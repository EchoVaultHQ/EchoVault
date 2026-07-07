# EchoVault — "Enhanced Audio" Feature: Implementation Spec

> **Audience**: implementer (Claude Code or a human engineer) working directly in the EchoVault codebase.
> **Status**: architecture decided, ready to build. The ONNX-vs-PyTorch decision gate has been resolved — this spec targets the **ONNX Runtime, torch-free** path only. Do not implement a Python/PyTorch venv path; it was considered and rejected in favor of this one.
>
> This spec assumes familiarity with the existing EchoVault codebase structure (Electron main/preload/renderer, `better-sqlite3`, `ipcHandlers.js` per-domain pattern, `contextBridge`-exposed `window.api`). Follow existing code conventions in each area rather than introducing new patterns.

---

## 1. What we're building

A user can right-click a track (or a folder) in their library and choose "Enhance Audio Quality." This runs a bundled ONNX model (via a spawned Python subprocess running `onnx_export/inference.py`, supplied by the model author) that upsamples the track to a higher-fidelity FLAC. The result appears as a new track in the library and in a virtual "Enhanced" smart playlist. No PyTorch, no CUDA, no network calls except a one-time model download during setup.

## 2. External artifacts this feature depends on

These come from the `audioreconstruction` repo, at **`onnx/`** (not `onnx_export/` — corrected against the actual repo layout; already built by the model author, not something this implementation needs to create):

| Artifact | Location | Purpose |
|---|---|---|
| `inference.py` | `onnx/inference.py` — a plain script, not a package. Invoke it directly (`python inference.py ...`), not via `python -m onnx_export.inference`. | Torch-free CLI: MP3 → enhanced FLAC. This is what EchoVault spawns as a subprocess. |
| `requirements-onnx.txt` | under `onnx/` — confirm exact filename/path in repo before bundling | Pinned deps for `inference.py` (`onnxruntime`, `soundfile`, `scipy`, `mutagen`, etc.) |
| `model.onnx` + `config.json` | `onnx/exported/model.onnx`, `onnx/exported/config.json` — **committed directly in the git repo via Git LFS, not hosted on HuggingFace.** `model.onnx` is ~107MB. | The exported model, fetched at setup time |
| `manifest.json` | confirm exact path in repo before bundling | Version + sha256 + byte-size pins for `model.onnx`/`config.json`, used to verify downloads |

**Important — Git LFS, not a plain file host.** `model.onnx` is LFS-tracked. A naive HTTP GET against a `raw.githubusercontent.com` URL for that path returns a small LFS *pointer* file (a text stub containing an oid/sha256/size, a few hundred bytes) — **not** the actual binary. Implementation must not treat "got 200 OK and some bytes" as success; it must verify the downloaded byte size matches `manifest.json` before proceeding. See §5.4 step 3 for the required download approach.

**`inference.py`'s CLI contract** (already implemented, do not modify):
```
python -m onnx_export.inference \
  --model <path>/model.onnx \
  --config <path>/config.json \
  --input <src-audio-path> \
  --output <dst-flac-path> \
  --provider auto
```
Also supports `--self-test` (no `--input`/`--output` needed) — runs a synthetic round-trip, used to validate setup.

**stdout contract**:
- `PROGRESS <0-100>` — emitted per chunk, parse the integer, forward to renderer.
- `DONE <output_path>` — success, always followed by exit code 0.

**stderr contract** (on failure, non-zero exit):
- `ERROR MODEL_NOT_FOUND <message>` — exit code 3
- `ERROR INPUT_READ_FAILED <message>` — exit code 2
- `ERROR ORT_INIT_FAILED <message>` — exit code 4
- `ERROR GENERIC <message>` — exit code 1

Metadata/cover-art copying from source to output is already handled inside `inference.py` — **do not duplicate this in EchoVault**.

---

## 3. Database changes

New migration, additive only, following the existing idempotent `CREATE TABLE IF NOT EXISTS` pattern in `schema.sql`:

