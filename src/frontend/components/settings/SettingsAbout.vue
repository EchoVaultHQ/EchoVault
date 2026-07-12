<template>
  <div class="tab-content">
    <h2 class="section-title">{{ t("settings.about.title") }}</h2>
    <p class="section-description">{{ t("settings.about.description") }}</p>

    <div class="about-card">
      <img src="../../assets/icons/app-icon.png" alt="App Icon" class="app-icon" />
      <h3>{{ t("app.name") }}</h3>
      <p class="version">{{ t("settings.about.version", { version }) }}</p>
      <p class="description">{{ t("settings.about.appDescription") }}</p>

      <div class="update-status">
        <p v-if="updateStore.available" class="update-status-line">
          {{ t("update.available", { version: updateStore.version }) }}
          <a href="#" @click.prevent="openUpdateLink">{{ t("update.download") }}</a>
        </p>
        <p v-else-if="updateStore.checked" class="update-status-line">
          {{ t("settings.about.upToDate") }}
        </p>
        <button class="pill-button" :disabled="checkingForUpdates" @click="checkForUpdatesNow">
          {{ checkingForUpdates ? t("settings.about.checking") : t("settings.about.checkForUpdates") }}
        </button>
      </div>

      <p class="attribution">
        Echo dot icon by
        <a href="https://www.flaticon.com/authors/iyahicon" target="_blank">IYAHICON</a>
        from
        <a href="https://www.flaticon.com/free-icons/echo-dot" target="_blank">Flaticon</a>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { useI18n } from "vue-i18n"
import { useUpdateStore } from "../../store/update.js"

const { t } = useI18n()
const updateStore = useUpdateStore()
const version = ref("")
const checkingForUpdates = ref(false)

async function checkForUpdatesNow() {
  checkingForUpdates.value = true
  try {
    await updateStore.checkNow()
  } finally {
    checkingForUpdates.value = false
  }
}

async function openUpdateLink() {
  const result = await window.api.openExternal(updateStore.url)
  if (!result?.success) {
    window.api.showToast?.("Could not open the download link.", "error")
  }
}

onMounted(() => {
  window.api.getAppVersion().then((v) => (version.value = v))
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

.about-card {
  background: var(--side-nav-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 3rem;
  text-align: center;
}

.app-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1rem;
  border-radius: var(--radius-xl);
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

.update-status {
  margin: 0 0 1.5rem 0;
}

.update-status-line {
  font-size: 0.9rem;
  color: var(--muted-text);
  margin: 0 0 0.75rem 0;
}

.update-status-line a {
  color: var(--accent);
  margin-left: 0.5rem;
}

.pill-button {
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-color);
  border-radius: var(--radius-full);
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.pill-button:hover {
  border-color: var(--accent);
}

.pill-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.attribution {
  font-size: 12px;
  opacity: 0.6;
  margin-top: 12px;
}

.attribution a {
  color: var(--muted-text);
}
</style>
