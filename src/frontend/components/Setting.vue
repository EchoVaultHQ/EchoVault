<template>
  <transition name="settings-fade">
    <div v-if="showSettingMenu" class="settings-overlay">
      <div class="settings-container">
        <!-- Header -->
        <div class="settings-header">
          <h1 class="settings-title">{{ t("settings.title") }}</h1>
          <button
            @click="$emit('close')"
            class="close-button"
            :aria-label="t('settings.close')"
            title="t('settings.close')"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Content Area -->
        <div class="settings-content">
          <!-- Sidebar Tabs -->
          <div class="settings-sidebar">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              class="tab-button"
              :class="{ active: activeTab === tab.id }"
            >
              <i :class="tab.icon"></i>
              <span>{{ t(tab.labelKey) }}</span>
            </button>
          </div>

          <!-- Main Content -->
          <div class="settings-main">
            <!-- Appearance Tab -->
            <div v-if="activeTab === 'appearance'" class="tab-content">
              <h2 class="section-title">
                {{ t("settings.appearance.title") }}
              </h2>
              <p class="section-description">
                {{ t("settings.appearance.description") }}
              </p>

              <!-- Theme Mode -->
              <div class="setting-group">
                <div class="setting-label">
                  <i class="fa-solid fa-moon"></i>
                  <div>
                    <h3>{{ t("settings.appearance.themeMode.title") }}</h3>
                    <p>{{ t("settings.appearance.themeMode.description") }}</p>
                  </div>
                </div>
                <div class="theme-toggle">
                  <button
                    @click="setTheme('light')"
                    class="theme-option"
                    :class="{ active: !isDarkMode }"
                  >
                    <i class="fa-solid fa-sun"></i>
                    <span>{{ t("settings.appearance.themeMode.light") }}</span>
                  </button>

                  <button
                    @click="setTheme('dark')"
                    class="theme-option"
                    :class="{ active: isDarkMode }"
                  >
                    <i class="fa-solid fa-moon"></i>
                    <span>{{ t("settings.appearance.themeMode.dark") }}</span>
                  </button>
                </div>
              </div>

              <!-- Accent Color -->
              <div class="setting-group">
                <div class="setting-label">
                  <i class="fa-solid fa-palette"></i>
                  <div>
                    <h3>{{ t("settings.appearance.accent.title") }}</h3>
                    <p>{{ t("settings.appearance.accent.description") }}</p>
                  </div>
                </div>
                <div class="color-grid">
                  <div
                    v-for="color in accentStore.accentColors"
                    :key="color.key"
                    @click="accentStore.setAccent(color.value)"
                    class="color-swatch"
                    :class="{ active: accentStore.accentColor === color.value }"
                    :style="{ background: color.value }"
                  >
                    <i
                      v-if="accentStore.accentColor === color.value"
                      class="fa-solid fa-check"
                    ></i>
                  </div>
                </div>
              </div>
            </div>

            <!-- Language Tab -->
            <div v-if="activeTab === 'language'" class="tab-content">
              <h2 class="section-title">{{ t("settings.language.title") }}</h2>
              <p class="section-description">
                {{ t("settings.language.description") }}
              </p>

              <div class="setting-group">
                <div class="setting-label">
                  <i class="fa-solid fa-language"></i>
                  <div>
                    <h3>{{ t("settings.language.displayLanguage.title") }}</h3>
                    <p>
                      {{ t("settings.language.displayLanguage.description") }}
                    </p>
                  </div>
                </div>
                <div class="language-selector">
                  <button
                    @click="setLanguage('en')"
                    class="language-option"
                    :class="{ active: currentLocale === 'en' }"
                  >
                    <span class="flag">🇬🇧</span>
                    <div>
                      <div class="lang-name">
                        {{ t("settings.language.languages.en.name") }}
                      </div>
                      <div class="lang-native">
                        {{ t("settings.language.languages.en.native") }}
                      </div>
                    </div>
                    <i
                      v-if="currentLocale === 'en'"
                      class="fa-solid fa-check"
                    ></i>
                  </button>
                  <button
                    @click="setLanguage('ja')"
                    class="language-option"
                    :class="{ active: currentLocale === 'ja' }"
                  >
                    <span class="flag">🇯🇵</span>
                    <div>
                      <div class="lang-name">
                        {{ t("settings.language.languages.ja.name") }}
                      </div>
                      <div class="lang-native">
                        {{ t("settings.language.languages.ja.native") }}
                      </div>
                    </div>
                    <i
                      v-if="currentLocale === 'ja'"
                      class="fa-solid fa-check"
                    ></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- Audio Tab -->
            <div v-if="activeTab === 'audio'" class="tab-content">
              <h2 class="section-title">{{ t("settings.audio.title") }}</h2>
              <p class="section-description">
                {{ t("settings.audio.description") }}
              </p>

              <div class="setting-group">
                <div class="setting-label">
                  <i class="fa-solid fa-cloud"></i>
                  <div>
                    <h3>{{ t("settings.audio.onlineLyrics.title") }}</h3>
                    <p>{{ t("settings.audio.onlineLyrics.description") }}</p>
                  </div>
                </div>
                <button
                  class="toggle-switch"
                  :class="{ active: fetchLyricsOnline }"
                  role="switch"
                  :aria-checked="fetchLyricsOnline"
                  @click="toggleFetchLyricsOnline"
                >
                  <span class="toggle-knob"></span>
                </button>
              </div>

              <div class="setting-group">
                <div class="setting-label">
                  <i class="fa-brands fa-lastfm"></i>
                  <div>
                    <h3>{{ t("settings.audio.lastfm.title") }}</h3>
                    <p>{{ t("settings.audio.lastfm.description") }}</p>
                  </div>
                </div>

                <template v-if="!lastfmStore.hasCredentials">
                  <p class="section-description">
                    {{ t("settings.audio.lastfm.credentialsHint") }}
                    <a
                      href="https://www.last.fm/api/account/create"
                      target="_blank"
                      >last.fm/api/account/create</a
                    >
                  </p>
                  <input
                    v-model="lastfmApiKey"
                    type="text"
                    class="lastfm-input"
                    :placeholder="t('settings.audio.lastfm.apiKeyLabel')"
                  />
                  <input
                    v-model="lastfmApiSecret"
                    type="password"
                    class="lastfm-input"
                    :placeholder="t('settings.audio.lastfm.apiSecretLabel')"
                  />
                  <button
                    class="theme-option"
                    @click="
                      lastfmStore.saveCredentials(lastfmApiKey, lastfmApiSecret)
                    "
                  >
                    {{ t("settings.audio.lastfm.saveAndConnect") }}
                  </button>
                  <p v-if="lastfmStore.error" class="section-description">
                    {{
                      t("settings.audio.lastfm.error", {
                        error: lastfmStore.error,
                      })
                    }}
                  </p>
                </template>
                <template v-else-if="!lastfmStore.connected">
                  <button
                    v-if="!lastfmStore.authPending"
                    class="theme-option"
                    @click="lastfmStore.connect()"
                  >
                    {{ t("settings.audio.lastfm.connect") }}
                  </button>
                  <template v-else>
                    <p class="section-description">
                      {{ t("settings.audio.lastfm.authorizeHint") }}
                    </p>
                    <button
                      class="theme-option active"
                      @click="lastfmStore.confirmAuth()"
                    >
                      {{ t("settings.audio.lastfm.confirm") }}
                    </button>
                  </template>
                  <p v-if="lastfmStore.error" class="section-description">
                    {{
                      t("settings.audio.lastfm.error", {
                        error: lastfmStore.error,
                      })
                    }}
                  </p>
                </template>
                <template v-else>
                  <p class="section-description">
                    {{
                      t("settings.audio.lastfm.connectedAs", {
                        username: lastfmStore.username,
                      })
                    }}
                  </p>
                  <div class="theme-toggle">
                    <button
                      class="toggle-switch"
                      :class="{ active: lastfmStore.scrobblingEnabled }"
                      role="switch"
                      :aria-checked="lastfmStore.scrobblingEnabled"
                      @click="lastfmStore.toggleEnabled()"
                    >
                      <span class="toggle-knob"></span>
                    </button>
                    <button
                      class="theme-option"
                      @click="lastfmStore.disconnect()"
                    >
                      {{ t("settings.audio.lastfm.disconnect") }}
                    </button>
                  </div>
                </template>
              </div>

              <div class="setting-group">
                <div class="setting-label">
                  <i class="fa-solid fa-sliders"></i>
                  <div>
                    <h3>{{ t("settings.audio.equalizer.title") }}</h3>
                    <p>{{ t("settings.audio.equalizer.description") }}</p>
                  </div>
                </div>
                <div class="eq-enable-row">
                  <span>{{ t("settings.audio.equalizer.enable") }}</span>
                  <button
                    class="toggle-switch"
                    :class="{ active: player.eqEnabled }"
                    role="switch"
                    :aria-checked="player.eqEnabled"
                    @click="player.setEQEnabled(!player.eqEnabled)"
                  >
                    <span class="toggle-knob"></span>
                  </button>
                </div>
                <EqualizerPanel
                  :bands="player.eqBands"
                  :preset="player.eqPreset"
                  :enabled="player.eqEnabled"
                  @update-band="(i, v) => player.setEQBand(i, v)"
                  @update-preset="(name) => player.applyEQPreset(name)"
                />
              </div>

              <div class="setting-group">
                <div class="setting-label">
                  <i class="fa-solid fa-volume-high"></i>
                  <div>
                    <h3>{{ t("settings.audio.normalization.title") }}</h3>
                    <p>{{ t("settings.audio.normalization.description") }}</p>
                  </div>
                </div>
                <div class="eq-enable-row">
                  <span>{{ t("settings.audio.normalization.enable") }}</span>
                  <button
                    class="toggle-switch"
                    :class="{ active: player.normalizationEnabled }"
                    role="switch"
                    :aria-checked="player.normalizationEnabled"
                    @click="
                      player.setNormalizationEnabled(
                        !player.normalizationEnabled
                      )
                    "
                  >
                    <span class="toggle-knob"></span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Devices Tab -->
            <div v-if="activeTab === 'devices'" class="tab-content">
              <h2 class="section-title">{{ t("settings.devices.title") }}</h2>
              <p class="section-description">
                {{ t("settings.devices.description") }}
              </p>

              <div class="setting-group">
                <div class="setting-label">
                  <i class="fa-solid fa-headphones"></i>
                  <div>
                    <h3>{{ t("settings.devices.output.title") }}</h3>
                    <p>{{ t("settings.devices.output.description") }}</p>
                  </div>
                </div>

                <p v-if="!hasDeviceLabels" class="section-description">
                  {{ t("settings.devices.output.permissionHint") }}
                  <button
                    class="theme-option"
                    @click="player.requestDeviceLabelsPermission()"
                  >
                    {{ t("settings.devices.output.grantPermission") }}
                  </button>
                </p>

                <div class="language-selector">
                  <button
                    class="language-option"
                    :class="{ active: player.outputDeviceId === '' }"
                    @click="player.setOutputDevice('')"
                  >
                    <div>
                      <div class="lang-name">
                        {{ t("settings.devices.output.systemDefault") }}
                      </div>
                    </div>
                    <i
                      v-if="player.outputDeviceId === ''"
                      class="fa-solid fa-check"
                    ></i>
                  </button>

                  <button
                    v-for="device in player.outputDevices"
                    :key="device.deviceId"
                    class="language-option"
                    :class="{ active: player.outputDeviceId === device.deviceId }"
                    @click="player.setOutputDevice(device.deviceId)"
                  >
                    <div>
                      <div class="lang-name">
                        {{ device.label || t("settings.devices.output.unnamedDevice") }}
                      </div>
                    </div>
                    <i
                      v-if="player.outputDeviceId === device.deviceId"
                      class="fa-solid fa-check"
                    ></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- Shortcuts Tab -->
            <div v-if="activeTab === 'shortcuts'" class="tab-content">
              <h2 class="section-title">{{ t("settings.shortcuts.title") }}</h2>
              <p class="section-description">
                {{ t("settings.shortcuts.description") }}
              </p>

              <div class="setting-group disabled">
                <div class="setting-label">
                  <i class="fa-solid fa-keyboard"></i>
                  <div>
                    <h3>{{ t("settings.shortcuts.playback.title") }}</h3>
                    <p>{{ t("settings.shortcuts.playback.description") }}</p>
                  </div>
                </div>
                <div class="coming-soon-badge">
                  {{ t("settings.comingSoon") }}
                </div>
              </div>

              <div class="setting-group disabled">
                <div class="setting-label">
                  <i class="fa-solid fa-arrow-pointer"></i>
                  <div>
                    <h3>{{ t("settings.shortcuts.navigation.title") }}</h3>
                    <p>{{ t("settings.shortcuts.navigation.description") }}</p>
                  </div>
                </div>
                <div class="coming-soon-badge">
                  {{ t("settings.comingSoon") }}
                </div>
              </div>
            </div>

            <!-- About Tab -->
            <div v-if="activeTab === 'about'" class="tab-content">
              <h2 class="section-title">{{ t("settings.about.title") }}</h2>
              <p class="section-description">
                {{ t("settings.about.description") }}
              </p>

              <div class="about-card">
                <div class="app-icon">
                  <img
                    src="../../frontend/assets/icons/app-icon.png"
                    alt="App Icon"
                    class="app-icon"
                  />
                </div>
                <h3>{{ t("app.name") }}</h3>
                <p class="version">
                  {{ t("settings.about.version", { version }) }}
                </p>
                <p class="description">
                  {{ t("settings.about.appDescription") }}
                </p>
                <div class="about-links">
                  <p class="attribution">
                    Echo dot icon by
                    <a
                      href="https://www.flaticon.com/authors/iyahicon"
                      target="_blank"
                      >IYAHICON</a
                    >
                    from
                    <a
                      href="https://www.flaticon.com/free-icons/echo-dot"
                      target="_blank"
                      >Flaticon</a
                    >
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useThemeStore } from "../store/theme.js"
import { useAccentStore } from "../store/accent.js"
import { useLastfmStore } from "../store/lastfm.js"
import { usePlayerStore } from "../store/player.js"
import EqualizerPanel from "./EqualizerPanel.vue"

