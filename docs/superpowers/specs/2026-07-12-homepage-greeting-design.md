# Time-of-Day Greeting + Optional Username

## Context

Homepage's "Now Playing" hero has no personalization. The i18n locale files already carry dead `home.greeting.morning/afternoon/evening` keys that are never rendered anywhere — this feature activates them. Add a greeting line above "Now Playing" ("Good morning" / "Good afternoon" / "Good evening" / "Good night") plus an optional username, settable in a new Settings tab and shown in the greeting and in the TopBar next to a generic avatar icon.

## Scope Decisions (confirmed with user)

- Avatar is a generic icon only (fa-solid fa-circle-user) — no photo upload.
- Username setting lives in its own new "Profile" tab in Settings, not bolted onto Appearance.
- Time boundaries: 5am–12pm Morning, 12pm–5pm Afternoon, 5pm–9pm Evening, 9pm–5am Night.
- TopBar placement: right side, before the Theme button.
- If no username is set, only the greeting text and only the avatar icon show — no name anywhere.

## Components

### 1. New store: `src/frontend/store/profile.js`

Pinia setup-store, same shape as `theme.js`/`accent.js`: `ref` + `localStorage` (key `"username"`).

```js
import { defineStore } from "pinia"
import { ref } from "vue"

export const useProfileStore = defineStore("profile", () => {
  const username = ref(localStorage.getItem("username") || "")

  function setUsername(name) {
    username.value = name.trim()
    localStorage.setItem("username", username.value)
  }

  return { username, setUsername }
})
```

### 2. HomePage.vue — greeting line

Add a computed `greeting` above the existing `.now-playing-label` div:

```js
import { useProfileStore } from "../store/profile.js"
const profile = useProfileStore()

const greeting = computed(() => {
  const hour = new Date().getHours()
  const key =
    hour >= 5 && hour < 12 ? "morning" :
    hour >= 12 && hour < 17 ? "afternoon" :
    hour >= 17 && hour < 21 ? "evening" : "night"
  const base = t(`home.greeting.${key}`)
  return profile.username ? `${base}, ${profile.username}` : base
})
```

Template addition, directly above the existing `<div class="now-playing-label">` (HomePage.vue line ~5):

```html
<p class="greeting-text">{{ greeting }}</p>
```

Styled as a small muted line above the label (reuse `--muted-text` variable already used elsewhere in the app, font-size ~0.95rem).

### 3. Settings — new "Profile" tab

Add to the `tabs` array in `Setting.vue` (after `appearance`, before `language` — first tab since it's identity-related):

```js
{ id: "profile", labelKey: "settings.tabs.profile", icon: "fa-solid fa-user" },
```

New tab content block, following the existing `.setting-group` + `.lastfm-input` idiom already used for the Last.fm API fields:

```html
<div v-if="activeTab === 'profile'" class="tab-content">
  <h2 class="section-title">{{ t("settings.profile.title") }}</h2>
  <p class="section-description">{{ t("settings.profile.description") }}</p>

  <div class="setting-group">
    <div class="setting-label">
      <i class="fa-solid fa-user"></i>
      <div>
        <h3>{{ t("settings.profile.usernameLabel") }}</h3>
      </div>
    </div>
    <input
      class="lastfm-input"
      type="text"
      :placeholder="t('settings.profile.usernamePlaceholder')"
      v-model="usernameInput"
      @blur="profileStore.setUsername(usernameInput)"
      @keyup.enter="profileStore.setUsername(usernameInput)"
    />
  </div>
</div>
```

Script: `const profileStore = useProfileStore()`, `const usernameInput = ref(profileStore.username)`.

### 4. TopBar.vue — avatar + username

In the `.actions` div, insert before the Theme button (right side, per confirmed placement):

```html
<div class="profile-badge" :title="profileStore.username || t('settings.tabs.profile')">
  <i class="fa-solid fa-circle-user profile-icon"></i>
  <span v-if="profileStore.username" class="profile-name">{{ profileStore.username }}</span>
</div>
```

`profileStore` imported via `useProfileStore()`. Icon always shows; name span only renders when username is set (per scope decision — no name anywhere when unset).

### 5. i18n — `src/locales/en.json` / `src/locales/ja.json`

Add:
- `home.greeting.night` — "Good night" / "こんばんは" (reusing existing `home.greeting.morning/afternoon/evening`, which are currently unused dead keys this feature activates)
- `settings.tabs.profile` — "Profile" / "プロフィール"
- `settings.profile.title` — "Profile" / "プロフィール"
- `settings.profile.description` — "Personalize your greeting" / "挨拶をパーソナライズします"
- `settings.profile.usernameLabel` — "Display Name" / "表示名"
- `settings.profile.usernamePlaceholder` — "Enter your name" / "名前を入力してください"

## Files Touched

- `src/frontend/store/profile.js` (new)
- `src/frontend/components/HomePage.vue`
- `src/frontend/components/Setting.vue`
- `src/frontend/components/TopBar.vue`
- `src/locales/en.json`
- `src/locales/ja.json`

No main-process, IPC, or backend changes — entirely renderer-side, following the exact `theme.js`/`accent.js` localStorage-store pattern already established in the codebase.

## Verification

1. `npm run start` — launch the app.
2. Homepage shows a greeting line above "Now Playing" matching current local time, no name shown by default.
3. Settings → new "Profile" tab: enter a name, blur/Enter — Homepage greeting immediately shows ", <name>"; TopBar shows the name next to the avatar icon.
4. Clear the name field and save — greeting reverts to no-name form, TopBar name disappears (icon stays).
5. Restart the app — username persists (localStorage).
6. Switch language to Japanese — greeting and Profile tab labels are in Japanese.
