# PopSearch - AutoHotkey Integration Analysis

**Analysis Date:** 2025-02-15  
**Focus:** Global hotkey trigger mechanism and Electron integration

---

## Overview

**File:** `.ahk/pop_search_trigger.ahk` (77 lines)  
**Purpose:** Windows global hotkey script for triggering popup search  
**Language:** AutoHotkey v2.0  
**Compilation:** Compiles to standalone .exe (no AHK runtime required for end users)

---

## Hotkey Configuration

### Primary Trigger: CapsLock + S
```ahk
~*CapsLock:: {
    ; Empty block prevents native CapsLock toggle on keydown
}

CapsLock & s::
{
    TriggerPopup()
}
```

**Behavior:**
- **CapsLock alone:** Functions normally (tap to toggle)
- **CapsLock + S:** Triggers popup search
- **`~` prefix:** Allows CapsLock through to OS (doesn't consume the key)
- **`*` wildcard:** Works with any modifier key state

**Design Rationale:**
- CapsLock is rarely used, available on all keyboards
- S for "Search" (mnemonic)
- Non-intrusive - doesn't break CapsLock functionality

---

### Secondary Trigger: Right Mouse Button (Hold)
```ahk
RButton::
{
    StartTime := A_TickCount
    KeyWait "RButton"  ; Wait for release
    PressDuration := A_TickCount - StartTime
    
    if (PressDuration < 200) {
        Send("{RButton}")  ; Short press = normal right-click
    } else {
        TriggerPopup()     ; Long press (>200ms) = trigger popup
    }
}
```

**Behavior:**
- **Click (<200ms):** Normal right-click (context menu)
- **Hold (≥200ms):** Triggers popup search

**Use Case:**
- Mouse-centric workflow
- Select text → Hold right button → Search

**Trade-Off:**
- 200ms delay on normal right-clicks
- Can't hold for drag operations starting with right button

---

## Trigger Mechanism

### TriggerPopup() Function Flow

**Step 1: Clipboard Backup**
```ahk
savedClipboard := ClipboardAll()  ; Binary backup preserving format
A_Clipboard := ""                 ; Clear clipboard
```

**Step 2: Text Selection Capture**
```ahk
Send("^c")         ; Ctrl+C to copy selected text
ClipWait(0.3)      ; Wait up to 300ms for clipboard data
selectedText := A_Clipboard
```

**Limitation:** If no text selected, `selectedText` will be empty or contain previous clipboard content

**Step 3: URL Encoding**
```ahk
encodedText := UriEncode(selectedText)  ; Percent-encoding for HTTP GET query
```

**Step 4: HTTP Request to Electron**
```ahk
try {
    whr := ComObject("WinHttp.WinHttpRequest.5.1")
    whr.Open("GET", "http://127.0.0.1:49152/search?q=" . encodedText, false)
    whr.Send()  ; Blocking call (false = synchronous)
} catch {
    ; HTTP failed - fallback to direct .exe launch
}
```

**Step 5: Clipboard Restoration**
```ahk
A_Clipboard := savedClipboard  ; Restore original clipboard state
```

---

## Communication Protocol

### Primary Path: HTTP GET
```ahk
GET http://127.0.0.1:49152/search?q={encodedText}
```

**Electron Server Response:**
```javascript
// src/main/triggerServer.js
if (url.pathname === '/search') {
    const query = url.searchParams.get('q');
    createPopup(query || '', cursorPosition.x, cursorPosition.y + 20);
    res.writeHead(200);
    res.end('OK');
}
```

**Success Indicator:** HTTP 200 OK response

---

### Fallback Path: Direct .exe Launch
```ahk
exePath := A_ScriptDir . "\PopSearch.exe"
if FileExist(exePath) {
    Run('"' . exePath . '" --search="' . StrReplace(selectedText, '"', "'") . '"', A_ScriptDir, "Hide")
}
```

**Triggered When:**
- HTTP server not responding
- Port 49152 occupied by another application
- Electron process crashed

**Command-Line Argument:**
```bash
PopSearch.exe --search="selected text here"
```

**Electron Handling:**
```javascript
// src/main/index.js
const searchArg = commandLine.find(arg => arg.startsWith('--search='));
if (searchArg) {
    const query = searchArg.split('=')[1];
    createPopup(query, x, y);
}
```

---

## URI Encoding Implementation

### UriEncode() Function
```ahk
UriEncode(str) {
    static doc := ComObject("HTMLFile")
    doc.write('<meta http-equiv="X-UA-Compatible" content="IE=9">')
    return doc.parentWindow.encodeURIComponent(str)
}
```

**Method:** Uses Internet Explorer COM object for JavaScript `encodeURIComponent()`

**Why Not Native AHK?**
- AHK v2 has no built-in URI encoding
- COM object provides reliable percent-encoding
- Handles international characters (UTF-8)

**Examples:**
```ahk
UriEncode("hello world")  ; → "hello%20world"
UriEncode("C++")          ; → "C%2B%2B"
UriEncode("日本語")        ; → "%E6%97%A5%E6%9C%AC%E8%AA%9E"
```

---

## Script Configuration

### Compiler Directives
```ahk
#Requires AutoHotkey v2.0    ; Enforces AHK v2 syntax
#SingleInstance Force         ; Only one instance allowed (auto-terminates old)
#NoTrayIcon                   ; No system tray icon (background process)
```

**Rationale:**
- **v2.0 Requirement:** Script uses v2 syntax (incompatible with v1)
- **Single Instance:** Prevents duplicate hotkey registrations
- **No Tray Icon:** Minimalist approach - settings accessible via Electron UI

---

## Compilation Process

### Build Script (package.json)
```json
"build:ahk": "chcp 65001 > nul && \"C:\\Program Files\\AutoHotkey\\Compiler\\Ahk2Exe.exe\" /in .ahk/pop_search_trigger.ahk /out pop_search_trigger.exe && move /y .ahk\\pop_search_trigger.exe assets\\pop_search_trigger.exe"
```

**Step-by-Step:**
```cmd
chcp 65001                     # Set UTF-8 code page
Ahk2Exe.exe /in script.ahk    # Compile AHK to EXE
move script.exe assets/       # Move to assets folder
```

**Output:** `assets/pop_search_trigger.exe` (~1MB standalone executable)

---

## AHK Process Management

### Lifecycle (ahkManager.js)

**Startup:**
```javascript
// Development
ahkPath = './assets/pop_search_trigger.exe';
ahkProcess = spawn(ahkPath, [], { detached: false });

// Production
ahkPath = path.join(process.resourcesPath, 'assets', 'pop_search_trigger.exe');
ahkProcess = spawn(ahkPath, [], { detached: false });
```

**Shutdown:**
```javascript
app.on('will-quit', () => {
    stopAhk();  // Terminate AHK process before app exit
});

export function stopAhk() {
    if (ahkProcess) {
        ahkProcess.kill();  // SIGTERM signal
        ahkProcess = null;
    }
}
```

**Error Handling:**
```javascript
ahkProcess.on('error', (err) => {
    logToFile(`[AHK Manager] Failed to start: ${err.message}`);
    ahkProcess = null;  // Prevent zombie process tracking
});

ahkProcess.on('exit', (code) => {
    logToFile(`[AHK Manager] Process exited with code: ${code}`);
    ahkProcess = null;
});
```

---

## Critical Issues

### 1. Clipboard Interference

**Problem:** Script overwrites user clipboard on every trigger

**Impact:**
```ahk
; User has "Important Data" in clipboard
; User triggers popup with no text selected
Send("^c")             ; Copies nothing (or incorrect data)
A_Clipboard := ""      ; Clears original clipboard
selectedText := ""     ; Empty query
; User's "Important Data" is LOST
```

**Workaround:**
```ahk
savedClipboard := ClipboardAll()  ; Backup preserves data...
A_Clipboard := savedClipboard     ; ...and restores it at end
```

**Remaining Issue:** 300ms window where clipboard is overwritten

**Recommended Fix:**
```ahk
; Check if text is already selected before copying
if (!IsTextSelected()) {
    ; Don't trigger if no selection
    return
}

IsTextSelected() {
    ; Use Acc library to check for text selection without clipboard manipulation
    ; Or: Check window type and use native selection APIs
}
```

---

### 2. No Selection Detection

**Problem:** Triggers even when no text is selected

**Current Behavior:**
```ahk
Send("^c")        ; Always attempts copy
ClipWait(0.3)     ; Waits for clipboard
selectedText := A_Clipboard  ; May be empty or stale data
```

**Consequences:**
- Empty popup shown
- Confusing UX (why did popup appear?)
- Clipboard manipulation for no reason

**Recommended Enhancement:**
```ahk
; Only trigger if selection exists
if (GetSelectedTextLength() > 0) {
    TriggerPopup()
}
```

---

### 3. 300ms Clipboard Delay

**Problem:** Fixed 300ms wait can be too long or too short

**Too Long:**
- User waits unnecessarily when text copies instantly (<50ms)
- Perceived lag in responsive applications

**Too Short:**
- Network drives, virtual machines, slow apps (>300ms to copy)
- Clipboard timeout = empty query sent

**Recommended Dynamic Timeout:**
```ahk
; Start with short timeout, extend if needed
if !ClipWait(0.1) {  ; Try 100ms first
    if !ClipWait(0.5) {  ; Extend to 500ms total
        ; Clipboard operation failed
        MsgBox "Failed to copy text. Try selecting again."
        return
    }
}
```

---

### 4. HTTP Request Blocking

**Problem:** Synchronous HTTP call blocks AHK script

**Current Implementation:**
```ahk
whr.Open("GET", url, false)  ; false = synchronous (blocking)
whr.Send()
```

**Impact:**
- If Electron server hangs (unlikely), AHK script freezes
- User cannot use other hotkeys during HTTP call
- Typical duration: <10ms (localhost), but could be longer

**Recommended Async Approach:**
```ahk
whr.Open("GET", url, true)  ; true = asynchronous (non-blocking)
whr.Send()
; Script continues immediately, Electron responds in background
```

---

### 5. No Error Notification

**Problem:** Silent failures - user has no idea why popup didn't appear

**Failure Scenarios:**
1. HTTP server not running (port 49152 down)
2. Fallback .exe not found
3. Both primary and fallback paths fail

**Current Behavior:**
```ahk
try {
    ; HTTP request
} catch {
    ; Fallback .exe launch
}
; No user feedback if both fail
```

**Recommended Improvement:**
```ahk
try {
    ; HTTP request
    if (whr.Status != 200) {
        throw "HTTP Error"
    }
} catch {
    if FileExist(exePath) {
        Run(exePath)
    } else {
        ; User notification
        TrayTip("PopSearch", "Failed to launch. Please restart the application.", 3, 0x10)
    }
}
```

---

### 6. CapsLock State Interference

**Problem:** Held CapsLock modifies other keypresses

**Scenario:**
```ahk
; User holds CapsLock for extended period
; Presses other keys while holding
; All keys typed in opposite case (CapsLock still held)
```

**Current Mitigation:**
```ahk
~*CapsLock:: {
    ; Empty block prevents toggle on down press
}
```

**Limitation:** Only prevents toggle, doesn't release CapsLock state

**Recommended Enhancement:**
```ahk
CapsLock & s::
{
    SetCapsLockState("Off")  ; Ensure CapsLock off after trigger
    TriggerPopup()
}
```

---

## Design Strengths

### 1. Clipboard State Preservation

**Implementation:**
```ahk
savedClipboard := ClipboardAll()  ; Binary backup (preserves images, RTF, etc.)
; ... operations ...
A_Clipboard := savedClipboard     ; Full restoration
```

**Benefit:** User's clipboard data not permanently lost

---

### 2. Dual Trigger Mechanism

**Keyboard + Mouse:**
```ahk
CapsLock & s::  ; For keyboard users
RButton::       ; For mouse users
```

**Flexibility:** Accommodates different user workflows

---

### 3. Graceful Fallback

**HTTP → Direct Launch:**
```ahk
try {
    ; HTTP (preferred)
} catch {
    ; Direct .exe launch (fallback)
}
```

**Reliability:** Continues working even if HTTP server fails

---

### 4. Standalone Compilation

**Compiled .exe:**
- No AHK runtime dependency
- ~1MB self-contained executable
- Distributable without installing AutoHotkey

**User Benefit:** Works out-of-box on any Windows system

---

## Performance Characteristics

### Trigger Latency Breakdown
```
User presses CapsLock+S          0ms
AHK registers hotkey             <1ms
Clipboard backup                 5-10ms
Send ^c                          1-2ms
ClipWait                         10-300ms  ← Primary bottleneck
URI encode                       1-2ms
HTTP request                     5-15ms    ← Secondary bottleneck
Clipboard restore                5-10ms
Total:                           27-341ms
```

**Optimization Targets:**
1. **Clipboard Operations:** Reduce from 300ms to dynamic timeout
2. **HTTP Request:** Async call to avoid blocking

---

## Integration Points

### AHK → Electron Communication

**Data Flow:**
```
User selects text
    ↓
AHK triggers hotkey
    ↓
Copy to clipboard
    ↓
HTTP GET to 127.0.0.1:49152
    ↓
Electron server receives request
    ↓
Main process creates popup window
    ↓
Popup renderer loads with query
```

### Electron → AHK Management

**Process Lifecycle:**
```
Electron app starts
    ↓
ahkManager.startAhk() spawns .exe
    ↓
AHK registers global hotkeys
    ↓
Hotkey triggers HTTP calls back to Electron
    ↓
Electron app quits
    ↓
ahkManager.stopAhk() terminates .exe
```

---

## Platform Limitations

### Windows-Only
**Why:**
- AutoHotkey is Windows-exclusive
- COM objects (WinHttp, HTMLFile) are Windows-specific
- No AHK v2 equivalent on Linux/macOS

**Cross-Platform Alternatives:**
- **macOS:** Swift app with global hotkey + AppleScript
- **Linux:** Python script with X11 bindings + xdotool

---

## Recommendations

### Priority 1 (High Impact)
1. Implement selection detection before triggering
2. Add dynamic clipboard timeout
3. Provide user feedback on failure

### Priority 2 (Medium Impact)
4. Make HTTP requests asynchronous
5. Add CapsLock state cleanup after trigger
6. Implement retry logic for HTTP failures

### Priority 3 (Low Impact)
7. Add configuration file for custom hotkeys
8. Implement clipboard-free text capture (Acc library)
9. Add hotkey disable/enable via HTTP endpoint

---

## Testing Considerations

### Manual Tests
- **Empty Selection:** Trigger with no text selected
- **Large Text:** Select 10,000+ character block
- **Special Characters:** Unicode, emoji, RTF formatting
- **Clipboard Conflict:** Copy during 300ms window
- **Network Failure:** Kill Electron, test fallback
- **Missing .exe:** Delete .exe, verify failure handling

### Automated Tests (Difficult)
- AHK v2 has limited test framework support
- Recommend: Integration tests from Electron side

---

## Next Steps

See `code-patterns.md` for cross-codebase patterns and technical debt summary