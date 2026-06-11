'use strict';

const textarea = document.getElementById('textarea');

// Internal buffer mirrors the visible text so Backspace edits are exact.
let buffer = '';

function render() {
  textarea.textContent = buffer;
  // Auto-scroll so the newest text is always visible.
  textarea.scrollTop = textarea.scrollHeight;
}

function clear() {
  buffer = '';
  render();
}

// Incoming keystrokes from the global hook (via preload bridge).
window.peekboard.onKey((payload) => {
  if (payload.type === 'char') {
    buffer += payload.value;
  } else if (payload.type === 'control' && payload.value === 'backspace') {
    buffer = buffer.slice(0, -1);
  }
  render();
});

// Clear triggered by Ctrl+Shift+X or the Clear button (both route through main).
window.peekboard.onClear(clear);

// Menu-bar buttons -> main process.
document.getElementById('clear').addEventListener('click', () => {
  window.peekboard.control('clear');
});
document.getElementById('hide').addEventListener('click', () => {
  window.peekboard.control('hide');
});
document.getElementById('close').addEventListener('click', () => {
  window.peekboard.control('close');
});
