## Why

Selected theme (light/dark) does not persist after app restart. Root cause: `src/main.js` kills the process before Chromium flushes `localStorage` to disk on quit, so the last `setTheme()` write is lost and the app falls back to the hardcoded default (`"dark"`) on next launch.

## What Changes

- Remove `app.exit(0)` from the `window-all-closed` handler in `src/main.js` — let `app.quit()` alone drive shutdown so Electron flushes storage before the process dies.
- Change `before-quit` handler to stop force-destroying windows (`win.destroy()`) before storage flush completes; let the normal quit sequence close windows.
- No renderer-side changes — `src/frontend/store/theme.js` and `src/renderer.js` read/write `localStorage` correctly already.

## Capabilities

### New Capabilities
- `theme-persistence`: user's selected theme (light/dark) is durably saved and restored across app restarts.

### Modified Capabilities
(none — no existing specs cover app shutdown/theme behavior)

## Impact

- `src/main.js`: `window-all-closed` and `before-quit` handlers.
- No schema, IPC, or renderer API changes.
- No breaking changes.
