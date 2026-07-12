<template>
  <div class="immersive-background">
    <img v-if="player.currentTrack?.coverDataUrl" :src="player.currentTrack.coverDataUrl" alt="Blurred Background Art"
      class="background-blur-img" />
    <div class="background-overlay"></div>
  </div>

  <!-- <div class="top-left-cluster">
    <button class="icon-btn corner-btn" @click="closeImmersiveMode" title="Exit Immersive Mode">
      <ChevronDown :size="20" />
    </button>
  </div> -->

  <div class="top-right-cluster">
    <button class="icon-btn corner-btn" @click="openEqualizer" title="Equalizer">
      <SlidersHorizontal :size="18" />
    </button>
    <!-- <button
      class="icon-btn exit-btn"
      @click="closeImmersiveMode"
      title="Exit Immersive Mode"
    >
      <img :src="DesktopLyrics" class="playbar-icon-class" alt="Exit Icon" />
      <span>Exit</span>
    </button> -->
  </div>

  <div class="immersive-content">
    <div class="artwork-column">
      <div class="artwork-wrapper">
        <img v-if="player.currentTrack?.coverDataUrl" :src="player.currentTrack.coverDataUrl" alt="Album Art"
          class="artwork-img" />
        <img v-else src="../assets/images/default-cover.svg" alt="Album Art" class="artwork-img" />
      </div>

      <h1 class="track-title">
        {{ player.currentTrack?.title || t("labels.unknownTrack") }}
      </h1>
      <h2 class="track-artist">
        {{ player.currentTrack?.artist || t("labels.unknownArtist") }}
      </h2>

      <button @click="toggleLikedSong" class="icon-btn like-btn" title="Like Song">
        <img class="playbar-icon-class" :src="player.currentTrack?.isLiked ? HeartSolid : Heart" alt="Heart icon"
          :class="{ 'is-liked': player.currentTrack?.isLiked }" />
      </button>
    </div>

    <div class="lyrics-column">
      <div v-if="hasLyrics" class="lyrics-scroll-area">
        <template v-if="player.lyrics.synchronized && player.lyrics.timestamps?.length">
          <div v-for="slot in visibleWindow" :key="slot.key" class="lyric-line" :class="`dist-${slot.distance}`"
            v-memo="[slot.line?.text, slot.distance]">
            {{ slot.line?.text }}
          </div>
        </template>
        <template v-else>
          <div v-for="(line, idx) in plainLyricLines" :key="idx" class="lyric-line plain">
            {{ line }}
          </div>
        </template>
      </div>
      <div v-else class="no-lyrics">{{ t("labels.noLyricsFound") }}</div>
    </div>
  </div>

  <div class="immersive-playerbar">
    <div class="immersive-progress-container">
      <div class="progress-bar immersive-mode-progress" @click="seek($event)" @mousemove="showHoverTime($event)"
        @mouseleave="hideHoverTime">
        <div class="progress-fill" :style="{ width: `${player.progress * 100}%` }"></div>
        <div v-if="hoverTimeVisible" class="progress-cursor-dot" :style="{ left: hoverX + 'px' }"></div>
        <div v-if="hoverTimeVisible" class="hover-time" :style="{ left: hoverX + 'px' }">
          {{ formatTime(hoverTime) }}
        </div>
      </div>
      <div class="time-labels">
        <span class="current-time">{{ formatTime(player.currentTime) }}</span>
        <span class="duration">{{ formatTime(player.duration) }}</span>
      </div>
    </div>

    <footer class="player-bar immersive-controls-bar">
      <div class="track-utils">
        <button @click="emit('toggle-queue')" class="icon-btn" title="Queue">
          <ListMusic :size="18" />
        </button>
        <div class="more-wrap">
          <button @click="showMoreMenu = !showMoreMenu" class="icon-btn" :class="{ active: showMoreMenu }" title="More">
            <Ellipsis :size="18" />
          </button>
          <div v-if="showMoreMenu" class="more-menu-backdrop" @click="showMoreMenu = false"></div>
          <div v-if="showMoreMenu" class="more-menu">
            <button class="more-menu-item" @click="onLikeFromMenu">
              <img :src="player.currentTrack?.isLiked ? HeartSolid : Heart" alt="" class="playbar-icon-class" />
              <span>{{ player.currentTrack?.isLiked ? t("miniPlayer.unlike") : t("miniPlayer.like") }}</span>
            </button>
            <button class="more-menu-item" @click="closeImmersiveMode">
              <img :src="DesktopLyrics" alt="" class="playbar-icon-class" />
              <span>{{ t("miniPlayer.close") }}</span>
            </button>
          </div>
        </div>
      </div>
      <div class="controls">
        <button @click="player.toggleShuffle" class="icon-btn toggle-shuffle" :class="{ active: player.shuffleEnabled }"
          :title="player.shuffleEnabled ? 'Shuffle: On' : 'Shuffle: Off'">
          <img class="playbar-icon-class" :src="Shuffle" alt="Shuffle icon" />
        </button>
        <button @click="playPreviousTrack" class="icon-btn prev-next-btn" :disabled="!player.hasPrevious"
          :class="{ disabled: !player.hasPrevious }">
          <img class="playbar-icon-class" :src="Previous" alt="Previous" />
        </button>
        <button @click="togglePlay" class="icon-btn play-btn">
          <img class="playbar-icon-class play-icon" :src="isPlaying ? Pause : Play"
            :alt="isPlaying ? 'Pause' : 'Play'" />
        </button>
        <button @click="playNextTrack" class="icon-btn prev-next-btn" :disabled="!player.hasNext"
          :class="{ disabled: !player.hasNext }">
          <img class="playbar-icon-class" :src="Next" alt="Next" />
        </button>
        <button @click="player.toggleRepeat" class="icon-btn" :class="player.repeatMode"
          :title="`Repeat: ${player.repeatMode}`">
          <img class="playbar-icon-class" :src="player.repeatMode === 'one' ? RepeatOne : Repeat" alt="Repeat icon" />
        </button>
      </div>
      <div class="right-section">
        <div class="volume">
          <button @click="toggleMute" class="icon-btn" :title="`Volume: ${volume}%`">
            <img class="playbar-icon-class" :src="currentVolumeIcon" alt="Volume icon" />
          </button>
          <input type="range" min="0" max="100" v-model="volume" @input="onVolumeChange" class="volume-slider"
            :style="{ '--range-progress': volume + '%' }" :title="`Volume: ${volume}%`" />
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from "vue"
import { usePlayerStore } from "../store/player.js"
import { ChevronDown, SlidersHorizontal, ListMusic, Ellipsis } from "@lucide/vue"
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
  DesktopLyrics,
} from "../assets/icons/icons"
import {
  formatTime,
  useVolumeControl,
  useProgressBar,
  usePlaybackControls,
  useTrackLike,
  useLyricsSync,
  getVolumeIcon,
} from "../utils/playerUtils.js"
import { useI18n } from "vue-i18n"

