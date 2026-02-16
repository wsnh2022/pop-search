# PopSearch - Code Patterns & Technical Debt

**Analysis Date:** 2025-02-15  
**Focus:** Cross-codebase patterns, conventions, and improvement areas

---

## Code Patterns

### 1. Module-Level State Management

**Pattern:** Singleton state variables at module top-level

**Examples:**
```javascript
// src/main/windowManager.js
let mainWindow = null;
let popupWindow = null;

// src/main/trayManager.js
let tray = null;

// src/main/ahkManager.js
let ahkProcess = null;

// src/renderer/settings/ui.js
let providers = Store.getProviders();
let categories = Store.getCategories();
let editingIndex = -1;
```

**Characteristics:**
- Single source of truth per module
- No class instances or complex state management
- Direct mutation pattern

**Trade-Offs:**
- **Pro:** Simple, no boilerplate, easy to debug
- **Con:** Not thread-safe (irrelevant for single-threaded JS)
- **Con:** Module coupling (state changes affect all consumers)

---

### 2. Error Logging Without Recovery

**Pattern:** Log errors but continue execution

**Examples:**
```javascript
// src/main/index.js
try {
    createTray();
} catch (err) {
    logToFile(`createTray failed: ${err.message}`);
    // Application continues without tray
}

// src/main/ipcHandlers.js
shell.openExternal(url).catch(err => {
    console.error(`Failed to open URL: ${err}`);
    // No user notification
});
```

**Characteristics:**
- Try-catch at feature boundaries
- Log to file, no user feedback
- Graceful degradation (features become unavailable)

**Trade-Offs:**
- **Pro:** Application doesn't crash on non-critical failures
- **Con:** Silent failures confuse users
- **Con:** No recovery mechanism

---

### 3. IPC Channel Constants

**Pattern:** Centralized string constants for all IPC channels

**Implementation:**
```javascript
// src/shared/constants.js
export const IPC_CHANNELS = {
    SHOW_POPUP: 'show-popup',
    SEARCH: 'search',
    SAVE_CONFIG: 'save-config'
    // ... 11 total channels
};

// Usage in main process
ipcMain.on(IPC_CHANNELS.SEARCH, handler);

// Usage in renderer
window.electronAPI.search = (provider, query) => 
    ipcRenderer.send(IPC_CHANNELS.SEARCH, { provider, query });
```

**Benefits:**
- Prevents typos ("serach" vs "search")
- Easy refactoring (change constant, updates everywhere)
- Single source of truth for communication protocol

---

### 4. Function Exposure via Window Global

**Pattern:** Expose renderer functions on `window` object for HTML onclick

**Implementation:**
```javascript
// src/renderer/settings/main.js
window.ui = {
    showSection, addProvider, editProvider,
    // ... 20+ functions
};

// HTML
<button onclick="window.ui.editProvider(0)">Edit</button>
```

**Issues:**
- Global namespace pollution
- No compile-time type checking
- Difficult to track usage
- CSP incompatible

---

### 5. Full Re-render on State Change

**Pattern:** Destroy and rebuild DOM on every update

**Implementation:**
```javascript
export function renderProviders() {
    container.innerHTML = '';  // Destroy all
    filteredProviders.forEach(p => {
        const div = createProviderElement(p, index);
        container.appendChild(div);  // Rebuild all
    });
}
```

**Triggers:**
- Provider add/edit/delete
- Search query change
- Category change
- Drag-and-drop reorder

**Performance Impact:**
- 40 providers = 200+ DOM elements destroyed/created
- Lost scroll position
- Interrupted animations
- Closed dropdowns

---

### 6. LocalStorage Direct Access

**Pattern:** Raw localStorage API with JSON serialization

**Implementation:**
```javascript
// Write
localStorage.setItem('searchProviders', JSON.stringify(providers));

// Read
const providers = JSON.parse(
    localStorage.getItem('searchProviders') || '[]'
);
```

**Abstraction Layer:**
```javascript
// src/renderer/settings/store.js
export const Store = {
    getProviders() {
        return JSON.parse(localStorage.getItem(...) || defaultValue);
    },
    saveProviders(arr) {
        localStorage.setItem(..., JSON.stringify(arr));
    }
};
```

**Benefits:**
- Synchronous API (no async/await needed)
- Built-in browser persistence
- Simple key-value model

**Limitations:**
- 5-10MB storage quota
- String-only values (requires JSON serialization)
- No transactions
- No schema validation

---

### 7. Prefix-Based Logging

**Pattern:** Include component name in log messages

**Examples:**
```javascript
logToFile(`[AHK Manager] Process started`);
logToFile(`[Window Manager] Creating popup at ${x}, ${y}`);
logToFile(`[Trigger Server] Request received`);
```

**Benefits:**
- Easy to filter logs by component
- Understand execution flow
- Debug multi-module interactions

