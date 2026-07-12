# Profile: DB Storage + Local Avatar Image

## Context

The profile feature just built (username greeting + TopBar badge) stores the username in `localStorage`. User wants two changes: (1) let the avatar be a picked local image file instead of only a generic icon, (2) move profile storage from `localStorage` into the app's SQLite DB, matching how the rest of the app's persistent data (library, playlists) is stored.

## Scope Decisions (confirmed with user)

- DB shape: dedicated single-row `profile` table (not a generic key-value settings table) — matches the existing schema's per-domain table style.
- Avatar images are copied into `userData/avatar/` (like cover art is copied into `userData/covers/`), not referenced by original path — survives the user moving/deleting the source file.
- No migration of any existing `localStorage` username — feature hasn't shipped, start fresh from the DB.
- This replaces the `localStorage`-based `store/profile.js` built earlier in this session entirely (that implementation is superseded, not kept as a fallback).

## Components

### 1. DB schema — `src/backend/db/schema.sql`

Add a single-row table:
```sql
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT DEFAULT '',
  avatar_path TEXT
);
```
`avatar_path` is an absolute path under `userData/avatar/`, or `NULL` if no avatar set.

### 2. Queries — `src/backend/db/queries.js`

Add query constants following the existing file's convention (each query is a named exported string):
- `GET_PROFILE` — `SELECT username, avatar_path FROM profile WHERE id = 1`
- `UPSERT_PROFILE_USERNAME` — `INSERT INTO profile (id, username) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET username = excluded.username`
- `UPSERT_PROFILE_AVATAR` — `INSERT INTO profile (id, avatar_path) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET avatar_path = excluded.avatar_path`

### 3. Backend handler — `src/backend/main/profile.js`

New `registerProfileHandlers(mainWindow, db)` module, following the shape of the other `register*Handlers` modules (e.g. `library.js`):

- `ipcMain.handle("profile:get", ...)` — reads the row (or `{ username: "", avatar_path: null }` if no row exists yet), returns `{ username, avatarUrl }` where `avatarUrl` is `` `echovault://${avatar_path}` `` if set, else `null`.
- `ipcMain.handle("profile:setUsername", (e, name) => ...)` — trims, runs `UPSERT_PROFILE_USERNAME`.
- `ipcMain.handle("profile:pickAvatar", async () => ...)` — `dialog.showOpenDialog(mainWindow, { filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }], properties: ["openFile"] })`. If not cancelled: ensure `userData/avatar/` exists (`fs.mkdirSync(dir, { recursive: true })`), copy the picked file to `userData/avatar/avatar<ext>` (`fs.copyFileSync`, fixed filename so re-picking overwrites — single avatar, no orphaned files), run `UPSERT_PROFILE_AVATAR` with that path, return `{ avatarUrl }`. If cancelled, return `{ avatarUrl: null, cancelled: true }` (renderer leaves existing avatar untouched on cancel).
- `ipcMain.handle("profile:clearAvatar", () => ...)` — if a file path exists in the DB row, `fs.unlinkSync` it (ignore ENOENT), run `UPSERT_PROFILE_AVATAR` with `null`.

Registered in `src/backend/main/ipcHandlers.js` alongside the other `register*Handlers` calls.

### 4. Preload — `src/preload.js`

Add a `profile` section to the exposed `window.api`:
```js
profile: {
  get: () => ipcRenderer.invoke("profile:get"),
  setUsername: (name) => ipcRenderer.invoke("profile:setUsername", name),
  pickAvatar: () => ipcRenderer.invoke("profile:pickAvatar"),
  clearAvatar: () => ipcRenderer.invoke("profile:clearAvatar"),
},
```

### 5. Frontend store — `src/frontend/store/profile.js` (rewritten)

No more `localStorage`. Pinia setup-store with `username`/`avatarUrl` refs and a `load()` action that calls `window.api.profile.get()` to populate them:
```js
import { defineStore } from "pinia"
import { ref } from "vue"

export const useProfileStore = defineStore("profile", () => {
  const username = ref("")
  const avatarUrl = ref(null)

  async function load() {
    const result = await window.api.profile.get()
    username.value = result.username || ""
    avatarUrl.value = result.avatarUrl
  }

  async function setUsername(name) {
    username.value = name.trim()
    await window.api.profile.setUsername(username.value)
  }

  async function pickAvatar() {
    const result = await window.api.profile.pickAvatar()
    if (result.avatarUrl) avatarUrl.value = result.avatarUrl
  }

  async function clearAvatar() {
    await window.api.profile.clearAvatar()
    avatarUrl.value = null
  }

  return { username, avatarUrl, load, setUsername, pickAvatar, clearAvatar }
})
```

`App.vue`'s existing `onMounted` (where `onUpdateAvailable`/`onTrayControl`/shortcut listener are wired up) calls `useProfileStore().load()` once at startup, so `HomePage`/`Setting`/`TopBar` all read an already-populated store — no per-component loading state needed.

### 6. Settings Profile tab — `Setting.vue`

Username input unchanged (still calls `profileStore.setUsername`). Below it, add an avatar section inside the same `.setting-group` or a new one:
```html
<div class="avatar-row">
  <div class="avatar-preview">
    <img v-if="profileStore.avatarUrl" :src="profileStore.avatarUrl" alt="Avatar" />
    <i v-else class="fa-solid fa-circle-user"></i>
  </div>
  <button class="check-updates-button" @click="profileStore.pickAvatar()">
    {{ t("settings.profile.chooseImage") }}
  </button>
  <button
    v-if="profileStore.avatarUrl"
    class="check-updates-button"
    @click="profileStore.clearAvatar()"
  >
    {{ t("settings.profile.removeImage") }}
  </button>
</div>
```
New i18n keys: `settings.profile.chooseImage` ("Choose Image" / "画像を選択"), `settings.profile.removeImage` ("Remove" / "削除").

### 7. TopBar / HomePage

`TopBar.vue`'s `.profile-badge`: swap the always-shown `<i class="fa-solid fa-circle-user">` for a conditional — `<img>` when `profileStore.avatarUrl` is set, the icon otherwise. `HomePage.vue`'s greeting logic is untouched (it only reads `username`, never touched the icon).

## Files Touched

- `src/backend/db/schema.sql`
- `src/backend/db/queries.js`
- `src/backend/main/profile.js` (new)
- `src/backend/main/ipcHandlers.js`
- `src/preload.js`
- `src/frontend/store/profile.js` (rewritten, no longer localStorage-backed)
- `src/frontend/App.vue` (add `profileStore.load()` call in `onMounted`)
- `src/frontend/components/Setting.vue`
- `src/frontend/components/TopBar.vue`
- `src/locales/en.json` / `src/locales/ja.json`

## Verification

1. `npm run start`.
2. Settings → Profile: click "Choose Image", pick a local PNG/JPG — preview updates immediately, TopBar avatar updates immediately (no restart).
3. Restart the app — avatar and username persist (now from DB, not localStorage).
4. Click "Remove" — avatar reverts to the generic icon everywhere; the copied file under `userData/avatar/` is deleted.
5. Cancel the file picker — nothing changes (existing avatar, if any, stays).
6. Check `userData/avatar/` only ever contains one file at a time (re-picking overwrites, doesn't accumulate).
