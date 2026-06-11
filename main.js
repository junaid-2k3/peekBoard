'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const { uIOhook, UiohookKey } = require('uiohook-napi');

// --- Window geometry (constants so they can be tuned later) ---
const WINDOW_WIDTH = 500;
const WINDOW_HEIGHT = 300;

let win = null;

// Reverse-lookup table: uiohook keycode -> key name (e.g. 14 -> "Backspace").
// Built once from UiohookKey so keydown handling stays O(1).
const KEYCODE_TO_NAME = Object.fromEntries(
  Object.entries(UiohookKey).map(([name, code]) => [code, name])
);

function createWindow() {
  win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Sit above normal windows and full-screen apps.
  win.setAlwaysOnTop(true, 'screen-saver');

  // Screen-share invisibility -> WDA_EXCLUDEFROMCAPTURE on Windows.
  // No-op on Linux (documented in README).
  win.setContentProtection(true);

  win.loadFile(path.join(__dirname, 'src', 'overlay.html'));

  win.on('closed', () => {
    win = null;
  });
}

// --- Translate a uiohook keydown event into text the renderer appends ---
// Returns { type: 'char', value } | { type: 'control', value } | null.
function translateKey(event) {
  const name = KEYCODE_TO_NAME[event.keycode];
  if (!name) return null;

  switch (name) {
    case 'Space':
      return { type: 'char', value: ' ' };
    case 'Enter':
    case 'NumpadEnter':
      return { type: 'char', value: '\n' };
    case 'Tab':
      return { type: 'char', value: '\t' };
    case 'Backspace':
      return { type: 'control', value: 'backspace' };
    default:
      break;
  }

  // Ignore standalone modifier presses.
  if (/^(Ctrl|Shift|Alt|Meta)/.test(name)) return null;

  // Single printable character keys (letters, digits, punctuation).
  if (name.length === 1) {
    const shift = event.shiftKey;
    return { type: 'char', value: shift ? name.toUpperCase() : name.toLowerCase() };
  }

  // Numpad digits.
  const numpad = /^Numpad(\d)$/.exec(name);
  if (numpad) return { type: 'char', value: numpad[1] };

  // Everything else (function keys, arrows, etc.) is ignored.
  return null;
}

function startKeyHook() {
  uIOhook.on('keydown', (event) => {
    const payload = translateKey(event);
    if (!payload || !win || win.isDestroyed()) return;
    win.webContents.send('key-event', payload);
  });
  uIOhook.start();
}

function registerShortcuts() {
  // Toggle overlay visibility.
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (!win) return;
    if (win.isVisible()) win.hide();
    else win.show();
  });

  // Clear all text.
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    if (win && !win.isDestroyed()) win.webContents.send('clear');
  });
}

// --- IPC control commands from the renderer's menu-bar buttons ---
function registerIpc() {
  ipcMain.on('control', (_event, action) => {
    if (!win) return;
    switch (action) {
      case 'clear':
        win.webContents.send('clear');
        break;
      case 'hide':
        win.hide();
        break;
      case 'close':
        app.quit();
        break;
      default:
        break;
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  registerIpc();
  registerShortcuts();
  startKeyHook();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Single-user overlay: quitting on all-windows-closed is desired on every OS.
app.on('window-all-closed', () => {
  app.quit();
});

// Tear down the native hook and shortcuts on exit.
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  try {
    uIOhook.stop();
  } catch (_) {
    // Hook may already be stopped; ignore.
  }
});
