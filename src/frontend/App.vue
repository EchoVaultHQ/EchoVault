<template>
  <div id="app" :class="{ 'immersive-active': isImmersiveMode }">
    <TopBar v-if="!isImmersiveMode" />

    <div class="main-layout" :class="{ 'queue-open': showQueue }">
      <SideNav :collapsed="showQueue" />
      <main class="content-area">
        <router-view />
      </main>
      <LyricsPanel />
      <QueueSidebar :showQueue="showQueue" @close="closeQueue" />
    </div>

    <PlayerBar
      @toggle-queue="toggleQueue"
      @toggle-immersive-mode="toggleImmersiveMode"
      @open-equalizer="openEqualizer"
      v-if="!isImmersiveMode"
    />
    <ImmersiveMode
      v-if="isImmersiveMode"
      @close-immersive-mode="toggleImmersiveMode"
      @toggle-queue="toggleQueueFromImmersive"
      @open-equalizer="openEqualizerFromImmersive"
    />
    <MiniPlayer />
    <Toast />
    <UpdateBanner />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue"
import { useRouter } from "vue-router"
import TopBar from "./components/TopBar.vue"
import SideNav from "./components/SideNav.vue"
import PlayerBar from "./components/PlayerBar.vue"
import QueueSidebar from "./components/QueueSidebar.vue"
import LyricsPanel from "./components/LyricsPanel.vue"
import Toast from "./components/Toast.vue"
import MiniPlayer from "./components/MiniPlayer.vue"
import ImmersiveMode from "./components/ImmersiveMode.vue"
import UpdateBanner from "./components/UpdateBanner.vue"
import { useUpdateStore } from "./store/update.js"
import { usePlayerStore } from "./store/player.js"
import { useShortcutsStore } from "./store/shortcuts.js"
import { useProfileStore } from "./store/profile.js"
import { normalizeKeyEvent, isEditableTarget } from "./utils/keyCombo.js"

const updateStore = useUpdateStore()
const playerStore = usePlayerStore()
const shortcutsStore = useShortcutsStore()
const profileStore = useProfileStore()
const router = useRouter()
let unsubscribeUpdate = null
let unsubscribeTrayControl = null

function handleGlobalKeydown(e) {
  if (isEditableTarget(e.target)) return
  const combo = normalizeKeyEvent(e)
  if (!combo) return
  const action = shortcutsStore.actionForCombo(combo)
  if (!action) return
  e.preventDefault()

  switch (action) {
    case "playPause":
      playerStore.togglePlay()
      break
    case "nextTrack":
      playerStore.playNext()
      break
    case "previousTrack":
      playerStore.playPrevious()
      break
    case "seekForward":
      playerStore.seekTo(playerStore.getLiveTime() + 5)
      break
    case "seekBackward":
      playerStore.seekTo(playerStore.getLiveTime() - 5)
      break
    case "volumeUp":
      playerStore.setVolume(playerStore.volume + 0.1)
      break
    case "volumeDown":
      playerStore.setVolume(playerStore.volume - 0.1)
      break
    case "muteToggle":
      playerStore.toggleMute()
      break
    case "shuffleToggle":
      playerStore.toggleShuffle()
      break
    case "repeatCycle":
      playerStore.toggleRepeat()
      break
    case "focusSearch":
      document.getElementById("global-search-input")?.focus()
      break
    case "goToLibrary":
      router.push("/library")
      break
  }
}

onMounted(() => {
  profileStore.load()
  unsubscribeUpdate = window.api.onUpdateAvailable((data) => updateStore.setResult(data))
  unsubscribeTrayControl = window.api.onTrayControl((action) => {
    if (action === "toggle-play") playerStore.togglePlay()
    else if (action === "next") playerStore.playNext()
    else if (action === "previous") playerStore.playPrevious()
    else if (action === "toggle-shuffle") playerStore.toggleShuffle()
    else if (action === "volume-up") playerStore.setVolume(playerStore.volume + 0.1)
    else if (action === "volume-down") playerStore.setVolume(playerStore.volume - 0.1)
  })
  window.addEventListener("keydown", handleGlobalKeydown)
})

onUnmounted(() => {
  if (unsubscribeUpdate) unsubscribeUpdate()
  if (unsubscribeTrayControl) unsubscribeTrayControl()
  window.removeEventListener("keydown", handleGlobalKeydown)
})

const showQueue = ref(false)
const isImmersiveMode = ref(false)

const toggleQueue = () => {
  showQueue.value = !showQueue.value
}

const openEqualizer = () => {
  router.push({ path: "/settings", query: { tab: "audio" } })
}

const closeQueue = () => {
  showQueue.value = false
}

const toggleImmersiveMode = () => {
  isImmersiveMode.value = !isImmersiveMode.value
  if (isImmersiveMode.value) {
    window.api.setImmersiveMode()
  } else {
    window.api.resetImmersiveMode()
  }
}

const toggleQueueFromImmersive = () => {
  toggleImmersiveMode()
  toggleQueue()
}

const openEqualizerFromImmersive = () => {
  toggleImmersiveMode()
  openEqualizer()
}
</script>

<style>
/* Global layout – root structure, main layout, and theme-specific scrollbar styles */

/* Root structure and body setup */
html,
body,
#app {
  height: 100%;
  margin: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Main layout wrapper (between top bar and player bar) */
.main-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  background-color: var(--bg-color);
  overflow: hidden;
  transition: all 0.3s ease;
}

/* Content area */
.content-area {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  background-color: var(--content-bg);
  color: var(--text-color);
  transition: all 0.3s ease;
}

#app.immersive-active .main-layout {
  /* Collapse the main layout when immersive is active */
  height: 0;
  flex: 0 0 0;
}

#app.immersive-active .content-area {
  /* Hide content area fully */
  display: none;
}

/* Also, add a class to the root element for clarity (optional but good practice) */
#app.immersive-active {
  /* Ensures nothing overflows the screen when in immersive mode */
  overflow: hidden;
}

/* Dark theme scrollbar */
:root[data-theme="dark"] ::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

:root[data-theme="dark"] ::-webkit-scrollbar-track {
  background: #1a1a1a;
}

:root[data-theme="dark"] ::-webkit-scrollbar-thumb {
  background-color: #444;
  border: 2px solid #1a1a1a;
}

:root[data-theme="dark"] ::-webkit-scrollbar-thumb:hover {
  background-color: #666;
}

/* Light theme scrollbar */
:root[data-theme="light"] ::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

:root[data-theme="light"] ::-webkit-scrollbar-track {
  background: #eaeaea;
}

:root[data-theme="light"] ::-webkit-scrollbar-thumb {
  background-color: #b5b5b5;
  border: 2px solid #eaeaea;
}

:root[data-theme="light"] ::-webkit-scrollbar-thumb:hover {
  background-color: #999;
}

/* Mobile: overlay queue instead of push */
@media (max-width: 768px) {
  .main-layout.queue-open .content-area {
    filter: brightness(0.5);
  }
}
</style>
