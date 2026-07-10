<template>
  <div v-if="visible" class="update-banner">
    <span>{{ t("update.available", { version }) }}</span>
    <div class="update-banner-actions">
      <button class="update-banner-download" @click="download">
        {{ t("update.download") }}
      </button>
      <button class="update-banner-dismiss" @click="dismiss">
        {{ t("update.dismiss") }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue"
import { useI18n } from "vue-i18n"

const { t } = useI18n()

const DISMISSED_KEY = "echovault-dismissed-update"

const visible = ref(false)
const version = ref("")
const url = ref("")
let unsubscribe = null

onMounted(() => {
  unsubscribe = window.api.onUpdateAvailable((data) => {
    if (localStorage.getItem(DISMISSED_KEY) === data.version) return
    version.value = data.version
    url.value = data.url
    visible.value = true
  })
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})

function download() {
  window.api.openExternal(url.value)
}

function dismiss() {
  localStorage.setItem(DISMISSED_KEY, version.value)
  visible.value = false
}
</script>

<style scoped>
.update-banner {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--accent);
  color: white;
  padding: 10px 16px;
  border-radius: 8px;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
  font-weight: 500;
}

.update-banner-actions {
  display: flex;
  gap: 8px;
}

.update-banner-download,
.update-banner-dismiss {
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  font-weight: 500;
}

.update-banner-download {
  background: white;
  color: var(--accent);
}

.update-banner-dismiss {
  background: transparent;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.6);
}
</style>
