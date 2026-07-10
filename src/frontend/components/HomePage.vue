<template>
  <!-- Redesigned Home.vue -->
  <div class="home-page">
    <!-- NOTE: Reuse your existing <script setup> from the current Home.vue -->
    <header class="home-header">
      <div>
        <p class="eyebrow">{{ greeting }}</p>
        <h1>{{ t("app.name") }}</h1>
        <div class="library-meta">
          <span>{{ animatedTracks }} Songs</span>

          <span>•</span>

          <span>{{ animatedArtists }} Artists</span>

          <span>•</span>

          <span>{{ stats.totalAlbums }} Albums</span>

          <span>•</span>

          <span>{{ animatedPlaylists }} Playlists</span>

          <span>•</span>

          <span>{{ formatStorage(stats.storageUsed) }}</span>

          <span>•</span>

          <span>{{ formatListeningTime(stats.totalListeningTime) }}</span>
        </div>
      </div>
    </header>
    <section v-if="folders.length === 0" class="empty-state">
      <i class="fas fa-music empty-icon"></i>
      <h2>Your library is empty</h2>
      <p>Import a folder to start building your music collection.</p>
    </section>
    <template v-else>
      <section>
        <div class="section-title">
          <h2>Your Playlists</h2>
        </div>
        <div class="playlist-grid">
          <div class="playlist-card liked" @click="router.push('/playlists/liked')">
            <div class="cover liked-cover"><i class="fas fa-heart"></i></div>
            <div>
              <h3>{{ t("liked.title") }}</h3>
            </div>
          </div>
          <div v-for="playlist in quickPlaylists" :key="playlist.id" class="playlist-card"
            @click="router.push(`/playlists/${playlist.id}`)">
            <img v-if="playlist.coverUrl" :src="playlist.coverUrl" class="cover" />
            <div v-else class="cover default-cover"><i class="fas fa-music"></i></div>
            <div>
              <h3>{{ playlist.name }}</h3>
              <p>{{ playlist.track_count || 0 }} tracks</p>
            </div>
          </div>
        </div>
      </section>
      <section v-if="topTracks.length">
        <div class="section-title">
          <h2>Most Played</h2>
        </div>
        <div class="track-list">
          <div v-for="(track, index) in topTracks" :key="track.id" class="track-row" @click="playTrack(track)">
            <span>{{ index + 1 }}</span>
            <img v-if="track.coverDataUrl" :src="track.coverDataUrl" class="track-cover" />
            <div v-else class="track-cover default-cover"><i class="fas fa-music"></i></div>
            <div class="track-info">
              <div class="title">{{ track.title }}</div>
              <div class="artist">{{ track.artist }}</div>
            </div>
            <div class="plays">{{ track.noOfPlays || 0 }}</div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import { useI18n } from "vue-i18n"
import { useRouter } from "vue-router"
import { storeToRefs } from "pinia"
import { usePlayerStore } from "../store/player.js"
import { usePlaylistsStore } from "../store/playlists.js"

const { t } = useI18n()
const router = useRouter()
const player = usePlayerStore()
const playlistsStore = usePlaylistsStore()
const { playlists } = storeToRefs(playlistsStore)

const folders = ref([])
const topTracks = ref([])
const stats = ref({
  totalTracks: 0,
  totalArtists: 0,
  totalAlbums: 0,
  storageUsed: 0,
  playlistsCount: 0,
  totalListeningTime: 0,
})

const animatedTracks = ref(0)
const animatedArtists = ref(0)
const animatedPlaylists = ref(0)

function formatListeningTime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) return `${hours}h ${minutes}m`

  return `${minutes}m`
}

function updateAnimations() {
  const duration = 1200
  const start = performance.now()

  function animate(now) {
    const progress = Math.min((now - start) / duration, 1)

    const ease = 1 - Math.pow(1 - progress, 4)

    animatedTracks.value = Math.floor(
      stats.value.totalTracks * ease
    )

    animatedArtists.value = Math.floor(
      stats.value.totalArtists * ease
    )

    animatedPlaylists.value = Math.floor(
      stats.value.playlistsCount * ease
    )

    if (progress < 1) requestAnimationFrame(animate)
  }

  requestAnimationFrame(animate)
}