const props = defineProps({
  showSettingMenu: {
    type: Boolean,
    required: true,
  },
  initialTab: {
    type: String,
    default: "appearance",
  },
})

const emit = defineEmits(["close"])
const themeStore = useThemeStore()
const accentStore = useAccentStore()
const lastfmStore = useLastfmStore()
const player = usePlayerStore()
const lastfmApiKey = ref("")
const lastfmApiSecret = ref("")
const { locale, t } = useI18n()

const activeTab = ref("appearance")

watch(
  () => props.showSettingMenu,
  (isOpen) => {
    if (isOpen) activeTab.value = props.initialTab ?? "appearance"
  }
)

watch(activeTab, (tab) => {
  if (tab === "devices") player.refreshOutputDevices()
})

const hasDeviceLabels = computed(() =>
  player.outputDevices.some((d) => d.label)
)

// use store for theme
const isDarkMode = computed(() => themeStore.theme === "dark")

// locale
const currentLocale = ref(localStorage.getItem("locale") || "en")

// online lyrics lookup
const fetchLyricsOnline = ref(
  localStorage.getItem("fetchLyricsOnline") !== "false",
)
const toggleFetchLyricsOnline = () => {
  fetchLyricsOnline.value = !fetchLyricsOnline.value
  localStorage.setItem("fetchLyricsOnline", String(fetchLyricsOnline.value))
}

