# 🚀 PopSearch v1.1.0-beta - Instant Search Assistant

[![Version](https://img.shields.io/badge/version-v1.1.0--beta-blue)](https://github.com/wsnh2022/pop-search/releases)
[![Platform](https://img.shields.io/badge/platform-Windows-0078d7.svg?logo=windows&logoColor=white)](https://github.com/wsnh2022/pop-search)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![Electron](https://img.shields.io/badge/Electron-4B32C3?logo=electron&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)

PopSearch triggers a customizable search popup from selected text using a global hotkey. Select text in any application, trigger with Right-Click Hold or CapsLock + S, and instantly search across your favorite search engines, AI tools, and bookmarks.

> **Windows 10+ only.** macOS/Linux not supported.

---

## 🔍 What It Does

### Key Features
- **Search Anywhere**: Select text in any app → trigger popup → search across 40+ pre-loaded engines instantly
- **Smart Triggers**: CapsLock + S (keyboard) or Right-Click Hold (mouse) — choose what fits your workflow
- **Infinite Extensibility**: Add any website using `{query}` placeholder, organize into custom groups, bulk import via TSV/Markdown
- **Beautiful & Customizable**: Full theme control with custom colors, icon sizes, spacing, and transparency
- **Portable & Private**: Single-file executable (~95 MB), no installation, no telemetry, settings auto-save locally

---

## 📸 Visual Guide

### The Instant Search Interface
![Search UI](assets/screenshots/main_popup.png)

<div align="center">
  <video src="https://github.com/user-attachments/assets/317ba541-bc16-42d7-aaec-0d2484a0c762" controls="controls" style="max-width: 100%; border-radius: 10px;"></video>
</div>

### The Settings Center
![Settings UI](assets/screenshots/settings.png)

<div align="center">
  <video src="https://github.com/user-attachments/assets/aafbf0a8-9f01-4919-9573-3f5073664690" controls="controls" style="max-width: 100%; border-radius: 10px;"></video>
</div>

### Trigger Methods
![Shortcuts Map](assets/screenshots/shortcuts_map.png)

---

## 📦 Installation

### Requirements
- **OS**: Windows 10 or later (64-bit)
- **Disk Space**: ~95 MB (portable version)
- **RAM**: ~60-80 MB idle
- **Dependencies**: None (portable version)

### Steps
1. Download `PopSearch-1.1.0-beta-portable.exe` from [Releases](https://github.com/wsnh2022/pop-search/releases)
2. Move to desired folder (Desktop, Documents, etc.)
3. Run the application → appears in System Tray

---

## ⚡ Usage

### Trigger Methods

**CapsLock + S**
- Works with or without selected text
- Type directly or search selection

**Right-Click Hold (200ms)**
- Select text, then hold right-click

### Basic Workflow
1. **Select Text**: Highlight text in any application (Browser, PDF, IDE)
2. **Trigger Popup**: CapsLock + S or Right-Click Hold
3. **Execute Search**: Left-click a provider icon to search in default browser

---

## ⚙️ Configuration

### Adding Search Providers
Under **Providers** tab in settings, add search engines using `{query}` placeholder.
- Example: `https://www.google.com/search?q={query}`

**Custom Icons**: Search icon names at [icons8.com](https://icons8.com/), copy Base64 or URL, paste into Settings for live preview.

![Get Icon](assets/screenshots/geticon.png)

![Search Providers](assets/screenshots/search_provider.png)

### Bulk Import
Organize bookmarks in Excel with columns: Category, Name, URL (with/without `{query}`), optional icon path. Use **Bulk Import** in Settings to add all at once.

![Bulk Import](assets/screenshots/Bulk_Import.png)

<details>
<summary>💡 Example Custom URLs</summary>

**Maps & Location**
- Google Maps: `https://www.google.com/maps/search/{query}`
- OpenStreetMap: `https://www.openstreetmap.org/search?query={query}`

**Entertainment**
- Spotify: `https://open.spotify.com/search/{query}`
- IMDb: `https://www.imdb.com/find?q={query}`

**Shopping**
- eBay: `https://www.ebay.com/sch/i.html?_nkw={query}`
- Yelp: `https://www.yelp.com/search?find_desc={query}`

**Professional**
- Indeed: `https://www.indeed.com/jobs?q={query}`

**Learning**
- Coursera: `https://www.coursera.org/search?query={query}`
- Udemy: `https://www.udemy.com/courses/search/?q={query}`

</details>

### Appearance Settings
Customize accent colors, icon sizes, grid spacing, transparency. Changes apply in real-time and save automatically.

### Application Control
Right-click tray icon or search bar UI to access Reload/Quit menu.

---

## 🛠️ Development

### Requirements
- Node.js 18.x+
- npm 9.x+
- AutoHotkey v2 (for building trigger engine)

### Build from Source
```bash
git clone https://github.com/wsnh2022/pop-search.git
cd pop-search
npm install

# Build AutoHotkey trigger (.ahk → .exe)
# Compiles .ahk/pop_search_trigger.ahk → assets/pop_search_trigger.exe
npm run build:ahk

# Build Electron application (output: dist/)
npm run build

# Or build both at once
npm run build  # Runs build:ahk then electron-vite build

# Start in development mode (requires AHK binary compiled first)
npm start
```

**Build outputs:**
- `assets/pop_search_trigger.exe` - Compiled AutoHotkey trigger
- `dist/` - Final Electron application (installer + portable)

### Project Structure
- `src/main`: Main process (window lifecycles, IPC)
- `src/renderer`: Frontend UI (Vanilla JS + CSS)
- `src/preload`: Secure bridge between processes
- `.ahk`: Global hotkey trigger source

---

## 🛑 Troubleshooting

- **Hotkey Conflict**: If `CapsLock + S` conflicts with another app, use Right-Click instead
- **AHK Compilation**: Ensure AutoHotkey v2 is in system PATH
- **Icons Not Loading**: Requires internet connection for favicon fetching, or use Emojis/Base64

---

## 🔒 Privacy

- **No telemetry, analytics, or network requests** except favicon fetching
- All settings stored locally in `%APPDATA%/PopSearch/config.json` (or portable directory)
- **No data leaves your machine**

---

## 📜 License

MIT License. See [LICENSE](LICENSE) for details.

---

*For future development plans, see the [Roadmap](ROADMAP.md).*