<template>
  <div class="tab-content">
    <h2 class="section-title">{{ t("settings.appearance.title") }}</h2>
    <p class="section-description">{{ t("settings.appearance.description") }}</p>

    <SettingCard
      :title="t('settings.appearance.themeMode.title')"
      :description="t('settings.appearance.themeMode.description')"
    >
      <template #icon><Moon :size="22" /></template>

      <div class="option-row">
        <button @click="setTheme('light')" class="option-button" :class="{ active: !isDarkMode }">
          <Sun :size="18" />
          <span>{{ t("settings.appearance.themeMode.light") }}</span>
        </button>
        <button @click="setTheme('dark')" class="option-button" :class="{ active: isDarkMode }">
          <Moon :size="18" />
          <span>{{ t("settings.appearance.themeMode.dark") }}</span>
        </button>
      </div>
    </SettingCard>

    <SettingCard
      :title="t('settings.appearance.accent.title')"
      :description="t('settings.appearance.accent.description')"
    >
      <template #icon><Palette :size="22" /></template>

      <div class="color-grid">
        <div
          v-for="color in accentStore.accentColors"
          :key="color.key"
          @click="accentStore.setAccent(color.value)"
          class="color-swatch"
          :class="{ active: accentStore.accentColor === color.value }"
          :style="{ background: color.value }"
        >
          <Check v-if="accentStore.accentColor === color.value" :size="18" />
        </div>
      </div>
    </SettingCard>
  </div>
</template>

<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { Sun, Moon, Palette, Check } from "@lucide/vue"
import { useThemeStore } from "../../store/theme.js"
import { useAccentStore } from "../../store/accent.js"
import SettingCard from "../ui/SettingCard.vue"

const { t } = useI18n()
const themeStore = useThemeStore()
const accentStore = useAccentStore()

const isDarkMode = computed(() => themeStore.theme === "dark")
const setTheme = (theme) => themeStore.setTheme(theme)
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

.option-row {
  display: flex;
  gap: 1rem;
}

.option-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-color);
  border-radius: var(--radius-md);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.option-button:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.option-button.active {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
  gap: 1rem;
}

.color-swatch {
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  border: 3px solid transparent;
}

.color-swatch:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-md);
}

.color-swatch.active {
  border-color: var(--text-color);
  transform: scale(1.1);
}
</style>
