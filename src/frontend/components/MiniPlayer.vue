<template>
  <transition name="fade-slide">
    <div v-if="isMiniPlayerActive" class="mini-player-overlay">
      <div class="mini-top">
        <div class="top-hover-bar">
          <div class="window-controls">
            <button class="win-btn" @click="winMinimize" :title="t('miniPlayer.minimize')">
              <img :src="Minimize" alt="" class="icon" />
            </button>
            <button class="win-btn" @click="winClose" :title="t('miniPlayer.closeWindow')">
              <img :src="X" alt="" class="icon" />
            </button>
          </div>
        </div>

        <img
          v-if="activeView === 'art' && player.currentTrack?.coverDataUrl"
          class="mini-art"
          :src="player.currentTrack.coverDataUrl"
          alt="Album Art"
        />
        <img
          v-else-if="activeView === 'art'"
          class="mini-art"
          :src="defaultCover"
          alt="Album Art"
        />

        <div v-else-if="activeView === 'queue'" class="queue-view">
          <div class="queue-view-header">
            <h3>{{ t("miniPlayer.upNext") }}</h3>
            <button class="text-btn" @click="player.clearQueue">
              {{ t("miniPlayer.clear") }}
            </button>
          </div>
          <div class="queue-view-list">
            <div
              v-for="(track, index) in displayedQueue"
              :key="track.id || index"
              class="queue-view-item"
              :class="{ playing: player.currentTrack?.file_path === track.file_path }"
              @click="playSongFromQueue(track, index)"
            >
              <img :src="track.coverDataUrl || defaultCover" class="queue-thumb" alt="" />
              <div class="queue-meta">
                <div class="queue-title">{{ track.title }}</div>
                <div class="queue-sub">
                  {{ track.artist }}<span v-if="track.album"> — {{ track.album }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="activeView === 'lyrics'" class="lyrics-view">
          <div v-if="hasLyrics" class="lyrics-scroll-area">
            <TransitionGroup
              v-if="player.lyrics.synchronized && player.lyrics.timestamps?.length"
              name="lyric"
              tag="div"
              class="lyrics-inner"
            >
              <div
                v-for="slot in visibleWindow"
                :key="slot.key"
                class="lyric-line"
                :class="`dist-${slot.distance}`"
              >
                {{ slot.line?.text }}
              </div>
            </TransitionGroup>
            <div v-else class="lyrics-inner">
              <div v-for="(line, idx) in plainLyricLines" :key="idx" class="lyric-line plain">
                {{ line }}
              </div>
            </div>
          </div>
          <div v-else class="no-lyrics">{{ t("labels.noLyricsFound") }}</div>
        </div>
      </div>

      <div class="glass-card">
        <div class="card-top">
          <div class="track-info">
            <h2 class="track-title">
              {{ player.currentTrack?.title || t("labels.noTrackSelected") }}
            </h2>
            <p class="track-subtitle">
              {{ player.currentTrack?.artist || t("labels.unknownArtist") }}
              <span v-if="player.currentTrack?.album"> — {{ player.currentTrack.album }}</span>
            </p>
          </div>

          <button
            class="icon-btn expand-btn"
            @click="exitMiniPlayer"
            :title="t('miniPlayer.close')"
          >
            <img :src="FullscreenExit" :alt="t('miniPlayer.close')" class="icon" />
          </button>
        </div>

        <div class="progress-section">
          <span class="time-elapsed">{{ formatTime(player.currentTime) }}</span>
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
              class="hover-time"
              :style="{ left: hoverX + 'px' }"
            >
              {{ formatTime(hoverTime) }}
            </div>
          </div>
          <span class="time-remaining">-{{ formatTime(player.duration - player.currentTime) }}</span>
        </div>

        <div class="bottom-controls">
          <div class="volume-wrap">
            <button
              class="control-btn"
              :class="{ 'view-active': showVolumePopup }"
              @click="showVolumePopup = !showVolumePopup"
              :title="t('miniPlayer.volume')"
            >
              <img :src="volumeIconComponent" alt="" class="icon" />
            </button>

            <div v-if="showVolumePopup" class="more-menu-backdrop" @click="showVolumePopup = false"></div>
            <div v-if="showVolumePopup" class="volume-popup">
              <button class="icon-btn" @click="toggleMute" :title="t('miniPlayer.volume')">
                <img :src="volumeIconComponent" alt="" class="icon" />
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

          <div class="more-wrap">
            <button
              class="control-btn"
              :class="{ 'view-active': showMoreMenu }"
              @click="showMoreMenu = !showMoreMenu"
              :title="t('miniPlayer.more')"
            >
              <img :src="More" alt="" class="icon" />
            </button>

            <div v-if="showMoreMenu" class="more-menu-backdrop" @click="showMoreMenu = false"></div>
            <div v-if="showMoreMenu" class="more-menu">
              <button class="more-menu-item" @click="onLikeClick">
                <img :src="player.currentTrack?.isLiked ? HeartSolid : Heart" alt="" class="icon" />
                <span>{{ player.currentTrack?.isLiked ? t("miniPlayer.unlike") : t("miniPlayer.like") }}</span>
              </button>
              <button class="more-menu-item" @click="onExitFromMenu">
                <img :src="FullscreenExit" alt="" class="icon" />
                <span>{{ t("miniPlayer.close") }}</span>
              </button>
            </div>
          </div>

          <button
            class="control-btn"
            @click="player.toggleShuffle"
            :class="{ active: player.shuffleEnabled }"
            :title="player.shuffleEnabled ? t('miniPlayer.shuffleOn') : t('miniPlayer.shuffleOff')"
          >
            <img :src="Shuffle" alt="" class="icon" />
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
              class="icon"
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

          <button
            class="control-btn"
            :class="{ 'view-active': activeView === 'lyrics' }"
            @click="toggleLyricsView"
            :title="t('miniPlayer.lyrics')"
          >
            <img :src="DesktopLyrics" alt="" class="icon" />
          </button>

          <button
            class="control-btn"
            :class="{ 'view-active': activeView === 'queue' }"
            @click="toggleQueueView"
            :title="t('miniPlayer.queue')"
          >
            <img :src="Playlist" alt="" class="icon" />
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from "vue"
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
  Minimize,
  More,
  DesktopLyrics,
  Playlist,
  Heart,
  HeartSolid,
  FullscreenExit,
  X,
} from "../assets/icons/icons"
import {
  formatTime,
  useVolumeControl,
  useProgressBar,
  usePlaybackControls,
  useQueueManagement,
  useTrackLike,
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

const winMinimize = () => window.api.minimize()
const winClose = () => window.api.close()

// Which panel fills the top region: album art, the up-next queue, or lyrics.
const activeView = ref("art")
function toggleQueueView() {
  activeView.value = activeView.value === "queue" ? "art" : "queue"
}
function toggleLyricsView() {
  activeView.value = activeView.value === "lyrics" ? "art" : "lyrics"
}

const showMoreMenu = ref(false)
const showVolumePopup = ref(false)
const { toggleLikedSong } = useTrackLike(player)
const onLikeClick = async () => {
  await toggleLikedSong()
  showMoreMenu.value = false
}
const onExitFromMenu = () => {
  showMoreMenu.value = false
  exitMiniPlayer()
}

const { displayedQueue, playSongFromQueue } = useQueueManagement(player)

// Lyrics sync (mirrors ImmersiveMode.vue's approach): driven by the playback
// clock via requestAnimationFrame, only does real work while the lyrics view
// is actually visible.
const hasLyrics = computed(() => !!player.lyrics?.text)
const plainLyricLines = computed(() =>
  (player.lyrics?.text || "").split("\n").filter((line) => line.trim())
)
const activeIndex = ref(-1)
let rafHandle = null

function tickLyricSync() {
  if (isMiniPlayerActive.value && activeView.value === "lyrics") {
    const timestamps = player.lyrics?.timestamps
    if (timestamps?.length) {
      const time = player.getLiveTime()
      const idx = timestamps.findIndex(
        (line) => time >= line.startTime && time < line.endTime
      )
      if (idx !== activeIndex.value) activeIndex.value = idx
    }
  }
  rafHandle = requestAnimationFrame(tickLyricSync)
}

const WINDOW_RADIUS = 2
const visibleWindow = computed(() => {
  const timestamps = player.lyrics?.timestamps
  const active = activeIndex.value
  const slots = []
  for (let offset = -WINDOW_RADIUS; offset <= WINDOW_RADIUS; offset++) {
    const realIdx = active + offset
    const line = timestamps?.[realIdx]
    slots.push({
      key: line ? `line-${realIdx}` : `pad-${offset}`,
      line,
      distance: Math.abs(offset),
    })
  }
  return slots
})

watch(
  () => player.lyrics,
  () => {
    activeIndex.value = -1
  }
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
  rafHandle = requestAnimationFrame(tickLyricSync)
})

