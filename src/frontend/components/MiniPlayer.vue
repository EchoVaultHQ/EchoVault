<template>
  <transition name="fade-slide">
    <div v-if="isMiniPlayerActive" class="mini-player-overlay">
      <img class="mini-backdrop" :src="backdropSrc" alt="" />
      <div class="mini-backdrop-tint"></div>

      <div class="mini-player">
        <!-- Header -->
        <div class="mini-header">
          <span class="track-count">
            {{ t("miniPlayer.trackCount", { current: currentIndex + 1, total: queueLength }) }}
          </span>

          <button
            class="icon-btn"
            @click="exitMiniPlayer"
            :title="t('miniPlayer.close')"
          >
            <img :src="X" :alt="t('miniPlayer.close')" class="icon" />
          </button>
        </div>

        <!-- Album Art -->
        <div class="album-art-container">
          <div class="album-art">
            <img
              v-if="player.currentTrack?.coverDataUrl"
              :src="player.currentTrack.coverDataUrl"
              alt="Album Art"
            />
            <img v-else :src="defaultCover" alt="Album Art" />
          </div>
        </div>

        <!-- Track Info -->
        <div class="track-info">
          <h2 class="track-title">
            {{ player.currentTrack?.title || t("labels.noTrackSelected") }}
          </h2>
          <p class="track-artist">
            {{ player.currentTrack?.artist || t("labels.unknownArtist") }}
          </p>
          <p class="track-album">{{ player.currentTrack?.album || "" }}</p>
        </div>

        <!-- Progress Bar -->
        <div class="progress-section">
          <div
            class="progress-bar"
            @click="seek"
            @mousemove="showHoverTime"
            @mouseleave="hideHoverTime"
          >
            <div
              class="progress-fill"
              :style="{ width: `${player.progress * 100}%` }"
            ></div>
            <div
              class="progress-handle"
              :style="{ left: `${player.progress * 100}%` }"
            ></div>
            <div
              v-if="hoverTimeVisible"
              class="progress-cursor-dot"
              :style="{ left: hoverX + 'px' }"
            ></div>
            <div
              v-if="hoverTimeVisible"
              class="hover-time"
              :style="{ left: hoverX + 'px' }"
            >
              {{ formatTime(hoverTime) }}
            </div>
          </div>
          <div class="time-info">
            <span>{{ formatTime(player.currentTime) }}</span>
            <span>{{ formatTime(player.duration) }}</span>
          </div>
        </div>

        <!-- Controls -->
        <div class="controls">
          <button
            @click="player.toggleShuffle"
            class="control-btn toggle-shuffle"
            :class="{ active: player.shuffleEnabled }"
            :title="player.shuffleEnabled ? t('miniPlayer.shuffleOn') : t('miniPlayer.shuffleOff')"
          >
            <img :src="Shuffle" alt="Shuffle icon" class="icon" />
          </button>

          <button
            class="control-btn"
            @click="playPreviousTrack"
            :disabled="!player.hasPrevious"
            :title="t('miniPlayer.previous')"
          >
            <img :src="Previous" :alt="t('miniPlayer.previous')" class="icon" />
          </button>

          <button
            class="control-btn play-btn"
            @click="togglePlay"
            :title="t('miniPlayer.playPause')"
          >
            <img
              :src="player.isPlaying ? Pause : Play"
              :alt="t('miniPlayer.playPause')"
              class="icon large"
            />
          </button>

          <button
            class="control-btn"
            @click="playNextTrack"
            :disabled="!player.hasNext"
            :title="t('miniPlayer.next')"
          >
            <img :src="Next" :alt="t('miniPlayer.next')" class="icon" />
          </button>

          <button
            class="control-btn"
            @click="player.toggleRepeat"
            :class="{ active: player.repeatMode !== 'off' }"
            :title="t('miniPlayer.repeat')"
          >
            <img
              :src="player.repeatMode === 'one' ? RepeatOne : Repeat"
              :alt="t('miniPlayer.repeat')"
              class="icon"
            />
          </button>
        </div>

        <!-- Volume -->
        <div class="volume-section">
          <button class="icon-btn" @click="toggleMute">
            <img :src="volumeIconComponent" alt="Volume" class="icon" />
          </button>

          <input
            type="range"
            min="0"
            max="100"
            v-model="volume"
            @input="onVolumeChange"
            class="volume-slider"
            :style="{ '--volume-progress': volume + '%' }"
          />
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from "vue"
import { useI18n } from "vue-i18n"
import { usePlayerStore } from "../store/player.js"
import {
  Previous,
  Next,
  Play,
  Volume,
  VolumeMute,
  Pause,
  Shuffle,
  Repeat,
  RepeatOne,
  X,
} from "../assets/icons/icons"
import {
  formatTime,
  useVolumeControl,
  useProgressBar,
  usePlaybackControls,
  getVolumeIcon,
} from "../utils/playerUtils.js"
import {
  isMiniPlayerActive,
  enterMiniPlayer,
  exitMiniPlayer,
} from "../utils/miniPlayerState.js"
import defaultCover from "../assets/images/default-cover.svg"

const { t } = useI18n()
const player = usePlayerStore()

const currentIndex = computed(() => player.currentIndex)
const queueLength = computed(() => player.queue.length)

const backdropSrc = computed(
  () => player.currentTrack?.coverDataUrl || defaultCover
)

// Use from utils
const { volume, onVolumeChange, toggleMute } = useVolumeControl(player)
const {
  hoverTimeVisible,
  hoverTime,
  hoverX,
  showHoverTime,
  hideHoverTime,
  seek,
} = useProgressBar(player)
const { togglePlay, playPreviousTrack, playNextTrack } =
  usePlaybackControls(player)

