<template>
  <div class="tab-content">
    <h2 class="section-title">{{ t("settings.audio.title") }}</h2>
    <p class="section-description">{{ t("settings.audio.description") }}</p>

    <SettingCard
      :title="t('settings.audio.equalizer.title')"
      :description="t('settings.audio.equalizer.description')"
    >
      <template #icon><SlidersHorizontal :size="22" /></template>

      <div class="row">
        <span>{{ t("settings.audio.equalizer.enable") }}</span>
        <ToggleSwitch
          :modelValue="player.eqEnabled"
          @update:modelValue="player.setEQEnabled"
        />
      </div>
      <EqualizerPanel
        :bands="player.eqBands"
        :preset="player.eqPreset"
        :enabled="player.eqEnabled"
        @update-band="(i, v) => player.setEQBand(i, v)"
        @update-preset="(name) => player.applyEQPreset(name)"
      />
    </SettingCard>

    <SettingCard
      :title="t('settings.audio.normalization.title')"
      :description="t('settings.audio.normalization.description')"
    >
      <template #icon><Volume2 :size="22" /></template>

      <div class="row">
        <span>{{ t("settings.audio.normalization.enable") }}</span>
        <ToggleSwitch
          :modelValue="player.normalizationEnabled"
          @update:modelValue="player.setNormalizationEnabled"
        />
      </div>
    </SettingCard>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n"
import { SlidersHorizontal, Volume2 } from "@lucide/vue"
import { usePlayerStore } from "../../store/player.js"
import SettingCard from "../ui/SettingCard.vue"
import ToggleSwitch from "../ui/ToggleSwitch.vue"
import EqualizerPanel from "../EqualizerPanel.vue"

const { t } = useI18n()
const player = usePlayerStore()
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

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.95rem;
  color: var(--text-color);
}
</style>
