import { ipcMain, BrowserWindow, dialog, clipboard, Menu, app, nativeTheme, screen } from 'electron';
import fs from 'fs';
import { exec } from 'child_process';
import { IPC_CHANNELS } from '../shared/constants';
import { getMainWindow, getPopupWindow, createPopup } from './windowManager.js';
import { updateTrayMenu } from './trayManager.js';

export function registerIpcHandlers() {
    ipcMain.on(IPC_CHANNELS.SHOW_POPUP, (event, data) => {
        const { text, x, y } = data;
        createPopup(text, x, y);
    });

    ipcMain.on(IPC_CHANNELS.RESIZE_POPUP, (event, { width, height }) => {
        const popupWindow = getPopupWindow();
        if (popupWindow && !popupWindow.isDestroyed()) {
            const w = Math.ceil(width);
            const h = Math.ceil(height);
            popupWindow.setSize(w, h);

            // Adjust position if it goes off-screen after resize
            const [x, y] = popupWindow.getPosition();
            const display = screen.getDisplayNearestPoint({ x, y });
            const bounds = display.workArea;

            let newX = Math.max(bounds.x, Math.min(x, bounds.x + bounds.width - w));
            let newY = Math.max(bounds.y, Math.min(y, bounds.y + bounds.height - h));

            if (newX !== x || newY !== y) {
                popupWindow.setPosition(newX, newY);
            }
        }
    });


    ipcMain.on(IPC_CHANNELS.SEARCH, (event, { provider, query }) => {
        const searchUrl = provider.replace(/%s|{query}/g, encodeURIComponent(query));
        openInBrowser(searchUrl);
        closePopup();
    });

    ipcMain.on(IPC_CHANNELS.COPY_AND_SEARCH, (event, { provider, query }) => {
        clipboard.writeText(query);
        const searchUrl = provider.replace(/%s|{query}/g, encodeURIComponent(query));
        openInBrowser(searchUrl);
        closePopup();
    });

    ipcMain.on(IPC_CHANNELS.LOG, (event, message) => {
        console.log(`[Renderer Log] ${message}`);
    });

    ipcMain.on(IPC_CHANNELS.RELOAD, () => {
        const mainWindow = getMainWindow();
        const popupWindow = getPopupWindow();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
        if (popupWindow && !popupWindow.isDestroyed()) popupWindow.reload();
    });

    ipcMain.on(IPC_CHANNELS.MINIMIZE, () => {
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
    });

    ipcMain.on(IPC_CHANNELS.CLOSE, () => {
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
    });

    ipcMain.on(IPC_CHANNELS.SET_THEME, () => {
        console.log(`[Main Theme] Forcing theme to dark`);
        nativeTheme.themeSource = 'dark';
        updateTrayMenu(); // Rebuild tray menu with dark theme
    });

    ipcMain.on(IPC_CHANNELS.CONTEXT_MENU, (event) => {
        console.log(`[Main Menu] Creating context menu. Current nativeTheme.themeSource: ${nativeTheme.themeSource}`);
        // Aggressively ensure themeSource is set for native menus
        if (!nativeTheme.themeSource || nativeTheme.themeSource === 'system') {
            console.log('[Main Menu] themeSource was system/null, keeping it for now.');
        }

        const template = [
            {
                label: 'Reload',
                click: () => {
                    console.log('[Main Menu] Reloading windows...');
                    const mainWindow = getMainWindow();
                    const popupWindow = getPopupWindow();
                    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
                    if (popupWindow && !popupWindow.isDestroyed()) {
                        popupWindow.reload();
                    }
                }
            },
            {
                label: 'Settings',
                click: () => {
                    const mainWindow = getMainWindow();
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            { type: 'separator' },
            { label: 'Quit', click: () => app.quit() }
        ];
        const menu = Menu.buildFromTemplate(template);
        menu.popup(BrowserWindow.fromWebContents(event.sender));
    });

    ipcMain.handle(IPC_CHANNELS.SAVE_CONFIG, async (event, data) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        const { filePath } = await dialog.showSaveDialog(window, {
            title: 'Export Configuration',
            defaultPath: 'pop_search_config.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });

        if (filePath) {
            try {
                fs.writeFileSync(filePath, data, 'utf-8');
                if (window && !window.isDestroyed()) window.focus(); // Ensure focus returns
                return { success: true };
            } catch (err) {
                console.error('Save error:', err);
                if (window && !window.isDestroyed()) window.focus(); // Ensure focus returns
                return { success: false, error: err.message };
            }
        }
        if (window && !window.isDestroyed()) window.focus(); // Ensure focus returns
        return { success: false, canceled: true };
    });

    ipcMain.handle(IPC_CHANNELS.LOAD_CONFIG, async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        const { canceled, filePaths } = await dialog.showOpenDialog(window, {
            title: 'Import Configuration',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile']
        });

        if (!canceled && filePaths.length > 0) {
            if (window && !window.isDestroyed()) window.focus(); // Ensure focus returns
            return fs.readFileSync(filePaths[0], 'utf-8');
        }
        if (window && !window.isDestroyed()) window.focus(); // Ensure focus returns
        return null;
    });

    ipcMain.on(IPC_CHANNELS.OPEN_EXTERNAL, (event, url) => {
        openInBrowser(url);
    });
}

function openInBrowser(url) {
    if (process.platform === 'win32') {
        exec(`start chrome "${url}"`);
    } else if (process.platform === 'darwin') {
        exec(`open -a "Google Chrome" "${url}"`);
    } else {
        exec(`google-chrome "${url}" || chromium-browser "${url}"`);
    }
}

function closePopup() {
    const popupWindow = getPopupWindow();
    if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.close();
    }
}