onUnmounted(() => {
  window.removeEventListener("resize", checkWindowSize)
  if (rafHandle) cancelAnimationFrame(rafHandle)
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
  flex-direction: column;
  overflow: hidden;
}

.mini-top {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-color);
}

.mini-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Window controls overlaid on the top region */
.top-hover-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2.75rem;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 0.6rem;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.55), transparent);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.mini-top:hover .top-hover-bar {
  opacity: 1;
}

.window-controls {
  display: flex;
  gap: 0.4rem;
}

.win-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.win-btn:hover {
  background: rgba(0, 0, 0, 0.55);
}

.win-btn .icon {
  width: 13px;
  height: 13px;
  filter: invert(1) brightness(2);
}

/* Queue view (Up Next) */
.queue-view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: 3rem 0 0;
}

.queue-view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem 0.5rem;
}

.queue-view-header h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-color);
}

.text-btn {
  background: transparent;
  border: none;
  color: var(--muted-text);
  font-size: 0.85rem;
  cursor: pointer;
}

.text-btn:hover {
  color: var(--accent);
}

.queue-view-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 0.6rem;
}

.queue-view-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem;
  border-radius: 8px;
  cursor: pointer;
}

.queue-view-item:hover {
  background: var(--hover-bg);
}

.queue-view-item.playing {
  color: var(--accent);
}

