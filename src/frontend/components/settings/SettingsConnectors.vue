<template>
  <div class="tab-content">
    <h2 class="section-title">{{ t("settings.connectors.title") }}</h2>
    <p class="section-description">{{ t("settings.connectors.description") }}</p>

    <SettingCard
      :title="t('settings.audio.onlineLyrics.title')"
      :description="t('settings.audio.onlineLyrics.description')"
    >
      <template #icon><Cloud :size="22" /></template>
      <ToggleSwitch :modelValue="fetchLyricsOnline" @update:modelValue="toggleFetchLyricsOnline" />
    </SettingCard>

    <SettingCard
      :title="t('settings.audio.lastfm.title')"
      :description="t('settings.audio.lastfm.description')"
    >
      <template #icon><img :src="Fm" class="icon" alt="" /></template>

      <template v-if="!lastfmStore.hasCredentials">
        <p class="section-description">
          {{ t("settings.audio.lastfm.credentialsHint") }}
          <a href="https://www.last.fm/api/account/create" target="_blank">last.fm/api/account/create</a>
        </p>
        <input v-model="lastfmApiKey" type="text" class="text-input" :placeholder="t('settings.audio.lastfm.apiKeyLabel')" />
        <input v-model="lastfmApiSecret" type="password" class="text-input" :placeholder="t('settings.audio.lastfm.apiSecretLabel')" />
        <button class="pill-button" @click="lastfmStore.saveCredentials(lastfmApiKey, lastfmApiSecret)">
          {{ t("settings.audio.lastfm.saveAndConnect") }}
        </button>
        <p v-if="lastfmStore.error" class="section-description">
          {{ t("settings.audio.lastfm.error", { error: lastfmStore.error }) }}
        </p>
      </template>
      <template v-else-if="!lastfmStore.connected">
        <button v-if="!lastfmStore.authPending" class="pill-button" @click="lastfmStore.connect()">
          {{ t("settings.audio.lastfm.connect") }}
        </button>
        <template v-else>
          <p class="section-description">{{ t("settings.audio.lastfm.authorizeHint") }}</p>
          <button class="pill-button active" @click="lastfmStore.confirmAuth()">
            {{ t("settings.audio.lastfm.confirm") }}
          </button>
        </template>
        <p v-if="lastfmStore.error" class="section-description">
          {{ t("settings.audio.lastfm.error", { error: lastfmStore.error }) }}
        </p>
      </template>
      <template v-else>
        <p class="section-description">
          {{ t("settings.audio.lastfm.connectedAs", { username: lastfmStore.username }) }}
        </p>
        <div class="row">
          <ToggleSwitch :modelValue="lastfmStore.scrobblingEnabled" @update:modelValue="lastfmStore.toggleEnabled" />
          <button class="pill-button" @click="lastfmStore.disconnect()">
            {{ t("settings.audio.lastfm.disconnect") }}
          </button>
        </div>
      </template>
    </SettingCard>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { useI18n } from "vue-i18n"
import { Cloud } from "@lucide/vue"
import { Fm } from "../../assets/icons/icons.js"
import { useLastfmStore } from "../../store/lastfm.js"
import SettingCard from "../ui/SettingCard.vue"
import ToggleSwitch from "../ui/ToggleSwitch.vue"

const { t } = useI18n()
const lastfmStore = useLastfmStore()
const lastfmApiKey = ref("")
const lastfmApiSecret = ref("")

onMounted(() => lastfmStore.fetchStatus())

const fetchLyricsOnline = ref(localStorage.getItem("fetchLyricsOnline") !== "false")
function toggleFetchLyricsOnline(val) {
  fetchLyricsOnline.value = val
  localStorage.setItem("fetchLyricsOnline", String(val))
}
</script>

<style scoped>
.tab-content {
  max-width: 900px;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-color);
  margin: 0 0 0.5rem 0;
}

.section-description {
  font-size: 1rem;
  color: var(--muted-text);
  margin: 0 0 2rem 0;
}

.icon {
  width: 22px;
  height: 22px;
  margin-top: 0.25rem;
}

:root[data-theme="dark"] .icon {
  filter: invert(100%) brightness(200%);
}

.text-input {
  display: block;
  width: 100%;
  max-width: 320px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-color);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
}

.text-input:focus {
  outline: none;
  border-color: var(--accent);
}

.pill-button {
  padding: 0.75rem 1.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pill-button:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.pill-button.active {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
}

.row {
  display: flex;
  align-items: center;
  gap: 1rem;
}
</style>
