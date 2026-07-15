<template>
  <div class="playerbar-wrapper">
    <!-- === PROGRESS BAR === -->
    <div class="progress-bar-row">
      <span class="time-label time-elapsed">{{ formatTime(player.currentTime) }}</span>
      <div
        class="progress-bar"
        :class="{ dragging: isDragging }"
        @mousedown="startDrag($event)"
        @mousemove="showHoverTime($event)"
        @mouseleave="hideHoverTime"
      >
        <div class="progress-track">
          <div
            class="progress-fill"
            :style="{ width: `${player.progress * 100}%` }"
          >
            <div class="progress-thumb"></div>
          </div>
        </div>
        <div
          v-if="hoverTimeVisible"
          class="hover-time"
          :style="{ left: hoverX + 'px' }"
        >
          {{ formatTime(hoverTime) }}
        </div>
      </div>
      <span class="time-label time-remaining">-{{ formatTime(player.duration - player.currentTime) }}</span>
    </div>

    <footer class="player-bar" :style="playerBarStyle">
      <!-- LEFT: Song Info -->
      <div class="song-info">
        <img
          v-if="player.currentTrack?.coverDataUrl"
          :src="player.currentTrack.coverDataUrl"
          alt="Album Art"
        />
        <img v-else src="../assets/images/default-cover.svg" alt="Album Art" />

        <div class="song-details">
          <p>{{ player.currentTrack?.title || t("labels.noTrackSelected") }}</p>
          <small class="artist-name" @click="openArtistFromPlayer">
            {{ player.currentTrack?.artist || t("labels.unknownArtist") }}
          </small>
        </div>
      </div>

      <!-- CENTER: Playback cluster -->
      <div class="controls">
        <button
          @click="player.toggleShuffle"
          class="icon-btn toggle-shuffle"
          :class="{ active: player.shuffleEnabled }"
          :title="player.shuffleEnabled ? 'Shuffle: On' : 'Shuffle: Off'"
        >
          <Shuffle :size="17" />
        </button>

        <button
          @click="playPreviousTrack"
          class="icon-btn"
          :disabled="!player.hasPrevious"
          :class="{ disabled: !player.hasPrevious }"
        >
          <SkipBack :size="18" />
        </button>

        <button @click="togglePlay" class="icon-btn play-btn">
          <component
            :is="isPlaying ? Pause : Play"
            :size="24"
            fill="currentColor"
          />
        </button>

        <button
          @click="playNextTrack"
          class="icon-btn"
          :disabled="!player.hasNext"
          :class="{ disabled: !player.hasNext }"
        >
          <SkipForward :size="18" />
        </button>

        <button
          @click="player.toggleRepeat"
          class="icon-btn"
          :class="player.repeatMode"
          :title="`Repeat: ${player.repeatMode}`"
        >
          <component
            :is="player.repeatMode === 'one' ? Repeat1 : Repeat"
            :size="17"
          />
        </button>
      </div>

      <!-- RIGHT: Utility cluster + Volume -->
      <div class="right-section">
        <div class="track-utils">
          <button
            @click="toggleMiniPlayerMode"
            class="icon-btn"
            :title="t('miniPlayer.toggle')"
          >
            <component :is="isMiniPlayerActive ? Minimize2 : Maximize2" :size="17" />
          </button>
          <button
            @click="togglePlayListQueueView"
            class="icon-btn"
            :title="`Show Queue`"
          >
            <ListMusic :size="17" />
          </button>
          <button
            @click="toggleImmersiveMode"
            class="icon-btn"
            title="Toggle Immersive Mode"
          >
            <Cast :size="17" />
          </button>
          <button
            @click="openEqualizer"
            class="icon-btn"
            :title="t('labels.equalizer')"
          >
            <SlidersHorizontal :size="17" />
          </button>
          <button
            @click="toggleLikedSong()"
            class="icon-btn like-btn"
            :class="{ 'is-liked': player.currentTrack?.isLiked }"
            :title="`Like Song`"
          >
            <Heart
              :size="17"
              :fill="player.currentTrack?.isLiked ? 'currentColor' : 'none'"
            />
          </button>
          <button
            @click="player.toggleLyricsPanel()"
            class="icon-btn"
            :class="{ active: player.showLyricsPanel }"
            :title="t('labels.showLyrics')"
          >
            <Captions :size="17" />
          </button>
        </div>

        <div class="volume">
          <button
            @click="toggleMute"
            class="icon-btn"
            :title="`Volume: ${volume}%`"
          >
            <component :is="currentVolumeIcon" :size="17" />
          </button>

          <input
            type="range"
            min="0"
            max="100"
            v-model="volume"
            @input="onVolumeChange"
            class="volume-slider"
            :style="{ '--range-progress': volume + '%' }"
            :title="`Volume: ${volume}%`"
          />
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue"
import { usePlayerStore } from "../store/player.js"
import { useRouter } from "vue-router"
import { extractCoverColor } from "../utils/coverColor.js"
import {
  Shuffle,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Repeat,
  Repeat1,
  Heart,
  ListMusic,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Cast,
  Captions,
} from "@lucide/vue"

