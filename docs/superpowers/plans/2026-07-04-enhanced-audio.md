# Enhanced Audio (Stub Phase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fully-wired "Enhance Audio Quality" feature (DB schema, IPC backend, Settings panel, track context-menu action, "Enhanced" smart playlist) driven by a **stub** `inference.py` that fakes the real ONNX model, per `enhanced-audio-implementation-spec.md` §11's own suggested order (steps 1-4). The real model download/runtime bundling (spec §5.4 steps 1-3, §10 open items) is explicitly out of scope for this plan — see "Deferred / blocked" at the bottom.

**Architecture:** New `enhance.js` main-process domain module (mirrors `tracks.js`/`playlists.js`), registered in `ipcHandlers.js`, spawns a stub Python script via `child_process`. Two new nullable columns on `tracks` (`is_enhanced`, `source_track_id`) represent enhanced tracks as ordinary rows, so every existing `SELECT * FROM tracks`-based query keeps working unmodified. Progress/completion pushed main→renderer via `webContents.send` + `ipcRenderer.on` — the first use of that pattern in this codebase (today everything is `invoke`/`handle` request-response only).

**Tech Stack:** Electron main/preload/renderer, `better-sqlite3`, Vue 3 `<script setup>`, `vue-i18n`, Node's `child_process` (no new npm dependencies).

## Global Constraints

