## Context

`src/frontend/store/theme.js` writes theme choice to `localStorage` synchronously on every `setTheme()` call. Browser/Chromium `localStorage` backends (leveldb) don't guarantee an immediate disk write on `setItem` — the write is queued and flushed asynchronously by the storage backend.

`src/main.js` currently:
- `window-all-closed`: calls `app.quit()` then immediately `app.exit(0)` (line 137-138).
- `before-quit`: force-destroys all `BrowserWindow`s via `win.destroy()` (line 144).

`app.exit(0)` terminates the process immediately without waiting for Electron's normal shutdown sequence (no `will-quit`/`quit` event flow), which is when Chromium flushes pending storage writes for the session partition. `win.destroy()` on the renderer also skips the graceful `close` teardown a webContents would otherwise get. Combined, the last theme write is frequently lost before hitting disk, so next launch falls back to `renderer.js`'s hardcoded default (`"dark"`).

## Goals / Non-Goals

**Goals:**
- Theme selection survives full app restart reliably.
- Shutdown remains clean — app still quits on `window-all-closed` (non-macOS) without hanging or leaving zombie processes.

**Non-Goals:**
- Not migrating theme storage off `localStorage` to some other persistence layer (e.g., electron-store, DB). Not needed — root cause is shutdown timing, not the storage mechanism.
- Not changing renderer-side theme logic in `theme.js`.

## Decisions

- **Remove `app.exit(0)` from `window-all-closed`.** `app.quit()` alone already triggers the standard Electron shutdown sequence, which waits for webContents/session teardown (including storage flush) before the process exits. `app.exit(0)` exists specifically to skip that sequence — appropriate for crash/force-quit paths, not normal quit. Alternative considered: keep `app.exit(0)` but add a delay/flush call before it — rejected as fragile (arbitrary timing) versus just not force-killing.
- **Change `before-quit` to not force-destroy windows.** Let `app.quit()`'s default behavior close windows normally (fires `close` on each `BrowserWindow`, allowing the renderer/session to unload cleanly) instead of `win.destroy()`, which skips the unload path. Alternative considered: call `session.flushStorageData()` explicitly before destroy — more explicit but adds an extra manual dependency on session internals for what's already the default behavior when quit isn't forced.

## Risks / Trade-offs

- [Removing `app.exit(0)` could theoretically leave the app slower to fully exit under `window-all-closed` if there's a hang in windows closing] → Mitigation: this is standard Electron shutdown; no functional difference expected across platforms already in use (Windows/Linux per `process.platform !== "darwin"` check).
- [Behavior change is only observable across a real restart, not from static analysis] → Mitigation: manual verification step in tasks.md (set theme, quit, relaunch, confirm retained).
