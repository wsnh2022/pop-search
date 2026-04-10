#Requires AutoHotkey v2.0
#SingleInstance Force
#NoTrayIcon
; ~*^s:: Reload

; CapsLock + S - Global Trigger
; Tracks whether S was pressed during CapsLock hold to decide if native toggle should fire.
~*CapsLock:: {
    global _capsUsedAsModifier := false  ; Reset modifier flag on every CapsLock press
}

; CapsLock released alone (no S pressed) - restore native toggle behavior
~*CapsLock Up:: {
    if !_capsUsedAsModifier {
        ; Manually toggle CapsLock state since AHK suppressed the native toggle
        SetCapsLockState !GetKeyState("CapsLock", "T")
    }
}

CapsLock & s:: {
    global _capsUsedAsModifier := true   ; Mark that CapsLock was used as a modifier
    TriggerPopup()
}

; RButton - capture text at button-DOWN (selection still intact), decide on UP
; Short press  → replay native right-click (context menu as normal)
; Long press ≥300ms → open Nexus popup with the captured text
RButton:: {
    ; ── STEP 1: grab selected text RIGHT NOW at button-down ─────────────────
    ; Most apps clear text selection on RButton-down, so Ctrl+C must happen
    ; HERE - before KeyWait - while the selection is still alive.
    savedClip := ClipboardAll()
    A_Clipboard := ""
    Send("^c")
    ClipWait(0.4)
    capturedText := A_Clipboard
    A_Clipboard := savedClip          ; restore clipboard before any delay

    ; ── STEP 2: time the hold ────────────────────────────────────────────────
    StartTime := A_TickCount
    KeyWait "RButton"
    PressDuration := A_TickCount - StartTime

    if (PressDuration >= 300) {
        FirePopup(capturedText)        ; use text already captured above
    } else {
        Click "Right"                  ; short press → replay native right-click
    }
}

; Called by RButton long-hold with pre-captured text (no Ctrl+C needed)
FirePopup(selectedText) {
    encodedText := UriEncode(selectedText)
    try {
        whr := ComObject("WinHttp.WinHttpRequest.5.1")
        whr.Open("GET", "http://127.0.0.1:49152/search?q=" . encodedText, false)
        whr.Send()
    } catch {
        exePath := A_ScriptDir . "\..\..\Nexus Launcher.exe"
        if !FileExist(exePath)
            exePath := A_ScriptDir . "\..\Nexus Launcher.exe"
        if FileExist(exePath) {
            Run('"' . exePath . '" --search="' . StrReplace(selectedText, '"', "'") . '"',
                A_ScriptDir, "Hide")
        }
    }
}

; Called by CapsLock+S - keyboard shortcut so selection survives, Ctrl+C is safe here
TriggerPopup() {
    savedClipboard := ClipboardAll()
    A_Clipboard := ""
    Send("^c")
    ClipWait(0.5)
    selectedText := A_Clipboard
    A_Clipboard := savedClipboard
    FirePopup(selectedText)
}

#HotIf ; Reset HotIf

/*
COMPILATION TIPS:
1. Compile Electron: Use `npm run build` after setting up electron-builder.
2. Compile AHK: Right-click this script and select "Compile Script"
   to create a standalone "nexus_trigger.exe".
*/

; Pure AHK v2 URL encoder - no IE/HTMLFile COM dependency (removed: broke on Win11)
UriEncode(str) {
    encoded := ""
    Loop Parse, str {
        c := A_LoopField
        o := Ord(c)
        if (o >= 48 && o <= 57) || (o >= 65 && o <= 90) || (o >= 97 && o <= 122)
            || c = "-" || c = "_" || c = "." || c = "~" {
            encoded .= c
        } else {
            buf := Buffer(4)
            n := DllCall("WideCharToMultiByte", "UInt", 65001, "UInt", 0,
                         "Str", c, "Int", 1, "Ptr", buf, "Int", 4, "Ptr", 0, "Ptr", 0)
            Loop n
                encoded .= "%" . Format("{:02X}", NumGet(buf, A_Index - 1, "UChar"))
        }
    }
    return encoded
}
