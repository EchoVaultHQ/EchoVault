<template>
  <div class="stats-container">
    <h1 class="stats-title">{{ t("stats.title") }}</h1>

    <div class="stats-grid">
      <!-- Total Tracks -->
      <div class="stat-card" :style="{ animationDelay: '0s' }">
        <div class="stat-icon">
          <i class="fas fa-bullseye"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ animatedTracks }}</div>
          <div class="stat-label">{{ t("stats.totalTracks") }}</div>
        </div>
        <div class="stat-sparkle"></div>
      </div>

      <!-- Total Artists -->
      <div class="stat-card" :style="{ animationDelay: '0.1s' }">
        <div class="stat-icon">
          <i class="fa-solid fa-user"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ animatedArtists }}</div>
          <div class="stat-label">{{ t("stats.artists") }}</div>
        </div>
        <div class="stat-sparkle"></div>
      </div>

      <!-- Liked Songs -->
      <div class="stat-card" :style="{ animationDelay: '0.2s' }">
        <div class="stat-icon">
          <i class="fa-solid fa-heart"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ animatedLiked }}</div>
          <div class="stat-label">{{ t("stats.likedSongs") }}</div>
        </div>
        <div class="stat-sparkle"></div>
      </div>

      <!-- Storage Used -->
      <div class="stat-card" :style="{ animationDelay: '0.3s' }">
        <div class="stat-icon">
          <i class="fas fa-cube"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatStorage(stats.storageUsed) }}</div>
          <div class="stat-label">{{ t("stats.storageUsed") }}</div>
        </div>
        <div class="stat-sparkle"></div>
      </div>

      <!-- Total Folders -->
      <div class="stat-card" :style="{ animationDelay: '0.4s' }">
        <div class="stat-icon">
          <i class="fas fa-folder"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ animatedFolders }}</div>
          <div class="stat-label">{{ t("stats.folders") }}</div>
        </div>
        <div class="stat-sparkle"></div>
      </div>

      <!-- Total Duration -->
      <div class="stat-card" :style="{ animationDelay: '0.5s' }">
        <div class="stat-icon">
          <i class="fas fa-clock"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">
            {{ formatDuration(stats.totalDuration) }}
          </div>
          <div class="stat-label">{{ t("stats.totalDuration") }}</div>
        </div>
        <div class="stat-sparkle"></div>
      </div>

      <!-- Total Listening Time -->
      <div class="stat-card" :style="{ animationDelay: '0.6s' }">
        <div class="stat-icon">
          <i class="fas fa-headphones"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">
            {{ formatListeningTime(animatedListeningTime) }}
          </div>
          <div class="stat-label">{{ t("stats.listeningTime") }}</div>
        </div>
        <div class="stat-sparkle"></div>
      </div>
    </div>

    <!-- Additional Info Section -->
    <div class="info-section">
      <h2 class="section-title">{{ t("stats.top.title") }}</h2>

      <div class="info-grid">
        <!-- Most Liked Artist -->
        <div class="info-card" v-if="stats.topArtist">
          <div class="info-header">
            <i class="fas fa-star info-icon"></i>
            <span class="info-title">{{ t("stats.top.mostLikedArtist") }}</span>
          </div>
          <div class="info-value">{{ stats.topArtist.name }}</div>
          <div class="info-sub">
            {{ stats.topArtist.likedCount }} , {{ t("stats.top.likedCount") }}
          </div>
        </div>

        <!-- Average Song Duration -->
        <div class="info-card">
          <div class="info-header">
            <i class="fas fa-clock info-icon"></i>
            <span class="info-title">{{
              t("stats.top.avgDurationTitle")
            }}</span>
          </div>
          <div class="info-value">{{ formatTime(stats.avgDuration) }}</div>
          <div class="info-sub">{{ t("labels.perTrack") }}</div>
        </div>

        <!-- Library Growth -->
        <div class="info-card">
          <div class="info-header">
            <i class="fas fa-chart-line info-icon"></i>
            <span class="info-title">{{ t("stats.top.collectionSize") }}</span>
          </div>
          <div class="info-value">{{ stats.totalAlbums }}</div>
          <div class="info-sub">{{ t("labels.uniqueAlbums") }}</div>
        </div>

        <!-- Total Plays -->
        <div class="info-card">
          <div class="info-header">
            <i class="fas fa-headphones info-icon"></i>
            <span class="info-title">{{ t("stats.top.totalPlays") }}</span>
          </div>
          <div class="info-value">
            {{ (stats.totalPlays || 0).toLocaleString() }}
          </div>
          <div class="info-sub">all time</div>
        </div>

        <!-- Playlist info -->
        <div class="info-card" v-if="stats.playlistsCount !== undefined">
          <div class="info-header">
            <i class="fas fa-list info-icon"></i>
            <span class="info-title">{{ t("stats.top.playlists") }}</span>
          </div>
          <div class="info-value">{{ stats.playlistsCount }}</div>
          <div class="info-sub">
            <template v-if="stats.topPlaylist">
              Top Playlist : {{ stats.topPlaylist.name }} —
              {{ stats.topPlaylist.track_count }} {{ t("labels.tracks") }}
            </template>
            <template v-else>
              {{ t("labels.noPlaylists") }}
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Folder Management -->
    <div class="folder-management-section">
      <div class="section-header">
        <h2 class="section-title">{{ t("library.folderManagement") }}</h2>
        <div class="folder-header-actions">
          <button class="accent-btn" @click="addFolder">
            <i class="fas fa-folder-plus btn-icon"></i>
            {{ t("home.import.addFolder") }}
          </button>
          <div class="view-controls" v-if="folders.length > 0">
            <button
              :class="['view-btn', { active: viewMode === 'grid' }]"
              @click="viewMode = 'grid'"
              title="Grid view"
            >
              <i class="fas fa-th"></i>
            </button>
            <button
              :class="['view-btn', { active: viewMode === 'list' }]"
              @click="viewMode = 'list'"
              title="List view"
            >
              <i class="fas fa-list"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Grid View -->
      <div
        v-if="viewMode === 'grid' && folders.length > 0"
        class="folder-grid"
      >
        <div
          v-for="folder in paginatedFolders"
          :key="folder.id"
          class="folder-card"
        >
          <div class="folder-card-icon"><i class="fas fa-folder"></i></div>
          <div class="folder-card-content">
            <div class="folder-card-path" :title="folder.path">
              {{ getFolderName(folder.path) }}
            </div>
            <div class="folder-card-full-path">{{ folder.path }}</div>
            <div class="folder-card-tracks">
              {{ folder.trackCount || 0 }} tracks
            </div>
          </div>
          <button
            class="folder-card-remove"
            @click="removeFolder(folder.path)"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- List View -->
      <table
        v-if="viewMode === 'list' && folders.length > 0"
        class="folder-table"
      >
        <thead>
          <tr>
            <th>{{ t("table.folderPath") }}</th>
            <th style="width: 120px; text-align: center">Tracks</th>
            <th style="width: 50px"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="folder in paginatedFolders"
            :key="folder.id"
            class="folder-row"
          >
            <td>
              <div class="folder-info">
                <span class="folder-icon"><i class="fas fa-folder"></i></span>
                <div>
                  <div class="folder-path">{{ folder.path }}</div>
                  <div class="folder-name">
                    {{ getFolderName(folder.path) }}
                  </div>
                </div>
              </div>
            </td>
            <td style="text-align: center">
              <span class="track-badge">{{ folder.trackCount || 0 }}</span>
            </td>
            <td class="remove-cell">
              <button
                class="icon-btn"
                @click="removeFolder(folder.path)"
                title="Remove folder"
              >
                <i class="fas fa-minus"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <div v-if="folders.length === 0" class="folder-empty-state">
        <div class="empty-icon"><i class="fas fa-music"></i></div>
        <div class="empty-text">{{ t("home.emptyCollection") }}</div>
        <div class="empty-subtext">Add a folder to get started</div>
      </div>

      <!-- Pagination -->
      <div v-if="totalFolderPages > 1" class="pagination">
        <button
          class="page-btn"
          @click="currentPage--"
          :disabled="currentPage === 1"
        >
          <i class="fas fa-chevron-left"></i>
        </button>
        <span class="page-info">
          Page {{ currentPage }} of {{ totalFolderPages }}
        </span>
        <button
          class="page-btn"
          @click="currentPage++"
          :disabled="currentPage === totalFolderPages"
        >
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>

      <div class="rescan-section" v-if="folders.length > 0">
        <button
          class="rescan-btn"
          @click="rescanLibrary"
          :disabled="isRescanning"
        >
          <span v-if="!isRescanning"
            ><i class="fas fa-sync-alt"></i> {{ t("home.rescan") }}</span
          >
          <span v-else class="scanning">
            <span class="spinner"></span> Scanning...
          </span>
        </button>
      </div>
    </div>

    <!-- Most Played Songs -->
    <div class="top-lists-section">
      <div class="top-list">
        <h2 class="section-title">
          <i class="fas fa-fire title-icon"></i>
          {{ t("stats.top.topTracksTitle") }}
        </h2>
        <div class="top-list-container">
          <div v-if="stats.topTracks.length === 0" class="empty-state">
            <p>
              {{ t("stats.top.noPlaysTracks") }}
            </p>
          </div>
          <div
            v-else
            v-for="(track, index) in stats.topTracks"
            :key="track.id"
            class="top-list-item"
            :style="{ animationDelay: `${index * 0.05}s` }"
          >
            <div class="rank">{{ index + 1 }}</div>
            <img
              v-if="track.coverDataUrl"
              :src="track.coverDataUrl"
              alt="Cover"
              class="track-cover"
            />
            <div v-else class="track-cover-placeholder">
              <i class="fas fa-bullseye"></i>
            </div>
            <div class="track-info">
              <div class="track-name">{{ track.title }}</div>
              <div class="track-artist">
                {{ track.artist || "Unknown Artist" }}
              </div>
            </div>
            <div class="play-count">
              <i class="fas fa-play"></i>
              {{ (track.noOfPlays || 0).toLocaleString() }} plays
            </div>
          </div>
        </div>
      </div>

      <!-- Most Played Artists -->
      <div class="top-list">
        <h2 class="section-title">
          <i class="fas fa-crown title-icon"></i>
          {{ t("stats.top.topArtistsTitle") }}
        </h2>
        <div class="top-list-container">
          <div v-if="stats.topArtists.length === 0" class="empty-state">
            <p>
              {{ t("stats.top.noPlaysArtists") }}
            </p>
          </div>
          <div
            v-else
            v-for="(artist, index) in stats.topArtists"
            :key="artist.artist"
            class="top-list-item"
            :style="{ animationDelay: `${index * 0.05}s` }"
          >
            <div class="rank">{{ index + 1 }}</div>
            <img
              v-if="artist.coverDataUrl"
              :src="artist.coverDataUrl"
              alt="Artist"
              class="artist-cover"
            />
            <div v-else class="artist-avatar">
              {{ artist.artist.charAt(0).toUpperCase() }}
            </div>
            <div class="track-info">
              <div class="track-name">{{ artist.artist }}</div>
              <div class="track-artist">
                {{ artist.trackCount }} tracks in library
              </div>
            </div>
            <div class="play-count">
              <i class="fas fa-play"></i>
              {{ (artist.totalPlays || 0).toLocaleString() }} plays
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Refresh Button -->
    <button class="refresh-btn" @click="loadStats" :disabled="loading">
      <i class="fas fa-sync" :class="{ 'fa-spin': loading }"></i>
      {{ loading ? t("buttons.loading") : t("buttons.refreshStats") }}
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue"
import { useI18n } from "vue-i18n"