- Follow existing file conventions exactly: `template` → `script setup` → `style scoped` block order in `.vue` files (this repo's actual convention, not the generic Vue-block-order guideline), plain JS (no TypeScript, no `lang="ts"`), no new npm dependencies.
- Query constants belong in `src/backend/db/queries.js` (`SCREAMING_SNAKE_CASE`, `//  Domain` header with two spaces) — do not inline raw SQL in `enhance.js` (the spec explicitly calls out `playlists.js`'s inline-SQL as an inconsistency to avoid repeating).
- **No test runner exists in this repo** (`package.json` has no jest/vitest/mocha). Steps that would normally be "write failing test / implement / run test" are instead "write a throwaway verification script under `/tmp`, run it against the real dev DB or dev app, delete it" — do not add a test framework as a side effect of this plan.
- `TrackList.vue`'s existing per-track menu items are plain hardcoded English strings (not `t(...)`) — new menu items and toasts follow that same convention. `Setting.vue` uses `vue-i18n` throughout — new Settings UI strings go through `t(...)` with new keys in `src/locales/en.json` and `src/locales/ja.json`.
- `forge.config.js`'s `ignore` regex and `vite.main.config.mjs`'s `copy-schema` plugin carry explicit "don't modify if you don't know the build process" comments — this plan adds new, additive keys/entries next to them, never edits those flagged lines.

---

### Task 1: DB schema, migration, and query constants

**Files:**
- Modify: `src/backend/db/schema.sql`
- Modify: `src/backend/db/index.js:33-81`
- Modify: `src/backend/db/queries.js` (append new section)
- Modify: `src/backend/main/tracks.js` (add one query + one handler)
- Modify: `src/preload.js:11-17` (add `getTrackById`)

**Interfaces:**
- Produces: query constants `GET_ENHANCED_TRACKS`, `GET_TRACK_BY_ID`, `GET_TRACK_ENHANCEMENT_STATUS`, `GET_ENHANCED_VERSION_FOR_TRACK`, `INSERT_ENHANCED_TRACK` (all exported from `src/backend/db/queries.js`). `window.api.getTrackById(trackId): Promise<TrackRow|undefined>`.

- [ ] **Step 1: Add the two new columns to `schema.sql`'s `CREATE TABLE tracks`**

`CREATE TABLE IF NOT EXISTS` only applies to brand-new databases, so this alone does not migrate existing users — Step 2 handles that. Edit `src/backend/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folder_id INTEGER,
  artist_id INTEGER,
  file_path TEXT UNIQUE,
  title TEXT,
  album TEXT,
  artist TEXT,
  duration REAL,
  cover TEXT,
  isLiked INTEGER DEFAULT 0,
  noOfPlays INTEGER DEFAULT 0,
  is_enhanced INTEGER DEFAULT 0,
  source_track_id INTEGER,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL,
  FOREIGN KEY (source_track_id) REFERENCES tracks(id) ON DELETE CASCADE
);
```

- [ ] **Step 2: Add an `ALTER TABLE` migration + index for existing databases**

This codebase has no `ALTER TABLE` precedent and no schema-version tracking — SQLite has no `ADD COLUMN IF NOT EXISTS`, so wrap each in try/catch (fails harmlessly once the column already exists). Edit `src/backend/db/index.js`, inserting right after `db.exec(schema)` (currently line 65) and before the `indexStatements` array:

```js
  db.exec(schema)

  // ponytail: no schema-version table exists in this codebase, so additive
  // columns on an existing DB go through a plain try/catch ALTER TABLE —
  // it throws (and is ignored) once the column already exists.
  for (const alter of [
    `ALTER TABLE tracks ADD COLUMN is_enhanced INTEGER DEFAULT 0`,
    `ALTER TABLE tracks ADD COLUMN source_track_id INTEGER REFERENCES tracks(id)`,
  ]) {
    try {
      db.exec(alter)
    } catch {
      // column already exists
    }
  }

  const indexStatements = [
```

And add one line inside the existing `indexStatements` array (currently ending at line 76, right before the closing `]`):

```js
    `CREATE INDEX IF NOT EXISTS idx_tracks_source_track_id ON tracks(source_track_id);`,
```

Also update the stale fallback schema string in the same file (`src/backend/db/index.js:47-61`, the `CREATE TABLE IF NOT EXISTS tracks (...)` inside the `if (!schema)` block) with the same two columns as Step 1, so the rarely-hit fallback path stays consistent:

```js
      CREATE TABLE IF NOT EXISTS tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_id INTEGER,
        artist_id INTEGER,
        file_path TEXT UNIQUE,
        title TEXT,
        album TEXT,
        artist TEXT,
        duration REAL,
        cover TEXT,
        isLiked INTEGER DEFAULT 0,
        noOfPlays INTEGER DEFAULT 0,
        is_enhanced INTEGER DEFAULT 0,
        source_track_id INTEGER,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL
      );
```

- [ ] **Step 3: Add query constants**

Append to `src/backend/db/queries.js` (end of file, after `GET_TOTAL_PLAYS`):

```js
//  Enhance
export const GET_ENHANCED_TRACKS = `SELECT * FROM tracks WHERE is_enhanced=1 ORDER BY LOWER(title)`
export const GET_TRACK_BY_ID = `SELECT * FROM tracks WHERE id=?`
export const GET_TRACK_ENHANCEMENT_STATUS = `
  SELECT is_enhanced, source_track_id FROM tracks WHERE id=?
`
export const GET_ENHANCED_VERSION_FOR_TRACK = `
  SELECT id FROM tracks WHERE source_track_id=?
`
export const INSERT_ENHANCED_TRACK = `
  INSERT INTO tracks (
    folder_id, artist_id, file_path, title, album, artist, duration, cover, is_enhanced, source_track_id
  )
  VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, 1, ?)
`
```

- [ ] **Step 4: Expose `GET_TRACK_BY_ID` as an IPC channel** (needed by the "View Enhanced Version" menu action in Task 6, and reused internally by `enhance.js` in Task 3)

Edit `src/backend/main/tracks.js` — add the import and one handler:

```js
import { GET_TRACKS, GET_LIKED_TRACKS, UPDATE_LIKE, GET_TRACK_BY_ID } from "../db/queries.js"
```

```js
  // get a single track by id (used by Enhanced Audio's "view enhanced version")
  ipcMain.handle("tracks:get-track-by-id", (event, trackId) =>
    db.prepare(GET_TRACK_BY_ID).get(trackId)
  )
```

Edit `src/preload.js`, in the `// tracks` section (after line 17's `getLikedTracks`):

```js
  getTrackById: (trackId) => ipcRenderer.invoke("tracks:get-track-by-id", trackId),
```

- [ ] **Step 5: Verify manually** (no test runner in this repo)

```bash
npm start
```
Delete `~/.config/EchoVault/sonicbox.db` first (or wherever `app.getPath("userData")` resolves on your OS) to exercise the fresh-DB `CREATE TABLE` path, confirm the app launches with no SQL errors in the terminal. Then run it again *without* deleting the DB to exercise the `ALTER TABLE` migration path against an existing DB created before this change — confirm no errors and that adding a folder/track still works.

- [ ] **Step 6: Commit**

```bash
git add src/backend/db/schema.sql src/backend/db/index.js src/backend/db/queries.js src/backend/main/tracks.js src/preload.js
git commit -m "feat(enhance): add is_enhanced/source_track_id columns and base queries"
```

---

### Task 2: Stub `inference.py`

**Files:**
- Create: `resources/enhance/inference.py`

**Interfaces:**
- Produces: a CLI matching the real `inference.py`'s documented contract (spec §2) — `--model`, `--config`, `--input`, `--output`, `--provider`, `--self-test`; stdout lines `PROGRESS <0-100>` and `DONE <path>`; stderr line `ERROR <CODE> <message>` with matching exit codes 1-4. Task 3 spawns this exact script.

- [ ] **Step 1: Write the stub**

```python
#!/usr/bin/env python3
# ponytail: stand-in for the real onnx_export/inference.py (spec §2), which
# depends on onnxruntime + a ~107MB model not yet fetchable (spec §10 open
# items: LFS download mechanism, licensing). This copies input -> output and
# fakes the PROGRESS/DONE/ERROR contract so the rest of the feature can be
# built and tested end-to-end. Swap the real script in once §10 is resolved.
import argparse
import os
import shutil
import sys
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model")
    parser.add_argument("--config")
    parser.add_argument("--input")
    parser.add_argument("--output")
    parser.add_argument("--provider", default="auto")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        print("PROGRESS 100")
        print("DONE selftest-ok")
        return 0

    if not args.model or not os.path.exists(args.model):
        print("ERROR MODEL_NOT_FOUND model.onnx not found", file=sys.stderr)
        return 3

    if not args.input or not os.path.exists(args.input):
        print("ERROR INPUT_READ_FAILED input file not found", file=sys.stderr)
        return 2

    if not args.output:
        print("ERROR GENERIC no --output given", file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    for pct in (25, 50, 75, 100):
        print(f"PROGRESS {pct}")
        sys.stdout.flush()
        time.sleep(0.05)

    shutil.copyfile(args.input, args.output)
    print(f"DONE {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Verify manually**

```bash
python3 resources/enhance/inference.py --self-test
echo "exit: $?"
# expect: PROGRESS 100 / DONE selftest-ok / exit: 0

mkdir -p /tmp/enhance-stub-test
cp "$(find ~/Music -iname '*.mp3' -o -iname '*.flac' 2>/dev/null | head -1)" /tmp/enhance-stub-test/in.mp3 || cp package.json /tmp/enhance-stub-test/in.mp3
touch /tmp/enhance-stub-test/model.onnx /tmp/enhance-stub-test/config.json
python3 resources/enhance/inference.py \
  --model /tmp/enhance-stub-test/model.onnx \
  --config /tmp/enhance-stub-test/config.json \
  --input /tmp/enhance-stub-test/in.mp3 \
  --output /tmp/enhance-stub-test/out.flac \
  --provider auto
echo "exit: $?"
diff /tmp/enhance-stub-test/in.mp3 /tmp/enhance-stub-test/out.flac && echo "copy OK"
rm -rf /tmp/enhance-stub-test
```
Expect four `PROGRESS` lines, then `DONE /tmp/enhance-stub-test/out.flac`, exit 0, and `copy OK`.

- [ ] **Step 3: Commit**

```bash
git add resources/enhance/inference.py
git commit -m "feat(enhance): add stub inference.py for end-to-end wiring"
```

---

### Task 3: Backend `enhance.js` module + registration

**Files:**
- Create: `src/backend/main/enhance.js`
- Modify: `src/backend/main/ipcHandlers.js`

**Interfaces:**
- Consumes: `GET_TRACK_BY_ID`, `GET_TRACK_ENHANCEMENT_STATUS`, `GET_ENHANCED_VERSION_FOR_TRACK`, `GET_ENHANCED_TRACKS`, `INSERT_ENHANCED_TRACK` from `../db/queries.js` (Task 1). `resources/enhance/inference.py` (Task 2).
- Produces: `registerEnhanceHandlers(mainWindow, db)`, and IPC channels `enhance:checkDeps`, `enhance:setup` (+ `enhance:setupProgress` push event), `enhance:track`, `enhance:cancelQueued`, `enhance:getEnhancedTracks` (+ `enhance:progress`, `enhance:complete`, `enhance:error` push events). Exact payload shapes match spec §5.2's table.

- [ ] **Step 1: Write `src/backend/main/enhance.js`**

```js
import { ipcMain, app } from "electron"
import { spawn, spawnSync } from "child_process"
import fs from "fs"
import path from "path"
import {
  GET_TRACK_BY_ID,
  GET_TRACK_ENHANCEMENT_STATUS,
  GET_ENHANCED_VERSION_FOR_TRACK,
  GET_ENHANCED_TRACKS,
  INSERT_ENHANCED_TRACK,
} from "../db/queries.js"

function resolveInferenceScript() {
  const candidates = [
    path.join(process.resourcesPath, "enhance", "inference.py"), // packaged app
    path.join(app.getAppPath(), "resources", "enhance", "inference.py"), // dev
  ]
  return candidates.find((p) => fs.existsSync(p)) || null
}

function enhanceDirs() {
  const root = path.join(app.getPath("userData"), "enhance")
  return {
    root,
    model: path.join(root, "model"),
    output: path.join(root, "output"),
    statePath: path.join(root, "state.json"),
  }
}

function readState(dirs) {
  try {
    return JSON.parse(fs.readFileSync(dirs.statePath, "utf-8"))
  } catch {
    return { selfTestPassed: false }
  }
}

function writeState(dirs, state) {
  fs.mkdirSync(dirs.root, { recursive: true })
  fs.writeFileSync(dirs.statePath, JSON.stringify(state))
}

function findPython() {
  // ponytail: uses whatever Python is on PATH. Bundling/downloading an
  // embeddable interpreter (spec §5.4 step 1, §10.3) is an open decision —
  // this sidesteps it for the stub phase. Swap in the real resolved runtime
  // path once that decision is made.
  for (const bin of ["python3", "python"]) {
    const result = spawnSync(bin, ["--version"])
    if (result.status === 0) return bin
  }
  return null
}

export function registerEnhanceHandlers(mainWindow, db) {
  const dirs = enhanceDirs()
  let queue = []
  let isProcessing = false

  function checkDeps() {
    const modelOk =
      fs.existsSync(path.join(dirs.model, "model.onnx")) &&
      fs.existsSync(path.join(dirs.model, "config.json"))
    return {
      runtime: !!findPython(),
      // ponytail: stub script has no extra deps (stdlib only), so this is
      // just "is the bundled script present" — real onnxruntime/soundfile/
      // scipy/mutagen import-check (spec §5.3) lands with the real script.
      dependencies: !!resolveInferenceScript(),
      model: modelOk,
      selfTestPassed: !!readState(dirs).selfTestPassed,
    }
  }

  async function runStep(send, name, alreadyOk, fn) {
    if (alreadyOk) {
      send(name, 100, "done")
      return true
    }
    send(name, 0, "running")
    try {
      await fn()
      send(name, 100, "done")
      return true
    } catch (err) {
      send(name, 0, "error", err.message)
      return false
    }
  }

  ipcMain.handle("enhance:checkDeps", () => checkDeps())

  ipcMain.handle("enhance:setup", async () => {
    const send = (step, percent, status, message) =>
      mainWindow.webContents.send("enhance:setupProgress", {
        step,
        percent,
        status,
        message,
      })

    const deps = checkDeps()

    const runtimeOk = await runStep(send, "runtime", deps.runtime, async () => {
      if (!findPython()) throw new Error("No system Python found on PATH.")
    })
    if (!runtimeOk) throw new Error("Enhancement setup failed at step: runtime")

    const dependenciesOk = await runStep(
      send,
      "dependencies",
      deps.dependencies,
      async () => {
        if (!resolveInferenceScript())
          throw new Error("Bundled inference script not found.")
      }
    )
    if (!dependenciesOk)
      throw new Error("Enhancement setup failed at step: dependencies")

    const modelOk = await runStep(send, "model", deps.model, async () => {
      // ponytail: placeholder files stand in for the real ~107MB Git-LFS
      // model download (spec §5.4 step 3), blocked on spec §10's open
      // items (LFS fetch mechanism + confirmed redistribution licensing).
      fs.mkdirSync(dirs.model, { recursive: true })
      fs.writeFileSync(path.join(dirs.model, "model.onnx"), "stub-model")
      fs.writeFileSync(path.join(dirs.model, "config.json"), "{}")
    })
    if (!modelOk) throw new Error("Enhancement setup failed at step: model")

    const selfTestOk = await runStep(
      send,
      "selftest",
      deps.selfTestPassed,
      async () => {
        const python = findPython()
        const script = resolveInferenceScript()
        const result = spawnSync(python, [script, "--self-test"])
        if (result.status !== 0) {
          throw new Error(result.stderr?.toString().trim() || "self-test failed")
        }
        writeState(dirs, { selfTestPassed: true })
      }
    )
    if (!selfTestOk) throw new Error("Enhancement setup failed at step: selftest")
  })

  ipcMain.handle("enhance:getEnhancedTracks", () =>
    db.prepare(GET_ENHANCED_TRACKS).all()
  )

  ipcMain.handle("enhance:track", (event, { trackId }) => {
    const status = db.prepare(GET_TRACK_ENHANCEMENT_STATUS).get(trackId)
    if (!status) throw new Error("Track not found.")
    if (status.is_enhanced)
      throw new Error("This track is already an enhanced track.")
    if (db.prepare(GET_ENHANCED_VERSION_FOR_TRACK).get(trackId))
      throw new Error("This track already has an enhanced version.")

    const deps = checkDeps()
    if (!deps.runtime || !deps.dependencies || !deps.model || !deps.selfTestPassed) {
      throw new Error("Enhancement is not set up yet. Finish setup in Settings first.")
    }

    const track = db.prepare(GET_TRACK_BY_ID).get(trackId)
    queue.push({ trackId, filePath: track.file_path })
    const position = queue.length
    if (!isProcessing) processNext()
    return { queued: true, position }
  })

  ipcMain.handle("enhance:cancelQueued", (event, { trackId }) => {
    queue = queue.filter((job) => job.trackId !== trackId)
  })

  function processNext() {
    const job = queue.shift()
    if (!job) {
      isProcessing = false
      return
    }
    isProcessing = true

    const python = findPython()
    const script = resolveInferenceScript()
    fs.mkdirSync(dirs.output, { recursive: true })
    const outputPath = path.join(dirs.output, `${job.trackId}.flac`)

    const child = spawn(python, [
      script,
      "--model",
      path.join(dirs.model, "model.onnx"),
      "--config",
      path.join(dirs.model, "config.json"),
      "--input",
      job.filePath,
      "--output",
      outputPath,
      "--provider",
      "auto",
    ])

    let stderr = ""
    let stdoutTail = ""
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    child.stdout.on("data", (chunk) => {
      stdoutTail += chunk
      const lines = stdoutTail.split("\n")
      stdoutTail = lines.pop()
      for (const line of lines) {
        const match = line.match(/^PROGRESS (\d+)/)
        if (match) {
          mainWindow.webContents.send("enhance:progress", {
            trackId: job.trackId,
            percent: Number(match[1]),
          })
        }
      }
    })

    child.on("close", (code) => {
      if (code === 0) {
        const original = db.prepare(GET_TRACK_BY_ID).get(job.trackId)
        const result = db
          .prepare(INSERT_ENHANCED_TRACK)
          .run(
            original.artist_id,
            outputPath,
            original.title,
            original.album,
            original.artist,
            original.duration,
            original.cover,
            job.trackId
          )
        mainWindow.webContents.send("enhance:complete", {
          trackId: job.trackId,
          newTrackId: result.lastInsertRowid,
        })
      } else {
        const match = stderr.match(/ERROR (\w+) (.*)/)
        mainWindow.webContents.send("enhance:error", {
          trackId: job.trackId,
          code: match ? match[1] : "GENERIC",
          message: match ? match[2].trim() : stderr.trim() || "Unknown error",
        })
      }
      processNext()
    })
  }
}
```

- [ ] **Step 2: Register in `ipcHandlers.js`**

Edit `src/backend/main/ipcHandlers.js`:

```js
import { registerArtistHandlers } from "./artists"
import { registerTrackHandlers } from "./tracks"
import { registerLibraryHandlers } from "./library"
import { registerPlayerHandlers } from "./player"
import { registerSearchHandlers } from "./search"
import { registerWindowHandlers } from "./window"
import { registerPlaylistHandlers } from "./playlists"
import { registerEnhanceHandlers } from "./enhance"

export function registerAllHandlers(mainWindow, db) {
  registerArtistHandlers(db)
  registerTrackHandlers(mainWindow, db)
  registerLibraryHandlers(mainWindow, db)
  registerPlayerHandlers(mainWindow, db)
  registerSearchHandlers(mainWindow, db)
  registerWindowHandlers(mainWindow)
  registerPlaylistHandlers(mainWindow, db)
  registerEnhanceHandlers(mainWindow, db)
}
```

- [ ] **Step 3: Verify manually with a throwaway script** (no test runner in this repo)

Run `npm start`, open DevTools console, and drive the round trip directly from `window.api`: `window.api.checkEnhanceDeps().then(console.log)`, then `window.api.setupEnhance().then(...)`, re-check deps, then pick a real track id from `window.api.getTracks()` and call `window.api.enhanceTrack(id)` — confirms the full round trip end-to-end before wiring any UI.

Expect: `checkEnhanceDeps()` initially `{ runtime: true|false, dependencies: true, model: false, selfTestPassed: false }` (assuming `python3`/`python` is on your PATH — `runtime` and `dependencies` should already be true even before setup, since the stub has no real deps); after `setupEnhance()`, all four true; after `enhanceTrack(id)`, `window.api.getEnhancedTracks()` eventually returns a new row (poll it a couple times a second apart — progress-event console logging is verified fully once Task 4/6's preload listeners exist).

- [ ] **Step 4: Commit**

```bash
git add src/backend/main/enhance.js src/backend/main/ipcHandlers.js
git commit -m "feat(enhance): add enhance.js backend module with checkDeps/setup/track queue"
```

---

### Task 4: Preload exposure

**Files:**
- Modify: `src/preload.js`

**Interfaces:**
- Consumes: IPC channels from Task 3.
- Produces: `window.api.checkEnhanceDeps()`, `window.api.setupEnhance()`, `window.api.onEnhanceSetupProgress(cb): () => void`, `window.api.enhanceTrack(trackId)`, `window.api.cancelEnhanceQueued(trackId)`, `window.api.onEnhanceProgress(cb): () => void`, `window.api.onEnhanceComplete(cb): () => void`, `window.api.onEnhanceError(cb): () => void`, `window.api.getEnhancedTracks()`. Each `on*` returns a cleanup function — **new pattern in this codebase** (no prior `ipcRenderer.on` usage), so every caller must call the returned cleanup in `onUnmounted` to avoid duplicate listeners across component remounts.

- [ ] **Step 1: Add the `// enhance` section to `src/preload.js`**, after the existing `// playlist` section (end of the object, before the closing `})`):

```js
  // enhance
  checkEnhanceDeps: () => ipcRenderer.invoke("enhance:checkDeps"),
  setupEnhance: () => ipcRenderer.invoke("enhance:setup"),
  onEnhanceSetupProgress: (cb) => {
    const listener = (_event, data) => cb(data)
    ipcRenderer.on("enhance:setupProgress", listener)
    return () => ipcRenderer.removeListener("enhance:setupProgress", listener)
  },
  enhanceTrack: (trackId) => ipcRenderer.invoke("enhance:track", { trackId }),
  cancelEnhanceQueued: (trackId) =>
    ipcRenderer.invoke("enhance:cancelQueued", { trackId }),
  onEnhanceProgress: (cb) => {
    const listener = (_event, data) => cb(data)
    ipcRenderer.on("enhance:progress", listener)
    return () => ipcRenderer.removeListener("enhance:progress", listener)
  },
  onEnhanceComplete: (cb) => {
    const listener = (_event, data) => cb(data)
    ipcRenderer.on("enhance:complete", listener)
    return () => ipcRenderer.removeListener("enhance:complete", listener)
  },
  onEnhanceError: (cb) => {
    const listener = (_event, data) => cb(data)
    ipcRenderer.on("enhance:error", listener)
    return () => ipcRenderer.removeListener("enhance:error", listener)
  },
  getEnhancedTracks: () => ipcRenderer.invoke("enhance:getEnhancedTracks"),
```

- [ ] **Step 2: Verify manually**

```bash
npm start
```
Open DevTools console in the running app, run:
```js
window.api.checkEnhanceDeps().then(console.log)
const off = window.api.onEnhanceProgress(console.log)
```
Confirm no "not a function" errors and the deps object logs.

- [ ] **Step 3: Commit**

```bash
git add src/preload.js
git commit -m "feat(enhance): expose enhance:* channels on window.api"
```

---

### Task 5: Settings → Enhancement panel

**Files:**
- Modify: `src/frontend/components/Setting.vue`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ja.json`

**Interfaces:**
- Consumes: `window.api.checkEnhanceDeps()`, `window.api.setupEnhance()`, `window.api.onEnhanceSetupProgress(cb)` (Task 4).

- [ ] **Step 1: Add locale keys**

Edit `src/locales/en.json`, replace the `"audio"` block under `"settings"` (currently lines 149-160) — keep `equalizer`/`normalization` as-is (still "coming soon"), add a new `enhance` sibling key:

```json
    "audio": {
      "title": "Audio Settings",
      "description": "Configure audio playback and equalizer",
      "equalizer": {
        "title": "Equalizer",
        "description": "Adjust audio frequencies to your preference"
      },
      "normalization": {
        "title": "Normalization",
        "description": "Normalize volume levels across tracks"
      },
      "enhance": {
        "title": "Audio Enhancement",
        "description": "Upscale tracks to higher fidelity using an on-device model",
        "status": {
          "runtime": "Runtime",
          "dependencies": "Dependencies",
          "model": "Model",
          "selftest": "Self-test"
        },
        "ready": "Ready",
        "missing": "Missing",
        "setupButton": "Set Up Enhancement",
        "settingUp": "Setting up…",
        "verifyButton": "Verify",
        "retryButton": "Retry"
      }
    },
```

Edit `src/locales/ja.json`'s equivalent `"audio"` block (currently lines 151-161) the same way:

```json
    "audio": {
      "title": "オーディオ設定",
      "description": "再生とイコライザの設定を行います",
      "equalizer": {
        "title": "イコライザ",
        "description": "音域を調整して好みの音にします"
      },
      "normalization": {
        "title": "正規化",
        "description": "トラック間の音量を正規化します"
      },
      "enhance": {
        "title": "オーディオ強化",
        "description": "デバイス上のモデルでトラックを高音質化します",
        "status": {
          "runtime": "ランタイム",
          "dependencies": "依存関係",
          "model": "モデル",
          "selftest": "セルフテスト"
        },
        "ready": "準備完了",
        "missing": "未設定",
        "setupButton": "強化機能をセットアップ",
        "settingUp": "セットアップ中…",
        "verifyButton": "確認",
        "retryButton": "再試行"
      }
    },
```

- [ ] **Step 2: Add the panel markup**

Edit `src/frontend/components/Setting.vue`, insert immediately after the existing normalization `setting-group` block, still inside `<!-- Audio Tab -->` (after line 193's closing `</div>`, before line 194's `</div>` that closes `tab-content`):

```vue
              <div class="setting-group enhance-group">
                <div class="setting-label">
                  <i class="fa-solid fa-wand-magic-sparkles"></i>
                  <div>
                    <h3>{{ t("settings.audio.enhance.title") }}</h3>
                    <p>{{ t("settings.audio.enhance.description") }}</p>
                  </div>
                </div>

                <div class="enhance-status-list">
                  <div
                    v-for="row in enhanceStatusRows"
                    :key="row.key"
                    class="enhance-status-row"
                  >
                    <span class="enhance-status-name">{{ row.label }}</span>
                    <span class="enhance-status-badge" :class="{ ok: row.ok }">
                      <i :class="row.ok ? 'fa-solid fa-check' : 'fa-solid fa-xmark'"></i>
                      {{ row.ok ? t("settings.audio.enhance.ready") : t("settings.audio.enhance.missing") }}
                    </span>
                    <button
                      v-if="!row.ok && !isSettingUp"
                      class="link-button"
                      @click="runEnhanceSetup"
                    >
                      {{ t("settings.audio.enhance.retryButton") }}
                    </button>
                  </div>
                </div>

                <p v-if="setupProgressMessage" class="enhance-progress-message">
                  {{ setupProgressMessage }}
                </p>

                <button
                  v-if="!allEnhanceDepsReady"
                  class="btn-primary"
                  :disabled="isSettingUp"
                  @click="runEnhanceSetup"
                >
                  {{ isSettingUp ? t("settings.audio.enhance.settingUp") : t("settings.audio.enhance.setupButton") }}
                </button>
                <button
                  v-else
                  class="link-button"
                  :disabled="isSettingUp"
                  @click="runEnhanceSetup"
                >
                  {{ t("settings.audio.enhance.verifyButton") }}
                </button>
              </div>
```

- [ ] **Step 3: Add script logic**

Edit `src/frontend/components/Setting.vue`'s `<script setup>`:

Change the Vue import (line 278) to add `onUnmounted`:
```js
import { ref, onMounted, onUnmounted, computed } from "vue"
```

Add after the existing `const version = "1.0.1-beta"` line (~337):

```js
// --- Enhance Audio ---
const enhanceDeps = ref({
  runtime: false,
  dependencies: false,
  model: false,
  selfTestPassed: false,
})
const isSettingUp = ref(false)
const setupProgressMessage = ref("")
let removeSetupProgressListener = null

const enhanceStatusRows = computed(() => [
  { key: "runtime", label: t("settings.audio.enhance.status.runtime"), ok: enhanceDeps.value.runtime },
  { key: "dependencies", label: t("settings.audio.enhance.status.dependencies"), ok: enhanceDeps.value.dependencies },
  { key: "model", label: t("settings.audio.enhance.status.model"), ok: enhanceDeps.value.model },
  { key: "selftest", label: t("settings.audio.enhance.status.selftest"), ok: enhanceDeps.value.selfTestPassed },
])

const allEnhanceDepsReady = computed(() => Object.values(enhanceDeps.value).every(Boolean))

async function refreshEnhanceDeps() {
  enhanceDeps.value = await window.api.checkEnhanceDeps()
}

async function runEnhanceSetup() {
  isSettingUp.value = true
  setupProgressMessage.value = ""
  try {
    await window.api.setupEnhance()
  } catch (err) {
    console.error("Enhancement setup failed:", err)
  } finally {
    isSettingUp.value = false
    await refreshEnhanceDeps()
  }
}
```

Update the existing `onMounted` (~389) to also load deps and subscribe to progress, and add a matching `onUnmounted`:

```js
onMounted(() => {
  // keep locale and accent initialization here (theme is initialized in store)
  const savedLang = localStorage.getItem("locale")
  if (savedLang) {
    currentLocale.value = savedLang
    locale.value = savedLang
  }

  const savedColor = localStorage.getItem("accentColor")
  if (savedColor) {
    activeAccent.value = savedColor
    // optionally re-apply CSS variables on mount:
    setAccent(savedColor)
  }

  refreshEnhanceDeps()
  removeSetupProgressListener = window.api.onEnhanceSetupProgress((data) => {
    setupProgressMessage.value = `${data.step}: ${data.status}${data.message ? " — " + data.message : ""}`
  })
})

onUnmounted(() => {
  removeSetupProgressListener?.()
})
```

- [ ] **Step 4: Add minimal styles**

Append to `src/frontend/components/Setting.vue`'s `<style scoped>` (before the closing `</style>`):

```css
.enhance-status-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.enhance-status-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.enhance-status-name {
  flex: 1;
  color: var(--text-color);
  font-size: 0.95rem;
}

.enhance-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.75rem;
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--muted-text);
  background: var(--topbar-bg);
}

