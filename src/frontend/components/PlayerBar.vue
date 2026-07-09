<template>
  <!-- === PROGRESS BAR === -->
  <div
    class="progress-bar"
    @click="seek($event)"
    @mousemove="showHoverTime($event)"
    @mouseleave="hideHoverTime"
  >
    <div
      class="progress-fill"
      :style="{ width: `${player.progress * 100}%` }"
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

  <footer class="player-bar">
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

    <!-- CENTER: Controls -->
    <div class="controls">
      <button
        @click="playPreviousTrack"
        class="icon-btn"
        :disabled="!player.hasPrevious"
        :class="{ disabled: !player.hasPrevious }"
      >
        <img class="playbar-icon-class" :src="Previous" alt="Previous" />
      </button>

      <button @click="togglePlay" class="icon-btn play-btn">
        <img
          class="playbar-icon-class play-icon"
          :src="isPlaying ? Pause : Play"
          :alt="isPlaying ? 'Pause' : 'Play'"
        />
      </button>

      <button
        @click="playNextTrack"
        class="icon-btn"
        :disabled="!player.hasNext"
        :class="{ disabled: !player.hasNext }"
      >
        <img class="playbar-icon-class" :src="Next" alt="Next" />
      </button>
    </div>

    <!-- RIGHT: Track Utils + Volume -->
    <div class="right-section">
      <div class="track-utils">
        <button
          @click="toggleMiniPlayerMode"
          class="icon-btn"
          :title="t('miniPlayer.toggle')"
        >
          <img
            :src="isMiniPlayerActive ? Fullscreen : FullscreenExit"
            class="playbar-icon-class"
            :alt="t('miniPlayer.toggle')"
          />
        </button>
        <button
          @click="togglePlayListQueueView"
          class="icon-btn"
          :title="`Show Queue`"
        >
          <img :src="Playlist" class="playbar-icon-class" alt="Playlist" />
        </button>
        <button
          @click="toggleImmersiveMode"
          class="icon-btn"
          title="Toggle Immersive Mode"
        >
          <img
            :src="DesktopLyrics"
            class="playbar-icon-class"
            alt="DesktopLyrics"
          />
        </button>
        <button
          @click="openEqualizer"
          class="icon-btn"
          :title="t('labels.equalizer')"
        >
          <img :src="Settings" class="playbar-icon-class" alt="Equalizer" />
        </button>
        <button @click="toggleLikedSong" class="icon-btn" :title="`Like Song`">
          <img
            class="playbar-icon-class"
            :src="player.currentTrack?.isLiked ? HeartSolid : Heart"
            alt="Heart icon"
          />
        </button>
        <button
          @click="player.toggleRepeat"
          class="icon-btn"
          :class="player.repeatMode"
          :title="`Repeat: ${player.repeatMode}`"
        >
          <img
            class="playbar-icon-class"
            :src="player.repeatMode === 'one' ? RepeatOne : Repeat"
            alt="Repeat icon"
          />
        </button>
        <button
          @click="player.toggleShuffle"
          class="icon-btn toggle-shuffle"
          :class="{ active: player.shuffleEnabled }"
          :title="player.shuffleEnabled ? 'Shuffle: On' : 'Shuffle: Off'"
        >
          <img class="playbar-icon-class" :src="Shuffle" alt="Shuffle icon" />
        </button>
      </div>

      <div class="volume">
        <button
          @click="toggleMute"
          class="icon-btn"
          :title="`Volume: ${volume}%`"
        >
          <img
            class="playbar-icon-class"
            :src="currentVolumeIcon"
            alt="Volume icon"
          />
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
</template>

<script setup>
import { computed } from "vue"
import { usePlayerStore } from "../store/player.js"
import { useRouter } from "vue-router"
import {
  Previous,
  Next,
  Play,
  Volume,
  VolumeMute,
  Pause,
  Heart,
  HeartSolid,
  Shuffle,
  Repeat,
  RepeatOne,
  Playlist,
  DesktopLyrics,
  Settings,
  Fullscreen,
  FullscreenExit,
} from "../assets/icons/icons"

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
  showHoverTime,
  hideHoverTime,
  seek,
} = useProgressBar(player)
const { togglePlay, playPreviousTrack, playNextTrack } =
  usePlaybackControls(player)
const { toggleLikedSong } = useTrackLike(player)

const currentVolumeIcon = computed(() =>
  getVolumeIcon(volume.value, { Volume, VolumeMute })
)

const togglePlayListQueueView = () => {
  emit("toggle-queue")
}

const toggleImmersiveMode = () => {
  console.log("Toggling immersive mode")
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
</script>

<style scoped>
/* Player bar – includes playback controls, song info, volume */

/* Player bar layout */
.player-bar {
  height: 80px;
  display: grid;
  grid-template-columns: 1fr auto 1fr; /* Left | Center | Right */
  align-items: center;
  gap: 1rem;
  padding: 0 1rem;
  background-color: var(--footer-bg);
  border-top: 2px solid var(--border-color);
  color: var(--text-color);
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

/* Left section: song info */
.song-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  max-width: 320px;
  overflow: hidden;
}

.song-info img {
  flex-shrink: 0;
  width: 55px;
  height: 55px;
  border-radius: 8px;
  object-fit: cover;
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
  gap: 8px;
}

.play-btn {
  transform: scale(1.2);
  transition:
    transform 0.2s ease,
    filter 0.2s ease;
}

.play-btn:hover {
  transform: scale(1.3);
  filter: drop-shadow(0 0 5px white);
}

/* Right section: utilities and volume */
.right-section {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.track-utils {
  display: flex;
  align-items: center;
  gap: 8px;
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
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background-color 0.2s ease,
    transform 0.1s ease;
}

.icon-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: scale(1.05);
}

.icon-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.playbar-icon-class {
  width: 18px;
  height: 18px;
  filter: invert(100%) brightness(200%);
}

.play-icon {
  width: 26px;
  height: 26px;
}

/* Volume slider */
.volume-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 120px;
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

/* Button states */
.icon-btn.active img {
  filter: brightness(1.3);
}

.icon-btn.off img {
  opacity: 0.6;
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

/* Icon theming by theme mode */
:root[data-theme="dark"] .playbar-icon-class {
  filter: invert(100%) brightness(200%);
}

:root[data-theme="light"] .playbar-icon-class {
  filter: invert(0%) brightness(0%);
}

/* Hover glow effect */
:root[data-theme="dark"] .icon-btn:hover img {
  filter: invert(100%) brightness(200%) drop-shadow(0 0 4px var(--accent-hover));
}

:root[data-theme="light"] .icon-btn:hover img {
  filter: invert(0%) brightness(0%) drop-shadow(0 0 3px var(--accent));
}

/* Playback progress bar */
.progress-bar {
  position: fixed;
  bottom: 80px; /* above player bar */
  left: 0;
  right: 0;
  height: 6px;
  background: var(--border-color);
  cursor: pointer;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.1s linear;
}

.progress-cursor-dot {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  z-index: 2;
  pointer-events: none;
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

.artist-name {
  cursor: pointer;
  text-decoration: underline;
}

.artist-name:hover {
  opacity: 0.7;
}
</style>
