<template>
  <div class="tab-content">
    <h2 class="section-title">{{ t("settings.shortcuts.title") }}</h2>
    <p class="section-description">{{ t("settings.shortcuts.description") }}</p>

    <SettingCard
      :title="t('settings.shortcuts.playback.title')"
      :description="t('settings.shortcuts.playback.description')"
    >
      <template #icon><Keyboard :size="22" /></template>
      <template #actions>
        <button class="pill-button" @click="shortcutsStore.resetToDefaults()">
          {{ t("settings.shortcuts.resetAll") }}
        </button>
      </template>

      <div class="shortcut-row" v-for="actionId in playbackActions" :key="actionId">
        <span class="shortcut-name">{{ t(`settings.shortcuts.actions.${actionId}`) }}</span>
        <div
          class="shortcut-key"
          :class="{ capturing: capturingAction === actionId }"
          tabindex="0"
          @click="startCapture(actionId)"
          @keydown="capturingAction === actionId && onCaptureKeydown($event, actionId)"
          @blur="capturingAction === actionId && (capturingAction = null)"
        >
          {{ capturingAction === actionId ? t("settings.shortcuts.pressKey") : formatCombo(shortcutsStore.keymap[actionId]) }}
        </div>
        <p v-if="conflictInfo?.actionId === actionId" class="shortcut-conflict">
          {{ t("settings.shortcuts.conflict", { action: t(`settings.shortcuts.actions.${conflictInfo.conflictAction}`) }) }}
          <button @click="overwriteConflict">{{ t("settings.shortcuts.conflictOverwrite") }}</button>
        </p>
      </div>
    </SettingCard>

    <SettingCard
      :title="t('settings.shortcuts.navigation.title')"
      :description="t('settings.shortcuts.navigation.description')"
    >
      <template #icon><MousePointer2 :size="22" /></template>

      <div class="shortcut-row" v-for="actionId in navigationActions" :key="actionId">
        <span class="shortcut-name">{{ t(`settings.shortcuts.actions.${actionId}`) }}</span>
        <div
          class="shortcut-key"
          :class="{ capturing: capturingAction === actionId }"
          tabindex="0"
          @click="startCapture(actionId)"
          @keydown="capturingAction === actionId && onCaptureKeydown($event, actionId)"
          @blur="capturingAction === actionId && (capturingAction = null)"
        >
          {{ capturingAction === actionId ? t("settings.shortcuts.pressKey") : formatCombo(shortcutsStore.keymap[actionId]) }}
        </div>
        <p v-if="conflictInfo?.actionId === actionId" class="shortcut-conflict">
          {{ t("settings.shortcuts.conflict", { action: t(`settings.shortcuts.actions.${conflictInfo.conflictAction}`) }) }}
          <button @click="overwriteConflict">{{ t("settings.shortcuts.conflictOverwrite") }}</button>
        </p>
      </div>
    </SettingCard>
  </div>
</template>

<script setup>
import { ref } from "vue"
import { useI18n } from "vue-i18n"
import { Keyboard, MousePointer2 } from "@lucide/vue"
import { useShortcutsStore } from "../../store/shortcuts.js"
import { normalizeKeyEvent, formatCombo } from "../../utils/keyCombo.js"
import SettingCard from "../ui/SettingCard.vue"

const { t } = useI18n()
const shortcutsStore = useShortcutsStore()

const playbackActions = [
  "playPause",
  "nextTrack",
  "previousTrack",
  "seekForward",
  "seekBackward",
  "volumeUp",
  "volumeDown",
  "muteToggle",
  "shuffleToggle",
  "repeatCycle",
]
const navigationActions = ["focusSearch", "goToLibrary"]

const capturingAction = ref(null)
const conflictInfo = ref(null)

function startCapture(actionId) {
  capturingAction.value = actionId
  conflictInfo.value = null
}

function onCaptureKeydown(e, actionId) {
  e.preventDefault()
  e.stopPropagation()
  if (e.key === "Escape") {
    capturingAction.value = null
    return
  }
  const combo = normalizeKeyEvent(e)
  if (!combo) return
  const result = shortcutsStore.setShortcut(actionId, combo)
  if (!result.ok) {
    conflictInfo.value = { actionId, combo, conflictAction: result.conflictAction }
  } else {
    capturingAction.value = null
  }
}

function overwriteConflict() {
  const { actionId, combo } = conflictInfo.value
  shortcutsStore.setShortcut(actionId, combo, { force: true })
  conflictInfo.value = null
  capturingAction.value = null
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

.pill-button {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-color);
  font-size: 0.85rem;
  cursor: pointer;
}

.pill-button:hover {
  border-color: var(--accent);
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-color);
}

.shortcut-row:last-child {
  border-bottom: none;
}

.shortcut-name {
  color: var(--text-color);
  font-size: 0.95rem;
}

.shortcut-key {
  min-width: 90px;
  text-align: center;
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.shortcut-key:hover {
  border-color: var(--accent);
}

.shortcut-key.capturing {
  border-color: var(--accent);
  color: var(--accent);
}

.shortcut-conflict {
  flex-basis: 100%;
  font-size: 0.8rem;
  color: var(--danger);
  margin: 0.25rem 0 0 0;
}

.shortcut-conflict button {
  margin-left: 0.5rem;
  border: none;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  font-weight: 600;
}
</style>