import {
  formatTime,
  useVolumeControl,
  useProgressBar,
  usePlaybackControls,
  useTrackLike,
  getVolumeIcon,
} from "../utils/playerUtils.js"
import { useI18n } from "vue-i18n"
import {
  isMiniPlayerActive,
  enterMiniPlayer,
  exitMiniPlayer,
} from "../utils/miniPlayerState.js"

const { t } = useI18n()
const emit = defineEmits([
  "toggle-queue",
  "toggle-immersive-mode",
  "open-equalizer",
])

const props = defineProps({
  isInImmersiveMode: {
    type: Boolean,
    default: false,
  },
})

const player = usePlayerStore()
const isPlaying = computed(() => player.isPlaying)
const router = useRouter()

const { volume, onVolumeChange, toggleMute } = useVolumeControl(player)
const {
  hoverTimeVisible,
  hoverTime,
  hoverX,
  isDragging,
  showHoverTime,
  hideHoverTime,
  startDrag,
} = useProgressBar(player)
const { togglePlay, playPreviousTrack, playNextTrack } =
  usePlaybackControls(player)
const { toggleLikedSong } = useTrackLike(player)

const currentVolumeIcon = computed(() =>
  getVolumeIcon(volume.value, { Volume: Volume2, VolumeMute: VolumeX })
)

const togglePlayListQueueView = () => {
  emit("toggle-queue")
}

const toggleImmersiveMode = () => {
  emit("toggle-immersive-mode")
}

const openEqualizer = () => {
  emit("open-equalizer")
}

const toggleMiniPlayerMode = () => {
  if (isMiniPlayerActive.value) {
    exitMiniPlayer()
  } else {
    enterMiniPlayer()
  }
}

const openArtistFromPlayer = () => {
  if (!player.currentTrack?.artist_id) return

  router.push(`/artists/${player.currentTrack.artist_id}`)
}

// Adaptive PlayerBar tint sampled from the current track's cover art.
const coverTint = ref(null)
watch(
  () => player.currentTrack?.coverDataUrl,
  async (url) => {
    coverTint.value = await extractCoverColor(url)
  },
  { immediate: true }
)

const playerBarStyle = computed(() => {
  const c = coverTint.value
  return {
    "--cover-tint": c ? `${c.r}, ${c.g}, ${c.b}` : "0, 0, 0",
    "--cover-tint-opacity": c ? "0.25" : "0",
  }
})
</script>

<style scoped>
/* Player bar – includes playback controls, song info, volume */

.playerbar-wrapper {
  padding: 10px 20px 16px;
  -webkit-app-region: no-drag;
}

/* Playback progress bar */
.progress-bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 14px 10px;
}

.time-label {
  font-size: 0.7rem;
  color: var(--muted-text);
  font-variant-numeric: tabular-nums;
  min-width: 34px;
  flex-shrink: 0;
}

.time-elapsed {
  text-align: right;
}

