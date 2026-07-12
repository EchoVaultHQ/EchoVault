<template>
  <div class="tab-content">
    <h2 class="section-title">{{ t("settings.devices.title") }}</h2>
    <p class="section-description">{{ t("settings.devices.description") }}</p>

    <SettingCard
      :title="t('settings.devices.output.title')"
      :description="t('settings.devices.output.description')"
    >
      <template #icon><Headphones :size="22" /></template>

      <p v-if="!hasDeviceLabels" class="section-description">
        {{ t("settings.devices.output.permissionHint") }}
        <button class="pill-button" @click="player.requestDeviceLabelsPermission()">
          {{ t("settings.devices.output.grantPermission") }}
        </button>
      </p>

      <div class="device-list">
        <button
          class="device-option"
          :class="{ active: player.outputDeviceId === '' }"
          @click="player.setOutputDevice('')"
        >
          <span class="lang-name">{{ t("settings.devices.output.systemDefault") }}</span>
          <Check v-if="player.outputDeviceId === ''" :size="18" />
        </button>

        <button
          v-for="device in player.outputDevices"
          :key="device.deviceId"
          class="device-option"
          :class="{ active: player.outputDeviceId === device.deviceId }"
          @click="player.setOutputDevice(device.deviceId)"
        >
          <span class="lang-name">{{ device.label || t("settings.devices.output.unnamedDevice") }}</span>
          <Check v-if="player.outputDeviceId === device.deviceId" :size="18" />
        </button>
      </div>
    </SettingCard>
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue"
import { useI18n } from "vue-i18n"
import { Headphones, Check } from "@lucide/vue"
import { usePlayerStore } from "../../store/player.js"
import SettingCard from "../ui/SettingCard.vue"

const { t } = useI18n()
const player = usePlayerStore()

const hasDeviceLabels = computed(() => player.outputDevices.some((d) => d.label))

onMounted(() => player.refreshOutputDevices())
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
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 0.85rem;
  cursor: pointer;
}

.pill-button:hover {
  border-color: var(--accent);
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.device-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.25rem;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.device-option:hover {
  border-color: var(--accent);
  transform: translateX(4px);
}

.device-option.active {
  border-color: var(--accent);
  background: var(--hover-bg);
}

.lang-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
}

.device-option svg {
  color: var(--accent);
  flex-shrink: 0;
}
</style>
