# Debugging & Optimization History - PopSearch Beta

**Date:** 2026-02-12  
**Time:** 23:48:45+05:30  

---

This document records the major issues identified and resolved during the beta debugging session (Feb 2026).

---

## 1. Settings Panel Performance & Memory
**Problem:**  
The Settings panel becomes slow, non-responsive, or crashes (Out of Memory) when managing a large number of search providers.

**Root Cause:**  
*   **Memory Limit:** The Electron main process was restricted to 128MB of JavaScript heap.
*   **DOM Bloat:** The UI pre-rendered category dropdowns for *every* provider list item, creating thousands of unnecessary DOM nodes.

**Solution:**  
*   **Increased Memory:** Modified `src/main/index.js` to set `--max-old-space-size=512`.
*   **Lazy Rendering:** Refactored `renderProviders` in `ui.js` to generate category dropdowns **on-demand**.

---

## 2. Input Fields Breaking After Reset
**Problem:**  
After using the "Reset Settings" button, the search bar and "Add Provider" input fields became completely unresponsive.

**Root Cause:**  
A minor error during re-initialization would crash the script, preventing event listeners from being attached.

**Solution:**  
*   **Fail-Safe Initialization:** Refactored `initUI` into isolated, protected segments using `try-catch` blocks.
*   **Diagnostic Logs:** Added terminal logging (`[Settings UI] ...`) to track every step of the UI startup.

---

## 3. UI "Freeze" (Focus Trap)
**Problem:**  
After deleting multiple bookmarks, the search bar would "freeze" and lose focus.

**Root Cause:**  
*   **Focus Conflict:** Native browser dialogs (`confirm()`) clashed with the Electron window's high-priority `alwaysOnTop: 'screen-saver'` setting. 

**Solution:**  
*   **Custom Modals:** Replaced all native dialogs with a **Custom HTML Modal System**.
*   **Window Tuning:** Lowered the Settings window priority from `screen-saver` to `alwaysOnTop: true`.

---

## 4. Git Synchronization
**Problem:**  
Unintentional staging of binaries (`.exe`) and media (`.mp4`) to the GitHub repository.

**Solution:**  
*   **Ignore Patterns:** Updated `.gitignore` with global exclusions for `*.exe` and `*.mp4`.

---

## Future Implementation Lessons (Developing Bug-Free Electron Apps)

1.  **Avoid Native Dialogs in Always-On-Top Windows:** Native OS dialogs (like `alert` or `confirm`) often fight with Electron for focus priority. Always use HTML-based modals to ensure a smooth, non-blocking user flow.
2.  **Isolated Initialization (Fault Tolerance):** Never let a single failed DOM element or missing config key crash the whole UI. Group initialization steps into `try-catch` blocks so that one failure (like "Appearance Settings") doesn't kill unrelated features (like "Add Provider").
3.  **Efficiency over Eagerness (DOM Management):** Pre-rendering complex UI elements for large lists leads to exponential RAM usage. Only render what the user is interacting with (on-demand rendering).
4.  **Diagnostic Presence:** Build-time logging (`logToTerminal`) is essential for remote debugging. When a user reports a "freeze," the terminal logs should show exactly which function failed.
5.  **Memory Awareness:** For portable Electron apps, default memory limits are often too low. Explicitly managing `--max-old-space-size` is critical for memory-intensive applications.
7.  **Modern Tooling (Vite):** Use **Vite** (via `electron-vite`) for bundling. It provides much faster reload times and more efficient production builds (tree-shaking and minification) compared to legacy bundlers, leading to better runtime optimization.

## Advanced Architectural Lessons (Project-Specific)

Based on the structure of **PopSearch v3**, here are deeper lessons for "Dynamic & Bug-Free" scaling:

1.  **The "Bridge" Pattern for Interoperability:** 
    *   Using an internal HTTP server (`triggerServer.js`) to bridge AHK and Electron is a powerful way to avoid complex win32 API calls within Node. 
    *   *Dynamic Tip:* To make this "dynamic," ensure the port is configurable or uses a "find-available-port" logic to prevent conflicts if multiple users run the app on the same network or machine.

2.  **State-First Rendering (Decoupling Data from UI):** 
    *   In `ui.js`, we saw that rendering is often tied directly to DOM queries. 
    *   *Bug-Free Tip:* Transition towards a "State -> Render" flow where you update a JS object first, and a single `render()` function updates the entire view. This prevents "Index Shifting" bugs (like the one fixed in `removeProvider`).

3.  **Cross-Window Focus Orchestration:** 
    *   The app has a specific check to "Ignore Popup if Settings focused." This is great for UX but dangerous if the Settings window enters a "ghost focus" state.
    *   *Implementation Method:* Implement a "Global Window Manager" that tracks focus states across *all* windows in a central Main-process variable, rather than letting windows "guess" each other's state.

4.  **Storage Scalability (Moving beyond LocalStorage):** 
    *   `localStorage` is synchronous and limited to ~5MB. As your "Bulk Import" feature grows, it might hit a wall.
    *   *Future-Proofing:* Consider moving to an asynchronous IPC-based storage (like `electron-store` or a simple JSON file with `fs.promises`) to prevent the Renderer from blocking while saving large lists.

5.  **Graceful Resource Disposal:** 
    *   The internal AHK and HTTP servers must be explicitly closed during `app.on('before-quit')`. 
    *   *Stability Tip:* Always use "Cleanup Manifests." Maintain an array of active resources (processes, servers, intervals) and loop through it on exit to ensure no "Zombie" AHK processes are left in the User's background.

## Moving Beyond AutoHotkey: Dynamic Trigger Alternatives

While AHK is powerful on Windows, it creates a dependency on an external language and is platform-locked. For future "Dynamic" projects, consider these fully-integrated alternatives:

1.  **uiohook-napi (Recommended for Node.js):**
    *   **What it is:** A native Node.js wrapper for `libuiohook`.
    *   **The Benefit:** It allows you to listen to global keyboard and mouse events directly inside Electron's **Main Process** without any external scripts.
    *   **Capture Strategy:** You can listen for your trigger key, then use a library like `robotjs` or `nut-js` to simulate `Ctrl+C`, read the clipboard, and trigger your popup instantly.

2.  **Native Electron `globalShortcut` + Clipboard Sync:**
    *   **What it is:** The built-in Electron module.
    *   *Limit:* It doesn't provide "event-swallowing" (preventing the key from reaching other apps) as easily as AHK.
    *   **Modern Twist:** Use this for simple triggers, and pair it with a Main-process "Clipboard Listener" to detect when the user has highlighted text.

3.  **Rust/Tauri "Sidecar" (High Performance):**
    *   **What it is:** Write a tiny Rust binary using the `enigo` or `rdev` crates.
    *   **The Benefit:** Extremely low latency and cross-platform (Windows/Mac/Linux). Electron can launch this as a "sidecar" process, communicating via `stdio` instead of a local HTTP server.

4.  **C# / .NET Hook (Windows Optimized):**
    *   **What it is:** A small invisible C# `.exe` that uses `SetWindowsHookEx`.
    *   **The Benefit:** Much more stable and "standard" than AHK for professional Windows software. You can compile this into your `assets` and talk to it via IPC.

---

**Current Status:** All identified bugs resolved. Settings panel is stable and responsive. Documentation updated for future scaling and AHK replacement strategies.
