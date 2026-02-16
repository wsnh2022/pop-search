# PopSearch v1.2.0-beta - Architecture Analysis

**Analysis Date:** 2025-02-15  
**Project:** frameless_popup_search_v3  
**Focus:** System design patterns, component relationships, and data flow

---

## Architecture Overview

PopSearch implements a **multi-process client-server architecture** with three distinct layers:

1. **Trigger Layer:** AutoHotkey global hotkey handler
2. **Main Process Layer:** Electron backend (Node.js runtime)
3. **Renderer Layer:** Frontend UI (Chromium browser contexts)

**Communication Flow:**
```
User Presses Win+W
    ↓
AutoHotkey Script (pop_search_trigger.exe)
    ↓ HTTP POST
Trigger Server (port 49152)
    ↓ IPC Event
Main Process (windowManager)
    ↓ IPC Channel
Popup Renderer (popup.js)
```

---

## Architectural Patterns

### 1. Multi-Process Architecture (Electron Standard)

**Pattern Type:** Process Isolation  
**Implementation:** Separate processes for main, preload, and renderer contexts

**Process Responsibilities:**

| Process | Runtime | API Access | Security Level | Purpose |
|---------|---------|------------|----------------|---------|
| Main | Node.js | Full OS | Privileged | Window management, file I/O, IPC coordination |
| Preload | Node.js (isolated) | Whitelisted | Restricted | Security bridge, API exposure |
| Renderer | Chromium | None | Sandboxed | UI rendering, user interaction |

**Security Boundaries:**
- **Context Isolation:** Renderer cannot access Node.js APIs directly
- **Explicit API Whitelisting:** Preload scripts expose only approved functions via `contextBridge`
- **IPC Message Validation:** Main process validates all incoming renderer requests

**Code Example (Preload Bridge):**
```javascript
// src/preload/index.js
contextBridge.exposeInMainWorld('electronAPI', {
  search: (provider, query) => ipcRenderer.send(IPC_CHANNELS.SEARCH, { provider, query }),
  // Only whitelisted APIs exposed
});
```

---

### 2. Event-Driven IPC (Inter-Process Communication)

**Pattern Type:** Message Passing  
**Implementation:** Electron IPC channels with centralized handler registration

**Channel Organization:**
```javascript
// src/shared/constants.js
export const IPC_CHANNELS = {
    SHOW_POPUP: 'show-popup',        // Trigger popup creation
    RESIZE_POPUP: 'resize-popup',    // Dynamic popup sizing
    SEARCH: 'search',                // Execute search action
    SAVE_CONFIG: 'save-config',      // File dialog operations
    // ... 11 total channels
};
```

**Communication Patterns:**

| Pattern | Use Case | Example |
|---------|----------|---------|
| One-way Send | Fire-and-forget actions | Minimize window, close popup |
| Request-Response | Async operations with return values | Save/load config dialogs |
| Event Broadcast | Main → Renderer notifications | Selected text delivery |

**Handler Registration (Main Process):**
```javascript
// src/main/ipcHandlers.js
export function registerIpcHandlers() {
    ipcMain.on(IPC_CHANNELS.SEARCH, (event, { provider, query }) => {
        const searchUrl = provider.replace(/%s|{query}/g, encodeURIComponent(query));
        shell.openExternal(searchUrl);
        closePopup();
    });
    // Centralized handler registration on app startup
}
```

---

### 3. Singleton Window Management

**Pattern Type:** Singleton + Factory  
**Implementation:** Single instance tracking with conditional creation

**Singleton Enforcement:**
```javascript
// src/main/windowManager.js
let mainWindow = null;
let popupWindow = null;

export function createMainWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        return mainWindow;  // Return existing instance
    }
    mainWindow = new BrowserWindow({...});  // Create only if needed
    return mainWindow;
}
```

**Window Lifecycle:**
- **Settings Window:** Created once at startup, hidden when closed (not destroyed)
- **Popup Window:** Created on demand, destroyed on blur or after search
- **Instance Reuse:** Settings window reused across multiple show/hide cycles

**Rationale:** Reduces memory allocation overhead and startup latency for frequent popup invocations.

---

### 4. HTTP-Based External IPC

**Pattern Type:** Microservice Communication  
**Implementation:** Localhost HTTP server for AutoHotkey integration

**Server Configuration:**
```javascript
// src/main/triggerServer.js
server.listen(49152, '127.0.0.1', () => {
    console.log('Internal IPC server listening on http://127.0.0.1:49152');
});
```

