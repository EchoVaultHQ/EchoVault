## Why

Fixing the `setResizeable` typo in the previous change exposed a second, previously-masked bug: `win:set-immersive-mode` calls `mainWindow.setFullScreen(true)` immediately followed by `mainWindow.setResizable(false)`. Before the typo fix, the second call silently threw and never ran, so entering fullscreen "worked" by accident. Now that `setResizable(false)` actually executes right after `setFullScreen(true)` on this frameless (`frame: false`) window, the window manager (confirmed Linux) mishandles the transition — the window snaps to the screen's top-left corner and stops responding to input. `setResizable(false)` here is also redundant: fullscreen already prevents the user from resizing, so the call was never load-bearing for anything Immersive Mode actually needs.

Separately, there's no visibility into what the lyrics fallback chain (`.lrc` → embedded → online) actually returns — the logging added in the prior change goes to `electron-log`'s file/main-process output, not the renderer DevTools console the user is actually looking at while testing. And the lyrics panel added in `sync-lyrics-display` renders as centered, non-standard floating text, inconsistent with how every other track list in the app (queue, playlists) is presented.

## What Changes

- Remove the `setResizable(false)`/`setResizable(true)` calls from `win:set-immersive-mode`/`win:reset-immersive-mode` — `setFullScreen` alone is sufficient and doesn't trigger the Linux WM freeze.
- Add renderer-side `console.log` statements in `player.js`'s `getLyrics()` action, logging the source/outcome of each fetch, so the result is visible directly in DevTools console (not just the main-process log file).
- Restyle the Immersive Mode lyrics panel to match the existing queue/playlist row-list convention (`QueueSidebar.vue`'s `.queue-item` pattern: numbered rows, alternating row background, hover/active highlight, left-aligned) instead of the current centered floating-text treatment — active line highlighted the same way the currently-playing queue row is highlighted.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `synced-lyrics` (from `sync-lyrics-display`, in progress, not yet archived): lyrics panel presentation changes from centered scroll to a row-list layout; fetch outcome now also logged to the renderer console.
- `online-lyrics-lookup` / immersive-mode window handling: no requirement change to lookup logic itself, but the window-freeze bug affects the same UI surface (Immersive Mode) these capabilities render into.

## Impact

- **Backend**: `src/backend/main/window.js` (remove 2 lines).
- **Frontend**: `src/frontend/store/player.js` (add console logging), `src/frontend/components/ImmersiveMode.vue` (lyrics panel template/style rewritten to row-list layout, active-line logic unchanged).
- **No schema, no settings, no new dependencies.**