const tabs = [
  {
    id: "appearance",
    labelKey: "settings.tabs.appearance",
    icon: "fa-solid fa-palette",
  },
  {
    id: "language",
    labelKey: "settings.tabs.language",
    icon: "fa-solid fa-language",
  },
  { id: "audio", labelKey: "settings.tabs.audio", icon: "fa-solid fa-sliders" },
  {
    id: "devices",
    labelKey: "settings.tabs.devices",
    icon: "fa-solid fa-headphones",
  },
  {
    id: "shortcuts",
    labelKey: "settings.tabs.shortcuts",
    icon: "fa-solid fa-keyboard",
  },
  {
    id: "about",
    labelKey: "settings.tabs.about",
    icon: "fa-solid fa-circle-info",
  },
]

const version = "2.1.0-beta"

const setTheme = (theme) => {
  themeStore.setTheme(theme)
}

const toggleTheme = () => {
  themeStore.toggleTheme()
}

// language
const setLanguage = (lang) => {
  locale.value = lang
  currentLocale.value = lang
  localStorage.setItem("locale", lang)
}

onMounted(() => {
  // keep locale initialization here (theme + accent are initialized in their stores)
  const savedLang = localStorage.getItem("locale")
  if (savedLang) {
    currentLocale.value = savedLang
    locale.value = savedLang
  }

  lastfmStore.fetchStatus()
})
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: var(--bg-color);
  z-index: 9999;
  overflow: hidden;
}

