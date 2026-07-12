<template>
  <div class="tab-content">
    <h2 class="section-title">{{ t("settings.profile.title") }}</h2>
    <p class="section-description">{{ t("settings.profile.description") }}</p>

    <SettingCard :title="t('settings.profile.usernameLabel')">
      <template #icon><User :size="22" /></template>

      <input
        class="text-input"
        type="text"
        :placeholder="t('settings.profile.usernamePlaceholder')"
        v-model="usernameInput"
        @blur="profileStore.setUsername(usernameInput)"
        @keyup.enter="profileStore.setUsername(usernameInput)"
      />

      <div class="avatar-row">
        <div class="avatar-preview">
          <img v-if="profileStore.avatarUrl" :src="profileStore.avatarUrl" alt="Avatar" />
          <CircleUser v-else :size="28" />
        </div>
        <button class="pill-button" @click="profileStore.pickAvatar()">
          {{ t("settings.profile.chooseImage") }}
        </button>
        <button
          v-if="profileStore.avatarUrl"
          class="pill-button"
          @click="profileStore.clearAvatar()"
        >
          {{ t("settings.profile.removeImage") }}
        </button>
      </div>
    </SettingCard>
  </div>
</template>

<script setup>
import { ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { User, CircleUser } from "@lucide/vue"
import { useProfileStore } from "../../store/profile.js"
import SettingCard from "../ui/SettingCard.vue"

const { t } = useI18n()
const profileStore = useProfileStore()
const usernameInput = ref(profileStore.username)
watch(
  () => profileStore.username,
  (val) => {
    usernameInput.value = val
  }
)
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

.text-input {
  display: block;
  width: 100%;
  max-width: 320px;
  padding: 0.75rem 1rem;
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

.avatar-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1.25rem;
}

.avatar-preview {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  color: var(--accent);
  flex-shrink: 0;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pill-button {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-color);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pill-button:hover {
  border-color: var(--accent);
  background: var(--hover-bg);
}
</style>