async function loadLibraryStats() {
  const tracks = await window.api.getTracks()

  stats.value.totalTracks = tracks.length

  stats.value.totalAlbums =
    new Set(
      tracks
        .map(t => t.album)
        .filter(Boolean)
    ).size

  const artists = await window.api.getArtists()

  stats.value.totalArtists = artists.length

  const playlists = await window.api.getPlaylists()

  stats.value.playlistsCount =
    playlists?.length || 0

  let totalSize = 0
  let listeningTime = 0

  for (const track of tracks) {

    listeningTime +=
      (track.duration || 0) *
      (track.noOfPlays || 0)

    try {
      totalSize +=
        await window.api.getFileSize(
          track.file_path
        )
    } catch { }
  }

  stats.value.storageUsed = totalSize
  stats.value.totalListeningTime = listeningTime

  updateAnimations()
}

function formatStorage(bytes) {
  if (bytes === 0) return "0 B"

  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return (
    Math.round((bytes / Math.pow(k, i)) * 100) / 100 +
    " " +
    sizes[i]
  )
}

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return t("home.greeting.morning")
  if (hour < 18) return t("home.greeting.afternoon")
  return t("home.greeting.evening")
})

const hasTracks = computed(() => {
  return folders.value.some((folder) => (folder.trackCount || 0) > 0)
})

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

async function addFolder() {
  folders.value = await window.api.addFolder()
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

onMounted(async () => {
  await Promise.all([
    loadFolders(),
    loadTopTracks(),
    loadLibraryStats(),
    playlistsStore.loadPlaylists(),
  ])
})
</script>

<style scoped>
.home-page {
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 36px;
  background: linear-gradient(180deg, #171717, #111111);
  min-height: 100%
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start
}

.library-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;

  gap: 10px;

  margin-top: 12px;

  color: var(--muted-text);

  font-size: 15px;

  font-weight: 500;
}

.library-meta span:nth-child(even) {
  opacity: .35;
}

.eyebrow {
  color: var(--muted-text)
}

.home-header h1 {
  font-size: 40px;
  margin: .25rem 0 1rem
}

.stats {
  display: flex;
  gap: 14px
}

.stat {
  background: var(--side-nav-bg);
  padding: 14px 18px;
  border-radius: 16px
}

.stat span {
  display: block;
  font-size: 22px;
  font-weight: 700
}

.stat small {
  color: var(--muted-text)
}

.section-title {
  margin-bottom: 16px
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px
}

.playlist-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--side-nav-bg);
  padding: 14px;
  border-radius: 18px;
  transition: .2s;
  cursor: pointer
}

.playlist-card:hover {
  background: var(--hover-bg);
  transform: translateY(-3px)
}

.cover {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  object-fit: cover;
  background: var(--topbar-bg);
  display: flex;
  align-items: center;
  justify-content: center
}

.liked-cover {
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  color: #fff
}

.track-list {
  display: flex;
  flex-direction: column;
  gap: 6px
}

.track-row {
  display: grid;
  grid-template-columns: 36px 48px 1fr auto;
  gap: 16px;
  align-items: center;
  padding: 10px 14px;
  border-radius: 14px;
  transition: .2s;
  cursor: pointer
}

.track-row:hover {
  background: var(--hover-bg)
}

.track-cover {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover
}

.title {
  font-weight: 600
}

.artist {
  font-size: 13px;
  color: var(--muted-text)
}

.plays {
  color: var(--accent);
  font-weight: 600
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px;
  gap: 16px
}

.empty-icon {
  font-size: 72px;
  opacity: .4
}

.accent-btn {
  padding: 12px 18px;
  border: none;
  border-radius: 12px;
  background: var(--accent);
  color: #fff
}
</style>