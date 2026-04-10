import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { logToFile } from './logger.js';

function getStartupShortcutPath() {
    const startupFolder = path.join(
        app.getPath('appData'),
        'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
    );
    return path.join(startupFolder, 'NexusLauncher.lnk');
}

/**
 * Returns true if the startup shortcut currently exists in the Windows Startup folder.
 * Reads from the OS directly - never from a cache or store.
 */
export function getLaunchAtStartup() {
    return fs.existsSync(getStartupShortcutPath());
}

/**
 * Creates or removes the startup shortcut in the Windows Startup folder.
 * Works for both portable and installed builds.
 * Returns { success: true } or { success: false, error: string }.
 */
export function setLaunchAtStartup(enabled) {
    const shortcutPath = getStartupShortcutPath();
    try {
        if (enabled) {
            // PORTABLE_EXECUTABLE_FILE is set by electron-builder portable builds.
            // process.execPath on a portable points to a temp extraction folder
            // that disappears on exit - never use it as the shortcut target.
            const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;

            // Use -EncodedCommand (base64) to avoid all backslash/quote escaping issues.
            // PowerShell single-quoted strings are literal - no escape sequences exist.
            // Doubling backslashes via .replace() makes paths invalid. Base64 is the fix.
            const ps = [
                `$ws = New-Object -ComObject WScript.Shell`,
                `$s = $ws.CreateShortcut('${shortcutPath}')`,
                `$s.TargetPath = '${exePath}'`,
                `$s.WorkingDirectory = '${path.dirname(exePath)}'`,
                `$s.Save()`
            ].join('; ');

            const encoded = Buffer.from(ps, 'utf16le').toString('base64');
            execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`);
            logToFile(`[Startup] shortcut created → target: ${exePath}`);
        } else {
            if (fs.existsSync(shortcutPath)) {
                fs.unlinkSync(shortcutPath);
                logToFile(`[Startup] shortcut removed`);
            }
        }
        return { success: true };
    } catch (err) {
        logToFile(`[Startup] setLaunchAtStartup error: ${err.message}`);
        return { success: false, error: err.message };
    }
}
