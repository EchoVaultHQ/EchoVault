<template>
  <div class="home-page">
    <section class="now-playing-hero">
      <div class="hero-info">
        <p class="greeting-text">{{ greeting }}</p>
        <div class="now-playing-label">
          <span class="label-text">{{ t("home.nowPlaying") }}</span>
          <span class="eq-bars" :class="{ paused: !player.isPlaying }">
            <span></span><span></span><span></span><span></span><span></span>
          </span>
        </div>

        <div class="track-title-box">
          <h1>{{ player.currentTrack?.title || t("labels.noTrackSelected") }}</h1>
        </div>
        <p class="track-artist">
          {{ player.currentTrack?.artist || t("labels.unknownArtist") }}
        </p>

        <div class="hero-controls">
          <button class="icon-btn" :disabled="!player.hasPrevious" @click="playPreviousTrack">
            <SkipBack :size="20" fill="currentColor" />
          </button>
          <button class="play-btn" @click="togglePlay">
            <Pause v-if="player.isPlaying" :size="22" fill="currentColor" />
            <Play v-else :size="22" fill="currentColor" />
          </button>
          <button class="icon-btn" :disabled="!player.hasNext" @click="playNextTrack">
            <SkipForward :size="20" fill="currentColor" />
          </button>
          <button class="icon-btn" :class="{ active: player.currentTrack?.isLiked }" @click="toggleLikedSong">
            <Heart :size="18" :fill="player.currentTrack?.isLiked ? 'currentColor' : 'none'" />
          </button>
          <button class="icon-btn" :class="{ active: player.shuffleEnabled }" @click="player.toggleShuffle">
            <Shuffle :size="18" />
          </button>
        </div>

        <div class="hero-progress">
          <span class="time">{{ formatTime(player.currentTime) }}</span>
          <div class="progress-track" @click="seek($event)" @mousemove="showHoverTime($event)"
            @mouseleave="hideHoverTime">
            <div class="progress-fill" :style="{ width: `${player.progress * 100}%` }"></div>
          </div>
          <span class="time">{{ formatTime(player.duration) }}</span>
        </div>

        <div v-if="stats.totalTracks > 0" class="hero-stats">
          <span>{{ animatedTracks }} {{ t("labels.tracks") }}</span>
          <span>·</span>
          <span>{{ animatedArtists }} {{ t("nav.artists") }}</span>
          <span>·</span>
          <span>{{ stats.totalAlbums }} {{ t("library.albums") }}</span>
        </div>
      </div>

      <div class="hero-art" :style="artGlowStyle">
        <img v-if="player.currentTrack?.coverDataUrl" :src="player.currentTrack.coverDataUrl" alt="Album art" />
        <div v-else class="art-empty">
          <ImageIcon :size="28" />
          <!-- <p>{{ t("home.dropAlbumArt") }}</p>
          <p class="browse">{{ t("home.browseFiles") }}</p> -->
        </div>
      </div>
    </section>

    <section v-if="folders.length === 0" class="empty-state">
      <i class="fas fa-music empty-icon"></i>
      <h2>Your library is empty</h2>
      <p>Import a folder to start building your music collection.</p>
    </section>
    <template v-else>
      <div class="home-body">
        <section v-if="topTracks.length" class="most-played-section">
          <div class="section-title">
            <h2>{{ t("home.mostPlayed") }}</h2>
          </div>
          <div class="track-list">
            <div v-for="(track, index) in topTracks" :key="track.id" class="track-row" @click="playTrack(track)">
              <span class="index">{{ String(index + 1).padStart(2, "0") }}</span>
              <div class="track-info">
                <div class="title">{{ track.title }}</div>
                <div class="artist">{{ track.artist }}</div>
              </div>
              <div class="plays">{{ track.noOfPlays || 0 }}</div>
            </div>
          </div>
        </section>

        <section class="playlists-section">
          <div class="section-title">
            <h2>{{ t("home.yourPlaylists") }}</h2>
          </div>
          <div class="playlist-grid-compact">
            <div class="playlist-card liked" @click="router.push('/playlists/liked')">
              <div class="card-icon liked-icon">
                <Heart :size="16" fill="currentColor" />
              </div>
              <h3>{{ t("liked.title") }}</h3>
              <p>{{ t("home.autoPlaylist") }}</p>
            </div>
            <div v-for="playlist in quickPlaylists" :key="playlist.id" class="playlist-card"
              @click="router.push(`/playlists/${playlist.id}`)">
              <img v-if="playlist.coverUrl" :src="playlist.coverUrl" class="card-icon" />
              <div v-else class="card-icon default-icon">
                <ListMusic :size="16" />
              </div>
              <h3>{{ playlist.name }}</h3>
              <p>{{ playlist.track_count || 0 }} {{ t("labels.tracks") }}</p>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useRouter } from "vue-router"
