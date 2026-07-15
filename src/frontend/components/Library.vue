<template>
  <div class="library-page">
    <!-- ===================== ALBUM DETAIL VIEW ===================== -->
    <div v-if="albumName" class="album-view">
      <div class="album-view-header">
        <button class="back-button" @click="router.push('/library')">
          <i class="fa-solid fa-arrow-left"></i>
          <span>{{ t("common.back") }}</span>
        </button>
      </div>

      <div class="album-hero">
        <div class="hero-cover">
          <img v-if="albumCover" class="hero-cover-image" :src="albumCover" />
          <div
            v-else
            class="hero-default-cover"
            :style="{ background: albumGradient(albumName) }"
          >
            {{ albumName.charAt(0).toUpperCase() }}
          </div>
        </div>
        <div class="hero-info">
          <p class="album-type">{{ t("library.albums") }}</p>
          <h1>{{ albumName }}</h1>
          <p class="album-artist">{{ albumArtist }}</p>
          <p class="album-meta">
            {{ albumTracks.length }} {{ t("playlist.tracks") }}
          </p>
          <div class="hero-actions">
            <button
              class="play-btn"
              @click="playAlbumFromStart"
              :disabled="!albumTracks.length"
            >
              <Play :size="18" fill="currentColor" />
              <span>{{ t("playlist.play") }}</span>
            </button>
            <button
              class="shuffle-btn"
              @click="shuffleAlbum"
              :disabled="!albumTracks.length"
            >
              <Shuffle :size="18" />
              <span>{{ t("playlist.shuffle") }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="album-tracks">
        <TrackList
          :tracks="albumTracks"
          :currentTrack="player.currentTrack"
          :formatDuration="formatTime"
          :playlists="playlists"
          :currentPlaylistId="null"
          @select="playAlbumTrack"
          @add-to-playlist="handleAddToPlaylist"
        />
      </div>
    </div>

    <!-- ===================== LIBRARY GRID VIEW ===================== -->
    <template v-else>
      <header class="library-header">
        <div class="header-title">
          <h1>{{ t("library.title") }}</h1>
          <span v-if="totalAlbums > 0" class="header-count">
            {{ totalAlbums }} {{ t("library.albums") }}
          </span>
        </div>

        <div class="pill-row">
          <button class="pill" @click="router.push('/songs')">
            {{ t("nav.allSongs") }} <span class="pill-count">{{ totalTracks }}</span>
          </button>
          <button class="pill" @click="router.push('/artists')">
            {{ t("nav.artists") }} <span class="pill-count">{{ totalArtists }}</span>
          </button>
          <button class="pill" @click="router.push('/playlists')">
            {{ t("nav.playlists") }} <span class="pill-count">{{ totalPlaylists }}</span>
          </button>
          <button class="pill" @click="router.push('/media')">
            {{ t("nav.media") }} <span class="pill-count">{{ totalFolders }}</span>
          </button>
        </div>
      </header>

      <section v-if="totalTracks === 0" class="empty-state">
        <i class="fas fa-music empty-icon"></i>
        <h2>{{ t("library.emptyTitle") }}</h2>
        <p>{{ t("library.emptyText") }}</p>
        <button class="accent-btn" @click="router.push('/media')">
          {{ t("library.addFolderCta") }}
        </button>
      </section>

      <div v-else class="library-body">
        <section class="albums-section">
          <div class="section-title">
            <h2>{{ t("library.albums") }}</h2>
            <div class="sort-toggle">
              <button
                :class="{ active: albumSort === 'recent' }"
                @click="albumSort = 'recent'"
              >
                {{ t("library.sortRecent") }}
              </button>
              <button
                :class="{ active: albumSort === 'az' }"
                @click="albumSort = 'az'"
              >
                {{ t("library.sortAZ") }}
              </button>
              <button
                :class="{ active: albumSort === 'artist' }"
                @click="albumSort = 'artist'"
              >
                {{ t("library.sortArtist") }}
              </button>
            </div>
          </div>

          <div class="albums-grid">
            <div
              v-for="album in sortedAlbums"
              :key="album.name"
              class="album-card"
              @click="router.push(`/library/album/${encodeURIComponent(album.name)}`)"
            >
              <div class="album-cover">
                <img v-if="album.coverDataUrl" :src="album.coverDataUrl" />
                <div
                  v-else
                  class="album-cover-fallback"
                  :style="{ background: albumGradient(album.name) }"
                >
                  {{ album.name.charAt(0).toUpperCase() }}
                </div>
              </div>
              <div class="album-title">{{ album.name }}</div>
              <div class="album-artist">{{ album.artist }}</div>
            </div>
          </div>
        </section>

        <aside class="library-sidebar">
          <div class="sidebar-panel">
            <h3>{{ t("library.recentlyPlayed") }}</h3>
            <div
              v-for="track in recentlyPlayed"
              :key="track.id"
              class="sidebar-row"
              @click="playRecentlyPlayed(track)"
            >
              <img v-if="track.coverDataUrl" :src="track.coverDataUrl" class="sidebar-thumb" />
              <div v-else class="sidebar-thumb default-cover">
                <i class="fas fa-music"></i>
              </div>
              <div class="sidebar-row-info">
                <div class="sidebar-row-title">{{ track.title }}</div>
                <div class="sidebar-row-sub">
                  {{ track.artist || t("labels.unknownArtist") }}
                </div>
              </div>
              <div class="sidebar-row-time">{{ formatRelativeTime(track.last_played_at) }}</div>
            </div>
            <p v-if="!recentlyPlayed.length" class="empty-hint">
              {{ t("labels.noTrackSelected") }}
            </p>
          </div>

          <div class="sidebar-panel">
            <h3>{{ t("nav.playlists") }}</h3>
            <div
              v-for="playlist in playlists"
              :key="playlist.id"
              class="sidebar-row"
              @click="router.push(`/playlists/${playlist.id}`)"
            >
              <img v-if="playlist.coverUrl" :src="playlist.coverUrl" class="sidebar-thumb" />
              <div v-else class="sidebar-thumb default-cover">
                <i class="fas fa-music"></i>
              </div>
              <div class="sidebar-row-info">
                <div class="sidebar-row-title">{{ playlist.name }}</div>
                <div class="sidebar-row-sub">
                  {{ playlist.track_count }} {{ t("labels.tracks") }}
                </div>
              </div>
            </div>

            <button class="new-playlist-row" @click="showCreateDialog = true">
              <span class="new-playlist-icon"><i class="fa-solid fa-plus"></i></span>
              <span>{{ t("library.newPlaylist") }}</span>
            </button>
          </div>
        </aside>
      </div>
    </template>

    <!-- Create Playlist Dialog -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click.self="cancelCreate">
      <div class="dialog">
        <h2>{{ t("playlist.createNew") }}</h2>
        <input
          ref="nameInput"
          v-model="newPlaylistName"
          type="text"
          :placeholder="t('playlist.namePlaceholder')"
          @keyup.enter="createPlaylist"
          @keyup.esc="cancelCreate"
        />
        <div class="dialog-actions">
          <button class="btn-secondary" @click="cancelCreate">
            {{ t("common.cancel") }}
          </button>
          <button
            class="btn-primary"
            @click="createPlaylist"
            :disabled="!newPlaylistName.trim()"
          >
            {{ t("common.create") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue"
import { useI18n } from "vue-i18n"
import { useRoute, useRouter } from "vue-router"
import { storeToRefs } from "pinia"
import { Play, Shuffle } from "@lucide/vue"
import { usePlayerStore } from "../store/player.js"
import { usePlaylistsStore } from "../store/playlists.js"
import { attachCoverUrl } from "../utils/trackFormat.js"
import { formatTime } from "../utils/playerUtils.js"
import TrackList from "./TrackList.vue"

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const player = usePlayerStore()
const playlistsStore = usePlaylistsStore()
const { playlists } = storeToRefs(playlistsStore)

const totalTracks = ref(0)
const totalArtists = ref(0)
const totalAlbums = ref(0)
const totalPlaylists = ref(0)
const totalFolders = ref(0)
const allTracks = ref([])
const recentlyPlayed = ref([])
const albumSort = ref("recent")
const showCreateDialog = ref(false)
const newPlaylistName = ref("")
const nameInput = ref(null)

const albumName = computed(() => {
  const raw = route.params.name
  return raw ? decodeURIComponent(raw) : null
})

async function loadCounts() {
  const [tracks, artists, plist, folders] = await Promise.all([
    window.api.getTracks(),
    window.api.getArtists(),
    window.api.getPlaylists(),
    window.api.getFolders(),
  ])

  allTracks.value = tracks.map(attachCoverUrl)
  totalTracks.value = tracks.length
  totalArtists.value = artists.length
  totalAlbums.value = new Set(tracks.map((t) => t.album).filter(Boolean)).size
  totalPlaylists.value = plist?.length || 0
  totalFolders.value = folders.length
}

async function loadRecentlyPlayed() {
  const tracks = await window.api.getRecentlyPlayed()
  recentlyPlayed.value = tracks.map(attachCoverUrl)
}

// --- Albums grid derived client-side (no getAlbums API) ---
const albums = computed(() => {
  const byName = new Map()
  for (const track of allTracks.value) {
    if (!track.album) continue
    if (!byName.has(track.album)) {
      byName.set(track.album, {
        name: track.album,
        artist: track.artist || t("labels.unknownArtist"),
        coverDataUrl: track.coverDataUrl,
        latestId: track.id,
      })
    } else {
      const entry = byName.get(track.album)
      if (!entry.coverDataUrl && track.coverDataUrl) entry.coverDataUrl = track.coverDataUrl
      if (track.id > entry.latestId) entry.latestId = track.id
    }
  }
  return Array.from(byName.values())
})

const sortedAlbums = computed(() => {
  const list = [...albums.value]
  if (albumSort.value === "az") {
    list.sort((a, b) => a.name.localeCompare(b.name))
  } else if (albumSort.value === "artist") {
    list.sort((a, b) => a.artist.localeCompare(b.artist))
  } else {
    list.sort((a, b) => b.latestId - a.latestId)
  }
  return list
})

function albumGradient(seed) {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  const hue1 = Math.abs(hash) % 360
  const hue2 = (hue1 + 40) % 360
  return `linear-gradient(135deg, hsl(${hue1}, 65%, 55%), hsl(${hue2}, 60%, 40%))`
}

function formatRelativeTime(sqliteDatetime) {
  if (!sqliteDatetime) return ""
  const then = new Date(sqliteDatetime.replace(" ", "T") + "Z").getTime()
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (diffSec < 60) return t("labels.justNow") || "just now"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  return `${diffDay}d ago`
}

function playRecentlyPlayed(track) {
  if (player.queueSource !== "library-recently-played") {
    player.clearQueue()
    player.queue = recentlyPlayed.value.map((t) => ({ ...t }))
    player.queueSource = "library-recently-played"
  }
  const index = player.queue.findIndex((t) => t.file_path === track.file_path)
  if (index !== -1) {
    player.currentIndex = index
    player.setTrack(player.queue[index], false)
  } else {
    player.setTrack(track)
  }
}

// --- Album detail view ---
const albumTracks = computed(() =>
  allTracks.value.filter((t) => t.album === albumName.value)
)
const albumArtist = computed(() => albumTracks.value[0]?.artist || "")
const albumCover = computed(
  () => albumTracks.value.find((t) => t.coverDataUrl)?.coverDataUrl || null
)

function playAlbumTrack(track) {
  const queueSource = `library-album-${albumName.value}`
  if (player.queueSource !== queueSource) {
    player.clearQueue()
    player.queue = albumTracks.value.map((t) => ({ ...t }))
    player.queueSource = queueSource
  }
  const index = player.queue.findIndex((t) => t.file_path === track.file_path)
  if (index !== -1) {
    player.currentIndex = index
    player.setTrack(player.queue[index], false)
  } else {
    player.setTrack(track)
  }
}

function playAlbumFromStart() {
  if (albumTracks.value.length) playAlbumTrack(albumTracks.value[0])
}

function shuffleAlbum() {
  if (!albumTracks.value.length) return
  if (!player.shuffleEnabled) player.toggleShuffle()
  const randomIndex = Math.floor(Math.random() * albumTracks.value.length)
  playAlbumTrack(albumTracks.value[randomIndex])
}

async function handleAddToPlaylist({ track, playlistId }) {
  await window.api.addTrackToPlaylist(playlistId, track.id)
  await playlistsStore.loadPlaylists(true)
}

// --- New playlist dialog ---
async function createPlaylist() {
  if (!newPlaylistName.value.trim()) return
  try {
    await playlistsStore.createPlaylist(newPlaylistName.value.trim())
    newPlaylistName.value = ""
    showCreateDialog.value = false
  } catch (error) {
    console.error("Error creating playlist:", error)
  }
}

function cancelCreate() {
  showCreateDialog.value = false
  newPlaylistName.value = ""
}

watch(showCreateDialog, async (open) => {
  if (open) {
    await nextTick()
    nameInput.value?.focus()
  }
})

onMounted(async () => {
  await Promise.all([loadCounts(), loadRecentlyPlayed()])
  await playlistsStore.loadPlaylists()
})
</script>

<style scoped>
.library-page {
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  background: var(--content-bg);
  min-height: 100%;
}

/* Header */
.library-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.header-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.header-title h1 {
  font-size: 40px;
  margin: 0;
  color: var(--text-color);
}

.header-count {
  color: var(--muted-text);
  font-size: 15px;
  font-weight: 500;
}

/* Pill row */
.pill-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: var(--radius-full);
  background: var(--side-nav-bg);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pill:hover {
  background: var(--hover-bg);
  border-color: var(--accent);
}

.pill-count {
  color: var(--muted-text);
  font-weight: 500;
}

/* Body layout: albums grid + right sidebar */
.library-body {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 28px;
  align-items: start;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-title h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-color);
  margin: 0;
}

.sort-toggle {
  display: flex;
  gap: 4px;
}

.sort-toggle button {
  background: transparent;
  border: none;
  color: var(--muted-text);
  font-size: 13px;
  font-weight: 600;
  padding: 4px 10px;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.sort-toggle button:hover {
  color: var(--text-color);
}

.sort-toggle button.active {
  color: var(--accent);
}

.albums-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 20px;
}

.album-card {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.album-card:hover {
  transform: translateY(-4px);
}

.album-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 10px;
  background: var(--topbar-bg);
}

.album-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.album-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 12px;
  font-size: 32px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.55);
}

