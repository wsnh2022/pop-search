import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const logPath = path.join(app.isPackaged ? path.dirname(process.execPath) : app.getAppPath(), 'debug_log.txt');

export function logToFile(message) {
    try {
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
    } catch (e) {
        // console.error('Failed to write log', e);
    }
}
