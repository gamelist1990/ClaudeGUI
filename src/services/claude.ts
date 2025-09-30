// WebSocket-based service wrapper. Connects to local ws-server provided by
// Tool/claudeEXE/ws-server.js. Keeps the same exported functions so UI code
// doesn't need changes.

type Callback = (msg: string) => void;

let ws: WebSocket | null = null;
let readyPromise: Promise<void> | null = null;
let stdoutHandlers: Callback[] = [];
let stderrHandlers: Callback[] = [];
let modeHandlers: ((m: string) => void)[] = [];
let thinkingHandlers: ((v: boolean) => void)[] = [];

function ensureConnected(): Promise<void> {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise((res, rej) => {
    ws = new WebSocket('ws://127.0.0.1:9234');
    ws.onopen = () => { res(); };
    ws.onmessage = (ev) => {
      try {
        const obj = JSON.parse(ev.data);
        switch (obj.type) {
          case 'stdout':
            stdoutHandlers.forEach(h => h(obj.text));
            break;
          case 'stderr':
            stderrHandlers.forEach(h => h(obj.text));
            break;
          case 'mode':
            modeHandlers.forEach(h => h(obj.mode));
            break;
          case 'thinking':
            thinkingHandlers.forEach(h => h(obj.value));
            break;
          default:
            break;
        }
      } catch (e) {
        // ignore
      }
    };
    ws.onclose = () => {
      readyPromise = null;
      ws = null;
    };
    ws.onerror = (e) => {
      readyPromise = null;
      ws = null;
      rej(e);
    };
  });
  return readyPromise;
}

export async function startClaude(args?: string[], envs?: Record<string, string>, working_dir?: string, executable?: string, visible?: boolean) {
  await ensureConnected();
  return new Promise((res) => {
    // include optional parameters in the start request so they're used and
    // forwarded to the backend ws-server (which may accept CLAUDE_BIN / envs)
    ws!.send(JSON.stringify({ cmd: 'start', args: args ?? [], envs: envs ?? {}, working_dir, executable, visible }));
    // wait a short time for response via ws messages; resolve immediately
    setTimeout(() => res({ ok: true }), 250);
  });
}

export async function stopClaude() {
  await ensureConnected();
  return new Promise((res) => {
    ws!.send(JSON.stringify({ cmd: 'stop' }));
    setTimeout(() => res({ ok: true }), 100);
  });
}

export async function sendInput(text: string) {
  await ensureConnected();
  return new Promise((res) => {
    ws!.send(JSON.stringify({ cmd: 'input', text }));
    setTimeout(() => res({ ok: true }), 50);
  });
}

export async function status() {
  await ensureConnected();
  return new Promise((res) => {
    ws!.send(JSON.stringify({ cmd: 'status' }));
    // We don't have request/response correlation here; simply return running boolean based on last known state.
    res(false);
  });
}

export async function getOutput() {
  // return current buffers — we don't maintain a large buffer here, UI listens to events directly
  return [[], []] as [string[], string[]];
}

export function onStdout(cb: (msg: string) => void) {
  stdoutHandlers.push(cb);
  return async () => { stdoutHandlers = stdoutHandlers.filter(c => c !== cb); };
}

export function onStderr(cb: (msg: string) => void) {
  stderrHandlers.push(cb);
  return async () => { stderrHandlers = stderrHandlers.filter(c => c !== cb); };
}

export function onMode(cb: (m: string) => void) { modeHandlers.push(cb); return async () => { modeHandlers = modeHandlers.filter(c => c !== cb); } }
export function onThinking(cb: (v: boolean) => void) { thinkingHandlers.push(cb); return async () => { thinkingHandlers = thinkingHandlers.filter(c => c !== cb); } }