.enhance-status-badge.ok {
  color: white;
  background: var(--accent);
}

.enhance-progress-message {
  font-size: 0.85rem;
  color: var(--muted-text);
  margin: 0 0 1rem 0;
}
```

- [ ] **Step 5: Verify manually**

```bash
npm start
```
Open Settings → Audio tab. Confirm all four status rows render, initially some/all show "Missing". Click "Set Up Enhancement", confirm progress messages update live and all four flip to "Ready" (assuming `python3`/`python` is on PATH), and the button becomes "Verify". Quit and relaunch the app, reopen Settings → Audio — confirm all four are still "Ready" without re-running setup (persisted `state.json` + on-disk model files).

- [ ] **Step 6: Commit**

```bash
git add src/frontend/components/Setting.vue src/locales/en.json src/locales/ja.json
git commit -m "feat(enhance): add Enhancement panel to Settings > Audio"
```

---

### Task 6: Track context-menu action + progress + error toasts

**Files:**
- Modify: `src/frontend/components/TrackList.vue`
- Modify: `src/frontend/components/AllSongs.vue`
- Modify: `src/frontend/components/Artists.vue`
- Modify: `src/frontend/components/Playlists.vue` (menu-wiring only — the smart playlist itself is Task 7)

**Interfaces:**
- Consumes: `window.api.checkEnhanceDeps`, `window.api.getEnhancedTracks`, `window.api.enhanceTrack`, `window.api.onEnhanceProgress`, `window.api.onEnhanceComplete`, `window.api.onEnhanceError`, `window.api.getTrackById` (Tasks 1, 3, 4).
- Produces: `TrackList.vue` now emits `enhance-complete` (payload `{ trackId, newTrackId }`) in addition to its existing `select`/`add-to-playlist`/`remove-from-playlist` emits — every parent that renders `<TrackList>` must listen for it and reload its own track list, matching the spec's "no restart/rescan needed" requirement.

- [ ] **Step 1: Add self-contained enhance state + logic to `TrackList.vue`**

`TrackList.vue` is used from 3 different parents (`AllSongs.vue`, `Artists.vue`, `Playlists.vue`); fetching its own deps/enhanced-map on mount avoids threading enhance state through all three as props.

Edit the `<script setup>` import line (currently line 111):
```js
import { ref, computed, onMounted, onUnmounted } from "vue"
```

Add after the existing `const emit = defineEmits(...)` (line 127), replacing it:
```js
const emit = defineEmits([
  "select",
  "add-to-playlist",
  "remove-from-playlist",
  "enhance-complete",
])
```

Add new state and functions after the existing `availablePlaylists` computed (~line 138):

```js
/* === ENHANCE AUDIO STATE === */

