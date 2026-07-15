<template>
  <div class="music-container">
    <div class="header">
      <div class="header-title">
        <h2>{{ $t('tracks.all') }}</h2>
        <span v-if="tracks.length" class="header-meta">
          {{ t('tracks.count', tracks.length) }} · {{ formatTotalDuration(totalDurationSeconds) }}
        </span>
      </div>

      <div class="header-controls">
        <TrackSortControls
          v-model:sortField="sortField"
          v-model:sortDirection="sortDirection"
        />
        <div class="view-toggle">
          <button
            :class="['toggle-btn', { active: viewMode === 'list' }]"
            @click="viewMode = 'list'"
          >
            <i class="fas fa-bars"></i>
          </button>
          <button
            :class="['toggle-btn', { active: viewMode === 'grid' }]"
            @click="viewMode = 'grid'"
          >
            <i class="fas fa-th-large"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="pill-row">
      <button class="pill active">
        {{ t('tracks.all') }} <span class="pill-count">{{ tracks.length }}</span>
      </button>
      <button class="pill" @click="router.push('/playlists/liked')">
        <Star :size="14" /> {{ t('tracks.favorites') }}
        <span class="pill-count">{{ likedCount }}</span>
      </button>
      <button class="pill" @click="router.push('/artists')">
        <User :size="14" /> {{ t('nav.artists') }}
        <span class="pill-count">{{ artistCount }}</span>
      </button>
      <button class="pill" @click="router.push('/playlists')">
        <ListMusic :size="14" /> {{ t('nav.playlists') }}
        <span class="pill-count">{{ playlistCount }}</span>
      </button>
    </div>

    <!-- List View -->
    <TrackList
      v-if="viewMode === 'list'"
      :tracks="sortedTracks"
      :currentTrack="player.currentTrack"
      :formatDuration="formatTime"
      :playlists="playlists"
      :currentPlaylistId="null"
      @select="playCurrentTrack"
      @add-to-playlist="handleAddToPlaylist"
    />

    <!-- Grid View -->
    <TrackGrid
      v-else
      :tracks="sortedTracks"
      :currentTrack="player.currentTrack"
      @select="playCurrentTrack"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from "vue"
import { useRouter } from "vue-router"
import { useSearchStore } from "../store/search.js"
import { usePlayerStore } from "../store/player.js"
import { useEnhanceStore } from "../store/enhance.js"
import { usePlaylistsStore } from "../store/playlists.js"
import { useI18n } from "vue-i18n"
import { Star, User, ListMusic } from "@lucide/vue"
import TrackList from "./TrackList.vue"
import TrackGrid from "./TrackGrid.vue"
import TrackSortControls from "./TrackSortControls.vue"
import { useTrackSort } from "../utils/useTrackSort.js"
import { formatTime, formatTotalDuration } from "../utils/playerUtils.js"

const { t } = useI18n()
const router = useRouter()
const tracks = ref([])
const playlists = ref([])
const artistCount = ref(0)
const viewMode = ref("list")
const { sortField, sortDirection, sortedTracks } = useTrackSort(
  tracks,
  "echovault-sort-all-songs"
)

const search = useSearchStore()
const player = usePlayerStore()
const enhance = useEnhanceStore()
const playlistsStore = usePlaylistsStore()

const likedCount = computed(() => tracks.value.filter((t) => t.isLiked).length)
const playlistCount = computed(() => playlists.value?.length || 0)
const totalDurationSeconds = computed(() =>
  tracks.value.reduce((sum, t) => sum + (t.duration || 0), 0)
)

async function loadArtistCount() {
  const artists = await window.api.getArtists()
  artistCount.value = artists.length
}

// Reload the list when an enhancement finishes so the new FLAC appears.
watch(
  () => enhance.completedCount,
  () => loadTracks()
)

// Patch the liked flag in place so the row's liked icon updates immediately.
watch(
  () => player.likedUpdated,
  () => {
    const current = player.currentTrack
    if (!current?.id) return
    const t = tracks.value.find((t) => t.id === current.id)
    if (t) t.isLiked = current.isLiked
  }
)

// watcher for search
watch(
  () => search.query,
  async (q) => {
    const query = q.trim()

    if (!query) {
      // Load full tracklist normally
      const result = await window.api.getTracks()
      tracks.value = await formatTracks(result)
      return
    }

    // DB FTS search
    const result = await window.api.searchTracks(query)
    tracks.value = await formatTracks(result)
  },
  { immediate: true }
)

async function loadPlaylists() {
  playlists.value = await window.api.getPlaylists()
}

async function handleAddToPlaylist({ track, playlistId }) {
  await window.api.addTrackToPlaylist(playlistId, track.id)
  await loadPlaylists()
  await playlistsStore.loadPlaylists(true)
}

async function loadTracks() {
  const result = await window.api.getTracks()

  // For each track, load cover as Base64 and attach it
  const withCovers = await formatTracks(result)

  tracks.value = withCovers

  if (Object.keys(player.currentTrack).length === 0) {
    player.clearQueue()
    player.queue = sortedTracks.value.map((t) => ({ ...t }))
    player.currentIndex = 0
    player.currentTrack = { ...withCovers[0] } || {}
    player.queueSource = "all"
  }

  await nextTick()
}


onMounted(async () => {
  await loadTracks()
  await loadPlaylists()
  await loadArtistCount()
})

// add cover to tracks
async function attachCover(track) {
  if (!track.cover) return { ...track, coverDataUrl: null }

  const url = track.cover.startsWith("/")
    ? `echovault://${track.cover}`
    : `echovault:///${track.cover}`

  return { ...track, coverDataUrl: url }
}

async function formatTracks(list) {
  return Promise.all(list.map((t) => attachCover(t)))
}

// Send to store for Player component
function playCurrentTrack(track) {
  if (player.queueSource !== "all") {
    player.clearQueue()
    player.queue = sortedTracks.value.map((t) => ({ ...t }))
    player.queueSource = "all"
  }

  const index = player.queue.findIndex((t) => t.file_path === track.file_path)
  if (index !== -1) {
    player.currentIndex = index
    player.setTrack(player.queue[index], false)
  } else {
    player.setTrack(track)
  }
}
</script>

<style scoped>
/* ────────────────────────────────
    Base Container
──────────────────────────────── */
.music-container {
  /* padding: 20px; */
  color: var(--text-color);
}

/* ────────────────────────────────
    Header & View Toggle Controls
──────────────────────────────── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 16px;
  margin: -1rem -1rem 20px -1rem;
  padding: 1rem 1rem 1.25rem 1rem;
  position: sticky;
  top: -1rem;
  z-index: 5;
  background: var(--content-bg);
}

.header-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.header h2 {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
}

.header-meta {
  color: var(--muted-text);
  font-size: 14px;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-controls :deep(.sort-controls) {
  margin-bottom: 0;
}

/* Pill row (All Songs / Favorites / Artists / Playlists shortcuts) */
.pill-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 24px;
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

.pill.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  cursor: default;
}

.pill-count {
  color: var(--muted-text);
  font-weight: 500;
}

.pill.active .pill-count {
  color: rgba(255, 255, 255, 0.75);
}

/* View toggle buttons container */
.view-toggle {
  display: flex;
  gap: 8px;
  background: var(--side-nav-bg);
  padding: 4px;
  border-radius: 8px;
}

/* Individual toggle button */
.toggle-btn {
  background: transparent;
  border: none;
  color: var(--muted-text);
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-btn:hover {
  background: var(--hover-bg);
  color: var(--text-color);
}

.toggle-btn.active {
  background: var(--accent);
  color: white;
}

</style>
