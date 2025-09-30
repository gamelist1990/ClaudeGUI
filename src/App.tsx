import React, { useEffect, useState } from "react";
import { UnlistenFn } from "@tauri-apps/api/event";
import "./styles/theme.css";
import "./styles/components.css";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Header, Sidebar, ChatContainer, SettingsModal } from "./components";
import { ClaudeAPI } from "./api/claude";
import type { MessageType } from "./api";

type Message = MessageType;

const AppContent: React.FC = () => {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [envBaseUrl, setEnvBaseUrl] = useState<string>(
    localStorage.getItem("ANTHROPIC_BASE_URL") ?? ""
  );
  const [thinkMode, setThinkMode] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Mode cycling for session behavior. Alt+M to cycle.
  const modes = ["normal", "bypass", "yolo"] as const;
  type Mode = (typeof modes)[number];
  const [mode, setMode] = useState<Mode>(
    (localStorage.getItem("claude_mode") as Mode) ?? "normal"
  );


  // Event listeners setup
  useEffect(() => {
    let unlistenOut: UnlistenFn | null = null;
    let unlistenErr: UnlistenFn | null = null;

    (async () => {
      unlistenOut = await ClaudeAPI.onStdout((payload) => {
        appendMessage({ 
          id: String(Date.now()) + "-o", 
          source: "claude", 
          text: payload 
        });
      });
      unlistenErr = await ClaudeAPI.onStderr((payload) => {
        appendMessage({ 
          id: String(Date.now()) + "-e", 
          source: "stderr", 
          text: payload 
        });
      });
    })();

    return () => {
      if (unlistenOut) unlistenOut();
      if (unlistenErr) unlistenErr();
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Tab") {
        e.preventDefault();
        toggleThinkMode();
      }
      // Alt+M to cycle modes
      if (e.key.toLowerCase() === "m" && e.altKey) {
        e.preventDefault();
        cycleMode();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [thinkMode, mode]);

  // Helper functions
  function appendMessage(m: Message) {
    setMessages((s) => [...s, m]);
  }

  async function handleSendMessage(text: string) {
    if (!text.trim()) return;
    
    appendMessage({ 
      id: String(Date.now()), 
      source: "user", 
      text 
    });
    
    try {
      const { sendInput } = await import("./services/claude");
      // Prefix GUI-sent messages with '> ' so backend sees as user message
      const out = text.startsWith('>') ? text : `> ${text}`;
      await sendInput(out);
    } catch (e: any) {
      appendMessage({ 
        id: String(Date.now()), 
        source: "stderr", 
        text: String(e) 
      });
    }
  }

  function cycleMode() {
    const idx = modes.indexOf(mode);
    const next = modes[(idx + 1) % modes.length];
    setMode(next);
    localStorage.setItem("claude_mode", next);
    appendMessage({ 
      id: String(Date.now()), 
      source: "claude", 
      text: `(mode => ${next})` 
    });
  }

  // Toggle Think mode and notify backend (special control messages)
  async function toggleThinkMode() {
    const newVal = !thinkMode;
    setThinkMode(newVal);
    
    try {
      const svc = await import("./services/claude");
      // send a control message so backend can detect Think-mode toggle
      await svc.sendInput(newVal ? "[[__THINK_ON__]]" : "[[__THINK_OFF__]]");
      appendMessage({ 
        id: String(Date.now()), 
        source: "claude", 
        text: `(think mode ${newVal ? "ON" : "OFF"})` 
      });
    } catch (e: any) {
      appendMessage({ 
        id: String(Date.now()), 
        source: "stderr", 
        text: String(e) 
      });
    }
  }

  async function startNewSession() {
    try {
      const svc = await import("./services/claude");
      // If running, stop first to ensure a fresh session
      const running = await svc.status();
      if (running) {
        await svc.stopClaude();
        appendMessage({ 
          id: String(Date.now()), 
          source: "claude", 
          text: "(claude stopped for new session)" 
        });
      }
      
      // build args depending on mode
      const args: string[] = [];
      if (mode === 'yolo') args.push('--dangerously-skip-permissions');
      // 'bypass' could be an alias to same flag or different; keep for future
      if (mode === 'bypass' && !args.includes('--dangerously-skip-permissions')) {
        args.push('--dangerously-skip-permissions');
      }
      
      await svc.startClaude(
        args, 
        envBaseUrl ? { ANTHROPIC_BASE_URL: envBaseUrl } : undefined
      );
      appendMessage({ 
        id: String(Date.now()), 
        source: "claude", 
        text: "(new claude session started)" 
      });
      setIsRunning(true);
    } catch (e: any) {
      appendMessage({ 
        id: String(Date.now()), 
        source: "stderr", 
        text: String(e) 
      });
    }
  }

  function saveConversation() {
    if (messages.length === 0) return;
    const convs = JSON.parse(localStorage.getItem("conversations") ?? "[]");
    convs.push({ id: Date.now(), messages });
    localStorage.setItem("conversations", JSON.stringify(convs));
    // Show a better notification (could be replaced with a toast component)
    appendMessage({
      id: String(Date.now()),
      source: "claude",
      text: "✅ Conversation saved to history"
    });
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

  function loadConversations() {
    const convs = JSON.parse(localStorage.getItem("conversations") ?? "[]");
    return convs as Array<{ id: number; messages: Message[] }>;
  }

  function applySettings() {
    localStorage.setItem("ANTHROPIC_BASE_URL", envBaseUrl);
    appendMessage({
      id: String(Date.now()),
      source: "claude",
      text: "⚙️ Settings saved successfully"
    });
  }

  async function handleStartStop() {
    try {
      const svc = await import('./services/claude');
      const running = await svc.status();
      setIsRunning(Boolean(running));
      
      if (running) {
        await svc.stopClaude();
        appendMessage({ 
          id: String(Date.now()), 
          source: 'claude', 
          text: '⏹️ Claude stopped' 
        });
        setIsRunning(false);
      } else {
        const args: string[] = [];
        if (mode === 'yolo' || mode === 'bypass') {
          args.push('--dangerously-skip-permissions');
        }
        
        await svc.startClaude(
          args, 
          envBaseUrl ? { ANTHROPIC_BASE_URL: envBaseUrl } : undefined
        );
        appendMessage({ 
          id: String(Date.now()), 
          source: 'claude', 
          text: '▶️ Claude started' 
        });
        setIsRunning(true);
      }
    } catch (e: any) {
      appendMessage({
        id: String(Date.now()),
        source: "stderr",
        text: String(e)
      });
    }
  }

  return (
    <div className="app-layout">
      <Sidebar
        conversations={loadConversations()}
        mode={mode}
        baseUrl={envBaseUrl}
        onBaseUrlChange={setEnvBaseUrl}
        onApplySettings={applySettings}
        onStartStop={handleStartStop}
        isRunning={isRunning}
      />
      
      <Header
        onNewSession={startNewSession}
        onSettings={() => setSettingsVisible(true)}
        thinkMode={thinkMode}
        onToggleThink={toggleThinkMode}
        mode={mode}
      />
      
      <ChatContainer
        messages={messages}
        onSendMessage={handleSendMessage}
        mode={mode}
        thinkMode={thinkMode}
        onSaveConversation={saveConversation}
        onExportConversations={exportConversations}
      />
      
      <SettingsModal
        isOpen={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        baseUrl={envBaseUrl}
        onSave={(url) => {
          setEnvBaseUrl(url);
          localStorage.setItem('ANTHROPIC_BASE_URL', url);
        }}
        yoloEnabled={mode === 'yolo'}
        onToggleYolo={(enabled) => {
          const newMode = enabled ? 'yolo' : 'normal';
          setMode(newMode);
          localStorage.setItem('claude_mode', newMode);
        }}
      />
    </div>
  );
};

// Main App component with Theme Provider
export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
