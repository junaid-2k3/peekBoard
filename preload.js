'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Minimal, explicit IPC surface. The renderer gets no direct Node access.
contextBridge.exposeInMainWorld('peekboard', {
  // Keystroke stream from the global hook: payload = { type, value }.
  onKey: (callback) => {
    ipcRenderer.on('key-event', (_event, payload) => callback(payload));
  },
  // Main process asks the renderer to clear (shortcut or button).
  onClear: (callback) => {
    ipcRenderer.on('clear', () => callback());
  },
  // Menu-bar buttons -> main process: 'clear' | 'hide' | 'close'.
  control: (action) => {
    ipcRenderer.send('control', action);
  }
});