**Inconsistencies:**
```javascript
logToFile(`[AHK Manager] Process started`);  // Consistent prefix
logToFile(`App starting...`);                // No prefix
logToFile(`CRITICAL: Icon missing`);         // No prefix
```

---

### 8. HTTP-Based External IPC

**Pattern:** Use HTTP server for communication with external processes

**Implementation:**
```javascript
// src/main/triggerServer.js
const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    if (url.pathname === '/search') {
        const query = url.searchParams.get('q');
        createPopup(query);
        res.writeHead(200);
        res.end('OK');
    }
});

server.listen(49152, '127.0.0.1');
```

**AutoHotkey Client:**
```ahk
whr := ComObject("WinHttp.WinHttpRequest.5.1")
whr.Open("GET", "http://127.0.0.1:49152/search?q=" . encodedText, false)
whr.Send()
```

**Benefits:**
- Simple protocol (HTTP GET)
- Universal client support
- Easy to test (browser, curl)
- Cross-language compatible

**Risks:**
- No authentication (localhost-only mitigation)
- Port conflicts (hardcoded 49152)
- Single-instance assumption

---

### 9. Async/Await for IPC Calls

**Pattern:** Use async functions for IPC operations with return values

**Implementation:**
```javascript
// Preload bridge
contextBridge.exposeInMainWorld('electronAPI', {
    saveConfig: (data) => ipcRenderer.invoke('save-config', data)
});

// Renderer usage
const result = await window.electronAPI.saveConfig(json);
if (result?.success) { /* ... */ }

// Main process handler
ipcMain.handle('save-config', async (event, data) => {
    const { filePath } = await dialog.showSaveDialog(...);
    if (filePath) {
        fs.writeFileSync(filePath, data);
        return { success: true };
    }
    return { success: false };
});
```

**Benefits:**
- Natural error propagation
- Return values without callback hell
- Sequential async operations

---

### 10. Factory Functions for Window Creation

**Pattern:** Factory functions that check for existing instances

**Implementation:**
```javascript
export function createMainWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        return mainWindow;  // Reuse existing
    }
    mainWindow = new BrowserWindow({...});
    return mainWindow;
}

export function createPopup(query, x, y) {
    if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.close();  // Destroy existing
    }
    popupWindow = new BrowserWindow({...});
    return popupWindow;
}
```

**Pattern Variation:**
- Settings window: Reuse (singleton)
- Popup window: Destroy and recreate

---

## Naming Conventions

### Files
```
camelCase.js           # JavaScript modules
kebab-case.md          # Documentation
PascalCase.exe         # Executables
```

### Functions
```
createWindow()         # Factory functions (verb + noun)
getMainWindow()        # Getters (get + noun)
updateTrayMenu()       # Updaters (update + noun)
renderProviders()      # Rendering (render + plural)
handleSearch()         # Event handlers (handle + event)
```

### Variables
```
mainWindow             # camelCase for local variables
IPC_CHANNELS           # SCREAMING_SNAKE_CASE for constants
let editingIndex       # State variables prefixed with description
```

### Components
```
windowManager          # Manager suffix for lifecycle management
triggerServer          # Server suffix for network services
Store                  # PascalCase for exported objects
```

---

## Technical Debt

### Critical (Blocks Features or Security)

**1. No Config Validation**
- **Issue:** Imported JSON not validated against schema
- **Risk:** XSS via malicious provider names/icons
- **Impact:** Security vulnerability
- **Fix Effort:** Medium (implement JSON schema validation)

**2. Port Conflict Silent Failure**
- **Issue:** HTTP server fails if port 49152 occupied
- **Risk:** AutoHotkey trigger stops working, no user notification
- **Impact:** Feature completely broken
- **Fix Effort:** Low (implement port fallback + error UI)

**3. Clipboard Interference**
- **Issue:** AHK script overwrites user clipboard on every trigger
- **Risk:** Data loss if user copies during 300ms window
- **Impact:** User experience degradation
- **Fix Effort:** Medium (implement selection detection)

---

### High (Performance or UX Issues)

**4. No Icon Caching**
- **Issue:** Fetches provider favicons from Google API on every render
- **Risk:** 40+ HTTP requests per render, network latency
- **Impact:** Slow UI, offline failure
- **Fix Effort:** Low (in-memory Map cache)

**5. Full DOM Re-render**
- **Issue:** Provider list destroyed and rebuilt on every change
- **Risk:** Lost scroll position, closed dropdowns
- **Impact:** Poor UX for large provider lists
- **Fix Effort:** High (virtual DOM or selective updates)

**6. Global Window Pollution**
- **Issue:** 20+ functions exposed on `window.ui`
- **Risk:** Name collisions, CSP violations
- **Impact:** Maintainability, security
- **Fix Effort:** Medium (refactor to programmatic event listeners)

---

