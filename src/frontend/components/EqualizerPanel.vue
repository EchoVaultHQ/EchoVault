<template>
  <div class="eq-panel" :class="{ disabled: !enabled }">
    <select
      class="eq-preset-select"
      :value="preset"
      :disabled="!enabled"
      @change="$emit('update-preset', $event.target.value)"
    >
      <option v-if="preset === 'Custom'" value="Custom" disabled>
        {{ t("settings.audio.equalizer.presets.Custom") }}
      </option>
      <option v-for="name in PRESET_NAMES" :key="name" :value="name">
        {{ t(`settings.audio.equalizer.presets.${name}`) }}
      </option>
    </select>

    <div class="eq-bands">
      <div v-for="(freq, i) in EQ_BANDS" :key="freq" class="eq-band">
        <span class="eq-db-label">{{ formatDb(bands[i]) }}</span>
        <input
          type="range"
          class="eq-slider"
          min="-12"
          max="12"
          step="1"
          :value="bands[i]"
          :disabled="!enabled"
          @input="$emit('update-band', i, Number($event.target.value))"
        />
        <span class="eq-freq-label">{{ formatFreq(freq) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n"
import { EQ_BANDS, PRESET_NAMES } from "../utils/eqPresets.js"

defineProps({
  bands: { type: Array, required: true },
  preset: { type: String, required: true },
  enabled: { type: Boolean, required: true },
})

defineEmits(["update-band", "update-preset"])

const { t } = useI18n()

const formatDb = (db) => (db > 0 ? `+${db}dB` : `${db}dB`)
const formatFreq = (freq) => (freq >= 1000 ? `${freq / 1000}k` : `${freq}`)
</script>

<style scoped>
.eq-panel {
  margin-top: 1.5rem;
}

.eq-panel.disabled {
  opacity: 0.5;
}

.eq-preset-select {
  width: 100%;
  max-width: 320px;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  border: 2px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-color);
  border-radius: 12px;
  font-size: 0.9rem;
  cursor: pointer;
}

.eq-preset-select:focus {
  outline: none;
  border-color: var(--accent);
}

.eq-preset-select:disabled {
  cursor: not-allowed;
}

.eq-bands {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  height: 200px;
}

.eq-band {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
}

.eq-db-label {
  font-size: 0.75rem;
  color: var(--muted-text);
  margin-bottom: 0.5rem;
  white-space: nowrap;
}

.eq-freq-label {
  font-size: 0.75rem;
  color: var(--muted-text);
  margin-top: 0.5rem;
}

/* Vertical slider — Electron's renderer is always Chromium, so this
   Chromium-native property is reliable here without a slider library. */
.eq-slider {
  -webkit-appearance: slider-vertical;
  width: 6px;
  height: 140px;
  cursor: pointer;
  accent-color: var(--accent);
}

.eq-slider:disabled {
  cursor: not-allowed;
}
</style>