const { t } = useI18n()
const stats = ref({
  totalTracks: 0,
  totalArtists: 0,
  likedSongs: 0,
  storageUsed: 0,
  totalFolders: 0,
  totalDuration: 0,
  avgDuration: 0,
  totalAlbums: 0,
  topArtist: null,
  totalPlays: 0,
  topTracks: [],
  topArtists: [],
  totalListeningTime: 0,
  playlistsCount: 0,
  topPlaylist: null,
})

const loading = ref(true)
const folders = ref([])
const viewMode = ref("grid")
const currentPage = ref(1)
const itemsPerPage = ref(12)
const isRescanning = ref(false)
const animatedTracks = ref(0)
const animatedArtists = ref(0)
const animatedLiked = ref(0)
const animatedFolders = ref(0)
const animatedListeningTime = ref(0)
const animatedPlaylists = ref(0)

// Animate numbers
function animateValue(target, duration = 1500) {
  const start = 0
  const startTime = Date.now()

  return new Promise((resolve) => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const current = Math.floor(start + (target - start) * easeOutQuart)

      return current
    }, 16)

    setTimeout(() => {
      clearInterval(timer)
      resolve(target)
    }, duration)
  })
}

// Computed animated values
const updateAnimations = () => {
  const duration = 1500
  const startTime = Date.now()

  const animate = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easeOutQuart = 1 - Math.pow(1 - progress, 4)

    animatedTracks.value = Math.floor(stats.value.totalTracks * easeOutQuart)
    animatedArtists.value = Math.floor(stats.value.totalArtists * easeOutQuart)
    animatedLiked.value = Math.floor(stats.value.likedSongs * easeOutQuart)
    animatedFolders.value = Math.floor(stats.value.totalFolders * easeOutQuart)
    animatedListeningTime.value = Math.floor(
      stats.value.totalListeningTime * easeOutQuart
    )
    animatedPlaylists.value = Math.floor(
      (stats.value.playlistsCount || 0) * easeOutQuart
    )

    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }

  animate()
}

