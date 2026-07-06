<template>
  <div class="music-container">
    <div class="header">
      <h2>{{ $t('tracks.all') }}</h2>
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

    <!-- List View -->
    <TrackList
      v-if="viewMode === 'list'"
      :tracks="tracks"
      :currentTrack="player.currentTrack"
      :formatDuration="formatDuration"
      :playlists="playlists"
      :currentPlaylistId="null"
      @select="playCurrentTrack"
      @add-to-playlist="handleAddToPlaylist"
    />

    <!-- Grid View -->
    <TrackGrid
      v-else
      :tracks="tracks"
      :currentTrack="player.currentTrack"
      @select="playCurrentTrack"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from "vue"
import { useSearchStore } from "../store/search.js"
import { usePlayerStore } from "../store/player.js"
import { useEnhanceStore } from "../store/enhance.js"
import { useI18n } from "vue-i18n"
import TrackList from "./TrackList.vue"
import TrackGrid from "./TrackGrid.vue"

const { t } = useI18n()
const tracks = ref([])
const playlists = ref([])
const viewMode = ref("list")

const search = useSearchStore()
const player = usePlayerStore()
const enhance = useEnhanceStore()

// Reload the list when an enhancement finishes so the new FLAC appears.
watch(
  () => enhance.completedCount,
  () => loadTracks()
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
}

async function loadTracks() {
  const result = await window.api.getTracks()

  // For each track, load cover as Base64 and attach it
  const withCovers = await formatTracks(result)

  tracks.value = withCovers

  if (Object.keys(player.currentTrack).length === 0) {
    player.clearQueue()
    player.queue = structuredClone(withCovers)
    player.currentIndex = 0
    player.currentTrack = { ...withCovers[0] } || {}
    player.queueSource = "all"
  }

  await nextTick()
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  const minLabel = mins === 1 ? "min" : "mins"
  const secLabel = secs === 1 ? "sec" : "secs"

  if (mins > 0 && secs > 0) {
    return `${mins} ${minLabel} ${secs} ${secLabel}`
  } else if (mins > 0) {
    return `${mins} ${minLabel}`
  } else {
    return `${secs} ${secLabel}`
  }
}

onMounted(async () => {
  await loadTracks()
  await loadPlaylists()
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
    player.queue = tracks.value.map((t) => ({ ...t }))
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
  align-items: center;
  margin-bottom: 30px;
}

.header h2 {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
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
