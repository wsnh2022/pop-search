# PopSearch - Developer Onboarding Guide

**Project:** PopSearch v1.2.0-beta  
**Last Updated:** 2025-02-15  
**Target Audience:** New developers joining the project

---

## Overview

PopSearch is an Electron-based desktop application providing instant search access via global hotkeys. This guide covers everything needed to start contributing effectively.

**Key Technologies:**
- Electron 40.2.1 (Chromium + Node.js)
- Vite 7.3.1 (build tool)
- AutoHotkey v2 (Windows global hotkeys)
- Vanilla JavaScript (no frontend frameworks)

---

## Prerequisites

### Required Software
```bash
# Node.js 18+ (includes npm)
node --version  # Should be >= 18.0.0

# AutoHotkey v2 (for building trigger script)
# Download: https://www.autohotkey.com/v2/
# Install to: C:\Program Files\AutoHotkey\

# Git
git --version
```

### Recommended Tools
- **VSCode** (or any code editor)
- **Windows Terminal** (better than cmd.exe)
- **Postman** or **curl** (for testing HTTP server)

---

## Initial Setup

### 1. Clone Repository
```bash
git clone https://github.com/the-thinker/popsearch-v1.git
cd popsearch-v1
```

### 2. Install Dependencies
```bash
npm install
```

**Expected Output:**
```
added 234 packages in 15s
```

### 3. Compile AutoHotkey Trigger
```bash
npm run build:ahk
```

**Expected Output:**
```
Successfully compiled: assets/pop_search_trigger.exe
```

**Troubleshooting:**
- If "Ahk2Exe.exe not found": Install AutoHotkey v2
- If path error: Verify AHK installed to default location

### 4. Start Development Server
```bash
npm run dev
```

**Expected Output:**
```
[vite] dev server running at http://localhost:5173
Electron started
Internal IPC server listening on http://127.0.0.1:49152
```

**What Happens:**
- Vite dev server starts (port 5173)
- Electron main process spawns
- Settings window opens automatically
- AutoHotkey trigger script starts
- HTTP server binds to port 49152

---

## Project Structure

### High-Level Organization
```
popsearch-v1/
├── src/                    # Source code
│   ├── main/              # Electron main process (Node.js)
│   ├── preload/           # Security bridge
│   ├── renderer/          # UI code (Chromium)
│   └── shared/            # Cross-process constants
│
├── .ahk/                  # AutoHotkey source
├── assets/                # Icons, compiled AHK exe
├── out/                   # Build output (gitignored)
├── dist/                  # Distribution packages (gitignored)
└── analysis/              # Codebase documentation
```

### Main Process (`src/main/`)
```
main/
├── index.js              # Entry point, app lifecycle
├── windowManager.js      # Window creation (settings, popup)
├── ipcHandlers.js        # IPC event routing
├── trayManager.js        # System tray integration
├── triggerServer.js      # HTTP server for AHK communication
├── ahkManager.js         # AHK process lifecycle
└── logger.js             # Logging wrapper (electron-log)
```

**Role:** System-level operations, file I/O, window management, IPC coordination

### Renderer Process (`src/renderer/`)
```
renderer/
├── popup/                # Search popup window
│   ├── index.html       # HTML structure
│   └── popup.js         # UI logic (provider rendering)
│
└── settings/             # Settings management window
    ├── index.html       # HTML structure
    ├── main.js          # Bootstrap (exposes functions to window)
    ├── ui.js            # DOM manipulation (967 lines)
    ├── store.js         # LocalStorage abstraction
    └── bridge.js        # IPC communication
```

**Role:** UI rendering, user interaction, configuration management

### Preload (`src/preload/`)
```
preload/
└── index.js              # Context bridge (security boundary)
```

**Role:** Exposes limited API from main process to renderer

### Shared (`src/shared/`)
```
shared/
└── constants.js          # IPC channels, defaults, schemas
```

**Role:** Cross-process constant definitions

---

## Architecture Overview

### Electron Multi-Process Model

**Main Process (Node.js)**
- Full OS access
- Window lifecycle management
- File system operations
- Entry point: `src/main/index.js`

**Renderer Process (Chromium)**
- Sandboxed browser context
- No Node.js access (security)
- UI rendering and user interaction
- Two windows: settings (persistent), popup (ephemeral)

**Preload Script (Bridge)**
- Runs before renderer
- Exposes whitelisted APIs via `contextBridge`
- Security boundary between main and renderer

### Communication Flow

**IPC (Inter-Process Communication):**
```javascript
// Renderer → Main
window.electronAPI.search(provider, query);
    ↓ IPC event
ipcMain.on('search', (event, { provider, query }) => { ... });

// Main → Renderer
popupWindow.webContents.send('selected-text', text);
    ↓ IPC event
window.electronAPI.onSelectedText((text) => { ... });
```

**HTTP (AutoHotkey → Electron):**
```
User presses CapsLock+S
    ↓
AHK script copies selected text
    ↓
HTTP GET http://127.0.0.1:49152/search?q={text}
    ↓
triggerServer.js receives request
    ↓
windowManager creates popup at cursor position
```