.queue-thumb {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.queue-meta {
  min-width: 0;
}

.queue-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-sub {
  font-size: 0.75rem;
  color: var(--muted-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Lyrics view */
.lyrics-view {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: 1.2rem;
}

.lyrics-scroll-area {
  flex: 1;
  max-height: 100%;
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(to bottom, transparent, black 12%, black 88%, transparent);
}

.lyrics-scroll-area::-webkit-scrollbar {
  display: none;
}

.lyrics-inner {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.lyric-line {
  font-size: 1rem;
  color: var(--muted-text);
  opacity: 0.5;
  transition:
    font-size 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    color 0.4s ease,
    opacity 0.4s ease,
    transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.lyric-move {
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.lyric-line.dist-0 {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--accent);
  opacity: 1;
}

.lyric-line.dist-1 {
  opacity: 0.75;
}

.lyric-line.plain {
  color: var(--text-color);
  opacity: 0.9;
}

.no-lyrics {
  color: var(--muted-text);
  font-size: 0.9rem;
  margin: auto;
}

/* Glass card */
.glass-card {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  padding: 0.9rem 1rem 1rem;
  border-radius: 16px 16px 0 0;
  background: color-mix(in srgb, var(--bg-color) 55%, transparent);
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.track-info {
  min-width: 0;
}

.track-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-color);
  margin: 0 0 0.15rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-subtitle {
  font-size: 0.8rem;
  color: var(--muted-text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.expand-btn {
  flex-shrink: 0;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  padding: 0.3rem;
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

/* Progress */
.progress-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.time-elapsed,
.time-remaining {
  font-size: 0.7rem;
  color: var(--muted-text);
  flex-shrink: 0;
  min-width: 2.2em;
}

.time-remaining {
  text-align: right;
}

.progress-bar {
  position: relative;
  flex: 1;
  height: 3px;
  background: rgba(128, 128, 128, 0.25);
  border-radius: 2px;
  cursor: pointer;
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
  width: 9px;
  height: 9px;
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

.hover-time {
  position: absolute;
  bottom: 100%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 0.7rem;
  white-space: nowrap;
  margin-bottom: 0.4rem;
  pointer-events: none;
}

/* Bottom controls */
.bottom-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.volume-wrap,
.more-wrap {
  position: relative;
}

.volume-popup {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 0.5rem;
  background: var(--bg-color);
  border: 1px solid var(--border-color, rgba(128, 128, 128, 0.25));
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  padding: 0.4rem 0.9rem 0.4rem 0.4rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  z-index: 4;
  width: 170px;
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
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  transition: transform 0.15s ease;
}

.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: none;
}

.more-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3;
}

.more-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 0.5rem;
  background: var(--bg-color);
  border: 1px solid var(--border-color, rgba(128, 128, 128, 0.25));
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  padding: 0.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  z-index: 4;
  min-width: 150px;
}

.more-menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: none;
  color: var(--text-color);
  padding: 0.45rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  white-space: nowrap;
}

.more-menu-item:hover {
  background: var(--hover-bg);
  color: var(--accent);
}

.control-btn {
  background: transparent;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  padding: 0.35rem;
  border-radius: 50%;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-btn:hover:not(:disabled) {
  color: var(--accent);
}

.control-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.control-btn.active {
  color: var(--accent);
}

.control-btn.view-active {
  background: var(--accent);
  color: #fff;
}

.play-btn {
  width: 32px;
  height: 32px;
  background: var(--accent);
}

.play-btn .icon {
  filter: brightness(0) invert(1);
}

.play-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  color: var(--text-color);
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
  width: 18px;
  height: 18px;
  color: var(--text-color);
  transition:
    color 0.2s ease,
    transform 0.2s ease;
}
</style>