async function loadStats() {
  loading.value = true

  try {
    // Get total tracks
    const tracks = await window.api.getTracks()
    stats.value.totalTracks = tracks.length

    // Get liked songs
    const likedTracks = await window.api.getLikedTracks()
    stats.value.likedSongs = likedTracks.length

    // Get artists
    const artists = await window.api.getArtists()
    stats.value.totalArtists = artists.length

    // Get folders
    const allFolders = await window.api.getFolders()
    stats.value.totalFolders = allFolders.length

    // Get playlists and populate playlist-related stats
    try {
      const playlists = await window.api.getPlaylists()
      stats.value.playlistsCount = playlists ? playlists.length : 0

      // choose top playlist to show (by track_count or created_at — here by track_count desc)
      if (playlists && playlists.length > 0) {
        const sorted = [...playlists].sort(
          (a, b) => (b.track_count || 0) - (a.track_count || 0)
        )
        stats.value.topPlaylist = {
          id: sorted[0].id,
          name: sorted[0].name,
          track_count: sorted[0].track_count || 0,
          cover: sorted[0].cover || null,
        }
      } else {
        stats.value.topPlaylist = null
      }
    } catch (e) {
      console.warn("Could not get playlists:", e)
      stats.value.playlistsCount = 0
      stats.value.topPlaylist = null
    }

    // Calculate storage and duration
    let totalSize = 0
    let totalDuration = 0

    for (const track of tracks) {
      try {
        const size = await window.api.getFileSize(track.file_path)
        totalSize += size
      } catch (e) {
        console.warn("Could not get size for:", track.file_path)
      }
      totalDuration += track.duration || 0
    }

    stats.value.storageUsed = totalSize
    stats.value.totalDuration = totalDuration
    stats.value.avgDuration =
      tracks.length > 0 ? totalDuration / tracks.length : 0

    // Get unique albums
    const albums = new Set(tracks.map((t) => t.album).filter(Boolean))
    stats.value.totalAlbums = albums.size

    // Find most liked artist
    const artistLikes = {}
    likedTracks.forEach((track) => {
      const artist = track.artist || "Unknown"
      artistLikes[artist] = (artistLikes[artist] || 0) + 1
    })

    const topArtistEntry = Object.entries(artistLikes).sort(
      (a, b) => b[1] - a[1]
    )[0]
    if (topArtistEntry) {
      stats.value.topArtist = {
        name: topArtistEntry[0],
        likedCount: topArtistEntry[1],
      }
    }

    // total listening time
    let listeningTime = 0

    for (const track of tracks) {
      const plays = track.noOfPlays || 0
      const duration = track.duration || 0
      listeningTime += duration * plays
    }

    stats.value.totalListeningTime = listeningTime

    // Get top 10 most played tracks
    try {
      const topTracks = await window.api.getTopPlayedTracks()
      stats.value.topTracks = topTracks || []
    } catch (e) {
      console.warn("Could not get top tracks:", e)
      stats.value.topTracks = []
    }

    // Get artists (for covers)
    const allArtists = await window.api.getArtists()

    // Get top 10 most played artists
    try {
      const topArtists = await window.api.getTopPlayedArtists()

      // Add cover URLs for artists by matching with full artists list
      const artistsWithCovers = (topArtists || []).map((topArtist) => {
        // Find matching artist from full list
        const artistData = allArtists.find((a) => a.name === topArtist.artist)

        if (artistData?.cover) {
          const url = artistData.cover.startsWith("/")
            ? `echovault://${artistData.cover}`
            : `echovault:///${artistData.cover}`
          return {
            ...topArtist,
            coverDataUrl: url,
          }
        }

        return { ...topArtist, coverDataUrl: null }
      })

      stats.value.topArtists = artistsWithCovers
    } catch (e) {
      console.warn("Could not get top artists:", e)
      stats.value.topArtists = []
    }

    // Get total plays
    try {
      const totalPlaysResult = await window.api.getTotalPlays()
      stats.value.totalPlays = totalPlaysResult?.totalPlays || 0
    } catch (e) {
      console.warn("Could not get total plays:", e)
      stats.value.totalPlays = 0
    }

    // Animate the numbers
    updateAnimations()
  } catch (error) {
    console.error("Error loading stats:", error)
  } finally {
    loading.value = false
  }
}