const volumeIconComponent = computed(() =>
  getVolumeIcon(volume.value, { Volume, VolumeMute })
)

// Auto-activate mini mode when the window gets small, as a fallback to the
// manual toggle button in PlayerBar.vue. Both paths route through the same
// shared enterMiniPlayer()/exitMiniPlayer() helpers so state never desyncs.
let resizingFromCode = false
let resizeTimeout = null

function checkWindowSize() {
  if (resizingFromCode) return

  if (resizeTimeout) clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(() => {
    const width = window.innerWidth
    const height = window.innerHeight

    const miniThresholdW = 600
    const miniThresholdH = 700

    const shouldActivateMini = width < miniThresholdW || height < miniThresholdH
    const shouldDeactivateMini =
      width >= miniThresholdW && height >= miniThresholdH

    if (!isMiniPlayerActive.value && shouldActivateMini) {
      resizingFromCode = true
      enterMiniPlayer()
      setTimeout(() => (resizingFromCode = false), 600)
    } else if (isMiniPlayerActive.value && shouldDeactivateMini) {
      // Only deactivate if window is significantly larger to prevent bouncing
      const hasSignificantMargin =
        width > miniThresholdW + 50 && height > miniThresholdH + 50

      if (hasSignificantMargin) {
        resizingFromCode = true
        exitMiniPlayer()
        setTimeout(() => (resizingFromCode = false), 600)
      }
    }
  }, 250)
}

onMounted(() => {
  setTimeout(() => {
    checkWindowSize()
  }, 300)
  window.addEventListener("resize", checkWindowSize)
})

onUnmounted(() => {
  window.removeEventListener("resize", checkWindowSize)
})
</script>

<style scoped>
.mini-player-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-color);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  overflow: hidden;
}

.mini-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(40px) saturate(1.4);
  transform: scale(1.2);
}

.mini-backdrop-tint {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--bg-color) 60%, transparent);
}

.mini-player {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  animation: scaleIn 0.3s ease;
  position: relative;
  z-index: 1;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Header */
.mini-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.25rem;
}

.track-count {
  font-size: 0.85rem;
  color: var(--muted-text);
  font-weight: 500;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  padding: 0.4rem;
  border-radius: 50%;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: var(--hover-bg);
  color: var(--accent);
}

.toggle-shuffle img {
  opacity: 0.7;
  transition:
    filter 0.2s ease,
    opacity 0.2s ease;
}

.toggle-shuffle.active img {
  filter: drop-shadow(0 0 4px var(--accent));
  opacity: 1;
}

/* Album Art */
.album-art-container {
  display: flex;
  justify-content: center;
}

.album-art {
  width: 240px;
  height: 240px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.album-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Track Info */
.track-info {
  text-align: center;
  padding: 0 0.5rem;
}

.track-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-color);
  margin: 0 0 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artist {
  font-size: 0.9rem;
  color: var(--muted-text);
  margin: 0 0 0.2rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-album {
  font-size: 0.8rem;
  color: var(--muted-text);
  opacity: 0.7;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Progress Section */
.progress-section {
  padding: 0 0.5rem;
}

.progress-bar {
  position: relative;
  height: 3px;
  background: rgba(128, 128, 128, 0.25);
  border-radius: 2px;
  cursor: pointer;
  margin-bottom: 0.4rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-hover));
  border-radius: 2px;
  transition: width 0.1s linear;
}

.progress-handle {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  background: white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.progress-bar:hover .progress-handle {
  opacity: 1;
}

.progress-cursor-dot {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  background: var(--accent);
  border: 1px solid white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  z-index: 2;
  pointer-events: none;
}

.hover-time {
  position: absolute;
  bottom: 100%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  white-space: nowrap;
  margin-bottom: 0.5rem;
  pointer-events: none;
}

.time-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--muted-text);
}

/* Controls */
.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0 0.5rem;
}

.control-btn {
  background: transparent;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  padding: 0.6rem;
  border-radius: 50%;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-btn:hover:not(:disabled) {
  background: var(--hover-bg);
  color: var(--accent);
  transform: scale(1.1);
}

.control-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.control-btn.active {
  color: var(--accent);
}

.play-btn:hover {
  transform: scale(1.1);
  filter: drop-shadow(0 0 5px var(--accent));
}

/* Volume */
.volume-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 0.5rem;
}

.volume-slider {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    var(--accent) 0%,
    var(--accent) var(--volume-progress, 50%),
    rgba(128, 128, 128, 0.25) var(--volume-progress, 50%),
    rgba(128, 128, 128, 0.25) 100%
  );
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  transition: background 0.2s ease;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  transition: all 0.2s ease;
}

.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  background: var(--accent-hover);
}

.volume-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.volume-slider::-moz-range-thumb:hover {
  transform: scale(1.2);
  background: var(--accent-hover);
}

/* Transitions */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* icons */
.icon {
  width: 20px;
  height: 20px;
  color: var(--text-color);
  transition:
    color 0.2s ease,
    transform 0.2s ease;
}

.icon.large {
  width: 26px;
  height: 26px;
}

.control-btn:hover .icon,
.icon-btn:hover .icon {
  color: var(--accent);
  transform: scale(1.1);
}

/* Responsive */
@media (max-width: 400px) {
  .album-art {
    width: 200px;
    height: 200px;
  }

  .track-title {
    font-size: 1.1rem;
  }

  .track-artist {
    font-size: 0.85rem;
  }
}
</style>
