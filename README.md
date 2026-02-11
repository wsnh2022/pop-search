# 🚀 PopSearch 1.0 Beta - Professional Search Assistant

**PopSearch 1.0 Beta** is a high-speed productivity tool for Windows. Highlight text in any app, press the hotkey, and a sleek, transparent search popup appears instantly at your cursor.

---

## 📺 Visual Showcase

### ⚡ 1. The Instant Search Interface
**Master the Trigger:** Hold **`CapsLock`** + press **`S`**  or  **Long-Press `Right Mouse Button`**.

![Search UI](assets/screenshots/main_popup.png)

<div align="center">
  <video src="https://github.com/user-attachments/assets/317ba541-bc16-42d7-aaec-0d2484a0c762" controls="controls" style="max-width: 100%; border-radius: 10px;"></video>
</div>

---

### 🎨 2. The Aura Control Center (Settings)
**Personalize:** Change accent colors, glow intensity, and manage your search providers in real-time.

![Settings UI](assets/screenshots/settings.png)

<div align="center">
  <video src="https://github.com/user-attachments/assets/aafbf0a8-9f01-4919-9573-3f5073664690" controls="controls" style="max-width: 100%; border-radius: 10px;"></video>
</div>
---

## 🎨 Why PopSearch 1.0 Beta? (The Professional Edge)
PopSearch focuses on **visual excellence** and **unmatched reliability**. We’ve removed the "ugly boxes" of the past and replaced them with a state-of-the-art UI.

### ✨ Key Features in 1.0 Beta:
*   **True Transparency**: No more flickering dark boxes. The popup is a clean, floating element.
*   **Aura Glow UI**: A beautiful, glowing aura surrounds the popup, matching your chosen accent color.
*   **Hardcoded Defaults**: Comes pre-loaded with a meticulous list of 40+ top-tier search and AI providers (Google, ChatGPT, Claude, etc.).
*   **One-Click Reset**: Easily revert to the factory "Beta State" with a single button in the settings.

---

## 🌟 Core Features

### 🔍 Search Anywhere
Select text in a Browser, PDF, Word doc, or even a Code Editor. Trigger the popup and search instantly without copy-pasting.

### 🍱 Category Tabs
Organize your tools into **Search**, **AI**, **Social**, and **Bookmarks**. Switch between them using the scroll wheel or sleek category tabs.

### 🖌️ Full Customization
*   **Glow & UI Highlights**: Change the entire look of the app by picking a single accent color.
*   **Dynamic Grid**: Adjust icon sizes, spacing, and icons-per-row to fit your style.
*   **Smart Icons**: Automatic favicon fetching for any URL you add. Supports Emojis, URLs, and Base64 images.

### 📦 Portable & Lightweight
*   **Singular .EXE**: Built to be a portable tool.
*   **Zero Background Noise**: No tray icon by default (clean taskbar), but fully manageable via settings.
*   **Ultra Fast**: Built with Vanilla JS and optimized Electron internals for instant response.

---

## 🚀 Quick Start

### 1. Developer Setup
```bash
# Clone the repo (if not already local)
# git clone https://github.com/the-thinker/popsearch-v1.git
# cd popsearch-v1

# Install dependencies
npm install

# Build the trigger & frontend
npm run build
```

```bash
npm start
```

### 3. Usage
1.  **Select text** anywhere on your computer (Browser, PDF, IDE).
2.  **Trigger the Popup**:
    *   **Keyboard**: Hold **CapsLock** and press **S**.
    *   **Mouse**: Long-press the **Right Mouse Button** (RButton).
3.  **Search**:
    *   Click any icon to search in your default browser.
    *   The search bar is auto-focused for manual typing.

---

## ⚙️ Configuration Guide

### Adding Providers
Go to the **Providers** tab in settings. You can add any site using the `{query}` placeholder. 
Example: `https://www.google.com/search?q={query}`

### Bulk Import
Paste a list of names and URLs in the **Bulk Import** tab to add dozens of engines in seconds.

### Factory Reset
If you ever want to return to the official Beta setup, just click **Reset** in the settings. It will apply the hardcoded 1.0 layout and providers.

---

## 📂 Project Highlights

*   **Technology**: Electron, Vite, AutoHotkey v2.
*   **Trigger Engine**: A high-performance AHK script that Electron manages automatically.
*   **Modern CSS**: Uses glassmorphism, backdrop blurs, and dynamic shadow calculations.

---

## 🔮 Future Plans & Roadmap

We are constantly working to make PopSearch the ultimate productivity companion. Here's what's on the horizon:

*   **⚡ Direct AI Responses**: Get instant answers from LLMs directly within the popup without opening a browser.
    *   **OpenRouter Integration**: Access 100+ free and paid models (Llama 3, Mistral, Qwen) via a single API.
    *   **Google Gemini Support**: Native integration for lightning-fast reasoning using Gemini 1.5 Flash/Pro.
*   **📂 Multi-Profile Support**: Create different provider sets for Work, Research, and Entertainment.

---

## 🏷️ License
Licensed under the MIT License. Built with ❤️ for productivity lovers.