---

## Development Workflow

### Hot Reload Behavior

**Renderer Changes (popup.js, settings UI):**
- ✅ Auto-reload on save (Vite HMR)
- Fast feedback (<1 second)

**Main Process Changes (windowManager.js, etc.):**
- ❌ No auto-reload
- Manual restart required: `Ctrl+C` then `npm run dev`

**Preload Changes:**
- ❌ No auto-reload
- Manual restart required

**AutoHotkey Changes:**
- Must recompile: `npm run build:ahk`
- Must restart app to pick up new .exe

### Testing Changes

**Test Popup Trigger:**
1. Select some text in any application
2. Press `CapsLock + S` (or hold right mouse button)
3. Popup should appear at cursor position

**Test Settings UI:**
1. Application auto-opens settings window in dev mode
2. Make changes in `src/renderer/settings/ui.js`
3. Save file → Window reloads automatically

**Test HTTP Server:**
```bash
# In separate terminal
curl "http://127.0.0.1:49152/search?q=test"
# Should see popup appear
```

### Debugging

**Main Process (Node.js):**
```bash
# Console output shows in terminal
console.log('[Main] Debug message');
```

**Renderer Process (Chromium):**
```javascript
// Open DevTools: Right-click → Inspect
console.log('[Renderer] Debug message');
```

**Logs:**
```bash
# Log file location (Windows)
%APPDATA%\PopSearch Beta\logs\debug_log.txt

# Open log from settings window
# Settings → Advanced → Open Log File
```

---

## Common Development Tasks

### Add New Search Provider (Default)

**File:** `src/shared/constants.js`

```javascript
export const DEFAULT_PROVIDERS = [
    // Add new provider here
    {
        name: "New Engine",
        url: "https://example.com/search?q={query}",
        enabled: true,
        category: "Search",
        icon: ""  // Optional: URL or data URI
    },
    // ... existing providers
];
```

**Effect:** New installations get this provider by default

---

### Add New Category

**File:** `src/shared/constants.js`

```javascript
export const DEFAULT_CATEGORIES = {
    "NewCategory": "data:image/svg+xml;base64,...",  // SVG icon
    // Or use emoji
    "NewCategory": "🚀",
    // ... existing categories
};
```

**Update Provider:**
```javascript
{
    name: "Example",
    url: "...",
    category: "NewCategory",  // Reference new category
    // ...
}
```

---

### Add New IPC Channel

**1. Define Channel (`src/shared/constants.js`):**
```javascript
export const IPC_CHANNELS = {
    // Add new channel
    NEW_ACTION: 'new-action',
    // ... existing channels
};
```

**2. Register Handler (`src/main/ipcHandlers.js`):**
```javascript
import { IPC_CHANNELS } from '../shared/constants';

export function registerIpcHandlers() {
    ipcMain.on(IPC_CHANNELS.NEW_ACTION, (event, data) => {
        // Handle action
        console.log('[IPC] New action received:', data);
    });
    // ... existing handlers
}
```

**3. Expose in Preload (`src/preload/index.js`):**
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
    newAction: (data) => ipcRenderer.send(IPC_CHANNELS.NEW_ACTION, data),
    // ... existing APIs
});
```

**4. Call from Renderer:**
```javascript
// src/renderer/settings/ui.js or popup.js
window.electronAPI.newAction({ key: 'value' });
```

---

### Modify Popup Appearance

**File:** `src/renderer/popup/popup.js`

**Change Icon Size:**
```javascript
// Find this section in applyTheme()
const iconSize = parseInt(localStorage.getItem('iconSize') || '28');  // Default: 28px

// Or change default in constants.js
export const DEFAULT_APPEARANCE = {
    iconSize: '32',  // Change default to 32px
    // ...
};
```

**Change Grid Layout:**
```javascript
export const DEFAULT_APPEARANCE = {
    iconsPerRow: '10',  // Default: 8, increase to 10
    gridGapX: '15',     // Horizontal spacing
    gridGapY: '8',      // Vertical spacing
    // ...
};
```

---

### Modify Global Hotkey

**File:** `.ahk/pop_search_trigger.ahk`

**Change CapsLock+S to Win+Space:**
```ahk
; Remove old hotkey
; CapsLock & s::

; Add new hotkey
#Space::  ; Win + Space
{
    TriggerPopup()
}
```

**Recompile:**
```bash
npm run build:ahk
```

**Restart app to pick up changes**

---

## Build & Distribution

### Development Build
```bash
npm run build
```

**Output:** `out/` directory with compiled JavaScript

### Create Distribution Package
```bash
npm run dist
```

**Output:** `dist/` directory
- `PopSearch-Beta-Setup-1.2.0-beta.exe` (NSIS installer)
- `PopSearch-Beta-1.2.0-beta-portable.exe` (portable version)

**Build Time:** ~2-3 minutes (includes AHK compilation)

### Test Portable Build
```bash
# After npm run dist
cd dist
.\PopSearch-Beta-1.2.0-beta-portable.exe
```

---

## Troubleshooting

### Port 49152 Already in Use

**Symptom:** Popup doesn't trigger when pressing hotkey

**Cause:** Another application using port 49152

**Solution:**
```bash
# Find process using port (PowerShell)
Get-NetTCPConnection -LocalPort 49152