.album-title {
  font-weight: 600;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.album-artist {
  font-size: 13px;
  color: var(--muted-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Right sidebar */
.library-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sidebar-panel {
  background: var(--side-nav-bg);
  border-radius: var(--radius-lg);
  padding: 18px;
}

.sidebar-panel h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-color);
  margin: 0 0 12px;
}

.sidebar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  margin: 0 -10px;
  cursor: pointer;
  border-radius: var(--radius-md);
}

.sidebar-row:hover {
  background: var(--hover-bg);
}

.sidebar-thumb {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.sidebar-thumb.default-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--topbar-bg);
  color: var(--muted-text);
}

.sidebar-row-info {
  flex: 1;
  min-width: 0;
}

.sidebar-row-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-row-sub {
  font-size: 12px;
  color: var(--muted-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-row-time {
  font-size: 12px;
  color: var(--muted-text);
  flex-shrink: 0;
}

.empty-hint {
  color: var(--muted-text);
  font-size: 13px;
  margin: 0;
}

.new-playlist-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 0;
  margin-top: 4px;
  background: transparent;
  border: none;
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}

.new-playlist-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px dashed var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Empty state */
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

.accent-btn {
  padding: 12px 18px;
  border: none;
  border-radius: 12px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
}

.accent-btn:hover {
  background: var(--accent-hover);
}

/* Album detail view */
.album-view-header {
  margin: -1rem -1rem 20px -1rem;
  padding: 1rem 1rem 1rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: -1rem;
  z-index: 5;
  background: var(--content-bg);
}

.back-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-color);
  font-size: 0.95rem;
  cursor: pointer;
}

