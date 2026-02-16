# PopSearch v1.2.0-beta - Project Overview

**Analysis Date:** 2025-02-15  
**Project Root:** `C:\dev\frameless_popup_search_v3`  
**Project Type:** Desktop Application (Electron + AutoHotkey)

---

## Executive Summary

PopSearch is a lightweight frameless search popup application built with Electron. It provides instant access to multiple search engines and web services through a global hotkey trigger (Win+W). The application features a minimalist, category-organized interface with customizable appearance and provider configurations.

**Core Value Proposition:** Reduce friction between selecting text and searching across multiple platforms by eliminating the need to open browsers or switch contexts.

---

## Technology Stack

### Core Framework
- **Electron** 40.2.1 - Desktop application framework (Chromium + Node.js)
- **Vite** 7.3.1 - Build tool and dev server
- **electron-vite** 5.0.0 - Vite integration for Electron
- **electron-builder** 26.7.0 - Application packaging and distribution

### External Integration
- **AutoHotkey v2** - Global hotkey management (compiled to .exe)
- **HTTP Server** - Local IPC bridge between AHK and Electron (port 49152)

### Dependencies
- **electron-log** 5.4.3 - Application logging system
- **rimraf** 6.1.2 - Cross-platform directory cleanup

### Build Tooling
- **Node.js** - Runtime environment
- **npm** - Package management
- **Ahk2Exe** - AutoHotkey compiler (external)

---

## Application Purpose

**Primary Function:** Unified search launcher triggered by global hotkey

**Key Features:**
1. **Global Trigger:** Win+W hotkey opens search popup at cursor position
2. **Multi-Provider Search:** 40+ preconfigured search engines, bookmarks, social networks, and AI tools
3. **Category Organization:** Providers grouped into Search, Bookmarks, Social, AI, and custom categories
4. **Customizable UI:** Theme colors, icon sizes, grid layout, and CSS overrides
5. **Configuration Management:** Import/export settings as JSON
6. **System Tray Integration:** Minimizes to tray with quick access menu
7. **Auto-Hide Behavior:** Popup closes on blur or after search execution

---

## Project Structure

```
frameless_popup_search_v3/
├── src/
│   ├── main/                    # Electron main process (Node.js)
│   │   ├── index.js            # Application entry point
│   │   ├── windowManager.js    # Window creation and lifecycle
│   │   ├── ipcHandlers.js      # IPC communication handlers
│   │   ├── trayManager.js      # System tray integration
│   │   ├── triggerServer.js    # HTTP server for AHK communication
│   │   ├── ahkManager.js       # AutoHotkey process management
│   │   └── logger.js           # Logging system wrapper
│   │
│   ├── preload/                 # Security bridge layer
│   │   └── index.js            # Context bridge API exposure
│   │
│   ├── renderer/                # Frontend UI processes
│   │   ├── popup/              # Search popup window
│   │   │   ├── index.html     
│   │   │   └── popup.js        # Popup UI logic and provider rendering
│   │   │
│   │   └── settings/           # Settings management window
│   │       ├── index.html
│   │       ├── main.js         # Settings UI orchestration
│   │       ├── ui.js           # DOM manipulation and rendering
│   │       ├── store.js        # LocalStorage persistence layer
│   │       └── bridge.js       # IPC bridge to main process
│   │
│   └── shared/                  # Cross-process constants
│       └── constants.js        # IPC channels, defaults, schemas
│
├── assets/                      # Static resources
│   ├── icon.png                # Application icon
│   └── pop_search_trigger.exe  # Compiled AHK trigger (generated)
│
├── .ahk/                        # AutoHotkey source files
│   └── pop_search_trigger.ahk  # Global hotkey script
│
├── out/                         # Build output (Vite)
├── dist/                        # Distribution packages (electron-builder)
├── pop_search_config.json       # User configuration file
├── electron.vite.config.js      # Vite build configuration
└── package.json                 # Project metadata and dependencies
```

---

## Electron Process Architecture

**Multi-Process Model:** Standard Electron security architecture

### 1. Main Process (`src/main/`)
- **Responsibility:** System-level operations, window management, file I/O, IPC coordination
- **Runs in:** Node.js runtime with full OS access
- **Entry Point:** `src/main/index.js`

### 2. Preload Scripts (`src/preload/`)
- **Responsibility:** Security boundary between main and renderer processes
- **Pattern:** Context isolation with explicit API exposure via `contextBridge`
- **Restrictions:** Limited API surface to prevent XSS exploitation

### 3. Renderer Processes (`src/renderer/`)
- **Popup Window:** Ephemeral search interface (created on demand)
- **Settings Window:** Persistent configuration UI
- **Runs in:** Chromium browser context (no Node.js access)
- **Security:** `nodeIntegration: false`, `contextIsolation: true`

---

## Build System

### Development Mode
```bash
npm run dev         # Start Vite dev server with hot reload
npm run start       # Alias for dev mode
```

### Production Build
```bash
npm run build:ahk   # Compile AutoHotkey script to .exe
npm run build       # Clean + AHK compile + Vite build
npm run dist        # Full build + electron-builder packaging
```

### Packaging Outputs
- **NSIS Installer:** Traditional Windows installer with Start Menu shortcuts
- **Portable Build:** Standalone .exe requiring no installation
- **Output Directory:** `dist/`

---

## Configuration System