const { t } = useI18n()
const emit = defineEmits(["toggle-queue", "close-immersive-mode", "open-equalizer"])
defineProps({
  isInImmersiveMode: {
    type: Boolean,
    default: false,
  },
})

const player = usePlayerStore()
const isPlaying = computed(() => player.isPlaying)

const { hasLyrics, plainLyricLines, visibleWindow } = useLyricsSync(player)

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

const closeImmersiveMode = () => emit("close-immersive-mode")
const openEqualizer = () => emit("open-equalizer")

const handleKeydown = (e) => {
  if (e.key === "Escape") closeImmersiveMode()
}
onMounted(() => window.addEventListener("keydown", handleKeydown))
onUnmounted(() => window.removeEventListener("keydown", handleKeydown))

const showMoreMenu = ref(false)
const onLikeFromMenu = () => {
  toggleLikedSong()
  showMoreMenu.value = false
}
</script>

<style scoped>
/* Player bar – includes playback controls, song info, volume */

.player-bar {
  height: 80px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  padding: 0 1rem;
  color: #e5e5e5;
  overflow: hidden;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

.play-btn {
  transform: scale(1.5);
  border: 2px solid var(--accent);
  border-radius: 50%;
  filter: drop-shadow(0 0 5px var(--accent));
  transition:
    transform 0.2s ease,
    filter 0.2s ease;
}

.play-btn:hover {
  transform: scale(1.6);
  filter: drop-shadow(0 0 8px var(--accent-hover));
}

/* More menu (queue/more cluster) */
.more-wrap {
  position: relative;
}

.more-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
}

.more-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 0.5rem;
  background: #1c1c1c;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  padding: 0.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  z-index: 1000;
  min-width: 160px;
}

.more-menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: none;
  color: #e5e5e5;
  padding: 0.45rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  white-space: nowrap;
}