import { storeToRefs } from "pinia"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Heart,
  Shuffle,
  ListMusic,
  Image as ImageIcon,
} from "@lucide/vue"
import { usePlayerStore } from "../store/player.js"
import { usePlaylistsStore } from "../store/playlists.js"
import { useProfileStore } from "../store/profile.js"
import { extractCoverColor } from "../utils/coverColor.js"
import {
  formatTime,
  useProgressBar,
  usePlaybackControls,
  useTrackLike,
} from "../utils/playerUtils.js"

const { t } = useI18n()
const router = useRouter()
const player = usePlayerStore()
const playlistsStore = usePlaylistsStore()
const profile = useProfileStore()
const { playlists } = storeToRefs(playlistsStore)

const greeting = computed(() => {
  const hour = new Date().getHours()
  const key =
    hour >= 5 && hour < 12
      ? "morning"
      : hour >= 12 && hour < 17
        ? "afternoon"
        : hour >= 17 && hour < 21
          ? "evening"
          : "night"
  const base = t(`home.greeting.${key}`)
  return profile.username ? `${base}, ${profile.username}` : base
})

const { seek, showHoverTime, hideHoverTime } = useProgressBar(player)
const { togglePlay, playPreviousTrack, playNextTrack } = usePlaybackControls(player)
const { toggleLikedSong } = useTrackLike(player)

const folders = ref([])
const topTracks = ref([])
const stats = ref({
  totalTracks: 0,
  totalArtists: 0,
  totalAlbums: 0,
})

const animatedTracks = ref(0)
const animatedArtists = ref(0)

function updateAnimations() {
  const duration = 1200
  const start = performance.now()

  function animate(now) {
    const progress = Math.min((now - start) / duration, 1)
    const ease = 1 - Math.pow(1 - progress, 4)

    animatedTracks.value = Math.floor(stats.value.totalTracks * ease)
    animatedArtists.value = Math.floor(stats.value.totalArtists * ease)

    if (progress < 1) requestAnimationFrame(animate)
  }

  requestAnimationFrame(animate)
}

async function loadLibraryStats() {
  const tracks = await window.api.getTracks()
  stats.value.totalTracks = tracks.length
  stats.value.totalAlbums = new Set(tracks.map((t) => t.album).filter(Boolean)).size

  const artists = await window.api.getArtists()
  stats.value.totalArtists = artists.length
}

const quickPlaylists = computed(() => playlists.value.slice(0, 8))

async function loadFolders() {
  folders.value = await window.api.getFolders()
}

async function loadTopTracks() {
  try {
    const tracks = await window.api.getTopPlayedTracks()
    topTracks.value = (tracks || []).slice(0, 5)
  } catch (error) {
    console.error("home :: failed to load top played tracks", error)
    topTracks.value = []
  }
}

function playTrack(track) {
  if (player.queueSource !== "home-top-played") {
    player.clearQueue()
    player.queue = topTracks.value.map((t) => ({ ...t }))
    player.queueSource = "home-top-played"
  }

  const index = player.queue.findIndex((t) => t.file_path === track.file_path)
  if (index !== -1) {
    player.currentIndex = index
    player.setTrack(player.queue[index], false)
  } else {
    player.setTrack(track)
  }
}

// Tint the album-art panel's glow from the current cover, same technique
// PlayerBar.vue already uses for its background tint.
const coverTint = ref(null)
watch(
  () => player.currentTrack?.coverDataUrl,
  async (url) => {
    coverTint.value = await extractCoverColor(url)
  },
  { immediate: true }
)

const artGlowStyle = computed(() => {
  const c = coverTint.value
  return { "--tint": c ? `${c.r}, ${c.g}, ${c.b}` : "124, 58, 237" }
})

