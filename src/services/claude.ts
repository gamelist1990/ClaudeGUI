import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export async function startClaude(args?: string[], envs?: Record<string, string>, working_dir?: string, executable?: string, visible?: boolean) {
  return invoke("start_claude", { args: args ?? [], envs, working_dir, executable, visible: visible ?? true });
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

export async function getOutput() {
  return invoke("get_claude_output");
}

export function onStdout(cb: (msg: string) => void): Promise<UnlistenFn> {
  return listen("claude-stdout", (e) => cb(String(e.payload)));
}

export function onStderr(cb: (msg: string) => void): Promise<UnlistenFn> {
  return listen("claude-stderr", (e) => cb(String(e.payload)));
}