.more-menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--accent);
}

.more-menu-item .playbar-icon-class {
  filter: invert(100%) brightness(200%);
  opacity: 0.85;
}

:root[data-theme="light"] .more-menu {
  background: #fff;
  border-color: rgba(0, 0, 0, 0.1);
}

:root[data-theme="light"] .more-menu-item {
  color: #1c1c1c;
}

:root[data-theme="light"] .more-menu-item .playbar-icon-class {
  filter: invert(0%) brightness(0%);
}

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
}

.play-icon {
  width: 26px;
  height: 26px;
}

.prev-next-btn {
  transform: scale(1.1);
}

/* Volume slider */
.volume-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 120px;
  height: 4px;
  border-radius: 4px;
  background: linear-gradient(to right,
      #e5e5e5 0%,
      #e5e5e5 var(--range-progress, 50%),
      #3a3a3a var(--range-progress, 50%),
      #3a3a3a 100%);
  outline: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: #e5e5e5;
  border-radius: 50%;
  cursor: pointer;
}

.icon-btn.active img {
  filter: brightness(1.3);
}

.toggle-shuffle img {
  opacity: 0.7;
  transition:
    filter 0.2s ease,
    opacity 0.2s ease;
}

.toggle-shuffle.active img {
  filter: drop-shadow(0 0 4px var(--accent-hover));
  opacity: 1;
}

.icon-btn .playbar-icon-class {
  filter: invert(100%) brightness(200%);
  opacity: 0.8;
  transition: opacity 0.2s;
}

:root[data-theme="light"] .icon-btn .playbar-icon-class {
  filter: invert(0%) brightness(0%);
}

.icon-btn:hover .playbar-icon-class {
  opacity: 1;
}

.icon-btn img.is-liked {
  filter: invert(100%) brightness(200%) drop-shadow(0 0 4px var(--accent));
}

:root[data-theme="light"] .icon-btn img.is-liked {
  filter: invert(0%) brightness(0%) drop-shadow(0 0 4px var(--accent));
}

/* Playback progress bar (relative, inside immersive-progress-container) */
.progress-bar {
  position: relative;
  height: 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.15);
  cursor: pointer;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
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
  background: #1c1c1c;
  color: #e5e5e5;
  font-size: 0.7rem;
  padding: 2px 5px;
  border-radius: 4px;
  transform: translateX(-50%);
  pointer-events: none;
  white-space: nowrap;
  z-index: 10001;
}

/* --- IMMERSIVE MODE --- */

.immersive-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  background-color: #0c0c0c;
  overflow: hidden;
}

.background-blur-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: right center;
  filter: blur(4px) brightness(75%);
  transform: scale(1.15);
}

:root[data-theme="light"] .background-blur-img {
  filter: blur(4px) brightness(95%);
}

.background-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg,
      rgba(0, 0, 0, 0.15) 0%,
      rgba(0, 0, 0, 0.35) 55%,
      rgba(0, 0, 0, 0.65) 100%),
    linear-gradient(90deg,
      rgba(0, 0, 0, 0.97) 0%,
      rgba(0, 0, 0, 0.7) 35%,
      rgba(0, 0, 0, 0.25) 70%,
      rgba(0, 0, 0, 0.05) 100%);
}

.top-left-cluster {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 1000;
}

.top-right-cluster {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 12px;
}

.corner-btn {
  background-color: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  color: #e5e5e5;
  transition: all 0.2s ease;
}

.corner-btn:hover {
  background-color: var(--accent);
  color: #fff;
}

.exit-btn {
  background-color: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  padding: 10px 15px;
  border-radius: 50px;
  color: #e5e5e5;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
}

.exit-btn:hover {
  background-color: var(--accent);
  color: #fff;
}

/* Two-column layout: artwork left, lyrics right */
.immersive-content {
  position: relative;
  z-index: 5;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 48px;
  width: 100%;
  height: 100vh;
  max-width: 1500px;
  margin: 0 auto;
  padding: 64px;
  padding-bottom: 220px;
  /* reserve space so lyrics never sit under the playerbar */
  box-sizing: border-box;
  -webkit-app-region: no-drag;
}

/* Left: album artwork */
.artwork-column {
  flex: 0 0 38%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  text-align: center;
}

.artwork-wrapper {
  width: clamp(320px, 32vw, 480px);
  height: clamp(320px, 32vw, 480px);
  animation: floatArt 6s ease-in-out infinite;
}