```sql
ALTER TABLE tracks ADD COLUMN is_enhanced INTEGER DEFAULT 0;
ALTER TABLE tracks ADD COLUMN source_track_id INTEGER REFERENCES tracks(id);
```

Add corresponding query constants to `src/backend/db/queries.js` following the existing naming convention (e.g. `GET_ENHANCED_TRACKS`, `INSERT_ENHANCED_TRACK`, `GET_TRACK_ENHANCEMENT_STATUS`). Do not inline raw SQL in the new handler file — `playlists.js` does this and it's flagged as an inconsistency to avoid repeating, not a pattern to follow.

**Rules enforced at the query layer**:
- A track with `is_enhanced = 1` cannot be enhanced again (its `source_track_id` already points elsewhere; check this before allowing the "Enhance" action to fire).
- A track that already has an enhanced version linked to it (i.e. some other row's `source_track_id` points to it) should show "View Enhanced Version" instead of "Enhance Audio Quality" in the UI.
- Original track rows/files are never modified or deleted by this feature.

**"Enhanced" smart playlist**: not a new row in the `playlists` table. It's a query filter (`WHERE is_enhanced = 1`) exposed the same way `Playlists.vue` renders other lists, but backed by `GET_ENHANCED_TRACKS` instead of a playlist-membership join. Confirm with existing `Playlists.vue`/`playlists.js` how virtual/smart lists (if any precedent exists) are currently distinguished in the UI; if none exists yet, add a `type: 'smart'` flag purely at the frontend list-rendering level, no backend playlist ID needed.

---

## 4. Directory layout (new)

```
<userData>/
├── enhance/
│   ├── runtime/            # bundled/embeddable Python interpreter (see §6)
│   ├── venv-onnx/          # pip-installed requirements-onnx.txt, isolated from anything else
│   ├── model/
│   │   ├── model.onnx
│   │   ├── config.json
│   │   └── manifest.json   # copy of the pinned manifest, used to verify the above two
│   └── output/             # enhanced FLAC files land here
```

App-bundled resources (shipped with the installer, not downloaded):
```
resources/
└── enhance/
    ├── inference.py           # copied from the audioreconstruction repo's onnx/inference.py at build time
    ├── requirements-onnx.txt  # from onnx/ — confirm exact filename in repo
    └── manifest.json          # pinned expected hashes, ships with the app so verification works before any network call — confirm exact path in repo
```
`model.onnx`/`config.json` themselves are **not** bundled with the app (too large, and licensing for redistribution is still unconfirmed per §10.4) — they're fetched at setup time per §5.4 step 3.

Add `resources/enhance/` to Forge's packaging config as an extra resource directory (not asar-bundled — same treatment `better-sqlite3`'s native binary already gets, per the existing `forge.config.js` `ignore` regex). **Read the existing comment warnings in `vite.main.config.mjs` and `forge.config.js` before touching either file** — both have explicit "don't modify if you don't know the build process" comments; extend carefully, don't restructure.

---

## 5. Backend: new module `src/backend/main/enhance.js`

Register in `ipcHandlers.js`'s `registerAllHandlers()` alongside existing domain handlers, following the same registration pattern used for `tracks.js`/`playlists.js`/etc.