# Kill process
Stop-Process -Id <PID>
```

**Long-term Fix:** Modify port in `triggerServer.js`:
```javascript
server.listen(49153, '127.0.0.1');  // Change port
```

---

### AHK Trigger Not Working

**Symptom:** Hotkey does nothing

**Checklist:**
1. Verify `assets/pop_search_trigger.exe` exists
   ```bash
   ls assets/pop_search_trigger.exe
   ```

2. Check if AHK process running
   ```bash
   Get-Process | Select-String "pop_search_trigger"
   ```

3. Check logs
   ```
   %APPDATA%\PopSearch Beta\logs\debug_log.txt
   ```
   Look for: `[AHK Manager] Process started successfully`

4. Test HTTP server directly
   ```bash
   curl "http://127.0.0.1:49152/search?q=test"
   ```

---

### Popup Not Appearing

**Symptom:** HTTP server responds but no popup

**Debug Steps:**
```javascript
// Add to triggerServer.js
console.log('[Trigger Server] Creating popup for query:', query);

// Add to windowManager.js
console.log('[Window Manager] Popup created at', x, y);
```

**Check:**
- Is settings window focused? (Popup suppressed if settings has focus)
- Screen bounds calculation error? (Check multi-monitor setup)

---

### Settings Window Not Loading

**Symptom:** Blank white window on startup

**Cause:** Renderer build failure

**Solution:**
```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Reinstall dependencies
npm install

# Restart dev server
npm run dev
```

**Check DevTools Console:**
```
Right-click settings window → Inspect → Console tab
```
Look for JavaScript errors

---

## Code Style Guidelines

### Naming Conventions
```javascript
// Functions: camelCase, verb + noun
function createWindow() { }
function updateTrayMenu() { }

// Variables: camelCase, descriptive
let mainWindow = null;
const providers = [];

// Constants: SCREAMING_SNAKE_CASE
const IPC_CHANNELS = { ... };
const DEFAULT_APPEARANCE = { ... };

// Files: camelCase.js
windowManager.js
ipcHandlers.js
```

### Module Pattern
```javascript
// Module-level state (singleton pattern)
let moduleState = null;

// Export functions
export function initializeModule() { ... }
export function getState() { return moduleState; }

// Private helpers (not exported)
function internalHelper() { ... }
```

### Error Handling
```javascript
// Log errors, continue execution
try {
    createTray();
} catch (err) {
    logToFile(`[Component] Operation failed: ${err.message}`);
    // Application continues without tray
}

// Fail-safe defaults
const value = localStorage.getItem('key') || DEFAULT_VALUE;
```

### Logging Format
```javascript
// Consistent prefix pattern
logToFile(`[Component Name] Event description`);

// Examples
logToFile(`[Window Manager] Creating popup at ${x}, ${y}`);
logToFile(`[IPC Handler] Search triggered for query: ${query}`);
```

---

## Next Steps

### Explore Codebase
1. Read `analysis/architecture-analysis.md` for design patterns
2. Review `analysis/code-patterns.md` for coding conventions
3. Check `analysis/technical-recommendations.md` for improvement areas

### Make Your First Contribution
1. Pick a small task from `analysis/technical-recommendations.md`
2. Create feature branch: `git checkout -b feature/description`
3. Make changes following code style guidelines
4. Test thoroughly (manual + verify logs)
5. Submit pull request with clear description

### Learn More
- **Electron Docs:** https://electronjs.org/docs
- **Vite Docs:** https://vitejs.dev/guide/
- **AutoHotkey v2:** https://www.autohotkey.com/docs/v2/
- **electron-log:** https://github.com/megahertz/electron-log

---

## Getting Help

### Documentation
- `analysis/project-overview.md` - Technology stack and structure
- `analysis/architecture-analysis.md` - Design patterns and decisions
- `analysis/troubleshooting-guide.md` - Common issues and solutions

### Debugging Resources
- Main process: Terminal output
- Renderer: DevTools console (Right-click → Inspect)
- Logs: `%APPDATA%\PopSearch Beta\logs\debug_log.txt`

### Common Questions

**Q: How do I add a new provider?**  
A: Edit `src/shared/constants.js` DEFAULT_PROVIDERS array

**Q: Can I change the hotkey?**  
A: Yes, edit `.ahk/pop_search_trigger.ahk` and recompile

**Q: Where are user settings stored?**  
A: LocalStorage (Chromium) + `pop_search_config.json` export

**Q: How do I test without installing?**  
A: `npm run dev` runs directly in development mode

**Q: Why doesn't popup appear?**  
A: Check AHK process running, HTTP server on port 49152, logs for errors