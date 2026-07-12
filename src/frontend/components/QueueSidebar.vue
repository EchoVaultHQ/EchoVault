<template>
  <transition name="slide-fade">
    <div
      v-if="showQueue"
      class="queue-panel"
      :style="{ width: panelWidth + 'px' }"
    >
      <div class="resize-handle" @mousedown="startResize"></div>
      <div class="queue-header">
        <h3>
          {{ t('queue.title') }}
          <small v-if="player.shuffleEnabled" style="opacity: 0.7"
            >({{ t('queue.shuffled') }})</small
          >
        </h3>
        <button class="close-btn icon-btn" @click="closeQueue" title="Close">
          <X :size="18" />
        </button>
      </div>

      <div v-if="displayedQueue.length" class="queue-list">
        <div
          v-for="(track, index) in displayedQueue"
          :key="track.id || index"
          class="queue-item"
          :class="{
            playing: player.currentTrack?.file_path === track.file_path,
          }"
          @click="playSongFromQueue(track)"
        >
          <span class="index">{{ index + 1 }}</span>

          <img
            v-if="track.coverDataUrl"
            :src="track.coverDataUrl"
            alt="Album Art"
            class="queue-thumb"
          />
          <img
            v-else
            src="../assets/images/default-cover.svg"
            alt="Album Art"
            class="queue-thumb"
          />

          <div class="track-details">
            <div class="track-title">{{ track.title }}</div>
            <div class="track-artist">{{ track.artist }}</div>
          </div>

          <span class="duration">{{ formatTime(track.duration) }}</span>

          <button
            class="remove-btn"
            title="Remove from queue"
            @click.stop="removeFromQueue(track)"
          >
            <X :size="14" />
          </button>
        </div>
      </div>
      <div v-else class="queue-empty">
        <ListMusic :size="28" />
        <p>{{ t('queue.empty') }}</p>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue"
import { usePlayerStore } from "../store/player.js"
import { X, ListMusic } from "@lucide/vue"
import { formatTime, useQueueManagement } from "../utils/playerUtils.js"
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({
  showQueue: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(["close"])

const player = usePlayerStore()
const { displayedQueue, playSongFromQueue, removeFromQueue } =
  useQueueManagement(player)

const closeQueue = () => {
  emit("close")
}

// Resizing logic
const panelWidth = ref(340)
const isResizing = ref(false)
const minWidth = 280
const maxWidth = 600

const startResize = (e) => {
  isResizing.value = true
  document.body.style.cursor = "ew-resize"
  document.body.style.userSelect = "none"
  e.preventDefault()
}

const handleResize = (e) => {
  if (!isResizing.value) return

  const newWidth = window.innerWidth - e.clientX

  if (newWidth >= minWidth && newWidth <= maxWidth) {
    panelWidth.value = newWidth
  }
}

const stopResize = () => {
  isResizing.value = false
  document.body.style.cursor = ""
  document.body.style.userSelect = ""
}

onMounted(() => {
  document.addEventListener("mousemove", handleResize)
  document.addEventListener("mouseup", stopResize)
})

onBeforeUnmount(() => {
  document.removeEventListener("mousemove", handleResize)
  document.removeEventListener("mouseup", stopResize)
})

watch(
  () => props.showQueue,
  async (val) => {
    if (val) {
      await nextTick()
      const list = document.querySelector(".queue-list")
      if (list) list.scrollTop = 0
    }
  }
)
</script>

<style scoped>
/* Queue panel layout */
.queue-panel {
  width: 340px;
  height: 100%;
  background-color: var(--content-bg);
  border-left: 2px solid var(--border-color);
  color: var(--text-color);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.5);
  position: relative;
}

/* Resize handle */
.resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  background: transparent;
  z-index: 10;
  transition: background 0.2s ease;
}

.resize-handle:hover {
  background: var(--accent);
}

.resize-handle::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 40px;
  background: var(--border-color);
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.resize-handle:hover::before {
  opacity: 1;
}

/* Queue header */
.queue-header {
  height: 55px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--topbar-bg);
}

.queue-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

/* Queue header buttons */
.icon-btn {
  background: transparent;
  border: none;
  border-radius: 8px;
  padding: 6px;
  color: var(--muted-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.icon-btn:hover {
  background-color: var(--hover-bg);
  color: var(--accent);
}

/* Queue list */
.queue-list {
  flex: 1;
  overflow-y: auto;
}

/* Queue item styles */
.queue-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: background 0.2s ease;
  position: relative;
  border-bottom: 1px solid var(--border-color);
}

.queue-item:hover {
  background-color: var(--hover-bg);
}

.queue-item.playing {
  background: color-mix(in srgb, var(--accent) 35%, var(--side-nav-bg));
  box-shadow: inset 2px 0 0 var(--accent);
}

.index {
  width: 18px;
  flex-shrink: 0;
  text-align: right;
  color: var(--muted-text);
  font-size: 0.85rem;
}

.queue-thumb {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* Track details inside queue */
.track-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.track-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artist {
  font-size: 13px;
  color: var(--muted-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Duration text alignment */
.duration {
  flex-shrink: 0;
  font-size: 0.85rem;
  color: var(--muted-text);
  margin-right: 1.5rem;
}

/* Remove button inside queue item */
.remove-btn {
  opacity: 0;
  background: transparent;
  border: none;
  color: var(--muted-text);
  position: absolute;
  right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    opacity 0.2s,
    color 0.2s;
  cursor: pointer;
}

.queue-item:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  color: var(--accent);
}

/* Empty queue state */
.queue-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted-text);
}

.queue-empty p {
  margin: 0;
  font-size: 0.9rem;
}

/* Queue transition animation */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

/* Responsive queue panel adjustments */
@media (max-width: 768px) {
  .queue-panel {
    width: 100%;
    height: 60vh;
    position: fixed;
    bottom: 80px;
    right: 0;
    left: 0;
    border-left: none;
    border-top: 2px solid var(--border-color);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.4);
    z-index: 9999;
  }

  .queue-header {
    padding: 0.8rem 1rem;
  }

  .queue-list {
    padding-bottom: 1rem;
  }
}
</style>