**Endpoints:**

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/search?q={text}` | GET | Trigger popup with query | 200 OK |
| `/settings` | GET | Show settings window | 200 OK |

**AutoHotkey Trigger Flow:**
```
1. User presses Win+W
2. AHK script sends clipboard content to http://127.0.0.1:49152/search?q={text}
3. Trigger server receives request
4. Main process creates popup at cursor position
5. Popup loads with pre-filled query
```

**Design Justification:**
- **Decoupling:** AHK script independent of Electron internals
- **Simplicity:** HTTP more universally supported than named pipes or TCP sockets
- **Localhost-Only:** Security constraint (no external network exposure)

---

### 5. Configuration-Driven UI

**Pattern Type:** Data-Driven Rendering  
**Implementation:** JSON configuration with LocalStorage persistence

**Configuration Flow:**
```
JSON File (pop_search_config.json)
    ↓ Read on startup
LocalStorage (renderer process)
    ↓ UI reads from storage
Dynamic Rendering (popup.js / settings UI)
    ↓ User modifications
Save Back to JSON
```

**Storage Layer (Dual Persistence):**
```javascript
// src/renderer/settings/store.js
export function saveAppearance(key, value) {
    localStorage.setItem(key, value);  // Immediate persistence
}

// File write via IPC (async)
export async function exportConfig() {
    const config = { appearance: {...}, providers: [...] };
    await window.electronAPI.saveConfig(JSON.stringify(config));
}
```

**Provider Schema:**
```json
{
  "name": "Google",
  "url": "https://www.google.com/search?q={query}",
  "enabled": true,
  "category": "Search",
  "icon": ""
}
```

**UI Generation Logic:**
```javascript
// src/renderer/popup/popup.js
function renderPopup() {
    const providers = getProviders();  // Read from LocalStorage
    providers
        .filter(p => p.enabled && p.category === currentCategory)
        .forEach(provider => {
            const icon = createIcon(provider);
            icon.onclick = () => search(provider.url, currentQuery);
            grid.appendChild(icon);
        });
}
```

---

## Component Relationships

### Dependency Graph

```
main/index.js (Entry Point)
    ├── windowManager.js
    │   ├── BrowserWindow (Electron)
    │   └── screen (Electron)
    │
    ├── ipcHandlers.js
    │   ├── shell (Electron)
    │   ├── dialog (Electron)
    │   └── windowManager.js
    │
    ├── trayManager.js
    │   ├── Tray (Electron)
    │   ├── Menu (Electron)
    │   └── windowManager.js
    │
    ├── triggerServer.js
    │   ├── http (Node.js)
    │   └── windowManager.js
    │
    ├── ahkManager.js
    │   ├── child_process (Node.js)
    │   └── fs (Node.js)
    │
    └── logger.js
        └── electron-log

preload/index.js
    ├── contextBridge (Electron)
    ├── ipcRenderer (Electron)
    └── shared/constants.js

renderer/popup/popup.js
    ├── preload API (window.electronAPI)
    └── shared/constants.js

renderer/settings/main.js
    ├── ui.js
    ├── store.js
    ├── bridge.js
    └── shared/constants.js
```

**Shared Dependencies:**
- **shared/constants.js:** Cross-process constant definitions (IPC channels, defaults)
- **electron-log:** Unified logging across main and renderer processes

---

## Data Flow Analysis

### 1. Popup Trigger Flow

**Initiator:** User presses Win+W with text selected

**Sequence:**
```
1. AutoHotkey Script
   - Captures Win+W keypress
   - Reads clipboard (selected text)
   - Sends HTTP GET to localhost:49152/search?q={text}

2. Trigger Server (main/triggerServer.js)
   - Receives request
   - Checks if settings window has focus (prevents popup during configuration)
   - Calls windowManager.createPopup(query, x, y)

3. Window Manager (main/windowManager.js)
   - Destroys existing popup if present
   - Calculates screen bounds to prevent off-screen positioning
   - Creates new BrowserWindow with query parameter

4. Popup Renderer (renderer/popup/popup.js)
   - Loads index.html
   - Preload script injects electronAPI
   - Listens for 'selected-text' IPC event
   - Receives query from main process
   - Renders provider icons from LocalStorage configuration

5. User Interaction
   - User clicks provider icon
   - popup.js sends SEARCH IPC event
   - Main process opens URL in default browser
   - Popup window closes
```

---

### 2. Configuration Persistence Flow

**Settings Window Operations:**

**Load Configuration:**
```
User clicks "Import Config"
    ↓
settings/bridge.js calls electronAPI.loadConfig()
    ↓
main/ipcHandlers.js opens file dialog
    ↓
User selects JSON file
    ↓
File read via fs.readFileSync()
    ↓
JSON returned to renderer
    ↓
settings/store.js parses and writes to LocalStorage
    ↓
settings/ui.js re-renders UI
```

**Save Configuration:**
```
User modifies appearance settings
    ↓