function formatListeningTime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatStorage(bytes) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

const totalFolderPages = computed(() => {
  return Math.ceil(folders.value.length / itemsPerPage.value)
})

const paginatedFolders = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return folders.value.slice(start, end)
})

function getFolderName(path) {
  return path.split(/[/\\]/).pop() || path
}

async function loadFolders() {
  folders.value = await window.api.getFolders()
}

async function addFolder() {
  folders.value = await window.api.addFolder()
  currentPage.value = 1
  await loadStats()
}

async function removeFolder(path) {
  folders.value = await window.api.removeFolder(path)
  if (paginatedFolders.value.length === 0 && currentPage.value > 1) {
    currentPage.value--
  }
  await loadStats()
}

async function rescanLibrary() {
  isRescanning.value = true
  folders.value = await window.api.rescanLibrary()
  await loadStats()

  setTimeout(() => {
    isRescanning.value = false
    alert("Library rescanned successfully!")
  }, 500)
}

onMounted(() => {
  loadStats()
  loadFolders()
})
</script>

<style scoped>
/* Stats dashboard page – includes metrics cards, info sections, refresh button, and top lists */

/* Container layout */
.stats-container {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  animation: fadeIn 0.6s ease;
}

/* Fade-in animation */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Page title */
.stats-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-color);
  margin-bottom: 2rem;
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Stats grid layout */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

