
import { setupWSS, watchLogFile, stopServer as stopServerImpl } from './Module/server';
import * as path from 'path';

const PORT = process.env.CLAUDE_WS_PORT ? parseInt(process.env.CLAUDE_WS_PORT) : 9234;
const CLAUDE_BIN = process.env.CLAUDE_BIN || path.join(__dirname, 'claude.exe');

export function startServer(options: { port?: number; claudeBin?: string } = {}) {
    const port = options.port ?? PORT;
    // currently claudeBin is passed via environment or ws start command
    setupWSS(port);
    watchLogFile();
    return { ok: true, port };
}

export function stopServer() {
    stopServerImpl();
    return { ok: true };
}

export default { startServer, stopServer };

// Auto-start logic: if CLAUDE_AUTO_START=true or the script appears to be run
// directly (argv points at this file), start the server automatically.
try {
    const auto = process.env.CLAUDE_AUTO_START === 'true';
    const argvPath = process.argv && process.argv[1] ? process.argv[1] : '';
    const isDirectRun = argvPath.endsWith('index.ts') || argvPath.endsWith('index.js');
    if (auto || isDirectRun) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        startServer();
    }
} catch (e) {
    // ignore in constrained runtimes
}
