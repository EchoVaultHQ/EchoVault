<template>
  <div class="settings-page">
    <div class="header">
      <h2>{{ t("settings.title") }}</h2>
    </div>

    <div class="pill-row">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="pill"
        :class="{ active: activeTab === tab.id }"
        @click="selectTab(tab.id)"
      >
        <component :is="tab.icon" :size="14" /> {{ t(tab.labelKey) }}
      </button>
    </div>

    <SettingsProfile v-if="activeTab === 'profile'" />
    <SettingsAppearance v-else-if="activeTab === 'appearance'" />
    <SettingsLanguage v-else-if="activeTab === 'language'" />
    <SettingsAudio v-else-if="activeTab === 'audio'" />
    <SettingsConnectors v-else-if="activeTab === 'connectors'" />
    <SettingsDevices v-else-if="activeTab === 'devices'" />
    <SettingsShortcuts v-else-if="activeTab === 'shortcuts'" />
    <SettingsAbout v-else-if="activeTab === 'about'" />
  </div>
</template>

<script setup>
import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useI18n } from "vue-i18n"
import { User, Palette, Languages, SlidersHorizontal, Link, Headphones, Keyboard, Info } from "@lucide/vue"
import SettingsProfile from "./SettingsProfile.vue"
import SettingsAppearance from "./SettingsAppearance.vue"
import SettingsLanguage from "./SettingsLanguage.vue"
import SettingsAudio from "./SettingsAudio.vue"
import SettingsConnectors from "./SettingsConnectors.vue"
import SettingsDevices from "./SettingsDevices.vue"
import SettingsShortcuts from "./SettingsShortcuts.vue"
import SettingsAbout from "./SettingsAbout.vue"

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const tabs = [
  { id: "profile", labelKey: "settings.tabs.profile", icon: User },
  { id: "appearance", labelKey: "settings.tabs.appearance", icon: Palette },
  { id: "language", labelKey: "settings.tabs.language", icon: Languages },
  { id: "audio", labelKey: "settings.tabs.audio", icon: SlidersHorizontal },
  { id: "connectors", labelKey: "settings.tabs.connectors", icon: Link },
  { id: "devices", labelKey: "settings.tabs.audioDevices", icon: Headphones },
  { id: "shortcuts", labelKey: "settings.tabs.shortcuts", icon: Keyboard },
  { id: "about", labelKey: "settings.tabs.about", icon: Info },
]

const activeTab = computed(() => route.query.tab || "appearance")

function selectTab(id) {
  router.replace({ query: { ...route.query, tab: id } })
}
</script>

<style scoped>
.settings-page {
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--content-bg);
  min-height: 100%;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin: -1rem -1rem 20px -1rem;
  padding: 1rem 1rem 1.25rem 1rem;
  position: sticky;
  top: -1rem;
  z-index: 5;
  background: var(--content-bg);
}

.header h2 {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  color: var(--text-color);
}

.pill-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: var(--radius-full);
  background: var(--side-nav-bg);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pill:hover {
  background: var(--hover-bg);
  border-color: var(--accent);
}

.pill.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  cursor: default;
}
</style>