@keyframes floatArt {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-14px);
  }
}

.artwork-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 22px;
  box-shadow:
    0 30px 60px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(255, 255, 255, 0.08);
}

.track-title {
  font-size: clamp(1.5rem, 2.2vw, 2rem);
  font-weight: 800;
  color: #fff;
  margin: 0;
  letter-spacing: -0.5px;
}

.track-artist {
  font-size: clamp(1rem, 1.4vw, 1.2rem);
  font-weight: 500;
  color: #a0a0a0;
  margin: 0;
}

.like-btn {
  margin-top: 4px;
}

.like-btn .playbar-icon-class {
  width: 22px;
  height: 22px;
}

/* Right: live lyrics */
.lyrics-column {
  /* flex:1 + width:100% (not fit-content/auto) so this never shrinks to the
     width of its longest word; explicit min/max caps the readable measure. */
  flex: 1;
  width: 100%;
  min-width: 500px;
  max-width: 850px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.lyrics-scroll-area {
  flex: 1;
  width: 100%;
  min-width: 500px;
  max-width: 850px;
  max-height: 100%;
  padding-left: 28px;
  overflow-y: auto;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 22px;
  mask-image: linear-gradient(to bottom,
      transparent,
      black 12%,
      black 88%,
      transparent);
}

.lyrics-scroll-area::-webkit-scrollbar {
  display: none;
}

.lyric-line {
  transition:
    transform 500ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 450ms ease,
    color 450ms ease;

  will-change: transform, opacity;
  transform-origin: left center;
}

/* dist-2 / dist-3: far lines, smaller + low opacity */
.lyric-line.dist-2,
.lyric-line.dist-3 {
  font-size: 24px;
  color: #a0a0a0;
  opacity: 0.3;
}

/* dist-1: adjacent lines */
.lyric-line.dist-1 {
  font-size: 32px;
  color: #a0a0a0;
  opacity: 0.6;
}

/* dist-0: the current, focused line */
.lyric-line.dist-0 {
  position: relative;
  font-size: 64px;
  font-weight: 700;
  color: #fff;
  opacity: 1;
  transform: scale(1.03);
  transform-origin: left center;
}

.lyric-line.dist-0::before {
  content: "";
  position: absolute;
  left: -20px;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 2px;
  background: var(--accent);
}

.lyric-line.plain {
  font-size: clamp(22px, 2vw, 28px);
  font-weight: 500;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.85);
  opacity: 1;
}

.no-lyrics {
  color: rgba(255, 255, 255, 0.4);
  font-size: 1.1rem;
}

/* Bottom playback controls */
.immersive-playerbar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 900px;
  max-width: 95%;
  z-index: 20;
  padding: 0 2rem 2rem;
  -webkit-app-region: no-drag;
}

.immersive-progress-container {
  padding: 0 20px;
}

.time-labels {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: 0.8rem;
  color: #a0a0a0;
  margin-top: 5px;
}

.player-bar.immersive-controls-bar {
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(15px) brightness(80%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50px;
  height: 80px;
  margin-top: 15px;
  padding: 0 40px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
  overflow: visible;
}

:root[data-theme="light"] .player-bar.immersive-controls-bar {
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(10px) brightness(100%);
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
}

/* Tablet: shrink artwork, keep two columns */
@media (max-width: 1024px) {
  .immersive-content {
    padding: 40px;
    padding-bottom: 200px;
    gap: 32px;
  }

  .artwork-wrapper {
    width: clamp(240px, 30vw, 340px);
    height: clamp(240px, 30vw, 340px);
  }
}

/* Mobile: stack artwork above lyrics */
@media (max-width: 700px) {
  .immersive-content {
    flex-direction: column;
    justify-content: flex-start;
    padding: 32px 24px;
    padding-bottom: 220px;
    gap: 28px;
    overflow-y: auto;
  }

  .artwork-column {
    flex: none;
    max-width: 100%;
  }

  .artwork-wrapper {
    width: min(60vw, 280px);
    height: min(60vw, 280px);
  }

  .lyrics-column {
    height: auto;
    min-width: 0;
    /* 500px floor doesn't fit on phone-width viewports */
    max-width: 100%;
    justify-content: center;
  }

  .lyrics-scroll-area {
    min-width: 0;
    max-width: 100%;
    text-align: center;
  }

  .lyric-line {
    text-align: center;
  }

  .lyric-line.dist-0 {
    transform-origin: center;
  }
}
</style>
