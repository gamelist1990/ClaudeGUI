import { invoke } from "@tauri-apps/api/tauri";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export async function startClaude(args?: string[], envs?: Record<string, string>) {
  return invoke("start_claude", { args: args ?? [], envs });
}

export async function stopClaude() {
  return invoke("stop_claude");
}

export async function sendInput(text: string) {
  return invoke("send_input", { text });
}

export async function status() {
  return invoke("status");
}

export function onStdout(cb: (msg: string) => void): Promise<UnlistenFn> {
  return listen("claude-stdout", (e) => cb(String(e.payload)));
}

export function onStderr(cb: (msg: string) => void): Promise<UnlistenFn> {
  return listen("claude-stderr", (e) => cb(String(e.payload)));
}