.settings-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Header */
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2rem 3rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--topbar-bg);
}

.settings-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-color);
  margin: 0;
}

.close-button {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--search-bar-color);
  color: var(--text-color);
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background: var(--hover-bg);
  transform: rotate(90deg);
}

/* Content */
.settings-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Sidebar */
.settings-sidebar {
  width: 280px;
  background: var(--side-nav-bg);
  border-right: 1px solid var(--border-color);
  padding: 2rem 1rem;
  overflow-y: auto;
}

.tab-button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border: none;
  background: transparent;
  color: var(--muted-text);
  font-size: 1rem;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 0.5rem;
  text-align: left;
}

.tab-button i {
  font-size: 1.25rem;
  width: 24px;
}

.tab-button:hover {
  background: var(--hover-bg);
  color: var(--text-color);
}

.tab-button.active {
  background: var(--accent);
  color: white;
}

/* Main Content */
.settings-main {
  flex: 1;
  padding: 3rem;
  overflow-y: auto;
  max-width: 900px;
}

.tab-content {
  animation: fadeInUp 0.3s ease;
}

.section-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-color);
  margin: 0 0 0.5rem 0;
}

.section-description {
  font-size: 1rem;
  color: var(--muted-text);
  margin: 0 0 2rem 0;
}

/* Setting Groups */
.setting-group {
  background: var(--side-nav-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 1.5rem;
  transition: all 0.2s ease;
}

.setting-group:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.setting-group.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.setting-label {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.setting-label > i {
  font-size: 1.5rem;
  color: var(--accent);
  margin-top: 0.25rem;
}

.setting-label h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 0.25rem 0;
}

.setting-label p {
  font-size: 0.9rem;
  color: var(--muted-text);
  margin: 0;
}

.eq-enable-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.95rem;
  color: var(--text-color);
}

