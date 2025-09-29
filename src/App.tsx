import React, { useEffect, useRef, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import "./App.css";
import { Composer, MarkdownView, Message } from "./components";

type Message = {
  id: string;
  source: "user" | "claude" | "stderr";
  text: string;
};


export default function App() {
  const [tab, setTab] = useState<"conversation" | "history" | "settings">("conversation");
  const [, setRunning] = useState(false); // Start/Stopボタンで使用
  const [messages, setMessages] = useState<Message[]>([]);
  const [envBaseUrl, setEnvBaseUrl] = useState<string>(
    localStorage.getItem("ANTHROPIC_BASE_URL") ?? ""
  );
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let unlistenOut: UnlistenFn | null = null;
    let unlistenErr: UnlistenFn | null = null;

    (async () => {
      unlistenOut = await listen("claude-stdout", (e) => {
        const payload = (e.payload as any) ?? "";
        appendMessage({ id: String(Date.now()) + "-o", source: "claude", text: String(payload) });
      });
      unlistenErr = await listen("claude-stderr", (e) => {
        const payload = (e.payload as any) ?? "";
        appendMessage({ id: String(Date.now()) + "-e", source: "stderr", text: String(payload) });
      });
    })();

    return () => {
      if (unlistenOut) unlistenOut();
      if (unlistenErr) unlistenErr();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  function appendMessage(m: Message) {
    setMessages((s) => [...s, m]);
  }

  async function handleSend(text: string) {
    if (!text.trim()) return;
    appendMessage({ id: String(Date.now()), source: "user", text });
    try {
      const { sendInput } = await import("./services/claude");
      await sendInput(text);
    } catch (e: any) {
      appendMessage({ id: String(Date.now()), source: "stderr", text: String(e) });
    }
  }

  function saveConversation() {
    if (messages.length === 0) return;
    const convs = JSON.parse(localStorage.getItem("conversations" ) ?? "[]");
    convs.push({ id: Date.now(), messages });
    localStorage.setItem("conversations", JSON.stringify(convs));
    alert("Saved conversation to history");
  }

  function exportConversations() {
    const data = localStorage.getItem("conversations") ?? "[]";
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "conversations.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importConversations(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result ?? "[]"));
        localStorage.setItem("conversations", JSON.stringify(json));
        alert("Imported conversations");
      } catch (err) {
        alert("Invalid file");
      }
    };
    reader.readAsText(file);
  }

  function loadConversations() {
    const convs = JSON.parse(localStorage.getItem("conversations" ) ?? "[]");
    return convs as Array<any>;
  }

  function applySettings() {
    localStorage.setItem("ANTHROPIC_BASE_URL", envBaseUrl);
    alert("Settings saved");
  }

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="title">Claude GUI</div>
        <div className="controls">
          <button onClick={() => { document.documentElement.classList.toggle('dark'); }}>Toggle Theme</button>
          <button onClick={async () => { const svc = await import('./services/claude'); const running = await svc.status(); setRunning(Boolean(running)); if (running) { svc.stopClaude(); appendMessage({ id: String(Date.now()), source: 'claude', text: '(claude stopped)' }); } else { svc.startClaude([], envBaseUrl ? { ANTHROPIC_BASE_URL: envBaseUrl } : undefined); appendMessage({ id: String(Date.now()), source: 'claude', text: '(claude started)' }); } }}>Start/Stop</button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === "conversation" ? "active" : ""} onClick={() => setTab("conversation")}>Conversation</button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History</button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>Settings</button>
      </nav>

      <main className="main-area">
        {tab === "conversation" && (
          <section className="conversation">
            <div className="message-list" ref={messagesRef}>
              {messages.map((m) => (
                <div key={m.id} className={`message ${m.source}`}>
                  <div className="meta">{m.source}</div>
                  <div className="text"><MarkdownView source={m.text} /></div>
                </div>
              ))}
            </div>

            <Composer onSend={handleSend} />
            <div style={{display:'flex', gap:8}}>
              <button onClick={saveConversation}>Save</button>
              <button onClick={exportConversations}>Export</button>
            </div>
          </section>
        )}

        {tab === "history" && (
          <section className="history">
            <div className="history-controls">
              <button onClick={exportConversations}>Export</button>
              <input type="file" accept="application/json" onChange={importConversations} />
            </div>
            <div className="history-list">
              {loadConversations().map((c: any) => (
                <div key={c.id} className="history-item">
                  <div>Conversation {c.id}</div>
                  <div className="history-preview">
                    {c.messages.slice(-5).map((m: any, idx: number) => (
                      <div key={idx} className={`preview ${m.source}`}><MarkdownView source={m.text} /></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="settings">
            <label>ANTHROPIC_BASE_URL</label>
            <input value={envBaseUrl} onChange={(e) => setEnvBaseUrl(e.currentTarget.value)} placeholder="http://localhost:4000/anthropic/claude" />
            <div className="settings-actions">
              <button onClick={applySettings}>Save</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
