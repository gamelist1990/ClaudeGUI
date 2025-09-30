import * as fs from 'fs';
import * as path from 'path';

export function safeJSON(obj: any): string {
  try { return JSON.stringify(obj); } catch (e) { return '{}'; }
}

// log file is one level up from Module directory
export const logFilePath = path.join(__dirname, '..', 'log.txt');

export function appendLog(chunk: string) {
  try { fs.appendFileSync(logFilePath, chunk); } catch (e) { /* noop */ }
}

export function ensureLogExists() {
  try { fs.writeFileSync(logFilePath, '', { flag: 'a' }); } catch (e) { /* noop */ }
}