### 5.1 State
Module-level job queue (single in-flight job at a time — mirror the existing debounce/flag pattern already used in `player.js` for mini-player resize, don't introduce a new concurrency pattern). Queued jobs are an array of `{ trackId, filePath }`; only one child process runs at once.

### 5.2 IPC handlers

| Channel | Type | Payload in | Payload out / event |
|---|---|---|---|
| `enhance:checkDeps` | `invoke` | none | `{ runtime: bool, dependencies: bool, model: bool, selfTestPassed: bool }` |
| `enhance:setup` | `invoke` | none | kicks off setup sequence, resolves when done or throws on first failed step |
| `enhance:setupProgress` | `event` (main→renderer) | — | `{ step: 'runtime'|'dependencies'|'model'|'selftest', percent: number, status: 'running'|'done'|'error', message?: string }` |
| `enhance:track` | `invoke` | `{ trackId: number }` | enqueues job, resolves immediately with `{ queued: true, position: number }` |
| `enhance:progress` | `event` | — | `{ trackId: number, percent: number }` |
| `enhance:complete` | `event` | — | `{ trackId: number, newTrackId: number }` |
| `enhance:error` | `event` | — | `{ trackId: number, code: 'MODEL_NOT_FOUND'|'INPUT_READ_FAILED'|'ORT_INIT_FAILED'|'GENERIC', message: string }` |
| `enhance:cancelQueued` | `invoke` | `{ trackId: number }` | removes from queue if not yet started; no-op if already running |

Expose all of these through `src/preload.js`'s `window.api` surface, matching the existing naming/wrapping style used for other domains (e.g. how `tracks:*` channels are currently exposed).

### 5.3 `enhance:checkDeps` implementation

Real checks, not cached flags:
- `runtime`: does the bundled Python executable exist at the expected path and respond to `--version`?
- `dependencies`: run `<runtime> -c "import onnxruntime, soundfile, scipy, mutagen"` inside `venv-onnx`, check exit code 0.
- `model`: do `model.onnx` and `config.json` exist under `<userData>/enhance/model/`, and does their sha256 match `manifest.json`'s pinned values? (Reuse one hashing utility for both the app-bundled manifest check and this one.)
- `selfTestPassed`: track this as a persisted flag (e.g. a small JSON file or a settings-table row) set the first time `--self-test` exits 0 after setup; re-verify by re-running `--self-test` if the model/dependencies checks above have changed since it was last set.

### 5.4 `enhance:setup` implementation, step by step

1. **Runtime**: if not present, either extract a bundled embeddable Python from app resources, or download one — **decide and document which at implementation time**; extracting a bundled interpreter is preferred since it avoids a network dependency for this step and keeps setup deterministic.
2. **Dependencies**: create `venv-onnx/` if absent, run `pip install -r requirements-onnx.txt` (the bundled copy under `resources/enhance/`) into it. Stream pip's output into `enhance:setupProgress` as raw status (doesn't need per-percent parsing, just "installing..." → "done").
3. **Model**: `model.onnx` (~107MB) and `config.json` live in the `audioreconstruction` GitHub repo under `onnx/exported/`, tracked via **Git LFS** — not hosted on HuggingFace, and not fetchable as a plain HTTPS file. This changes what "download" means here:
   - **Do not** GET a `raw.githubusercontent.com` URL for `model.onnx` and treat any 200 response as success — for an LFS-tracked file that returns a small text pointer (an oid/sha256/size stub of a few hundred bytes), not the binary. A naive implementation will "succeed" while writing a ~130-byte garbage file, and every downstream step (hash check, self-test, real inference) will fail confusingly if this isn't caught at the source.
   - Correct approaches, in order of preference: (a) use GitHub's LFS media API / a `git lfs`-aware fetch to resolve the pointer to the actual object, or (b) shell out to `git clone` (sparse/shallow, just the `onnx/` path if possible) followed by `git lfs pull` in a temp directory during setup, then copy the resolved files into `<userData>/enhance/model/`. Do not attempt to hand-parse the LFS pointer format and reimplement the LFS protocol from scratch.
   - **Always verify by byte size before trusting a downloaded file**: if the resulting `model.onnx` is anywhere near the pointer-file size (bytes, not megabytes) rather than the ~107MB expected size, treat it as a failed download, not a corrupt-but-real one.
   - After a size-sane download, verify sha256 against the bundled `manifest.json`. **Reject and delete on mismatch, then retry once automatically before surfacing an error** — don't leave a corrupted/mismatched file in place.
   - Confirm the exact `manifest.json` path/contents and the precise repo ref (branch/tag/commit) to pin against with the model author before hardcoding a URL or clone target — `main` can move; prefer pinning to a commit SHA or tag if the author provides one, so a future upstream change doesn't silently swap the model under an already-shipped app version.
4. **Self-test**: run `inference.py --self-test` with the newly-installed runtime/deps/model. Must exit 0. Persist the "selfTestPassed" flag only on success.

