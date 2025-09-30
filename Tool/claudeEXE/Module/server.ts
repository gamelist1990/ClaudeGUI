import * as wsLib from 'ws';
import { safeJSON, appendLog, logFilePath } from './utils';
import { spawnClaude, stopClaude, sendInputToClaude, isRunning } from './processManager';
import * as fs from 'fs';
import * as path from 'path';

// Use a lightweight any-typed wrapper for the ws library to avoid depending on
// tsconfig/ambient settings in this module while keeping ESM imports.
const WebSocket: any = wsLib as any;
type WSServer = any;

const DEFAULT_CLAUDE_BIN = process.env.CLAUDE_BIN || path.join(__dirname, '..', 'claude.exe');

let wss: WSServer | null = null;
let logWatcherInterval: NodeJS.Timeout | null = null;

function broadcast(obj: any) {
    const s = safeJSON(obj);
    if (!wss) return;
    const clients = (wss.clients && Array.from(wss.clients)) || [];
    clients.forEach((c: any) => { if (c && c.readyState === WebSocket.OPEN) c.send(s); });
}

function onData(chunk: string, isErr = false) {
    appendLog(chunk);
    const s = chunk.replace(/\r/g, '');
    const lines = s.split('\n').filter(Boolean);
    for (let line of lines) {
        const trimmed = line.trim();
        const modeMatch = trimmed.match(/⏵⏵\s*([^\(]+)/);
        if (modeMatch) {
            const textMode = modeMatch[1].trim().toLowerCase();
            let mode = 'normal';
            if (textMode.includes('bypass')) mode = 'bypass';
            else if (textMode.includes('yolo')) mode = 'yolo';
            broadcast({ type: 'mode', mode, raw: trimmed });
            continue;
        }
        if (/Thinking\s+on/i.test(trimmed)) { broadcast({ type: 'thinking', value: true, raw: trimmed }); continue; }
        if (/Thinking\s+off/i.test(trimmed)) { broadcast({ type: 'thinking', value: false, raw: trimmed }); continue; }
        broadcast({ type: isErr ? 'stderr' : 'stdout', text: trimmed, raw: trimmed });
    }
}

export function setupWSS(port: number) {
    wss = new WebSocket.Server({ port }, () => console.log('claude ws-server listening on', port));
    wss.on('connection', (ws: any) => {
        ws.on('message', (msg: any) => {
            let data: any = null;
            try { data = JSON.parse(String(msg)); } catch (e) { return; }
            switch (data.cmd) {
                case 'start':
                    // determine executable path: prefer provided, otherwise use default
                    const exe = data.executable && data.executable.length ? data.executable : DEFAULT_CLAUDE_BIN;
                    ws.send(safeJSON(spawnClaude(exe, data.args || [], data.working_dir, onData)));
                    break;
                case 'stop':
                    ws.send(safeJSON(stopClaude()));
                    break;
                case 'input':
                    ws.send(safeJSON(sendInputToClaude(data.text || '')));
                    break;
                case 'status':
                    ws.send(safeJSON({ running: isRunning(), pid: null }));
                    break;
                default:
                    ws.send(safeJSON({ ok: false, msg: 'unknown cmd' }));
            }
        });
            ws.send(safeJSON({ type: 'hello', pid: null }));
    });
}

export function watchLogFile() {
    if (logWatcherInterval) return;
    let lastSize = 0;
    try { lastSize = fs.statSync(logFilePath).size; } catch (e) { lastSize = 0; }
    logWatcherInterval = setInterval(() => {
        try {
            const st = fs.statSync(logFilePath);
            if (st.size > lastSize) {
                const buf = fs.readFileSync(logFilePath, { encoding: 'utf8' });
                const appended = buf.slice(lastSize);
                lastSize = st.size;
                onData(appended, false);
            } else if (st.size < lastSize) {
                lastSize = st.size;
            }
        } catch (e) { }
    }, 250);
}

export function stopServer() {
    if (wss) { try { wss.close(); } catch (e) { } wss = null; }
    if (logWatcherInterval) { clearInterval(logWatcherInterval); logWatcherInterval = null; }
    stopClaude();
}
