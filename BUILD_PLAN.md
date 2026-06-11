# Build Plan — Transparent Floating Keystroke Overlay (Windows primary, Linux secondary)

> **For the coding agent:** Read this entire document before writing any code. Follow the phases in order. After each completed step, output a line in the form `✅ [what was done] — [file(s) affected]`. Obey the Scope and Stop Conditions sections strictly. Do not add features, files, or dependencies beyond what is specified here.

---

## 1. App Idea & Intended Use

A single-user desktop utility that displays, in real time, whatever the operator types — inside a transparent, frameless, always-on-top floating panel styled like a minimal notepad. Keystrokes are captured **globally**, so text appears in the panel even when another application (Chrome, an editor, a terminal) holds keyboard focus. The panel is freely draggable, toggleable, and clearable via keyboard shortcuts and a slim three-button menu bar.

The app additionally uses the Windows OS-level capture-exclusion API so the panel is **not visible in screen-share / screen-recording software** (Zoom, Google Meet, Teams, OBS) while remaining visible on the physical monitor.

**Intended use assumption:** this runs on the operator's own machine, capturing the operator's own typing (e.g. a private teleprompter / scratchpad / cue panel that a shared screen does not reveal). The build is scoped to that use only — no disk persistence, no network, no exfiltration of any kind.

---

## 2. Honest Capability Notes (read before building)

These constraints shape the design; do not promise behavior the platform cannot deliver.

- **Screen-share invisibility is real but Windows-only.** Windows exposes `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` (Windows 10 v2004 / build 19041+). The compositor draws the window on the physical screen but omits it from frame captures. Electron wraps this as `win.setContentProtection(true)`.
- **It defeats software capture only.** Zoom, Meet, Teams, OBS, and OS screenshot tools capture a blank/black region where the window is. A phone camera pointed at the monitor still sees it. Some privileged or hardware/driver-level capture paths can bypass it.
- **Linux has no equivalent.** Neither X11 nor Wayland offers reliable per-window capture exclusion. On the Linux build, `setContentProtection` is a no-op; the README must state this plainly.
- **Global key capture requires a native hook.** This is provided by a native Node module (`uiohook-napi`), which prebuilds binaries for Windows and Linux.

---

## 3. Tech Stack Decision

**Chosen framework: Electron (Node.js).**

Rationale — it is the only candidate that satisfies every hard requirement with minimal friction:

| Requirement | Electron capability |
|---|---|
| Truly transparent, frameless, always-on-top window | `BrowserWindow({ transparent: true, frame: false, alwaysOnTop: true })` |
| Screen-share invisibility | `win.setContentProtection(true)` → maps to `WDA_EXCLUDEFROMCAPTURE` on Windows |
| Global keyboard hook (captures keys without focus) | Native module `uiohook-napi` running in the main process |
| Global app-level shortcuts | `globalShortcut.register(...)` |
| Windows primary + Linux secondary from one codebase | Cross-platform runtime; `electron-builder` targets both |
| Minimal install footprint relative to features | Acceptable; single packaged artifact per OS |

Candidates rejected: **Tauri** (transparent + always-on-top OK, but capture-exclusion and a robust cross-platform global hook require extra native plumbing); **PyQt6/PySide6 + pynput/keyboard** (transparency and global hooks work, but capture-exclusion needs manual `ctypes` calls into `user32` and packaging/transparency is fiddlier across both OSes).

---

## 4. Architecture

```
┌────────────────────── Electron Main Process (main.js) ──────────────────────┐
│  • Creates the BrowserWindow (transparent, frameless, always-on-top)         │
│  • win.setContentProtection(true)         → screen-share invisibility        │
│  • uiohook-napi global keyboard hook      → captures keystrokes everywhere   │
│  • globalShortcut: Ctrl+Shift+Space (toggle), Ctrl+Shift+X (clear)           │
│  • IPC bridge → forwards each keystroke + control events to the renderer     │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                        │ contextBridge / ipcRenderer (preload.js)
┌──────────────────────────────────────▼───────────────────────────────────────┐
│  Renderer (overlay.html + overlay.css + renderer.js)                          │
│  • Slim near-transparent menu bar: Clear · Hide · Close                       │
│  • Scrolling notepad text area: append keystroke, wrap, auto-scroll to bottom │
│  • Draggable panel via -webkit-app-region                                     │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Security posture:** `nodeIntegration: false`, `contextIsolation: true`. The renderer never touches Node directly; a minimal `preload.js` exposes only the specific IPC channels needed (key events in, control commands out).

---

## 5. File Layout

Work only inside these files. Do not create others.

```
/                      project root
├─ package.json        deps, scripts, electron-builder config
├─ main.js             Electron main process
├─ preload.js          contextBridge IPC exposure
├─ README.md           run/build instructions incl. Linux notes
└─ src/
   ├─ overlay.html     panel markup (menu bar + text area)
   ├─ overlay.css      transparent styling, text contrast, drag regions
   └─ renderer.js      receives keystrokes, renders, handles buttons
