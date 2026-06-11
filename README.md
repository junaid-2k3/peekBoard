# PeekBoard

A transparent, frameless, always-on-top floating overlay that displays your
keystrokes in real time — even while another application holds keyboard focus.
On Windows it is **excluded from screen-share and screen-recording capture**, so
the panel stays visible on your physical monitor while appearing blank to Zoom,
Google Meet, Teams, and OBS.

> Single-user desktop utility. No disk persistence, no network, no telemetry —
> it only renders what you type, locally.

---

## Features

- **Transparent floating panel** — frameless, always-on-top, styled like a
  minimal notepad with no visible background box.
- **Global keystroke capture** — text appears even when Chrome, an editor, or a
  terminal has focus, via the native `uiohook-napi` hook.
- **Screen-share invisibility (Windows)** — uses `setContentProtection(true)`
  → `WDA_EXCLUDEFROMCAPTURE`.
- **Draggable** from anywhere on the panel.
- **Global shortcuts** — toggle visibility and clear without touching the mouse.
- **Slim three-button menu bar** — Clear · Hide · Close.

---

## Tech stack

**Electron (Node.js).** It is the only framework that satisfies every hard
requirement out of the box: true transparency + frameless + always-on-top
windows, screen-capture exclusion via `setContentProtection`, a robust
cross-platform global keyboard hook (`uiohook-napi`), global shortcuts
(`globalShortcut`), and one-codebase Windows + Linux packaging
(`electron-builder`).

Alternatives such as Tauri or PyQt6 can match transparency and global hooks but
require manual native plumbing for capture-exclusion, so they were rejected.

| Layer | Responsibility |
|---|---|
| `main.js` | Window creation, content protection, global hook, shortcuts, IPC |
| `preload.js` | Minimal `contextBridge` IPC surface (keys in, controls out) |
| `src/overlay.html` / `overlay.css` / `renderer.js` | Panel UI, text rendering, buttons |

Security posture: `nodeIntegration: false`, `contextIsolation: true`. The
renderer never touches Node directly.

---

## Download (prebuilt binaries)

Grab the latest build from the
[**Releases page**](https://github.com/junaid-2k3/peekBoard/releases/latest).

### Windows

1. Download `PeekBoard-Setup-<version>.exe`.
2. Run it. The build is **unsigned**, so Windows SmartScreen shows
   *"Windows protected your PC / unknown publisher"* — click **More info →
   Run anyway**. (This is expected for a free, self-published tool.)

### Linux (AppImage)

```bash
chmod +x PeekBoard-<version>.AppImage
./PeekBoard-<version>.AppImage
```

> Reminder: on Linux the overlay is **not** hidden from screen-share, and global
> keystroke capture is limited under Wayland (see *Platform caveats*).

---

## Requirements

- [Node.js](https://nodejs.org/) 18+ and npm.
- Windows 10 build 19041 (v2004) or newer for capture-exclusion.
- Linux: keystroke capture works; capture-exclusion does **not** (see caveats).

---

## Install

```bash
npm install
```

## Run

```bash
npm start
```

## Usage

| Action | Control |
|---|---|
| Toggle overlay visibility | `Ctrl + Shift + Space` |
| Clear all text | `Ctrl + Shift + X` |
| Clear / Hide / Close | Menu-bar buttons |
| Move the panel | Drag anywhere on it |

---

## Build

Packaging is handled by `electron-builder`.

```bash
# Current platform
npm run build

# Windows installer (.exe via NSIS)
npm run build:win

# Linux AppImage
npm run build:linux
```

Artifacts are written to `dist/`.

---

## Platform caveats (read this)

- **Screen-share invisibility is Windows-only.** It relies on
  `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` (Windows 10 v2004+).
  The compositor draws the window on the physical screen but omits it from frame
  captures.
- **It defeats software capture only.** Zoom, Meet, Teams, OBS, and OS
  screenshot tools see a blank/black region. **A phone camera pointed at the
  monitor still sees the panel.** Some privileged or hardware/driver-level
  capture paths can bypass it.
- **Linux has no equivalent.** Neither X11 nor Wayland offers reliable
  per-window capture exclusion. On Linux, `setContentProtection` is a **no-op** —
  the overlay *will* appear in screen shares. Keystroke capture still works.
- **Global key capture needs the native hook.** On Linux you may need to run
  with appropriate input-device permissions (e.g. membership in the `input`
  group) for `uiohook-napi` to read events.
- **Wayland limits global capture.** `uiohook-napi` reads keys via the X11
  `XRecord` API. Under a Wayland session (e.g. Hyprland), global grab is blocked
  by design — keystrokes from native Wayland apps are not captured; only
  XWayland clients may be seen. Use an X11 session for reliable Linux capture.

---

## Scope

In scope: only the overlay behavior described above. Out of scope (by design):
disk persistence, cloud sync, settings UI, system tray, auto-start, and
hotkey remapping.

## License

MIT
