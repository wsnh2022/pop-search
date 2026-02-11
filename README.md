# 🚀 PopSearch v1.1.0-beta - Professional Assistant

[![Version](https://img.shields.io/badge/version-v1.1.0--beta-blue)](https://github.com/wsnh2022/pop-search/releases)
[![Platform](https://img.shields.io/badge/platform-Windows-0078d7.svg?logo=windows&logoColor=white)](https://github.com/wsnh2022/pop-search)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![Electron](https://img.shields.io/badge/Electron-4B32C3?logo=electron&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)

PopSearch is a lightweight search tool for Windows that triggers a customizable search popup from any selected text using a global hotkey. It enables instant searching without the need for manual copy-pasting into a browser.

---

## 🔍 What It Does

PopSearch monitors for a specific trigger (Right-Click or CapsLock + S) after text has been selected in any application. It then displays a sleek, transparent interface containing your favorite search engines, AI tools, and bookmarks.

### Key Features
- **Auto-Save System**: All appearance settings (colors, sizes, layout) are saved instantly as you modify them.
- **True Transparency**: A floating, glassmorphism-inspired UI that blends with your workspace.
- **Customizable Search Providers**: Add any website using a `{query}` placeholder. Includes 40+ pre-loaded providers.
- **Bulk Import**: Quickly add dozens of search engines via TSV or Markdown format.
- **Portable Version**: Single-file executable requiring no installation.

---

## 📦 Installation

### Pre-built Binary
Download the latest version from the [Releases](https://github.com/wsnh2022/pop-search/releases) page.

### Requirements
- **OS**: Windows 10 or later (64-bit).
- **Dependencies**: No additional software is required for the portable version.

### Steps
1. Download `PopSearch-1.1.0-beta-portable.exe`.
2. Move it to a folder of your choice (e.g., Desktop or Documents).
3. Run the application; it will reside in your System Tray.

---

## ⚡ Usage

1. **Select Text**: Highlight text in any application (Browser, PDF, IDE, etc.).
2. **Trigger Popup**:
   - **Keyboard**: Press `CapsLock + S`.
   - **Mouse**: Release the `Right Mouse Button` after a brief hold.
3. **Execute Search**:
   - Left-click a provider icon to search in your default browser.
   - Use the search bar for manual overrides or refined queries.

### Visual Guide

#### ⚡ 1. The Instant Search Interface
![Search UI](assets/screenshots/main_popup.png)

<div align="center">
  <video src="https://github.com/user-attachments/assets/317ba541-bc16-42d7-aaec-0d2484a0c762" controls="controls" style="max-width: 100%; border-radius: 10px;"></video>
</div>

#### 🎨 2. The Settings Center
![Settings UI](assets/screenshots/settings.png)

<div align="center">
  <video src="https://github.com/user-attachments/assets/aafbf0a8-9f01-4919-9573-3f5073664690" controls="controls" style="max-width: 100%; border-radius: 10px;"></video>
</div>

---

## ⚙️ Configuration

### Managing Providers
Under the **Providers** tab in settings, you can add new search engines. Use the `{query}` placeholder for the search term.
- Example: `https://www.google.com/search?q={query}`

### Appearance Settings
Customize accent colors, icon sizes, grid spacing, and transparency. Changes are applied in real-time and saved automatically.

### Application Control
- **Reload/Quit**: Right-click the tray icon or right-click anywhere on the search bar UI to access the management menu.

---

## 🛠️ Development

### Requirements
- **Node.js**: 18.x or later.
- **npm**: 9.x or later.
- **AutoHotkey**: v2 (required for building the trigger engine).

### Build from Source
```bash
# Clone the repository
git clone https://github.com/wsnh2022/pop-search.git
cd pop-search

# Install dependencies
npm install

# Build the AHK trigger and application
npm run build

# Start the application in development mode
npm start
```

### Project Structure
- `src/main`: Main process handles window lifecycles and IPC.
- `src/renderer`: Frontend UI (Vanilla JS + CSS).
- `src/preload`: Secure bridge between processes.
- `.ahk`: Source code for the global hotkey trigger.

---

## 🛑 Troubleshooting

- **Hotkey Conflict**: If `CapsLock + S` is used by another application, the trigger might fail. Use Right-Click as an alternative.
- **AHK Compilation**: If `npm run build` fails, ensure AutoHotkey v2 is correctly installed and in your system PATH.
- **Icons Not Loading**: Ensure you have an active internet connection for favicon fetching, or use Emojis/Base64 strings.

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

*For future development plans, see the [Roadmap](ROADMAP.md).*