/* Stat card base */
.stat-card {
  position: relative;
  background: var(--side-nav-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 2rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  animation: slideUp 0.6s ease both;
}

/* Slide-up animation for cards */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Stat card hover effects */
.stat-card:hover {
  transform: translateY(-4px);
  border-color: var(--accent);
  box-shadow: 0 8px 24px rgba(142, 68, 173, 0.2);
}

.stat-card:hover .stat-icon {
  transform: scale(1.1) rotate(5deg);
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
}

/* Icon container */
.stat-icon {
  width: 60px;
  height: 60px;
  background: var(--hover-bg);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.stat-icon svg {
  width: 30px;
  height: 30px;
  color: var(--accent);
  transition: all 0.3s ease;
}

.stat-card:hover .stat-icon svg {
  color: white;
}

/* Stat card content */
.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-color);
  line-height: 1;
  margin-bottom: 0.5rem;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 0.95rem;
  color: var(--muted-text);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Sparkle hover effect */
.stat-sparkle {
  position: absolute;
  top: -50%;
  right: -50%;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    circle,
    rgba(142, 68, 173, 0.15) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.stat-card:hover .stat-sparkle {
  opacity: 1;
  animation: sparkle 2s infinite;
}

@keyframes sparkle {
  0%,
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.5) rotate(180deg);
    opacity: 0.6;
  }
}