const enhanceDeps = ref({ runtime: false, dependencies: false, model: false, selfTestPassed: false })
const enhancedBySourceId = ref(new Map())
const enhanceProgress = ref({})
let removeProgressListener = null
let removeCompleteListener = null
let removeErrorListener = null

const enhanceReady = computed(() => Object.values(enhanceDeps.value).every(Boolean))

async function refreshEnhanceState() {
  enhanceDeps.value = await window.api.checkEnhanceDeps()
  const rows = await window.api.getEnhancedTracks()
  enhancedBySourceId.value = new Map(rows.map((r) => [r.source_track_id, r.id]))
}

function isEnhancedTrack(track) {
  return track.is_enhanced === 1
}

function hasEnhancedVersion(track) {
  return enhancedBySourceId.value.has(track.id)
}

async function startEnhance(track) {
  try {
    await window.api.enhanceTrack(track.id)
    enhanceProgress.value = { ...enhanceProgress.value, [track.id]: 0 }
  } catch (err) {
    window.api.showToast?.(err.message || "Something went wrong while enhancing this track. Please try again.", "error")
  }
  closeMenu()
}

async function viewEnhancedVersion(track) {
  const enhancedId = enhancedBySourceId.value.get(track.id)
  const enhancedTrack = await window.api.getTrackById(enhancedId)
  if (enhancedTrack) emit("select", enhancedTrack)
  closeMenu()
}