### Configuration File Location
- **Development:** `./pop_search_config.json` (project root)
- **Production:** User data directory (managed by electron-log)

### Configuration Schema
```json
{
  "appearance": {
    "iconSize": "28",
    "iconsPerRow": "8",
    "gridGapX": "10",
    "gridGapY": "5",
    "popupMaxWidth": "0",
    "theme": "dark",
    "fontWeight": "500",
    "fontColor": "#00f2ff",
    "bgColor": "#13132a",
    "accentColor": "#5900ff",
    "tabActiveBg": "#1d1d1d",
    "customCSS": "",
    "showDummyBtn": false,
    "showUnsorted": false
  },
  "providers": [
    {
      "name": "Google",
      "url": "https://www.google.com/search?q={query}",
      "enabled": true,
      "category": "Search",
      "icon": ""
    }
  ],
  "categories": {
    "Search": "data:image/svg+xml;base64,...",
    "Bookmarks": "...",
    "Social": "...",
    "AI": "..."
  }
}
```

**Storage Layer:** LocalStorage in renderer processes (synchronized with JSON file)

---

## Performance Optimizations

### Memory Constraints
```javascript
app.disableHardwareAcceleration();  // Disable GPU to reduce RAM usage
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');  // 512MB heap limit
```

### Window Optimization
- **Frameless Windows:** Eliminate OS window chrome overhead
- **Transparent Background:** Custom styling without native borders
- **Skip Taskbar:** Popup window invisible in Alt+Tab switcher
- **Always on Top:** Popup maintains focus hierarchy without full-screen mode interruption

---

## Security Considerations

### Electron Security Model
- **Context Isolation:** Enabled (prevents renderer prototype pollution)
- **Node Integration:** Disabled (renderer cannot access Node.js APIs)
- **Preload Scripts:** Explicit API whitelisting via `contextBridge`

### External Communication
- **AutoHotkey Trigger:** Localhost-only HTTP server (127.0.0.1:49152)
- **Search URLs:** Sanitized query parameter encoding
- **External Links:** Opened via `shell.openExternal()` (default browser)

### Identified Risks
1. **Local HTTP Server:** No authentication on port 49152 (localhost-only mitigation)
2. **Configuration Import:** JSON parsing without schema validation
3. **Custom CSS:** User-provided CSS executed in renderer (XSS risk if shared configs from untrusted sources)

---

## Development Workflow

### Prerequisites
```bash
node --version      # Node.js (v18+ recommended)
npm --version       # npm (bundled with Node.js)
# AutoHotkey v2 installation required for build:ahk
```

### Initial Setup
```bash
npm install         # Install dependencies
npm run build:ahk   # Compile AHK trigger
npm run dev         # Start development server
```

### File Watching
Vite automatically reloads renderer processes on file changes. Main process changes require manual restart.

---

## Distribution

### Target Platform
- **Windows** (primary support)
- **Architecture:** x64
- **Minimum Windows Version:** Windows 10

### Installer Types
1. **NSIS Installer** (`PopSearch-Beta-Setup-1.2.0-beta.exe`)
   - Desktop shortcut option
   - Start Menu integration
   - Configurable installation directory
   - Uninstaller included

2. **Portable Build** (`PopSearch-Beta-1.2.0-beta-portable.exe`)
   - No installation required
   - Runs from any directory
   - Ideal for USB drives or restricted environments

---

## Key Technical Decisions

### Why Electron?
- Cross-platform potential (Windows primary, Linux/macOS possible)
- Web technologies for rapid UI development
- Native system integration (tray, global shortcuts via AHK)
- Mature ecosystem and tooling

### Why AutoHotkey?
- Windows global hotkey registration more reliable than Electron's `globalShortcut`
- Compiled .exe eliminates AHK installation requirement for users
- Lightweight trigger mechanism (<1MB)

### Why HTTP Server for IPC?
- Simple communication bridge between AHK and Electron
- Decouples trigger mechanism from Electron internals
- Allows trigger script to remain independent of Electron lifecycle

### Why Vite over Webpack?
- Faster dev server startup (ESM-native)
- Simpler configuration
- Better HMR (Hot Module Replacement) performance
- electron-vite provides seamless integration

---

## Known Limitations

1. **Single Instance Lock:** Only one PopSearch instance can run at a time
2. **Windows-Only Global Hotkey:** AHK trigger script is Windows-specific
3. **Port Conflict:** HTTP server fails silently if port 49152 is occupied
4. **No Password Manager Integration:** Cannot auto-populate credentials in search forms
5. **Static Provider List:** Providers must be manually configured (no auto-discovery)

---

## Future Enhancement Opportunities

**Low-Hanging Fruit:**
- Provider search/filter in settings UI
- Keyboard navigation in popup (arrow keys, tab)
- Provider usage analytics (most-clicked tracking)
- Recent searches history

**Medium Complexity:**
- Plugin system for custom providers
- Multi-monitor awareness improvements
- Cloud sync for configuration
- Theming presets (Light, Dark, Cyberpunk, etc.)

**High Complexity:**
- Cross-platform global hotkey support (Linux, macOS)
- Browser extension integration
- Voice input support
- AI-powered provider suggestions

---

## Next Steps

This document provides foundational understanding. Proceed to:
- **architecture-analysis.md** for design patterns and component relationships
- **codebase-analysis-progress.md** for analysis methodology and current status