/* Info section */
.info-section {
  margin-top: 3rem;
  animation: fadeIn 0.8s ease 0.3s both;
}

.section-title {
  font-size: 1.8rem;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 1.5rem;
}

/* Info cards grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

/* Info card styles */
.info-card {
  background: var(--side-nav-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.info-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(142, 68, 173, 0.15);
}

/* Info card header */
.info-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.info-icon {
  font-size: 1.5rem;
}

.info-title {
  font-size: 0.9rem;
  color: var(--muted-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.info-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-color);
  margin-bottom: 0.25rem;
}

.info-sub {
  font-size: 0.9rem;
  color: var(--muted-text);
}

/* Refresh button */
.refresh-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 3rem auto 0;
  padding: 1rem 2rem;
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(142, 68, 173, 0.3);
}

.refresh-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(142, 68, 173, 0.4);
}

.refresh-btn:active:not(:disabled) {
  transform: translateY(0);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-btn svg {
  width: 20px;
  height: 20px;
}

.refresh-btn svg.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .stats-container {
    padding: 1rem;
  }

  .stats-title {
    font-size: 2rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .stat-card {
    padding: 1.5rem;
  }

  .stat-value {
    font-size: 2rem;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .top-lists-section {
    grid-template-columns: 1fr;
  }

  .track-name {
    font-size: 0.95rem;
  }

  .play-count {
    font-size: 0.85rem;
  }
}

/* Top lists section */
.top-lists-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 2rem;
  margin-top: 3rem;
}

.top-list {
  animation: fadeIn 0.8s ease 0.5s both;
}

.title-icon {
  font-size: 1.5rem;
  margin-right: 0.5rem;
}

/* Top list container */
.top-list-container {
  background: var(--side-nav-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1rem;
  max-height: 600px;
  overflow-y: auto;
}

/* Custom scrollbar for top list */
.top-list-container::-webkit-scrollbar {
  width: 8px;
}

.top-list-container::-webkit-scrollbar-track {
  background: var(--bg-color);
  border-radius: 4px;
}

.top-list-container::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.top-list-container::-webkit-scrollbar-thumb:hover {
  background: var(--accent);
}

/* Empty state inside top lists */
.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--muted-text);
}

.empty-state p {
  font-size: 1rem;
  line-height: 1.6;
}

/* Top list items */
.top-list-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-color);
  border-radius: 8px;
  margin-bottom: 0.75rem;
  transition: all 0.3s ease;
  animation: slideInLeft 0.4s ease both;
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.top-list-item:hover {
  background: var(--hover-bg);
  transform: translateX(4px);
  border-left: 3px solid var(--accent);
}

/* Rank and highlights */
.rank {
  font-weight: 600;
  font-size: 1rem;
  color: var(--muted-text);
  width: 24px;
  text-align: right;
  margin-right: 0.5rem;
}

/* Highlight for top 3 */
.top-list-item:nth-child(1) {
  background: linear-gradient(90deg, rgba(255, 215, 0, 0.15), transparent 80%);
}

.top-list-item:nth-child(2) {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--text-color) 10%, rgba(192, 192, 192, 0.25)),
    transparent 85%
  );
}

.top-list-item:nth-child(3) {
  background: linear-gradient(90deg, rgba(205, 127, 50, 0.15), transparent 80%);
}

/* Track and artist images */
.track-cover,
.track-cover-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  flex-shrink: 0;
  object-fit: cover;
}

.track-cover-placeholder {
  background: var(--hover-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}

.track-cover-placeholder svg {
  width: 24px;
  height: 24px;
}

.artist-avatar,
.artist-cover {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
}

.artist-avatar {
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  font-weight: 700;
}

/* Track info layout */
.track-info {
  flex: 1;
  min-width: 0;
}

.track-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.25rem;
}