const ERROR_COPY = {
  MODEL_NOT_FOUND: "Enhancement model files are missing. Try re-downloading in Settings → Enhancement.",
  INPUT_READ_FAILED: "This file couldn't be read for enhancement — it may be corrupted or in an unsupported format.",
  ORT_INIT_FAILED: "The enhancement engine failed to start. Try reinstalling in Settings → Enhancement.",
  GENERIC: "Something went wrong while enhancing this track. Please try again.",
}
```

- [ ] **Step 2: Wire the menu item into the template**

Edit `src/frontend/components/TrackList.vue`'s dropdown menu (inside the `v-if="openMenuId === track.id"` block, after the existing "Add to playlist" `has-sub` div, currently ending at line 101):

```vue
              <!-- Enhance Audio Quality -->
              <div
                v-if="!isEnhancedTrack(track)"
                class="dropdown-item"
                :class="{ disabled: !enhanceReady }"
                :title="!enhanceReady ? 'Set up Enhancement in Settings first' : ''"
                @click.stop="enhanceReady && (hasEnhancedVersion(track) ? viewEnhancedVersion(track) : startEnhance(track))"
              >
                <span>
                  {{ hasEnhancedVersion(track) ? "View Enhanced Version" : "Enhance Audio Quality" }}
                </span>
                <span v-if="enhanceProgress[track.id] != null" class="enhance-progress-inline">
                  {{ enhanceProgress[track.id] }}%
                </span>
              </div>
