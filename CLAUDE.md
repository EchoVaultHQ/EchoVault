# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

EchoVault is a cross-platform desktop music player for lossless audio (FLAC/WAV/ALAC/MP3), built with Electron + Vite + Vue 3.

## Commands

```bash
npm run start      # Dev: Vite renderer + Electron main (auto-reload)
npm run make       # Build + package for current OS -> out/make/
npm run package    # Package without making installers
npm run publish    # Package + publish to GitHub Releases (needs GITHUB_TOKEN)
```

- Node **v20.20.2** (`.nvmrc`). `npm run lint` is a no-op; there are **no tests** wired up.
- Native module `better-sqlite3` is rebuilt against Electron on install/package (`@electron/rebuild`, `rebuildConfig.force`).

## Architecture

Three Electron contexts, all under `src/`:

- **Main process** — `src/main.js`: creates the frameless `BrowserWindow`, initializes the DB, registers a custom `echovault://` buffer protocol (serves cover-art image files by absolute path, with a WSL `/C/...` → `C:/...` fixup), then calls `registerAllHandlers`.
- **Preload** — `src/preload.js`: the *only* renderer↔main bridge. Exposes `window.api.*` via `contextBridge` (contextIsolation on, nodeIntegration off). Every renderer capability must be added here as an `ipcRenderer.invoke/send` wrapper.
- **Renderer** — `src/frontend/`: Vue 3 app (`vue-router`, `pinia`, `vue-i18n`). State lives in `store/` (player, search, theme, enhance). Audio is decoded/played in the renderer via WebAudio (`AudioContext` in `store/player.js`); the main process only hands over raw bytes.

### Backend (main-side, `src/backend/`)

- `db/index.js` — `initDB()` opens `better-sqlite3` at `userData/sonicbox.db` (WAL mode, foreign keys on), loads `db/schema.sql`, and creates indexes. Schema tables: `folders`, `artists`, `tracks`, `playlists` (+ join). All SQL strings live in `db/queries.js`.
- `main/ipcHandlers.js` — `registerAllHandlers(mainWindow, db)` wires up one handler module per domain (`artists`, `tracks`, `library`, `player`, `search`, `window`, `playlists`, `enhance`). Add new IPC by creating a `register*Handlers` module and registering it here.
- `main/scanner.js` — walks a library folder (recursive up to 3 levels), extracts tags via `music-metadata`, writes embedded cover art to `userData/covers/`, and upserts tracks. `main/watcher.js` uses `chokidar` for live folder changes.
- `main/player.js` — file reads: `player:play` (full buffer), `player:streamChunk` (offset/size chunked reads for large files), plus mini-player window resizing.

### AI Audio Enhancement (`main/enhance.js` + `main/downloader.js`)

Enhances a track (MP3→FLAC) via an **external frozen inference binary** running an ONNX model — assets are NOT bundled; they download on first use.

- `enhancer-manifest.json` (repo root) pins the model/config/binary: `baseUrl` (a GitHub release), per-file `sha256` + `bytes`, and a per-platform `binary` map.
- `downloader.js` streams assets to `userData/enhancer/`, following redirects, retrying transient failures, verifying sha256, and `chmod +x` on Unix. `checkReady()` reports what's missing.
- `enhance.js` `enhance:track` spawns the binary and parses its stdout/stderr contract: `PROGRESS <0-100>` / `DONE <path>` on stdout, `ERROR <CODE> <msg>` on stderr (exit code 0 = success). Progress/done/error are pushed to the renderer over `enhance:progress|done|error` channels (subscribe via `window.api.onEnhance*`). The enhanced FLAC is re-scanned and inserted as a new track suffixed `" (Enhanced)"`.

## Build gotchas

- **`vite.main.config.mjs` `closeBundle()` manually copies `schema.sql`, `app-icon.png`, and `enhancer-manifest.json` into `.vite/build/`.** These files are resolved at runtime via `__dirname`/`resourcesPath`; if you rename/move them or break this hook, the packaged app fails to start or enhance. Don't touch it without understanding the copy paths.
- `better-sqlite3` (and `fs`/`path`/`os`) are Rollup `external` in the main config and unpacked from asar in `forge.config.js` (`asar.unpack`, `ignore` allowlist). Keep it out of the bundle.
- Three Vite configs: `vite.main.config.mjs`, `vite.preload.config.mjs`, `vite.renderer.config.mjs`, orchestrated by the electron-forge Vite plugin in `forge.config.js`.
- Renderer CSP is set in `vite.main.config.mjs` `server.headers` — new external origins/schemes for media or images must be allowed there.

## Conventions

- ESM throughout `src/` except `forge.config.js` (CommonJS).
- Logging via `electron-log` (`src/logger.js` / `electron-log/main` / `electron-log/renderer`), tagged `"<module> :: <message>"`. No `console.log` in new code.
- User-facing strings go through `vue-i18n` — add keys to both `src/locales/en.json` and `src/locales/ja.json`.
- `openspec/` holds spec-driven-development change proposals (see the `opsx:*` skills); `SPEC.md` is the project spec.