onMounted(async () => {
  await Promise.all([
    loadFolders(),
    loadTopTracks(),
    loadLibraryStats(),
    playlistsStore.loadPlaylists(),
  ])
  await nextTick()
  updateAnimations()
})
</script>

<style scoped>
.home-page {
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 36px;
  background: var(--content-bg);
  min-height: 100%;
}

/* ── Now Playing hero ── */
.now-playing-hero {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 32px;
  align-items: start;
}

.greeting-text {
  font-size: 0.95rem;
  color: var(--muted-text);
  margin: 0;
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.now-playing-label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted-text);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.eq-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
}

.eq-bars span {
  width: 3px;
  background: var(--accent);
  border-radius: 1px;
  animation: eq-bounce 1s ease-in-out infinite;
}

.eq-bars span:nth-child(1) {
  animation-delay: 0s;
}

.eq-bars span:nth-child(2) {
  animation-delay: 0.15s;
}

.eq-bars span:nth-child(3) {
  animation-delay: 0.3s;
}

.eq-bars span:nth-child(4) {
  animation-delay: 0.1s;
}

.eq-bars span:nth-child(5) {
  animation-delay: 0.25s;
}

.eq-bars.paused span {
  animation-play-state: paused;
  height: 3px !important;
}

@keyframes eq-bounce {

  0%,
  100% {
    height: 3px;
  }

  50% {
    height: 12px;
  }
}

.track-title-box {
  display: inline-block;
  width: fit-content;
  max-width: 100%;
  padding: 6px 14px;
}

.track-title-box h1 {
  margin: 0;
  font-size: 48px;
  font-weight: 800;
  color: var(--text-color);
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.track-artist {
  margin: 0;
  color: var(--muted-text);
  font-size: 16px;
}

.hero-controls {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 4px;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  padding: 8px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.icon-btn:hover:not(:disabled) {
  background: var(--hover-bg);
}

.icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.icon-btn.active {
  color: var(--accent);
}

.play-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.play-btn:hover {
  background: var(--accent-hover);
}

.hero-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 480px;
}

.hero-progress .time {
  font-size: 12px;
  color: var(--muted-text);
  flex-shrink: 0;
}

.progress-track {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--border-color);
  cursor: pointer;
  position: relative;
}

.progress-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--accent);
  transition: width 0.1s linear;
}

.hero-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--muted-text);
  font-size: 14px;
  margin-top: 4px;
}

/* ── Album art panel ── */
.hero-art {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  background:
    radial-gradient(circle at 50% 42%, rgba(var(--tint), 0.35), transparent 70%),
    var(--side-nav-bg);
  border: 1px solid var(--border-color);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.art-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--muted-text);
  text-align: center;
}

.art-empty p {
  margin: 0;
  font-size: 14px;
}

.art-empty .browse {
  font-size: 12px;
  opacity: 0.75;
}

/* ── Body: Most Played + Playlists ── */
.home-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  align-items: start;
}

.section-title {
  margin-bottom: 16px;
}

.section-title h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-color);
}

.track-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.track-row {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 10px 14px;
  border-radius: 14px;
  transition: 0.2s;
  cursor: pointer;
}

.track-row:hover {
  background: var(--hover-bg);
}

.track-row .index {
  color: var(--muted-text);
  font-size: 13px;
  font-weight: 600;
}

.title {
  font-weight: 600;
  color: var(--text-color);
}

.artist {
  font-size: 13px;
  color: var(--muted-text);
}

.plays {
  color: var(--accent);
  font-weight: 600;
}

.playlist-grid-compact {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.playlist-card {
  background: var(--side-nav-bg);
  border-radius: var(--radius-lg);
  padding: 16px;
  cursor: pointer;
  transition: 0.2s;
}

.playlist-card:hover {
  background: var(--hover-bg);
  transform: translateY(-2px);
}

.playlist-card h3 {
  margin: 8px 0 2px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-color);
}

.playlist-card p {
  margin: 0;
  font-size: 13px;
  color: var(--muted-text);
}

.card-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: cover;
  background: var(--topbar-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted-text);
}

.liked-icon {
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  color: #fff;
}

/* ── Empty state ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px;
  gap: 16px;
}

.empty-icon {
  font-size: 72px;
  opacity: 0.4;
}

@media (max-width: 900px) {

  .now-playing-hero,
  .home-body {
    grid-template-columns: 1fr;
  }
}
</style>