Each step failing stops the sequence and reports which step failed via `enhance:setupProgress`'s `status: 'error'` — do not silently continue to the next step. Each step must be independently retriable without re-running prior successful steps (e.g. if step 3 fails, retry only downloads the model again, doesn't reinstall dependencies).

### 5.5 `enhance:track` implementation

1. Validate: track exists, is not already enhanced (`is_enhanced = 0`), doesn't already have an enhanced version pointing to it, and all `checkDeps` conditions are true. Reject immediately (don't queue) if any of these fail, with a clear reason.
2. Enqueue `{ trackId, filePath }`. If queue was empty, start immediately.
3. Spawn (note: `inference.py` is a standalone script, invoked directly — **not** `python -m onnx_export.inference`, that module path was based on an earlier/incorrect assumption about the repo layout):
   ```
   <venv-onnx>/python <bundled-resources>/enhance/inference.py \
     --model <userData>/enhance/model/model.onnx \
     --config <userData>/enhance/model/config.json \
     --input <original file path> \
     --output <userData>/enhance/output/<generated filename>.flac \
     --provider auto
   ```
4. Parse stdout line-by-line: `PROGRESS <n>` → emit `enhance:progress`; `DONE <path>` → proceed to step 5.
5. On success: insert new `tracks` row via `INSERT_ENHANCED_TRACK` with `is_enhanced=1`, `source_track_id=<original id>`, pointing at the output FLAC path. Emit `enhance:complete`. Let the existing scanner/watcher path pick up the new file naturally where applicable, but insert the DB row directly here rather than waiting on a filesystem-watch cycle — the app already knows the exact result, no need to round-trip through file-discovery.
6. On failure (non-zero exit): parse the `ERROR <CODE> <message>` line from stderr, emit `enhance:error` with that code/message. **Map codes to user-facing copy in the renderer, not here** — this handler should forward the raw code, not translate it (keep the translation table in the UI layer so copy changes don't require a backend rebuild).
7. Advance the queue: start the next job if one is queued, regardless of whether the previous one succeeded or failed.

**Filename collision handling for output files**: generate output filenames deterministically from the original track ID (not the original filename) to avoid the same collision class already documented as a known bug for cover art in the base spec (`path.basename(filePath) + ".jpg"` collisions) — e.g. `<userData>/enhance/output/<trackId>.flac`.

---

## 6. Settings UI — Enhancement panel (`Setting.vue`)

New section, following the existing structure/conventions in `Setting.vue` (theme/mini-player/immersive toggles already live here — match visual style, don't introduce a new settings-page pattern).

- Four status rows (Runtime / Dependencies / Model / Self-test), each backed by live `enhance:checkDeps` results, not manually-set toggles.
- Single "Set Up Enhancement" primary button that calls `enhance:setup` and shows combined progress (driven by `enhance:setupProgress` events) across all four steps.
- Per-row retry buttons that appear only if that specific row failed — do not force a full setup restart for a single failed step.
- If all four are ✅, replace the setup button with a "Reinstall" / "Verify" affordance for troubleshooting, rather than hiding the panel entirely.

## 7. Track UI — enhance action & progress

- Add "Enhance Audio Quality" to the existing track context menu (wherever track-level actions currently live — check `TrackList.vue`/`TrackGrid.vue` for the existing per-track menu pattern and extend it, don't create a new menu component).
- Menu item states:
  - Disabled + tooltip "Set up Enhancement in Settings first" if `checkDeps` isn't fully green.
  - "Enhance Audio Quality" if eligible.
  - "View Enhanced Version" (jumps to the enhanced track) if already enhanced.
  - Hidden or disabled entirely if the track itself **is** an enhanced track (has a `source_track_id`) — don't allow enhancing an enhanced track.
- On triggering: show a per-track progress indicator (reuse whatever inline progress/loading pattern already exists in the codebase for other async per-track operations, if one exists; otherwise a simple inline percentage next to the track row is sufficient for v1 — no need for a dedicated global "jobs" panel).
- On `enhance:complete`: refresh the relevant list view so the new track/playlist membership appears without requiring a manual app restart or rescan.
- On `enhance:error`: toast with user-facing copy per the code-mapping table below.

### 7.1 Error code → user-facing copy mapping (renderer-side)

| Code | User-facing message |
|---|---|
| `MODEL_NOT_FOUND` | "Enhancement model files are missing. Try re-downloading in Settings → Enhancement." |
| `INPUT_READ_FAILED` | "This file couldn't be read for enhancement — it may be corrupted or in an unsupported format." |
| `ORT_INIT_FAILED` | "The enhancement engine failed to start. Try reinstalling in Settings → Enhancement." |
| `GENERIC` | "Something went wrong while enhancing this track. Please try again." |

## 8. "Enhanced" smart playlist UI

- New entry in the existing playlist/navigation list (wherever `Playlists.vue` currently renders user playlists), visually distinguished as a smart/system playlist (not draggable/deletable/renameable like user playlists).
- Backed by `GET_ENHANCED_TRACKS`, refreshed on `enhance:complete`.
- Empty state: if no tracks are enhanced yet, show a short explainer + link to the Settings panel rather than an empty list with no context.

---

## 9. Explicit non-goals for this implementation pass

- No real-time/streaming enhancement.
- No mid-inference job cancellation (only queued-but-not-started jobs can be cancelled, via `enhance:cancelQueued`).
- No resuming interrupted jobs across app restarts — if the app closes mid-job, the user re-triggers it next launch. Don't build resume logic.
- No GPU-specific settings UI — `--provider auto` handles device selection internally; do not expose a provider picker to the user in v1.
- No batch/folder-level "enhance all" in this pass unless explicitly requested afterward — build single-track enhancement first, folder-level can reuse the same queue mechanism later without rearchitecting.

## 10. Open items to confirm before/during implementation (not guesses)

1. ~~Exact HuggingFace repo path~~ — **resolved**: the repo is `https://github.com/rohan-prasen/audioreconstruction`, model files live at `onnx/exported/model.onnx` and `onnx/exported/config.json`, tracked via Git LFS (not HuggingFace). What's still open: the exact `manifest.json` path/contents, and which git ref (branch/tag/commit) to pin the download against — confirm with the model author rather than defaulting to `main`.
2. Confirm which LFS-download mechanism to implement (§5.4 step 3: GitHub LFS media API vs. `git clone` + `git lfs pull` in a temp dir) — this needs a concrete decision before writing the download code, since it determines what tooling/dependencies the setup step needs available (e.g. whether `git` and `git-lfs` must be present on the user's system, or whether a pure-HTTP LFS API call avoids that requirement — the latter is preferable if feasible, since it avoids adding "does the user have git installed" as a new dependency check).
3. Whether to bundle an embeddable Python interpreter with the installer vs. downloading one at setup time (§5.4 step 1) — pick one and document the choice in code comments, since it affects installer size materially.
4. Confirm the model's/weights' license permits redistribution/programmatic download by EchoVault (blocks shipping regardless of implementation correctness — flag this to the user if not yet confirmed, don't proceed to build the download step against unconfirmed licensing).

## 11. Suggested implementation order

1. Schema migration (§3) + query constants — no UI dependency, can be done and tested standalone.
2. `enhance.js` skeleton with `checkDeps`/`setup` against a **stubbed** fake `inference.py` (a trivial script that just copies input to output and prints fake `PROGRESS`/`DONE` lines) — unblocks all IPC/UI work without needing the real model or resolved open items above.
3. Settings → Enhancement panel, wired to the stub.
4. Track context menu action + progress UI + smart playlist, wired to the stub end-to-end.
5. Swap the stub for the real `inference.py` + real model download once open items in §10 are resolved.
6. End-to-end test: enhance a real track, confirm correct FLAC output, correct metadata/cover art carried over (verify `inference.py`'s built-in tagging actually works as documented — don't assume, check), correct DB row, correct playlist membership, correct behavior on a forced failure (delete the model file mid-run and confirm `MODEL_NOT_FOUND` surfaces correctly in the UI).