```

- [ ] **Step 3: Wire lifecycle listeners**

Edit the existing `onMounted`/`onUnmounted` (currently lines 181-187):

```js
onMounted(() => {
  document.addEventListener("click", closeMenu)
  refreshEnhanceState()
  removeProgressListener = window.api.onEnhanceProgress(({ trackId, percent }) => {
    enhanceProgress.value = { ...enhanceProgress.value, [trackId]: percent }
  })
  removeCompleteListener = window.api.onEnhanceComplete(({ trackId, newTrackId }) => {
    const next = { ...enhanceProgress.value }
    delete next[trackId]
    enhanceProgress.value = next
    refreshEnhanceState()
    window.api.showToast?.("Enhanced version ready.", "success")
    emit("enhance-complete", { trackId, newTrackId })
  })
  removeErrorListener = window.api.onEnhanceError(({ trackId, code, message }) => {
    const next = { ...enhanceProgress.value }
    delete next[trackId]
    enhanceProgress.value = next
    window.api.showToast?.(ERROR_COPY[code] || message, "error")
  })
})

onUnmounted(() => {
  document.removeEventListener("click", closeMenu)
  removeProgressListener?.()
  removeCompleteListener?.()
  removeErrorListener?.()
})
```

- [ ] **Step 4: Add minimal style**

Append to `TrackList.vue`'s `<style scoped>`:

```css
.enhance-progress-inline {
  color: var(--muted-text);
  font-size: 12px;
}
```

- [ ] **Step 5: Wire `enhance-complete` in every parent so the new track shows up without a restart**

Edit `src/frontend/components/AllSongs.vue` — add the listener to the existing `<TrackList>` (line 22-31):
```vue
    <TrackList
      v-if="viewMode === 'list'"
      :tracks="tracks"
      :currentTrack="player.currentTrack"
      :formatDuration="formatDuration"
      :playlists="playlists"
      :currentPlaylistId="null"
      @select="playCurrentTrack"
      @add-to-playlist="handleAddToPlaylist"
      @enhance-complete="loadTracks"
    />
```

Edit `src/frontend/components/Artists.vue` — add the listener to its `<TrackList>` (line 47-56):
```vue
        <TrackList
          v-if="viewMode === 'list'"
          :tracks="artistTracks"
          :currentTrack="player.currentTrack"
          :formatDuration="formatDuration"
          :playlists="playlists"
          :currentPlaylistId="null"
          @select="playCurrentTrack"
          @add-to-playlist="handleAddToPlaylist"
          @enhance-complete="() => selectedArtist && openArtist(selectedArtist.id)"
        />
```

Edit `src/frontend/components/Playlists.vue` — add the listener to its `<TrackList>` (line 103-114); the handler is filled in fully in Task 7 (it needs to reload the enhanced virtual list), so for now just wire a call to a function Task 7 defines:
```vue
        <TrackList
          :tracks="currentTracks"
          :currentTrack="player.currentTrack"
          :formatDuration="formatDuration"
          :playlists="playlists"
          :currentPlaylistId="
            selectedPlaylist !== 'liked' ? selectedPlaylist : null
          "
          @select="playTrack"
          @add-to-playlist="handleAddToPlaylist"
          @remove-from-playlist="handleRemoveFromPlaylist"
          @enhance-complete="handleEnhanceComplete"
        />
