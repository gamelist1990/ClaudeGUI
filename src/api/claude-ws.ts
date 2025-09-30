import {
  StartClaudeArgs,
  SendInputArgs,
  StartClaudeResponse,
  StopClaudeResponse,
  StatusResponse,
  GreetResponse,
} from "./types";

// Use Vite env var prefix VITE_ for client-side access via import.meta.env
const WS_URL = (import.meta.env.VITE_CLAUDE_WS_URL as string) || "ws://127.0.0.1:9234";

function waitForOpen(ws: WebSocket, timeout = 3000): Promise<void> {
  return new Promise((res, rej) => {
    if (ws.readyState === ws.OPEN) return res();
    const to = setTimeout(() => {
      ws.close();
      rej(new Error('ws open timeout'));
    }, timeout);
    ws.onopen = () => { clearTimeout(to); res(); };
    ws.onerror = (e) => { clearTimeout(to); rej(e); };
  });
}

function wsSend(payload: any, timeout = 5000): Promise<any> {
  return new Promise((res, rej) => {
    try {
      const ws = new WebSocket(WS_URL);
      let done = false;
      const cleanup = () => { try { ws.close(); } catch (e) {} };
      waitForOpen(ws).then(() => {
        ws.send(JSON.stringify(payload));
        const timer = setTimeout(() => {
          if (done) return;
          done = true;
          cleanup();
          rej(new Error('ws response timeout'));
        }, timeout);
        ws.onmessage = (ev) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try {
            const data = JSON.parse(ev.data as string);
            res(data);
          } catch (e) {
            res(ev.data);
          } finally {
            cleanup();
          }
        };
        ws.onerror = (e) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          cleanup();
          rej(e);
        };
      }).catch((err) => { try { ws.close(); } catch (e) {} rej(err); });
    } catch (e) { rej(e); }
  });
}

// Persistent connection for event subscriptions
let persistentWs: WebSocket | null = null;
const outSubscribers = new Set<(m: string) => void>();
const errSubscribers = new Set<(m: string) => void>();
let reconnectTimer: any = null;
let reconnectAttempts = 0;

function normalizeMessage(data: any) {
  // Support server shapes: { payload } or { text } or { raw }
  if (!data || typeof data !== 'object') return null;
  const t = data.type;
  const payload = data.payload ?? data.text ?? data.raw ?? null;
  return { type: t, payload };
}

function ensurePersistentWs() {
  if (persistentWs && (persistentWs.readyState === WebSocket.OPEN || persistentWs.readyState === WebSocket.CONNECTING)) return;
  reconnectAttempts = 0;
  const create = () => {
    persistentWs = new WebSocket(WS_URL);
    persistentWs.onopen = () => {
      // reset attempts on successful connect
      reconnectAttempts = 0;
    };
    persistentWs.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string);
        const msg = normalizeMessage(data);
        if (!msg) return;
        const { type, payload } = msg;
        if (type === 'stdout') {
          outSubscribers.forEach((cb) => cb(String(payload ?? '')));
        } else if (type === 'stderr') {
          errSubscribers.forEach((cb) => cb(String(payload ?? '')));
        } else if (type === 'mode' || type === 'thinking') {
          // forward as stdout for visibility by default
          outSubscribers.forEach((cb) => cb(String(payload ?? '')));
        }
      } catch (e) {
        // ignore non-json messages
      }
    };
    persistentWs.onerror = () => {
      // swallow; reconnection handled in onclose
    };
    persistentWs.onclose = () => {
      persistentWs = null;
      if (outSubscribers.size === 0 && errSubscribers.size === 0) return;
      // reconnect with backoff
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 15000);
      reconnectTimer = setTimeout(() => { create(); }, delay);
    };
  };
  create();
}

export class ClaudeAPI {
  static async startClaude(args?: StartClaudeArgs): Promise<StartClaudeResponse> {
    const payload = { cmd: "start", args: args?.args ?? [], envs: args?.envs };
    return wsSend(payload);
  }

  static async stopClaude(): Promise<StopClaudeResponse> {
    return wsSend({ cmd: "stop" });
  }

  static async sendInput(args: SendInputArgs): Promise<void> {
    return wsSend({ cmd: "input", text: args.text });
  }

  static async getStatus(): Promise<StatusResponse> {
    return wsSend({ cmd: "status" });
  }

  static async greet(name: string): Promise<GreetResponse> {
    return wsSend({ cmd: "greet", name });
  }

  static onStdout(callback: (message: string) => void): Promise<() => void> {
    ensurePersistentWs();
    outSubscribers.add(callback);
    return Promise.resolve(() => {
      outSubscribers.delete(callback);
      if (outSubscribers.size === 0 && errSubscribers.size === 0 && persistentWs) {
        try { persistentWs.close(); } catch(e) {}
        persistentWs = null;
      }
    });
  }

  static onStderr(callback: (message: string) => void): Promise<() => void> {
    ensurePersistentWs();
    errSubscribers.add(callback);
    return Promise.resolve(() => {
      errSubscribers.delete(callback);
      if (outSubscribers.size === 0 && errSubscribers.size === 0 && persistentWs) {
        try { persistentWs.close(); } catch(e) {}
        persistentWs = null;
      }
    });
  }
}

export const startClaude = ClaudeAPI.startClaude;
export const stopClaude = ClaudeAPI.stopClaude;
export const sendInput = ClaudeAPI.sendInput;
export const status = ClaudeAPI.getStatus;
export const onStdout = ClaudeAPI.onStdout;
export const onStderr = ClaudeAPI.onStderr;