### Medium (Code Quality)

**7. Inconsistent Logging Format**
- **Issue:** Log messages lack standard structure
- **Risk:** Difficult to parse logs programmatically
- **Impact:** Debugging efficiency
- **Fix Effort:** Low (standardize log format)

**8. Hardcoded Configuration**
- **Issue:** Port, timeouts, paths hardcoded
- **Risk:** Cannot adapt to different environments
- **Impact:** Limited flexibility
- **Fix Effort:** Low (extract to config file)

**9. No Unit Tests**
- **Issue:** Zero test coverage
- **Risk:** Regressions on refactoring
- **Impact:** Development velocity
- **Fix Effort:** High (establish test infrastructure)

---

### Low (Future Improvements)

**10. No Keyboard Navigation**
- **Issue:** Popup requires mouse interaction
- **Risk:** Accessibility issue
- **Impact:** Power user workflow
- **Fix Effort:** Medium (implement arrow key navigation)

**11. Single Log File**
- **Issue:** All logs in one file, no rotation by date
- **Risk:** Difficult to analyze historical issues
- **Impact:** Debugging efficiency
- **Fix Effort:** Low (date-based log files)

**12. Static Tray Menu**
- **Issue:** Tray menu never updates after creation
- **Risk:** Missed opportunity for dynamic features
- **Impact:** Feature potential
- **Fix Effort:** Low (call updateTrayMenu on provider changes)

---

## Code Smells

### 1. Magic Numbers

**Examples:**
```javascript
popupWindow = new BrowserWindow({ width: 400, height: 60 });  // No constants
ClipWait(0.3)  // 300ms hardcoded
if (PressDuration < 200) { /* ... */ }  // 200ms threshold
```

**Recommended:**
```javascript
const POPUP_WIDTH = 400;
const POPUP_HEIGHT = 60;
const CLIPBOARD_TIMEOUT_MS = 300;
const MOUSE_HOLD_THRESHOLD_MS = 200;
```

---

### 2. Callback Hell Avoided (Good)

**No Examples Found** - Codebase uses async/await consistently

---

### 3. Large Function Bodies

**Example: ui.js renderProviders() ~80 lines**
- Mixes: filtering, DOM creation, event attachment, drag setup
- Recommendation: Extract subfunctions

```javascript
function renderProviders() {
    const filtered = filterProviders(searchQuery);
    const elements = filtered.map(createProviderElement);
    attachEventListeners(elements);
    updateContainer(elements);
}
```

---

### 4. Conditional Complexity

**Example: popup.js getFilteredData()**
```javascript
const filteredProviders = enabledProviders.filter(p => {
    const cat = p.category || 'Unsorted';
    return showUnsorted || cat !== 'Unsorted';
});
```

**High Cyclomatic Complexity in:**
- `ui.js parseBulkImport()` - 3 format detection branches
- `popup.js handleWheelEvent()` - Multiple threshold checks
- `settings/ui.js initUI()` - Nested try-catch blocks

---

## Positive Patterns

### 1. Separation of Concerns

**Clear Module Boundaries:**
- `windowManager.js` - Only window lifecycle
- `ipcHandlers.js` - Only IPC routing
- `store.js` - Only persistence
- `bridge.js` - Only main process communication

---

### 2. Fail-Safe Defaults

**Examples:**
```javascript
const providers = JSON.parse(
    localStorage.getItem('searchProviders') || 
    JSON.stringify(DEFAULT_PROVIDERS)
);

const iconSize = localStorage.getItem('iconSize') || DEFAULT_APPEARANCE.iconSize;
```

---

### 3. Explicit Constants

**IPC_CHANNELS, DEFAULT_PROVIDERS, DEFAULT_CATEGORIES**
- Centralized definitions
- Easy to find and update
- Type-safe references

---

### 4. Graceful Degradation

**Missing Features Don't Crash:**
- No tray icon → App continues
- No AHK trigger → Manual launch still works
- HTTP server fails → Fallback to .exe args

---

## Recommendations Summary

### Immediate (Next Sprint)
1. Add JSON schema validation for config imports
2. Implement favicon caching in LocalStorage
3. Add user notification for HTTP server failures
4. Standardize logging format with timestamps

### Short-Term (1-2 Weeks)
5. Implement selection detection in AHK (no clipboard copy if no selection)
6. Add keyboard navigation for popup (arrow keys, Enter, Escape)
7. Refactor settings UI to programmatic event listeners (remove window.ui)
8. Extract magic numbers to named constants

### Long-Term (1-2 Months)
9. Implement virtual DOM or selective updates for provider list
10. Add unit test infrastructure (Jest + Testing Library)
11. Migrate to TypeScript for type safety
12. Implement plugin system for custom providers

---

## Next Steps

See `codebase-analysis-progress.md` for Phase 3 planning (Documentation & Recommendations)