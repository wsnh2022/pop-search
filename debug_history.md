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
6.  **Window Level Discipline:** Use the lowest `alwaysOnTop` level necessary. Higher levels (like `screen-saver`) should be reserved for critical triggers.
7.  **Modern Tooling (Vite):** Use **Vite** (via `electron-vite`) for bundling. It provides much faster reload times and more efficient production builds (tree-shaking and minification) compared to legacy bundlers, leading to better runtime optimization.

---

**Current Status:** All identified bugs resolved. Settings panel is stable and responsive.