```

- [ ] **Step 6: Verify manually**

```bash
npm start
```
Go to Settings → Audio, run setup so all four rows are "Ready". Go to All Songs, open a track's "⋮" menu, confirm "Enhance Audio Quality" is enabled (not the "Set up Enhancement first" tooltip state), click it. Confirm inline "0%" → "25%" → ... progress appears next to the menu item while the menu is reopened, a success toast appears on completion, and re-opening the same track's menu now shows "View Enhanced Version" instead. Click "View Enhanced Version" and confirm the enhanced track starts playing. Then delete the `enhance/model` folder under the app's userData directory and try enhancing a different, not-yet-enhanced track — confirm a `MODEL_NOT_FOUND`-mapped error toast appears (re-run Settings setup afterward to restore state for further testing).

- [ ] **Step 7: Commit**

```bash
git add src/frontend/components/TrackList.vue src/frontend/components/AllSongs.vue src/frontend/components/Artists.vue src/frontend/components/Playlists.vue
git commit -m "feat(enhance): add track context-menu action, progress, and error toasts"
```

---

### Task 7: "Enhanced" smart playlist UI

**Files:**
- Modify: `src/frontend/components/Playlists.vue`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ja.json`

**Interfaces:**
- Consumes: `window.api.getEnhancedTracks` (Task 4), `handleEnhanceComplete` referenced by Task 6 Step 5.
- Produces: a third virtual list alongside the existing hardcoded `"liked"` sentinel, using the identical sentinel-string pattern (`selectedPlaylist.value === "enhanced"`) — this codebase has no rule-based/generic smart-playlist infrastructure, so this follows the one existing precedent (`"liked"`) rather than inventing a new `is_smart` playlist-table concept for a single virtual list.

- [ ] **Step 1: Add locale keys**

Edit `src/locales/en.json` — add a top-level `"enhanced"` key next to the existing `"liked"` key (line 44-46):
```json
  "liked": {
    "title": "Liked Songs"
  },

  "enhanced": {
    "title": "Enhanced Tracks",
    "empty": "No enhanced tracks yet. Set up Enhancement in Settings → Audio, then use \"Enhance Audio Quality\" from any track's menu."
  },
```
And add an `"enhanced"` entry to `"playlist.type"` (currently lines 187-190):
```json
    "type": {
      "liked": "Liked Songs Playlist",
      "playlist": "Playlist",
      "enhanced": "Enhanced Tracks"
    }
```

Edit `src/locales/ja.json` the same way (its `"liked"` key is at lines 44-46; it has no top-level `"playlist"` key today, so only add the `"enhanced"` block, matching the existing gap rather than introducing new `playlist.*` coverage that isn't there for `"liked"` either):
```json
  "liked": {
    "title": "いいねした曲"
  },

  "enhanced": {
    "title": "強化済みトラック",
    "empty": "強化済みトラックはまだありません。設定 → オーディオで強化機能をセットアップし、トラックのメニューから「音質を強化」を実行してください。"
  },
```

- [ ] **Step 2: Add state + loading logic**

Edit `src/frontend/components/Playlists.vue`'s `<script setup>` — add after `const likedTracks = ref([])` (line 160):
```js
const enhancedTracks = ref([])
```

Add a loader mirroring `loadLikedTracks` (after that function, ~line 183):
```js
// Load enhanced tracks
async function loadEnhancedTracks() {
  const result = await window.api.getEnhancedTracks()
  const withCovers = await Promise.all(
    result.map(async (track) => {
      if (track.cover) {
        const url = track.cover.startsWith("/")
          ? `echovault://${track.cover}`
          : `echovault:///${track.cover}`
        return { ...track, coverDataUrl: url }
      }
      return { ...track, coverDataUrl: null }
    })
  )
  enhancedTracks.value = withCovers
}

function handleEnhanceComplete() {
  loadEnhancedTracks()
}
```

Update `selectPlaylist` (currently lines 247-252) to treat `"enhanced"` like `"liked"` (no `loadPlaylistTracks` call needed):
```js
async function selectPlaylist(playlistId) {
  selectedPlaylist.value = playlistId
  if (playlistId !== "liked" && playlistId !== "enhanced") {
    await loadPlaylistTracks(playlistId)
  }
}
```

Update the three computeds (`currentTracks`, `currentPlaylistName`, `currentPlaylistCover`, currently lines 302-319):
```js
const currentTracks = computed(() => {
  if (selectedPlaylist.value === "liked") return likedTracks.value
  if (selectedPlaylist.value === "enhanced") return enhancedTracks.value
  return playlistTracks.value[selectedPlaylist.value] || []
})

const currentPlaylistName = computed(() => {
  if (selectedPlaylist.value === "liked") return t("liked.title")
  if (selectedPlaylist.value === "enhanced") return t("enhanced.title")
  const playlist = playlists.value.find((p) => p.id === selectedPlaylist.value)
  return playlist?.name || ""
})

const currentPlaylistCover = computed(() => {
  if (selectedPlaylist.value === "liked" || selectedPlaylist.value === "enhanced")
    return null
  const playlist = playlists.value.find((p) => p.id === selectedPlaylist.value)
  return playlist?.coverUrl || null
})
```

Update `playTrack`'s `queueSource` (currently lines 322-332):
```js
function playTrack(track) {
  const queueSource =
    selectedPlaylist.value === "liked"
      ? "liked"
      : selectedPlaylist.value === "enhanced"
        ? "enhanced"
        : `playlist-${selectedPlaylist.value}`

  if (player.queueSource !== queueSource) {
    player.clearQueue()
    player.queue = currentTracks.value.map((t) => ({ ...t }))
    player.queueSource = queueSource
  }

  const index = player.queue.findIndex((t) => t.file_path === track.file_path)
  if (index !== -1) {
    player.currentIndex = index
    player.setTrack(player.queue[index], false)
  } else {
    player.setTrack(track)
  }
}
```

Update `onMounted` (currently lines 368-371) to also load enhanced tracks:
```js
onMounted(() => {
  loadLikedTracks()
  loadEnhancedTracks()
  loadPlaylists()
})
```

- [ ] **Step 3: Add the card + hero + empty state to the template**

Edit `src/frontend/components/Playlists.vue`'s grid view — add a new card right after the existing "Liked Songs Card" (after line 26's closing `</div>`, before the `<!-- User Playlists -->` comment on line 28):
```vue
      <!-- Enhanced Tracks Card -->
      <div class="playlist-card enhanced-card" @click="selectPlaylist('enhanced')">
        <div class="card-cover enhanced-cover">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
        </div>
        <div class="card-info">
          <h3>{{ t("enhanced.title") }}</h3>
          <p class="track-count">
            {{ enhancedTracks.length }} {{ t("playlist.tracks") }}
          </p>
        </div>
      </div>
