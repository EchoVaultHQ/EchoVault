<template>
  <div id="app" :class="{ 'immersive-active': isImmersiveMode }">
    <TopBar @toggle-setting-menu="toggleSettingMenu" v-if="!isImmersiveMode" />

    <div class="main-layout" :class="{ 'queue-open': showQueue }">
      <SideNav :collapsed="showQueue" v-if="showMainViews" />
      <main class="content-area">
        <Setting
          :showSettingMenu="showSettingMenu"
          :initialTab="settingsInitialTab"
          @close="closeSettingMenu"
        />
        <router-view v-if="showMainViews" />
      </main>
      <QueueSidebar :showQueue="showQueue" @close="closeQueue" />
    </div>

    <PlayerBar
      @toggle-queue="toggleQueue"
      @toggle-immersive-mode="toggleImmersiveMode"
      @open-equalizer="openEqualizer"
      v-if="showMainViews && !isImmersiveMode"
    />
    <ImmersiveMode
      v-if="isImmersiveMode"
      @close-immersive-mode="toggleImmersiveMode"
    />
    <MiniPlayer />
    <Toast />
  </div>
</template>

<script setup>
import { ref, computed } from "vue"
import TopBar from "./components/TopBar.vue"
import SideNav from "./components/SideNav.vue"
import PlayerBar from "./components/PlayerBar.vue"
import QueueSidebar from "./components/QueueSidebar.vue"
import Toast from "./components/Toast.vue"
import MiniPlayer from "./components/MiniPlayer.vue"
import Setting from "./components/Setting.vue"
import ImmersiveMode from "./components/ImmersiveMode.vue"

const showQueue = ref(false)
const showSettingMenu = ref(false)
const settingsInitialTab = ref("appearance")
const showMainViews = computed(() => !showSettingMenu.value)
const isImmersiveMode = ref(false)

const toggleQueue = () => {
  showQueue.value = !showQueue.value
}

const toggleSettingMenu = () => {
  showSettingMenu.value = !showSettingMenu.value
}

const openEqualizer = () => {
  settingsInitialTab.value = "audio"
  showSettingMenu.value = true
}

const closeSettingMenu = () => {
  showSettingMenu.value = false
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
  height: calc(100vh - 70px - 80px); /* subtract topbar + playerbar height */
  background-color: var(--bg-color);
  overflow: hidden;
  max-height: 100vh;
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