```

---

## 6. Dependencies (exact, minimal)

Install only these. Anything else → stop and ask (see Section 9).

| Package | Purpose | Scope |
|---|---|---|
| `electron` | runtime / windowing | devDependency |
| `uiohook-napi` | global keyboard hook | dependency |
| `electron-builder` | package Windows `.exe` + Linux `AppImage` | devDependency |

---

## 7. Detailed Requirements (acceptance-mapped)

### Window & display
- Frameless, always-on-top, transparent background (no visible box behind text).
- Always-on-top level should sit above normal windows (use `'screen-saver'` level on Windows).
- Fixed size ~500×300 px (define as constants so it can be adjusted later).
- `skipTaskbar: true` so it does not appear in the taskbar/alt-tab clutter.
- `win.setContentProtection(true)` immediately after window creation.

### Text behavior
- Each global keystroke appends to the panel in real time.
- Map special keys: Space → `' '`, Enter → newline, Backspace → delete last char, Tab → spaces or tab. Ignore pure modifier presses (Ctrl/Shift/Alt/Meta) as standalone characters.
- Text wraps within the fixed width; container auto-scrolls so the newest text is always visible.
- Font ~16–18 px. Bright white text with a thin dark stroke / drop-shadow (e.g. `text-shadow` producing a dark outline) so it reads over light and dark backgrounds.

### Keyboard shortcuts (global)
- `Ctrl+Shift+Space` → toggle overlay visibility.
- `Ctrl+Shift+X` → clear all text.

### Mini menu bar (exactly three buttons)
- **Clear** → empties the text area.
- **Hide** → hides the overlay (same as toggle-hide).
- **Close** → quits the app.
- The bar is transparent / near-transparent — never an opaque system titlebar.

### Dragging
- Panel draggable from anywhere via `-webkit-app-region: drag`.
- The three buttons must set `-webkit-app-region: no-drag` so they remain clickable.

---

## 8. Implementation Phases

Execute in order. Emit a `✅` progress line after each.

**Phase 0 — Decision & scaffold**
- Record the stack choice (Electron) and reason in README.
- `npm init -y`; install the three dependencies from Section 6; add `start` and `build` scripts.
- Create empty `main.js`, `preload.js`, `src/overlay.html`, `src/overlay.css`, `src/renderer.js`.

**Phase 1 — Transparent always-on-top window + capture exclusion**
- Build the `BrowserWindow` with transparent/frameless/always-on-top/fixed-size/skipTaskbar config.
- Call `win.setContentProtection(true)`.
- Load `src/overlay.html`.
- Checkpoint: a transparent box floats on top of everything and is blank in a Zoom/OBS test capture.

**Phase 2 — Layout & styling**
- Markup: top menu bar (Clear · Hide · Close) + scrolling text container.
- CSS: transparent backgrounds, white text with dark stroke/shadow, ~16–18 px, word-wrap, vertical auto-scroll, drag vs no-drag regions.
- Checkpoint: panel looks like a minimal floating notepad; draggable; buttons clickable; readable on light and dark backgrounds.

**Phase 3 — Global key capture via IPC**
- Start `uiohook-napi` in main; on each keydown, translate to a character/control and send over IPC.
- `preload.js` exposes a listener; `renderer.js` appends and auto-scrolls.
- Checkpoint: typing into Chrome shows keystrokes live in the overlay.

**Phase 4 — Shortcuts & button wiring**
- Register `Ctrl+Shift+Space` (toggle) and `Ctrl+Shift+X` (clear) via `globalShortcut`.
- Wire Clear / Hide / Close to their actions (Close fully quits and unregisters the hook + shortcuts).
- Checkpoint: all shortcuts and all three buttons work.

**Phase 5 — Cross-platform packaging + README**
- `electron-builder` config: Windows target `nsis` (or portable `.exe`), Linux target `AppImage`.
- README: install, run (`npm start`), build per-OS, and an explicit note that **content protection / screen-share invisibility does not work on Linux**, plus the camera-capture caveat.
- Checkpoint: documented build commands produce a Windows artifact; Linux build documented.

---

## 9. Scope & Stop Conditions

**In scope:** only the behavior in this document, only inside `/src` and root config/manifest files.

**Explicitly OUT of scope unless asked later:** file saving to disk, cloud sync, settings UI panel, system tray icon, auto-start on boot, hotkey-remapping UI, any abstraction/file beyond those listed in Section 5.

**Stop and ask before:**
- Installing any dependency not in Section 6.
- Adding any network call or external API usage.
- Making the app auto-run at startup or modifying system settings.
- Touching anything outside `/src` and root config files.

---

## 10. Acceptance Criteria

- [ ] App launches without errors on Windows.
- [ ] Window is transparent and frameless — no visible background box.
- [ ] Window stays on top of all other running apps at all times.
- [ ] Typing while Chrome (or any other app) is focused shows keystrokes live in the overlay.
- [ ] Text wraps inside the fixed box and scrolls down when full.
- [ ] Text is readable over both light and dark desktop backgrounds.
- [ ] `Ctrl+Shift+Space` toggles overlay on/off.
- [ ] `Ctrl+Shift+X` clears the text.
- [ ] Mini menu bar shows three working buttons: Clear, Hide, Close.
- [ ] Window is freely draggable.
- [ ] Overlay is excluded from screen capture on Windows (verify in Zoom/OBS).
- [ ] README documents how to run on Linux and notes that capture-exclusion is Windows-only.