```

Update the hero cover block (currently lines 74-86) to add an enhanced-specific icon:
```vue
        <div class="hero-cover">
          <div v-if="selectedPlaylist === 'liked'" class="liked-hero-cover">
            <i class="fa-solid fa-heart"></i>
          </div>
          <div v-else-if="selectedPlaylist === 'enhanced'" class="enhanced-hero-cover">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
          </div>
          <img
            v-else-if="currentPlaylistCover"
            class="hero-cover-image"
            :src="currentPlaylistCover"
          />
          <div v-else class="hero-default-cover">
            <i class="fa-solid fa-layer-group"></i>
          </div>
        </div>
```

Update the `playlist-type` text (currently lines 88-94):
```vue
          <p class="playlist-type">
            {{
              selectedPlaylist === "liked"
                ? t("playlist.type.liked")
                : selectedPlaylist === "enhanced"
                  ? t("playlist.type.enhanced")
                  : t("playlist.type.playlist")
            }}
          </p>
```

Add an empty state next to the `<TrackList>` in the "Playlist Tracks View" (currently lines 102-115) — show the explainer instead of an empty table when viewing the enhanced list with nothing in it:
```vue
      <div class="playlist-tracks">
        <div
          v-if="selectedPlaylist === 'enhanced' && currentTracks.length === 0"
          class="enhanced-empty-state"
        >
          <p>{{ t("enhanced.empty") }}</p>
        </div>
        <TrackList
          v-else
          :tracks="currentTracks"
          :currentTrack="player.currentTrack"
          :formatDuration="formatDuration"
          :playlists="playlists"
          :currentPlaylistId="
            selectedPlaylist !== 'liked' ? selectedPlaylist : null
          "
          @select="playTrack"
          @add-to-playlist="handleAddToPlaylist"
          @remove-from-playlist="handleRemoveFromPlaylist"
          @enhance-complete="handleEnhanceComplete"
        />
      </div>
```

(Note this replaces the same block already touched in Task 6 Step 5 — Task 6 adds the `@enhance-complete` listener, this step wraps it with the empty-state `v-if`/`v-else`. If executing tasks strictly in order, this is a small additional edit on top of Task 6's version, not a conflicting one.)

- [ ] **Step 4: Add minimal styles**

Append to `Playlists.vue`'s `<style scoped>`:
```css
.enhanced-card .enhanced-cover {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 48px;
}

.enhanced-hero-cover {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 80px;
}

.enhanced-empty-state {
  padding: 3rem 2rem;
  text-align: center;
  color: var(--muted-text);
}
```

- [ ] **Step 5: Verify manually**

```bash
npm start
```
Go to Playlists — confirm a new "Enhanced Tracks" card appears (0 tracks initially) between "Liked Songs" and user playlists, and clicking it shows the empty-state explainer, not a blank table. After enhancing a track from Task 6's verification, revisit this card and confirm the enhanced track now appears and plays correctly, with the queue behaving like a normal playlist (next/prev within the enhanced list).

- [ ] **Step 6: Commit**

```bash
git add src/frontend/components/Playlists.vue src/locales/en.json src/locales/ja.json
git commit -m "feat(enhance): add Enhanced Tracks smart playlist to Playlists view"
```

---

### Task 8: Packaging — bundle `resources/enhance/` and mark `child_process` external

**Files:**
- Modify: `forge.config.js`
- Modify: `vite.main.config.mjs`

**Interfaces:** none (build config only).

- [ ] **Step 1: Add `extraResource` to `forge.config.js`'s `packagerConfig`**

The file has an explicit "IMP: dont touch the packagerConfig" / "dont modify this" comment scoped to the `ignore` line — `extraResource` is Forge's documented, separate mechanism for exactly this case (shipping a non-asar directory alongside the app, the same role `better-sqlite3`'s native binary plays via the `ignore` regex), so add it as a new sibling key rather than touching the flagged line:

```js
  packagerConfig: {
    icon: path.join(__dirname, "src/frontend/assets/icons/app-icon"),
    executableName: "echovault",
    asar: {
      unpack: "*.{node,dll}",
    },
    // ships resources/enhance/ (inference.py + friends) unpacked, alongside
    // the app — read at runtime via process.resourcesPath, same idea as the
    // better-sqlite3 native binary below, just via Forge's dedicated option
    // instead of the ignore regex.
    extraResource: [path.join(__dirname, "resources/enhance")],
    // ignore node_modules and use it on runtime
    // dont modify this
    ignore: [/node_modules\/(?!(better-sqlite3|bindings|file-uri-to-path)\/)/],
  },
```

- [ ] **Step 2: Mark `child_process` external in `vite.main.config.mjs`**

`enhance.js` (Task 3) imports Node's builtin `child_process` in the main process — it must be excluded from Vite's bundling the same way `fs`/`path`/`os`/`better-sqlite3` already are:

```js
    rollupOptions: {
      external: ["better-sqlite3", "fs", "path", "os", "child_process"],
    },
```

- [ ] **Step 3: Verify manually**

Check `package.json`'s `scripts` block for the packaging command (likely `npm run make`), run it, confirm the build succeeds, then inspect the packaged output directory for a `resources/enhance/inference.py` file present unpacked (not inside `app.asar`), and confirm the packaged app launches and Settings → Audio → "Set Up Enhancement" still works against the packaged `resources/enhance/inference.py` path (`process.resourcesPath` branch of `resolveInferenceScript()`).

- [ ] **Step 4: Commit**

```bash
git add forge.config.js vite.main.config.mjs
git commit -m "build(enhance): package resources/enhance/ and externalize child_process"
```

---

## Deferred / blocked (do not implement without explicit confirmation)

Per spec §10, these are explicitly flagged as "confirm before implementing, not guesses" — this plan intentionally stops short of them:

1. **Real model download** (spec §5.4 step 3): fetching the actual ~107MB `model.onnx`/`config.json` via Git LFS. Blocked on: which LFS-download mechanism (LFS media API vs. `git clone` + `git lfs pull`), and the exact `manifest.json` path + git ref to pin against — the model author needs to confirm both.
2. **Model/weights redistribution license** (spec §10.4) — blocks shipping any real download regardless of implementation correctness. Not yet confirmed per the spec.
3. **Bundled vs. downloaded Python runtime** (spec §5.4 step 1, §10.3) — this plan's `findPython()` uses whatever `python3`/`python` is already on the user's PATH as a stub-phase placeholder; it is not a shipping-ready runtime strategy.
4. **Real `onnxruntime`/`soundfile`/`scipy`/`mutagen` dependency install into an isolated `venv-onnx`** (spec §5.4 step 2) — the stub script has no dependencies, so this plan's "dependencies" check is trivial.

Swapping in the real pieces later is a matter of replacing `resources/enhance/inference.py` (Task 2) with the real script + its `requirements-onnx.txt`, and replacing the placeholder blocks marked with `ponytail:` comments in `enhance.js` (Task 3) — the IPC contract, DB schema, and all UI built in Tasks 1 and 4-7 do not need to change.