settings/store.js updates LocalStorage (immediate)
    ↓
User clicks "Export Config"
    ↓
settings/store.js aggregates all LocalStorage values
    ↓
JSON.stringify() creates config object
    ↓
IPC call to main process
    ↓
File dialog shown, user selects save location
    ↓
fs.writeFileSync() writes JSON to disk
```

---

### 3. Provider Rendering Flow

**Dynamic Icon Grid Generation:**

```
Popup Window Loads
    ↓
popup.js reads LocalStorage:
    - searchProviders (array)
    - searchCategories (object)
    - appearance settings
    ↓
getFilteredData() applies filters:
    - enabled: true
    - showUnsorted setting respected
    ↓
renderPopup() creates DOM structure:
    - Search input field
    - Category tabs (if multiple categories)
    - Icon grid (current category only)
    ↓
updateIconGrid() generates provider icons:
    - Icon source: provider.icon || Google favicon API
    - Event handlers: click → search, middle-click → copy+search
    - Error handling: fallback to first letter SVG
    ↓
resizePopup() measures final DOM dimensions:
    - wrapper.offsetWidth/Height
    - IPC call to resize BrowserWindow
```

---

## Design Decisions & Rationale

### 1. Why Frameless Transparent Windows?

**Decision:** Use `frame: false`, `transparent: true` for both popup and settings windows

**Rationale:**
- **Visual Consistency:** Custom styling matches application theme without OS chrome conflicts
- **Cross-Platform Appearance:** Eliminates Windows 10/11 title bar differences
- **Minimal Footprint:** Popup appears as floating widget rather than traditional application window
- **CSS Control:** Full control over borders, shadows, and drag regions

**Trade-Offs:**
- **Drag Region Management:** Manual implementation required (settings window title bar)
- **Window Controls:** Custom minimize/close buttons needed
- **Accessibility:** Screen reader compatibility requires explicit ARIA labeling

---

### 2. Why Singleton Pattern for Windows?

**Decision:** Reuse settings window instance instead of creating new windows

**Rationale:**
- **Performance:** Avoid window creation overhead on repeated show/hide
- **State Preservation:** Maintain scroll position and unsaved changes
- **Memory Efficiency:** Single renderer process instead of multiple instances
- **Consistent Behavior:** Prevents duplicate settings windows from conflicting

**Implementation:**
```javascript
export function createMainWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        return mainWindow;  // Reuse existing
    }
    mainWindow = new BrowserWindow({...});  // Create new only if destroyed
    return mainWindow;
}
```

---

### 3. Why HTTP Server Instead of Named Pipes?

**Decision:** Use HTTP server on localhost:49152 for AHK-Electron communication

**Alternatives Considered:**
- **Named Pipes:** Windows-specific, more complex error handling
- **TCP Sockets:** Similar to HTTP but requires custom protocol
- **File System Watcher:** High latency, polling overhead

**HTTP Benefits:**
- **Universal Client:** AHK, curl, browsers all support HTTP GET
- **Simple Protocol:** Standard status codes and headers
- **Easy Debugging:** Can test with browser or Postman
- **Cross-Platform Potential:** HTTP server works on Linux/macOS if trigger mechanism changes

**Security Mitigation:**
- Bind to 127.0.0.1 only (not 0.0.0.0)
- No authentication required (localhost trust model)
- Non-critical data only (search queries, not credentials)

---

### 4. Why LocalStorage Over SQLite/JSON File?

**Decision:** Use browser LocalStorage for settings persistence with manual JSON export

**Rationale:**
- **Built-In API:** No external dependencies required
- **Synchronous Access:** Immediate reads without async overhead
- **Renderer Process:** Settings available without IPC round-trip
- **Automatic Serialization:** JSON stringify/parse handled by LocalStorage

**Limitations:**
- **5-10MB Quota:** Insufficient for large datasets (not a concern for config)
- **String-Only Storage:** Requires JSON serialization for objects
- **No Transactions:** Cannot atomic-update multiple keys
- **Export Required:** User must manually export to backup configuration

**Alternative Considered:**
- **Electron Store Library:** Adds dependency, similar functionality
- **JSON File in User Directory:** Requires IPC for every read (latency)
- **SQLite:** Overkill for simple key-value config

---

### 5. Why Popup Closes on Blur?

**Decision:** Automatically close popup window when focus is lost

**Rationale:**
- **Expected Behavior:** Consistent with other launchers (Spotlight, Alfred, Wox)
- **Prevents Clutter:** Popup doesn't linger after search execution
- **Clean UX:** No manual close button needed (reduces UI complexity)

**Implementation:**
```javascript
popupWindow.on('blur', () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.close();
    }
});
```

**Edge Cases:**
- **Alt+Tab:** Popup closes if user switches applications
- **Settings Window Focus:** Trigger server prevents popup creation if settings focused
- **Context Menu:** Right-click context menu triggers blur (intentional, forces user to re-trigger)

---

## Critical Architecture Weaknesses

### 1. Single-Threaded Main Process

**Issue:** All window management, IPC handling, and file I/O occurs on single event loop

**Impact:**
- Blocking file I/O (fs.readFileSync) during config import freezes main process
- HTTP server shares event loop with window management
- Large config files (1000+ providers) could cause UI lag

**Mitigation Strategies:**
- Use async file operations (`fs.promises.readFile`)
- Offload HTTP server to worker thread
- Implement config loading spinner with progress indication

---

### 2. No Schema Validation for Imported Configs

**Issue:** Config import trusts user-provided JSON without validation

**Risk Scenarios:**
```json
{
  "providers": [
    {
      "name": "<script>alert('XSS')</script>",
      "url": "javascript:void(0)",
      "enabled": true
    }
  ]
}
```

**Potential Exploits:**
- XSS via provider names injected into DOM
- Malicious URLs (javascript:, file://, data:)
- Malformed JSON causing parser errors

**Recommended Fix:**
```javascript
function validateConfig(config) {
    const schema = {
        providers: [{ name: String, url: String, enabled: Boolean, category: String }],
        appearance: { iconSize: String, theme: String, /* ... */ }
    };
    return validateAgainstSchema(config, schema);
}
```

---

### 3. Port Conflict Handling

**Issue:** HTTP server silently fails if port 49152 is occupied

**Current Behavior:**
```javascript
server.on('error', (e) => {
    if (e.code !== 'EADDRINUSE') {
        console.error('Server error:', e);
    }
    // EADDRINUSE silently ignored
});
```

**Consequence:** AutoHotkey trigger sends requests to different application on port 49152

**Recommended Fix:**
- Dynamic port allocation with fallback range (49152-49162)
- Write chosen port to temp file for AHK script to read
- Show user notification if server fails to start

---

### 4. No Icon Caching

**Issue:** Popup fetches provider icons from Google's favicon API on every render

**Performance Impact:**
- Network requests delay popup rendering (100-500ms)
- Multiple providers trigger concurrent requests (thundering herd)
- Offline use fails to display icons

**Current Implementation:**
```javascript
const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
img.src = faviconUrl;  // No caching layer
```

**Optimization Strategies:**
1. **LocalStorage Cache:** Store fetched favicons as base64 data URLs
2. **Preload on Settings Load:** Fetch all enabled providers' icons in background
3. **Service Worker:** Offline cache for repeated icon requests

---

## Architecture Strengths

### 1. Clear Separation of Concerns

**Main Process Modules:**
- `windowManager.js`: Pure window lifecycle management
- `ipcHandlers.js`: IPC event routing only
- `triggerServer.js`: HTTP server isolated from other logic
- `trayManager.js`: System tray operations encapsulated

**Benefit:** Easy to modify one component without affecting others

---

### 2. Stateless Popup Window

**Pattern:** Popup receives all required data via IPC, no persistent state

**Advantages:**
- Fresh render on every trigger (no stale data)
- No synchronization issues with settings changes
- Popup destruction frees memory immediately

**Implementation:**
```javascript
popupWindow.webContents.on('did-finish-load', () => {
    popupWindow.webContents.send('selected-text', selectedText);
    // Popup bootstraps from this single message
});
```

---

### 3. Explicit IPC Channel Definitions

**Centralized Constants:**
```javascript
// src/shared/constants.js
export const IPC_CHANNELS = {
    SHOW_POPUP: 'show-popup',
    SEARCH: 'search',
    // All channels defined in one place
};
```

**Benefits:**
- Prevents typo-induced bugs ('serach' vs 'search')
- Easy to audit all IPC communication paths
- Refactoring-friendly (change constant, update everywhere)

---

## Recommendations

### Immediate (Low Effort)
1. Add JSON schema validation for config imports
2. Implement favicon caching in LocalStorage
3. Handle port conflicts with fallback range
4. Add loading spinner for config import operations

### Short-Term (Medium Effort)
5. Keyboard navigation for popup (arrow keys, Escape)
6. Provider usage tracking (analytics for optimization)
7. Multi-monitor positioning improvements
8. Error boundary for renderer process crashes

### Long-Term (High Effort)
9. Plugin system for custom providers
10. Cloud sync for configuration
11. Cross-platform global hotkey support
12. Migrate to TypeScript for type safety

---

## Next Steps

- **Phase 2:** Component deep-dives (popup.js, settings UI, AHK integration)
- **Phase 3:** Technical recommendations with implementation guidance