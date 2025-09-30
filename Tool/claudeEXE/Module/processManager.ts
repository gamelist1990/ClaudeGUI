import { spawn, ChildProcess } from 'child_process';
import { ensureLogExists, appendLog } from './utils';
import * as path from 'path';

export type DataHandler = (text: string, isErr?: boolean) => void;

let child: ChildProcess | null = null;

export function isRunning() {
  return !!child;
}

export function spawnClaude(binPath: string, args: string[] = [], cwd?: string, onData?: DataHandler) {
  if (child) return { ok: false, msg: 'already running' };
  ensureLogExists();
  const cwdDir = cwd || path.dirname(binPath);
  child = spawn(binPath, args, { cwd: cwdDir });
  if (child.stdout) child.stdout.on('data', (b) => onData && onData(String(b), false));
  if (child.stderr) child.stderr.on('data', (b) => onData && onData(String(b), true));
  child.on('close', (code) => { if (onData) onData(JSON.stringify({ type: 'process', action: 'closed', code })); child = null; });
  child.on('error', (err) => { if (onData) onData(JSON.stringify({ type: 'process', action: 'error', error: String(err) })); child = null; });
  return { ok: true, pid: child.pid };
}

export function stopClaude() {
  if (!child) return { ok: false, msg: 'not running' };
  try { child.kill(); } catch (e) { /* noop */ }
  child = null;
  return { ok: true };
}

export function sendInputToClaude(text: string) {
  if (!child) return { ok: false, msg: 'not running' };
  if (child.stdin && !child.stdin.destroyed) {
    child.stdin.write(text + '\n');
    return { ok: true };
  }
  return { ok: false, msg: 'stdin unavailable' };
}