/* Theme Toggle */
.theme-toggle {
  display: flex;
  gap: 1rem;
}

.theme-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  border: 2px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-color);
  border-radius: 12px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-option:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.theme-option.active {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
}

.theme-option i {
  font-size: 1.25rem;
}

.lastfm-input {
  display: block;
  width: 100%;
  max-width: 320px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  border: 2px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-color);
  border-radius: 12px;
  font-size: 0.9rem;
}

.lastfm-input:focus {
  outline: none;
  border-color: var(--accent);
}

/* Toggle Switch */
.toggle-switch {
  width: 52px;
  height: 28px;
  border-radius: 14px;
  border: none;
  background: var(--border-color);
  cursor: pointer;
  position: relative;
  padding: 3px;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.toggle-switch.active {
  background: var(--accent);
}

.toggle-knob {
  display: block;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s ease;
}

.toggle-switch.active .toggle-knob {
  transform: translateX(24px);
}

/* Color Grid */
.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
  gap: 1rem;
}

.color-swatch {
  aspect-ratio: 1;
  border-radius: 24px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid transparent;
}

.color-swatch:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.color-swatch.active {
  border-color: var(--text-color);
  transform: scale(1.1);
}

.color-swatch i {
  color: white;
  font-size: 1.25rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.color-swatch.active i {
  opacity: 1;
}

/* Language Selector */
.language-selector {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.language-option {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.25rem;
  border: 2px solid var(--border-color);
  background: var(--bg-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.language-option:hover {
  border-color: var(--accent);
  transform: translateX(4px);
}

.language-option.active {
  border-color: var(--accent);
  background: var(--hover-bg);
}

.flag {
  font-size: 2rem;
}

.lang-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
}

.lang-native {
  font-size: 0.875rem;
  color: var(--muted-text);
}

.language-option i {
  margin-left: auto;
  color: var(--accent);
  font-size: 1.25rem;
}

/* Coming Soon Badge */
.coming-soon-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: var(--accent);
  color: white;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
}

/* About Card */
.about-card {
  background: var(--side-nav-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 3rem;
  text-align: center;
}

.app-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1rem;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  color: white;
}

.about-card h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-color);
  margin: 0 0 0.5rem 0;
}

.version {
  font-size: 1rem;
  color: var(--muted-text);
  margin: 0 0 1rem 0;
}

.description {
  font-size: 1rem;
  color: var(--text-color);
  line-height: 1.6;
  margin: 0 0 2rem 0;
}

.about-links {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.attribution {
  font-size: 12px;
  opacity: 0.6;
  margin-top: 12px;
}

.attribution a {
  color: var(--muted-text);
}

.link-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: 2px solid var(--border-color);
  background: transparent;
  color: var(--text-color);
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.link-button:hover {
  border-color: var(--accent);
  background: var(--hover-bg);
}

/* Animations */
.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 0.3s ease;
}

.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scrollbar Styling */
.settings-sidebar::-webkit-scrollbar,
.settings-main::-webkit-scrollbar {
  width: 8px;
}

.settings-sidebar::-webkit-scrollbar-track,
.settings-main::-webkit-scrollbar-track {
  background: transparent;
}

.settings-sidebar::-webkit-scrollbar-thumb,
.settings-main::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.settings-sidebar::-webkit-scrollbar-thumb:hover,
.settings-main::-webkit-scrollbar-thumb:hover {
  background: var(--accent);
}
</style>
