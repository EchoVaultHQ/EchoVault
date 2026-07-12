<template>
  <div class="tab-content">
    <h2 class="section-title">{{ t("settings.language.title") }}</h2>
    <p class="section-description">{{ t("settings.language.description") }}</p>

    <SettingCard
      :title="t('settings.language.displayLanguage.title')"
      :description="t('settings.language.displayLanguage.description')"
    >
      <template #icon><Languages :size="22" /></template>

      <div class="language-list">
        <button
          @click="setLanguage('en')"
          class="language-option"
          :class="{ active: currentLocale === 'en' }"
        >
          <span class="flag">🇬🇧</span>
          <div>
            <div class="lang-name">{{ t("settings.language.languages.en.name") }}</div>
            <div class="lang-native">{{ t("settings.language.languages.en.native") }}</div>
          </div>
          <Check v-if="currentLocale === 'en'" :size="18" />
        </button>
        <button
          @click="setLanguage('ja')"
          class="language-option"
          :class="{ active: currentLocale === 'ja' }"
        >
          <span class="flag">🇯🇵</span>
          <div>
            <div class="lang-name">{{ t("settings.language.languages.ja.name") }}</div>
            <div class="lang-native">{{ t("settings.language.languages.ja.native") }}</div>
          </div>
          <Check v-if="currentLocale === 'ja'" :size="18" />
        </button>
      </div>
    </SettingCard>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { useI18n } from "vue-i18n"
import { Languages, Check } from "@lucide/vue"
import SettingCard from "../ui/SettingCard.vue"

const { locale, t } = useI18n()
const currentLocale = ref(localStorage.getItem("locale") || "en")

const setLanguage = (lang) => {
  locale.value = lang
  currentLocale.value = lang
  localStorage.setItem("locale", lang)
}

onMounted(() => {
  const savedLang = localStorage.getItem("locale")
  if (savedLang) {
    currentLocale.value = savedLang
    locale.value = savedLang
  }
})
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

.language-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.language-option {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.25rem;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  border-radius: var(--radius-md);
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

.language-option svg {
  margin-left: auto;
  color: var(--accent);
  flex-shrink: 0;
}
</style>
