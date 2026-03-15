#Requires AutoHotkey v2.0
#SingleInstance Force
#NoTrayIcon
; ~*^s:: Reload

; CapsLock + S - Global Trigger
; Tracks whether S was pressed during CapsLock hold to decide if native toggle should fire.
~*CapsLock:: {
    global _capsUsedAsModifier := false  ; Reset modifier flag on every CapsLock press
}

; CapsLock released alone (no S pressed) — restore native toggle behavior
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

; RButton - short click passes through natively via ~ prefix
; Hold ≥300ms triggers the popup search
~RButton:: {
    StartTime := A_TickCount
    KeyWait "RButton"
    PressDuration := A_TickCount - StartTime

    if (PressDuration >= 300) {
        TriggerPopup()
    }
    ; Short press: native right-click already passed through — no Send() needed
}

TriggerPopup() {
    ; Save current clipboard
    savedClipboard := ClipboardAll()
    A_Clipboard := ""

    ; Attempt to copy selected text
    Send("^c")

    ; Wait for clipboard (0.3s for speed)
    ClipWait(0.3)

    selectedText := A_Clipboard
    encodedText := UriEncode(selectedText)

    ; Send to Electron
    try {
        whr := ComObject("WinHttp.WinHttpRequest.5.1")
        whr.Open("GET", "http://127.0.0.1:49152/search?q=" . encodedText, false)
        whr.Send()
    } catch {
        ; Fallback: launch the main exe directly when Electron is not yet running.
        ; Production layout: nexus_trigger.exe is in <install>\resources\assets\
        ;                    Nexus Launcher.exe is two levels up at <install>\
        ; Dev layout:        nexus_trigger.exe is in assets\ (project root)
        ;                    Nexus Launcher.exe is not present in dev — no-op.
        exePath := A_ScriptDir . "\..\..\Nexus Launcher.exe"
        if !FileExist(exePath)
            exePath := A_ScriptDir . "\..\Nexus Launcher.exe"  ; dev fallback
        if FileExist(exePath) {
            Run('"' . exePath . '" --search="' . StrReplace(selectedText, '"', "'") . '"',
                A_ScriptDir, "Hide")
        }
    }

    ; Restore clipboard
    A_Clipboard := savedClipboard
}

#HotIf ; Reset HotIf

/*
COMPILATION TIPS:
1. Compile Electron: Use `npm run build` after setting up electron-builder.
2. Compile AHK: Right-click this script and select "Compile Script"
   to create a standalone "nexus_trigger.exe".
*/

; Pure AHK v2 URL encoder — no IE/HTMLFile COM dependency (removed: broke on Win11)
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
