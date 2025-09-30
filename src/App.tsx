import { useEffect, useRef, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import "./css/theme.css";
import { Composer, MarkdownView, Message } from "./components";
import Settings from './settings';

type Message = MessageType;

export default function App() {
  // old tab state removed in redesign
  const [, setRunning] = useState(false); // Start/Stopボタンで使用
  const [messages, setMessages] = useState<Message[]>([]);
  const [envBaseUrl, setEnvBaseUrl] = useState<string>(
    localStorage.getItem("ANTHROPIC_BASE_URL") ?? ""
  );
  const messagesRef = useRef<HTMLDivElement | null>(null);

  // Think mode state (思考モード)
  const [thinkMode, setThinkMode] = useState(false);
  // Mode cycling for session behavior. Alt+M to cycle.
  const modes = ["normal", "bypass", "yolo"] as const;
  type Mode = (typeof modes)[number];
  const [mode, setMode] = useState<Mode>((localStorage.getItem("claude_mode") as Mode) ?? "normal");
  const [settingsVisible, setSettingsVisible] = useState(false);


  useEffect(() => {
    let unlistenOut: UnlistenFn | null = null;
    let unlistenErr: UnlistenFn | null = null;

    (async () => {
      unlistenOut = await ClaudeAPI.onStdout((payload) => {
        appendMessage({ id: String(Date.now()) + "-o", source: "claude", text: payload });
      });
      unlistenErr = await ClaudeAPI.onStderr((payload) => {
        appendMessage({ id: String(Date.now()) + "-e", source: "stderr", text: payload });
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

  // Listen for Tab key to toggle Think mode, and Alt+M to cycle modes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Tab") {
        e.preventDefault();
        toggleThinkMode();
      }
      // Alt+M to cycle
      if (e.key.toLowerCase() === "m" && e.altKey) {
        e.preventDefault();
        cycleMode();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinkMode, mode]);

  function appendMessage(m: Message) {
    setMessages((s) => [...s, m]);
  }

  async function handleSend(text: string) {
    if (!text.trim()) return;
    appendMessage({ id: String(Date.now()), source: "user", text });
    try {
      const { sendInput } = await import("./services/claude");
      // Prefix GUI-sent messages with '> ' so backend sees as user message
      const out = text.startsWith('>') ? text : `> ${text}`;
      await sendInput(out);
    } catch (e: any) {
      appendMessage({ id: String(Date.now()), source: "stderr", text: String(e) });
    }
  }

  function cycleMode() {
    const idx = modes.indexOf(mode);
    const next = modes[(idx + 1) % modes.length];
    setMode(next);
    localStorage.setItem("claude_mode", next);
    appendMessage({ id: String(Date.now()), source: "claude", text: `(mode => ${next})` });
  }

  // Toggle Think mode and notify backend (special control messages)
  async function toggleThinkMode() {
    const newVal = !thinkMode;
    setThinkMode(newVal);
    try {
      const svc = await import("./services/claude");
      // send a control message so backend can detect Think-mode toggle
      await svc.sendInput(newVal ? "[[__THINK_ON__]]" : "[[__THINK_OFF__]]");
      appendMessage({ id: String(Date.now()), source: "claude", text: `(think mode ${newVal ? "ON" : "OFF"})` });
    } catch (e: any) {
      appendMessage({ id: String(Date.now()), source: "stderr", text: String(e) });
    }
  }

  async function startNewSession() {
    try {
      const svc = await import("./services/claude");
      // If running, stop first to ensure a fresh session
      const running = await svc.status();
      if (running) {
        await svc.stopClaude();
        appendMessage({ id: String(Date.now()), source: "claude", text: "(claude stopped for new session)" });
      }
      // build args depending on mode
      const args: string[] = [];
      if (mode === 'yolo') args.push('--dangerously-skip-permissions');
      // 'bypass' could be an alias to same flag or different; keep for future
      if (mode === 'bypass' && !args.includes('--dangerously-skip-permissions')) args.push('--dangerously-skip-permissions');
      await svc.startClaude(args, envBaseUrl ? { ANTHROPIC_BASE_URL: envBaseUrl } : undefined);
      appendMessage({ id: String(Date.now()), source: "claude", text: "(new claude session started)" });
      setRunning(true);
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

  // importConversations removed; import via History tab is not part of the new layout

  function loadConversations() {
    const convs = JSON.parse(localStorage.getItem("conversations" ) ?? "[]");
    return convs as Array<any>;
  }

  function applySettings() {
    localStorage.setItem("ANTHROPIC_BASE_URL", envBaseUrl);
    alert("Settings saved");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontWeight:700}}>Conversations</div>
          <div className="mode-chip">{mode.toUpperCase()}</div>
        </div>
        <div className="hint">New: Alt+M to cycle modes · Tab toggles Think</div>
        <div style={{height:12}} />
        {/* simple history preview */}
        {loadConversations().map((c: any) => (
          <div key={c.id} style={{padding:8,borderRadius:8,marginBottom:8,background:'rgba(255,255,255,0.02)'}}>
            <div style={{fontSize:12,fontWeight:700}}>Conversation {c.id}</div>
            <div style={{fontSize:12,color:'#9aa6b2'}}>{c.messages.length} messages</div>
          </div>
        ))}
      </aside>

      <header className="header">
        <div className="header-left">
          <div className="brand">Claude GUI</div>
          <div style={{marginLeft:8,color:'#9aa6b2'}}>軽量なGUIクライアント</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button className="btn btn--gray" onClick={() => { document.documentElement.classList.toggle('dark'); }}>Theme</button>
          <button className="btn btn--gray" onClick={toggleThinkMode}>{thinkMode ? '🤔 Think: ON' : '💡 Think: OFF'}</button>
          <button className="btn btn--white" onClick={startNewSession}>🔁 New Session</button>
          <button className="btn btn--gray" onClick={() => setSettingsVisible(true)}>⚙️</button>
        </div>
      </header>

      <main className="main">
        {mode === 'yolo' && <div className="warning">Yolo Mode enabled: --dangerously-skip-permissions will be passed when starting Claude.</div>}
        <div className="conversation-area">
          <div className="messages" ref={messagesRef}>
            {messages.map((m) => (
              <div key={m.id} className={`message-card ${m.source}`}>
                <div className="message-meta">{m.source} <span style={{marginLeft:8,color:'#8e9aa3',fontSize:12}}>{new Date(Number(m.id.split('-')[0]||Date.now())).toLocaleTimeString()}</span></div>
                <div className="message-text"><MarkdownView source={m.text} /></div>
              </div>
            ))}
          </div>

          <div className="composer-row">
            <Composer onSend={handleSend} mode={mode} thinkMode={thinkMode} />
            <div className="composer-controls">
              <button className="btn btn--white" onClick={saveConversation}>💾 Save</button>
              <button className="btn btn--gray" onClick={exportConversations}>⤓ Export</button>
            </div>
          </div>
        </div>
      </main>

      <aside className="right-pane">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontWeight:700}}>Session</div>
          <div className="mode-chip">{mode.toUpperCase()}</div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:13,color:'#9aa6b2'}}>Anthropic Base URL</div>
          <input value={envBaseUrl} onChange={(e) => setEnvBaseUrl(e.currentTarget.value)} style={{width:'100%',marginTop:8,padding:8,borderRadius:8,background:'transparent',border:'1px solid rgba(255,255,255,0.03)'}} />
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={applySettings}>Save</button>
          <button onClick={async () => { const svc = await import('./services/claude'); const running = await svc.status(); setRunning(Boolean(running)); if (running) { svc.stopClaude(); appendMessage({ id: String(Date.now()), source: 'claude', text: '(claude stopped)' }); } else { svc.startClaude([], envBaseUrl ? { ANTHROPIC_BASE_URL: envBaseUrl } : undefined); appendMessage({ id: String(Date.now()), source: 'claude', text: '(claude started)' }); } }}>Start/Stop</button>
        </div>
      </aside>
      <Settings
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        baseUrl={envBaseUrl}
        onSave={(u) => { setEnvBaseUrl(u); localStorage.setItem('ANTHROPIC_BASE_URL', u); }}
        yoloEnabled={mode === 'yolo'}
        onToggleYolo={(v) => { if (v) setMode('yolo'); else setMode('normal'); localStorage.setItem('claude_mode', v ? 'yolo' : 'normal'); }}
      />
    </div>
  );
}