.progress-bar {
  position: relative;
  flex: 1;
  height: 16px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.progress-track {
  position: relative;
  width: 100%;
  height: 3px;
  border-radius: 3px;
  background: var(--border-color);
  transition: height 0.15s ease;
}

.progress-bar:hover .progress-track,
.progress-bar.dragging .progress-track {
  height: 6px;
}

.progress-fill {
  position: relative;
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transition: width 0.1s linear;
  filter: drop-shadow(0 0 4px var(--accent));
}

.progress-thumb {
  position: absolute;
  top: 50%;
  right: 0;
  width: 12px;
  height: 12px;
  background: var(--accent);
  border: 2px solid white;
  border-radius: 50%;
  transform: translate(50%, -50%) scale(0);
  transition: transform 0.15s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}

.progress-bar:hover .progress-thumb,
.progress-bar.dragging .progress-thumb {
  transform: translate(50%, -50%) scale(1);
}

.hover-time {
  position: absolute;
  bottom: 110%;
  background: var(--topbar-bg);
  color: var(--text-color);
  font-size: 0.7rem;
  padding: 2px 5px;
  border-radius: 4px;
  transform: translateX(-50%);
  pointer-events: none;
  white-space: nowrap;
  z-index: 10001;
}

/* Player bar layout: floating rounded pill */
.player-bar {
  height: 76px;
  display: grid;
  grid-template-columns: 1fr auto 1fr; /* Left | Center | Right */
  align-items: center;
  gap: 1rem;
  padding: 0 1.25rem;
  border-radius: 20px;
  background-image: radial-gradient(
    120% 180% at 15% 50%,
    rgba(var(--cover-tint), var(--cover-tint-opacity, 0)),
    transparent 70%
  );
  background-color: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--border-color);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  color: var(--text-color);
  overflow: hidden;
}

/* Left section: song info */
.song-info {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
  max-width: 320px;
  overflow: hidden;
  padding-right: 1rem;
  border-right: 1px solid var(--border-color);
}

.song-info img {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 10px;
  object-fit: cover;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
}

.song-details {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.song-details p {
  margin: 0;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.3s ease;
  cursor: default;
}

/* Scrolling song title on hover */
.song-details p:hover {
  animation: scrollText 6s linear infinite;
}

@keyframes scrollText {
  0%,
  10% {
    transform: translateX(0);
  }
  90%,
  100% {
    transform: translateX(-60%);
  }
}

.song-details small {
  color: #aaa;
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Center section: playback controls */
.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.play-btn {
  transform: scale(1.15);
  transition:
    transform 0.2s ease,
    filter 0.2s ease;
}

.play-btn:hover {
  transform: scale(1.25);
  filter: drop-shadow(0 0 8px var(--accent));
}

/* Right section: utilities and volume */
.right-section {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}

.track-utils {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 1rem;
  border-right: 1px solid var(--border-color);
}

.volume {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Icon buttons */
.icon-btn {
  background: transparent;
  border: none;
  border-radius: 10px;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color);
  opacity: 0.75;
  transition:
    background-color 0.2s ease,
    transform 0.1s ease,
    opacity 0.2s ease,
    color 0.2s ease;
}

.icon-btn:hover {
  background-color: rgba(128, 128, 128, 0.15);
  transform: scale(1.05);
  opacity: 1;
}

.icon-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Active states — shuffle/repeat/like all recolor to the accent */
.toggle-shuffle.active,
.icon-btn.all,
.icon-btn.one,
.icon-btn.active,
.like-btn.is-liked {
  color: var(--accent);
  opacity: 1;
}

/* Volume slider */
.volume-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 110px;
  height: 4px;
  border-radius: 4px;
  background: linear-gradient(
    to right,
    white 0%,
    white var(--range-progress, 50%),
    #3a3a3a var(--range-progress, 50%),
    #3a3a3a 100%
  );
  outline: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s ease;
}

.artist-name {
  cursor: pointer;
  text-decoration: underline;
}

.artist-name:hover {
  opacity: 0.7;
}
</style>
