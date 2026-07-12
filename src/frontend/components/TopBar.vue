<template>
  <header class="top-bar">
    <!-- Window controls row - sits at top. On macOS this stays empty so its
         height reserves space for the native traffic lights. -->
    <div class="window-controls">
      <template v-if="!isMac">
        <button class="win-btn" @click="winMinimize">
          <img :src="Minimize" :style="iconFilter" />
        </button>

        <button class="win-btn" @click="winMaximize">
          <img :src="Maximize" :style="iconFilter" />
        </button>

        <button class="win-btn close-btn" @click="winClose">
          <img :src="X" :style="iconFilter" />
        </button>
      </template>
    </div>

    <!-- Main content row - search and actions below controls -->
    <div class="main-content">
      <div class="search-bar">
        <img
          :src="Search"
          alt="Search"
          class="search-icon"
          :style="iconFilter"
        />
        <input
          id="global-search-input"
          v-model="localQuery"
          type="text"
          :placeholder="t('search.placeholder')"
          class="search-input"
          @keyup.esc="clearSearch"
        />
        <button
          v-if="localQuery"
          class="clear-search-btn"
          :title="t('search.clear')"
          @click="clearSearch"
        >
          <img :src="X" :style="iconFilter" />
        </button>
      </div>

      <div class="actions">
        <!-- Profile Badge -->
        <div class="profile-badge" :title="profileStore.username || t('settings.tabs.profile')">
          <img v-if="profileStore.avatarUrl" :src="profileStore.avatarUrl" alt="Avatar" class="profile-avatar-img" />
          <i v-else class="fa-solid fa-circle-user profile-icon"></i>
          <span v-if="profileStore.username" class="profile-name">{{ profileStore.username }}</span>
        </div>

        <!-- Theme Button -->
        <button title="Theme" @click="toggleTheme" class="icon-btn">
          <img
            class="topbar-icon-class"
            :src="isDarkMode ? Light : Dark"
            :style="iconFilter"
            alt="Theme"
          />
        </button>

        <!-- Settings Button -->
        <div class="settings-dropdown-wrapper">
          <button
            title="Settings"
            class="icon-btn"
            @click="toggleSettingMenuView"
          >
            <img
              class="topbar-icon-class"
              :src="Settings"
              :style="iconFilter"
              alt="Settings"
            />
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, watch, onMounted, computed, onBeforeUnmount } from "vue"
import { useI18n } from "vue-i18n"
import { useRouter, useRoute } from "vue-router"
import { debounce } from "../../backend/utils/debounce.js"
import { useSearchStore } from "../store/search.js"
import { useThemeStore } from "../store/theme.js"
import { useProfileStore } from "../store/profile.js"

import {
  Dark,
  Light,
  Settings,
  Search,
  Maximize,
  Minimize,
  X,
} from "../assets/icons/icons.js"

const themeStore = useThemeStore()
const profileStore = useProfileStore()
const router = useRouter()
const route = useRoute()

const isMac = window.api.platform === "darwin"

const showDropdown = ref(false)
const searchStore = useSearchStore()
const localQuery = ref(searchStore.query)

// Localize
const { locale, t } = useI18n()
const currentLocale = ref(localStorage.getItem("locale") || "en")

// search debounce
const updateSearch = debounce((val) => {
  const trimmed = val.trim()
  searchStore.setQuery(trimmed)
  if (trimmed && route.path !== "/search") {
    router.push("/search")
  }
}, 400)
watch(localQuery, (val) => updateSearch(val))

const clearSearch = () => {
  localQuery.value = ""
  searchStore.setQuery("")
}

// language helpers (unchanged)
const setLanguage = (lang) => {
  locale.value = lang
  currentLocale.value = lang
  localStorage.setItem("locale", lang)
}
const toggleLanguage = () => {
  const newLang = currentLocale.value === "en" ? "ja" : "en"
  setLanguage(newLang)
}

// THEME: expose computed for UI
const isDarkMode = computed(() => themeStore.theme === "dark")
const toggleTheme = () => themeStore.toggleTheme()

// iconFilter now depends on computed isDarkMode
const iconFilter = computed(() => ({
  filter: isDarkMode.value
    ? "invert(100%) brightness(200%)"
    : "invert(0%) brightness(0%)",
}))

// Dropdown outside click handling unchanged
const handleClickOutside = (e) => {
  const dropdown = document.querySelector(".settings-dropdown-wrapper")
  if (dropdown && !dropdown.contains(e.target)) {
    showDropdown.value = false
  }
}

// window controls (keep as-is)
const winMinimize = () => window.api.minimize()
const winMaximize = async () => {
  // small fix: isMax should be a ref if you plan to use it in template
  const isMax = await window.api.isMaximized()
  window.api.maximize()
}
const winClose = () => window.api.close()

onMounted(() => {
  // language
  const savedLang = localStorage.getItem("locale")
  if (savedLang) setLanguage(savedLang)

  document.addEventListener("click", handleClickOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside)
})

const toggleSettingMenuView = () => {
  router.push("/settings")
}
</script>

<style scoped>
/* Top bar – header layout with window controls on top, search and actions below */

/* Main container - flexible column layout */
.top-bar {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  color: var(--text-color);
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--border-color);
  -webkit-app-region: drag; /* make whole topbar draggable */
}

/* Window controls - positioned at top right like native apps */
.window-controls {
  display: flex;
  gap: 0;
  margin-left: auto;
  -webkit-app-region: no-drag;
  height: 32px;
}

.win-btn {
  width: 46px;
  height: 32px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  transition: background 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.win-btn img {
  width: 15px;
  height: 15px;
}

.win-btn:hover {
  background: var(--search-bar-color);
}

.close-btn:hover {
  background: #e81123 !important;
}

/* Main content row - contains search bar and action buttons */
.main-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem 0.75rem 1rem;
  -webkit-app-region: no-drag;
}

/* Search bar */
.search-bar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background-color: var(--search-bar-color);
  color: var(--text-color);
  border-radius: var(--radius-xl);
  padding: 0.5rem 1rem;
  flex: 1;
  max-width: 500px;
}

.search-icon {
  width: 16px;
  height: 16px;
  filter: invert(100%) brightness(200%);
  margin-right: 0.5rem;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-color);
  font-size: 0.9rem;
}

.search-input::placeholder {
  color: var(--muted-text);
}

.clear-search-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

.clear-search-btn:hover {
  opacity: 1;
}

.clear-search-btn img {
  width: 12px;
  height: 12px;
}

/* Action buttons group - positioned on the right */
.actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: 1rem;
}

.profile-badge {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-color);
  -webkit-app-region: no-drag;
}

.profile-icon {
  font-size: 1.4rem;
  color: var(--accent);
}

.profile-avatar-img {
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  object-fit: cover;
}

.profile-name {
  font-size: 0.85rem;
  font-weight: 600;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Icon buttons */
.icon-btn {
  background: transparent;
  border: none;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  justify-content: center;
  transition:
    background-color 0.2s ease,
    transform 0.1s ease;
  -webkit-app-region: no-drag;
}

.icon-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: scale(1.05);
}

.topbar-icon-class {
  width: 18px;
  height: 18px;
  filter: invert(100%) brightness(200%);
}

/* Color theme options */
.color-options {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.color-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-circle:hover {
  transform: scale(1.1);
  box-shadow: 0 0 6px var(--accent);
}

.color-circle.active {
  box-shadow:
    0 0 0 3px var(--border-color),
    0 0 0 5px var(--accent);
  transform: scale(1.1);
}

.color-circle svg {
  pointer-events: none;
}
</style>