.back-button:hover {
  background: var(--hover-bg);
  border-color: var(--accent);
}

.album-hero {
  display: flex;
  align-items: flex-end;
  gap: 2rem;
  padding: 1.5rem 0 2rem;
}

.hero-cover {
  width: 200px;
  height: 200px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  flex-shrink: 0;
}

.hero-cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-default-cover {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  padding: 16px;
  font-size: 56px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.55);
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 1rem;
}

.album-type {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted-text);
  margin: 0;
}

.hero-info h1 {
  font-size: 3rem;
  font-weight: 800;
  color: var(--text-color);
  margin: 0;
  line-height: 1.1;
}

.album-meta {
  font-size: 0.95rem;
  color: var(--muted-text);
  margin: 0;
}

.hero-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.hero-actions .play-btn,
.hero-actions .shuffle-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
}

.hero-actions .play-btn {
  background: var(--accent);
  color: #fff;
  border: none;
}

.hero-actions .play-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.hero-actions .shuffle-btn {
  background: var(--hover-bg);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.hero-actions button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--side-nav-bg);
  border-radius: var(--radius-lg);
  padding: 2rem;
  width: 90%;
  max-width: 400px;
  border: 1px solid var(--border-color);
}

.dialog h2 {
  margin: 0 0 1.5rem;
  font-size: 1.5rem;
  color: var(--text-color);
}

.dialog input {
  width: 100%;
  padding: 0.75rem;
  background: var(--topbar-bg);
  border: 2px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-color);
  font-size: 1rem;
  outline: none;
}

.dialog input:focus {
  border-color: var(--accent);
}

.dialog-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
  justify-content: flex-end;
}

.btn-secondary,
.btn-primary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-secondary {
  background: var(--topbar-bg);
  color: var(--text-color);
}

.btn-secondary:hover {
  background: var(--border-color);
}

.btn-primary {
  background: var(--accent);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .library-body {
    grid-template-columns: 1fr;
  }
}
</style>