.track-artist {
  font-size: 0.85rem;
  color: var(--muted-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Play count badge */
.play-count {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--accent);
  flex-shrink: 0;
}

.play-count svg {
  opacity: 0.7;
}

/* Folder management section */
.folder-management-section {
  margin-top: 3rem;
  animation: fadeIn 0.8s ease 0.4s both;
}

.folder-management-section .section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.folder-header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.accent-btn {
  background-color: var(--accent);
  color: #fff;
  border: none;
  padding: 10px 18px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
}

.accent-btn:hover {
  background-color: var(--accent-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-icon {
  font-size: 1rem;
}

/* View Controls */
.view-controls {
  display: flex;
  gap: 0.5rem;
}

.view-btn {
  background: var(--topbar-bg);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.view-btn:hover {
  background: var(--hover-bg);
}

.view-btn.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

/* Folder grid view */
.folder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin: 1rem 0 2rem;
}

.folder-card {
  background: var(--topbar-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  position: relative;
  transition: all 0.3s ease;
  cursor: pointer;
}

.folder-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  border-color: var(--accent);
}

.folder-card-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  text-align: center;
  opacity: 0.8;
  color: var(--accent);
}

.folder-card-content {
  text-align: center;
  overflow: hidden;
}

.folder-card-path {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-card-full-path {
  display: inline-block;
  white-space: nowrap;
  font-size: 0.75rem;
  color: var(--muted-text);
  cursor: default;
  transition: transform 0.3s ease;
  margin-bottom: 0.75rem;
}

.folder-card-full-path:hover {
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

.folder-card-tracks {
  color: var(--accent);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
  width: fit-content;
  margin: 0 auto;
}

.folder-card-remove {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.4);
  border: none;
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s ease;
}

.folder-card:hover .folder-card-remove {
  opacity: 1;
}

.folder-card-remove:hover {
  background: var(--accent);
  transform: scale(1.1);
}

/* Folder list view */
.folder-table {
  width: 100%;
  border-collapse: collapse;
  border-radius: 10px;
  overflow: hidden;
  background-color: var(--topbar-bg);
  margin-bottom: 2rem;
}

.folder-table th,
.folder-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  text-align: left;
}

.folder-table th {
  background: var(--hover-bg);
  font-weight: 600;
  color: var(--accent);
}

.folder-row {
  transition: background 0.2s ease;
}

.folder-row:hover {
  background: var(--hover-bg);
}

.folder-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.folder-icon {
  font-size: 1.25rem;
  color: var(--accent);
}

.folder-path {
  font-weight: 500;
  color: var(--text-color);
  font-size: 0.95rem;
}

.folder-name {
  font-size: 0.8rem;
  color: var(--muted-text);
  margin-top: 2px;
}

.track-badge {
  background: var(--accent);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  display: inline-block;
}

.remove-cell {
  text-align: center;
  width: 50px;
}

.icon-btn {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 4px;
}

.icon-btn:hover {
  color: var(--accent-hover);
  transform: scale(1.2) rotate(90deg);
}

/* Folder-management empty state (distinct from .empty-state used in top lists) */
.folder-empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.folder-empty-state .empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
  color: var(--muted-text);
}

.folder-empty-state .empty-text {
  font-size: 1.2rem;
  color: var(--text-color);
  margin-bottom: 0.5rem;
}

.folder-empty-state .empty-subtext {
  color: var(--muted-text);
  font-size: 0.95rem;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  margin-bottom: 2rem;
}

.page-btn {
  background: var(--topbar-bg);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-btn:hover:not(:disabled) {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-info {
  color: var(--text-color);
  font-size: 0.95rem;
}

/* Rescan button */
.rescan-section {
  text-align: center;
}

.rescan-btn {
  background-color: var(--topbar-bg);
  border: 1px solid var(--accent);
  color: var(--text-color);
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.rescan-btn:hover:not(:disabled) {
  background-color: var(--accent);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.rescan-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.scanning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@media (max-width: 768px) {
  .folder-grid {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.25rem;
  }

  .folder-management-section .section-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
