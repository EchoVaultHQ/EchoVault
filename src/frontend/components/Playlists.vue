<template>
  <div class="playlists-wrapper">
    <!-- Playlists Grid View -->
    <div v-if="!selectedPlaylist" class="playlists-container">
      <!-- Create New Playlist Card -->
      <div class="playlist-card create-card" @click="showCreateDialog = true">
        <div class="card-content">
          <div class="create-icon">
            <i class="fa-solid fa-plus"></i>
          </div>
            <h3>{{ t("playlist.create") }}</h3>
        </div>
      </div>

      <!-- Liked Songs Card -->
      <div class="playlist-card liked-card" @click="selectPlaylist('liked')">
        <div class="card-cover liked-cover">
          <i class="fa-solid fa-heart"></i>
        </div>
        <div class="card-info">
          <h3>{{ t("liked.title") }}</h3>
          <p class="track-count">
            {{ likedTracks.length }} {{ t("playlist.tracks") }}
          </p>
        </div>
      </div>

      <!-- Enhanced Songs Card -->
      <div class="playlist-card enhanced-card" @click="selectPlaylist('enhanced')">
        <div class="card-cover enhanced-cover">
          <Sparkles :size="48" />
        </div>
        <div class="card-info">
          <h3>{{ t("enhancedPlaylist.title") }}</h3>
          <p class="track-count">
            {{ enhancedTracks.length }} {{ t("playlist.tracks") }}
          </p>
        </div>
      </div>

      <!-- User Playlists -->
      <div
        v-for="playlist in playlists"
        :key="playlist.id"
        class="playlist-card"
        @click="selectPlaylist(playlist.id)"
      >
        <div class="card-cover">
          <img
            v-if="playlist.coverUrl"
            :src="playlist.coverUrl"
            class="card-cover"
            draggable="false"
          />
          <div v-if="!playlist.coverUrl" class="default-cover">
            <i class="fa-solid fa-music"></i>
          </div>

          <!-- DELETE BUTTON -->
          <button
            class="delete-btn"
            @click.stop="deletePlaylist(playlist.id)"
            title="Delete playlist"
          >
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
        <div class="card-info">
          <h3>{{ playlist.name }}</h3>
          <p class="track-count">
            {{ playlist.track_count }} {{ t("playlist.tracks") }}
          </p>
        </div>
      </div>
    </div>

    <!-- Playlist Tracks View -->
    <div v-else class="playlist-view">
      <div class="playlist-view-header">
        <button class="back-button" :title="t('common.back')" @click="router.push('/playlists')">
          <ArrowLeft :size="20" />
        </button>
      </div>

      <div class="playlist-hero">
        <div class="hero-cover">
          <div v-if="selectedPlaylist === 'liked'" class="liked-hero-cover">
            <i class="fa-solid fa-heart"></i>
          </div>
          <div
            v-else-if="selectedPlaylist === 'enhanced'"
            class="enhanced-hero-cover"
          >
            <Sparkles :size="80" />
          </div>
          <img
            v-else-if="currentPlaylistCover"
            class="hero-cover-image"
            :src="currentPlaylistCover"
          />
          <div v-else class="hero-default-cover">
            <ImagePlus :size="36" />
            <p class="cover-placeholder-title">{{ t("playlist.coverPlaceholder") }}</p>
            <p class="cover-placeholder-sub">{{ t("home.browseFiles") }}</p>
          </div>
        </div>
        <div class="hero-info">
          <p class="playlist-type">
            {{
              selectedPlaylist === "liked"
                ? t("playlist.type.liked")
                : selectedPlaylist === "enhanced"
                  ? t("playlist.type.enhanced")
                  : t("playlist.type.playlist")
            }}
          </p>
          <h1>{{ currentPlaylistName }}</h1>
          <p class="playlist-meta">
            {{ currentTracks.length }} {{ t("playlist.tracks") }} · {{ formattedTotalDuration }}
          </p>
          <div class="hero-actions">
            <button
              class="play-btn"
              @click="playFromStart"
              :disabled="!currentTracks.length"
            >
              <Play :size="18" fill="currentColor" />
              <span>{{ t("playlist.play") }}</span>
            </button>
            <button
              class="shuffle-btn"
              @click="shuffleAndPlay"
              :disabled="!currentTracks.length"
            >
              <Shuffle :size="18" />
              <span>{{ t("playlist.shuffle") }}</span>
            </button>
            <div
              v-if="selectedPlaylist !== 'liked' && selectedPlaylist !== 'enhanced'"
              class="hero-more"
            >
              <button
                class="more-options-btn"
                :title="t('playlist.moreOptions')"
                @click.stop="heroMenuOpen = !heroMenuOpen"
              >
                <Ellipsis :size="18" />
              </button>
              <div v-if="heroMenuOpen" class="hero-menu">
                <div class="dropdown-item" @click="openRenameDialog">
                  <PencilLine :size="16" /><span>{{ t("playlist.rename") }}</span>
                </div>
                <div class="dropdown-item danger" @click="deletePlaylist(selectedPlaylist)">
                  <Trash2 :size="16" /><span>{{ t("playlist.delete") }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="playlist-tracks">
        <div v-if="!sortedTracks.length" class="playlist-empty-state">
          <ListMusic :size="48" class="empty-icon" />
          <h2>{{ t("playlist.emptyTitle") }}</h2>
          <p>{{ t("playlist.emptySubtext") }}</p>
          <button class="accent-btn" @click="router.push('/songs')">
            {{ t("playlist.browseAllSongs") }}
          </button>
        </div>
        <template v-else>
          <div class="tracks-toolbar">
            <TrackSortControls
              v-model:sortField="sortField"
              v-model:sortDirection="sortDirection"
            />
          </div>
          <TrackList
            :tracks="sortedTracks"
            :currentTrack="player.currentTrack"
            :formatDuration="formatTime"
            :playlists="playlists"
            :currentPlaylistId="
              selectedPlaylist !== 'liked' && selectedPlaylist !== 'enhanced'
                ? selectedPlaylist
                : null
            "
            @select="playTrack"
            @add-to-playlist="handleAddToPlaylist"
            @remove-from-playlist="handleRemoveFromPlaylist"
          />
        </template>
      </div>
    </div>

    <!-- Create Dialog -->
    <div
      v-if="showCreateDialog"
      class="dialog-overlay"
      @click.self="cancelCreate"
    >
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

    <!-- Rename Dialog -->
    <div
      v-if="showRenameDialog"
      class="dialog-overlay"
      @click.self="cancelRename"
    >
      <div class="dialog">
        <h2>{{ t("playlist.renameTitle") }}</h2>
        <input
          ref="renameInput"
          v-model="renamePlaylistName"
          type="text"
          @keyup.enter="confirmRename"
          @keyup.esc="cancelRename"
        />
        <div class="dialog-actions">
          <button class="btn-secondary" @click="cancelRename">
            {{ t("common.cancel") }}
          </button>
          <button
            class="btn-primary"
            @click="confirmRename"
            :disabled="!renamePlaylistName.trim()"
          >
            {{ t("common.save") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue"
import { useRoute, useRouter } from "vue-router"
import { storeToRefs } from "pinia"
import { Play, Shuffle, Sparkles, ListMusic, ImagePlus, Ellipsis, PencilLine, Trash2, ArrowLeft } from "@lucide/vue"
import { usePlayerStore } from "../store/player.js"
import { usePlaylistsStore } from "../store/playlists.js"
import { useEnhanceStore } from "../store/enhance.js"
import TrackList from "./TrackList.vue"
import TrackSortControls from "./TrackSortControls.vue"
import { useTrackSort } from "../utils/useTrackSort.js"
import { formatTime, formatTotalDuration } from "../utils/playerUtils.js"
import { useI18n } from "vue-i18n"

const { t } = useI18n()
const player = usePlayerStore()
const route = useRoute()
const router = useRouter()
const playlistsStore = usePlaylistsStore()
const { playlists } = storeToRefs(playlistsStore)
const enhanceStore = useEnhanceStore()

const likedTracks = ref([])
const enhancedTracks = ref([])
const selectedPlaylist = computed(() => route.params.id ?? null)
const playlistTracks = ref({})
const showCreateDialog = ref(false)
const newPlaylistName = ref("")
const nameInput = ref(null)
const heroMenuOpen = ref(false)
const showRenameDialog = ref(false)
const renamePlaylistName = ref("")
const renameInput = ref(null)

// Load liked tracks
async function loadLikedTracks() {
  const result = await window.api.getLikedTracks()
  const withCovers = await Promise.all(
    result.map(async (track) => {
      if (track.cover) {
        const url = track.cover.startsWith("/")
          ? `echovault://${track.cover}`
          : `echovault:///${track.cover}`
        return { ...track, coverDataUrl: url }
      }
      return { ...track, coverDataUrl: null }
    })
  )
  likedTracks.value = withCovers
}

// Load enhanced tracks
async function loadEnhancedTracks() {
  const result = await window.api.getEnhancedTracks()
  const withCovers = await Promise.all(
    result.map(async (track) => {
      if (track.cover) {
        const url = track.cover.startsWith("/")
          ? `echovault://${track.cover}`
          : `echovault:///${track.cover}`
        return { ...track, coverDataUrl: url }
      }
      return { ...track, coverDataUrl: null }
    })
  )
  enhancedTracks.value = withCovers
}

// Create new playlist
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

// Load playlist tracks
async function loadPlaylistTracks(playlistId) {
  try {
    const result = await window.api.getPlaylistTracks(playlistId)
    const withCovers = await Promise.all(
      result.map(async (track) => {
        if (track.cover) {
          const url = track.cover.startsWith("/")
            ? `echovault://${track.cover}`
            : `echovault:///${track.cover}`
          return { ...track, coverDataUrl: url }
        }
        return { ...track, coverDataUrl: null }
      })
    )
    playlistTracks.value[playlistId] = withCovers
  } catch (error) {
    console.error("Error loading playlist tracks:", error)
  }
}

// Select playlist
function selectPlaylist(playlistId) {
  router.push(playlistId ? `/playlists/${playlistId}` : "/playlists")
}

// Handle add to playlist
async function handleAddToPlaylist({ track, playlistId }) {
  try {
    await window.api.addTrackToPlaylist(playlistId, track.id)
    // Reload playlists to update track counts (sidebar + grid)
    await playlistsStore.loadPlaylists(true)
    // If currently viewing the playlist, reload its tracks
    if (String(selectedPlaylist.value) === String(playlistId)) {
      delete playlistTracks.value[playlistId]
      await loadPlaylistTracks(playlistId)
    }
  } catch (error) {
    console.error("Error adding track to playlist:", error)
  }
}

// Handle remove from playlist
async function handleRemoveFromPlaylist({ track, playlistId }) {
  try {
    await window.api.removeTrackFromPlaylist(playlistId, track.id)
    // Reload the playlist tracks
    delete playlistTracks.value[playlistId]
    await loadPlaylistTracks(playlistId)
    // Reload playlists to update track counts (sidebar + grid)
    await playlistsStore.loadPlaylists(true)
  } catch (error) {
    console.error("Error removing track from playlist:", error)
  }
}

// delete a playlist
async function deletePlaylist(id) {
  if (!confirm(t("playlist.confirmDelete") || "Delete this playlist?")) return

  try {
    const wasViewing = String(selectedPlaylist.value) === String(id)
    await playlistsStore.deletePlaylist(id)

    // If currently viewing this playlist, go back
    if (wasViewing) {
      router.push("/playlists")
    }
  } catch (err) {
    console.error("Failed to delete playlist:", err)
  }
}

// rename a playlist
function openRenameDialog() {
  renamePlaylistName.value = currentPlaylistName.value
  showRenameDialog.value = true
  heroMenuOpen.value = false
}

function cancelRename() {
  showRenameDialog.value = false
  renamePlaylistName.value = ""
}

async function confirmRename() {
  if (!renamePlaylistName.value.trim()) return
  await playlistsStore.renamePlaylist(selectedPlaylist.value, renamePlaylistName.value.trim())
  showRenameDialog.value = false
}

// Current tracks and playlist info
const currentTracks = computed(() => {
  if (selectedPlaylist.value === "liked") {
    return likedTracks.value
  }
  if (selectedPlaylist.value === "enhanced") {
    return enhancedTracks.value
  }
  return playlistTracks.value[selectedPlaylist.value] || []
})

const { sortField, sortDirection, sortedTracks } = useTrackSort(
  currentTracks,
  "echovault-sort-playlist"
)

const totalDurationSeconds = computed(() =>
  currentTracks.value.reduce((sum, t) => sum + (t.duration || 0), 0)
)
const formattedTotalDuration = computed(() => formatTotalDuration(totalDurationSeconds.value))

const currentPlaylistName = computed(() => {
  if (selectedPlaylist.value === "liked") return t("liked.title")
  if (selectedPlaylist.value === "enhanced") return t("enhancedPlaylist.title")
  const playlist = playlists.value.find(
    (p) => String(p.id) === String(selectedPlaylist.value)
  )
  return playlist?.name || ""
})

const currentPlaylistCover = computed(() => {
  if (selectedPlaylist.value === "liked" || selectedPlaylist.value === "enhanced")
    return null
  const playlist = playlists.value.find(
    (p) => String(p.id) === String(selectedPlaylist.value)
  )
  return playlist?.coverUrl || null
})

// Play track
function playTrack(track) {
  const queueSource =
    selectedPlaylist.value === "liked" || selectedPlaylist.value === "enhanced"
      ? selectedPlaylist.value
      : `playlist-${selectedPlaylist.value}`

  if (player.queueSource !== queueSource) {
    player.clearQueue()
    player.queue = sortedTracks.value.map((t) => ({ ...t }))
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

function playFromStart() {
  if (sortedTracks.value.length) playTrack(sortedTracks.value[0])
}

function shuffleAndPlay() {
  if (!sortedTracks.value.length) return
  if (!player.shuffleEnabled) player.toggleShuffle()
  const randomIndex = Math.floor(Math.random() * sortedTracks.value.length)
  playTrack(sortedTracks.value[randomIndex])
}

// Watch for dialog show to focus input
watch(showCreateDialog, async (newVal) => {
  if (newVal) {
    await nextTick()
    nameInput.value?.focus()
  }
})

watch(showRenameDialog, async (newVal) => {
  if (newVal) {
    await nextTick()
    renameInput.value?.focus()
  }
})

function closeHeroMenu() {
  heroMenuOpen.value = false
}

watch(() => player.likedUpdated, loadLikedTracks)
watch(() => enhanceStore.completedCount, loadEnhancedTracks)

watch(
  () => route.params.id,
  (id) => {
    if (id && id !== "liked" && id !== "enhanced") loadPlaylistTracks(id)
  },
  { immediate: true }
)

onMounted(() => {
  loadLikedTracks()
  loadEnhancedTracks()
  playlistsStore.loadPlaylists()
  document.addEventListener("click", closeHeroMenu)
})

onUnmounted(() => {
  document.removeEventListener("click", closeHeroMenu)
})
</script>

<style scoped>
.playlists-wrapper {
  width: 100%;
}

.playlists-container {
  padding: 2rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1.5rem;
  max-width: 100%;
}

.playlist-card {
  background: var(--side-nav-bg);
  border-radius: var(--radius-md);
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.playlist-card:hover {
  background: var(--hover-bg);
  border-color: var(--accent);
  transform: translateY(-2px);
}

/* Create Card */
.create-card {
  border: 2px dashed var(--border-color);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
}

.create-card:hover {
  border-color: var(--accent);
  background: var(--hover-bg);
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.create-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}

.create-icon svg {
  width: 32px;
  height: 32px;
  stroke-width: 2;
}

/* Liked Card */
.liked-card .liked-cover {
  background: linear-gradient(
    135deg,
    var(--accent) 0%,
    var(--accent-hover) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.liked-cover svg {
  width: 60px;
  height: 60px;
}

/* Enhanced Card */
.enhanced-card .enhanced-cover {
  background: linear-gradient(
    135deg,
    var(--accent) 0%,
    var(--accent-hover) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.enhanced-cover svg {
  width: 48px;
  height: 48px;
}

/* Card Cover */
.card-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  background-color: var(--topbar-bg);
  background-size: cover;
  background-position: center;
  overflow: hidden;
}

.default-cover {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted-text);
}

.default-cover svg {
  width: 48px;
  height: 48px;
  stroke-width: 1.5;
}

/* Card Info */
.card-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.card-info h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-count {
  font-size: 0.85rem;
  color: var(--muted-text);
  margin: 0;
}

/* Playlist View */
.playlist-view {
  width: 100%;
  min-height: 100%;
  background: var(--content-bg);
}

.playlist-view-header {
  display: flex;
  align-items: center;
  padding: 1.75rem 2rem 0.5rem 2rem;
}

.back-button {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-full);
  color: var(--muted-text);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    transform 0.15s ease;
}

.back-button:hover {
  background: var(--hover-bg);
  color: var(--text-color);
}

.back-button:active {
  transform: scale(0.92);
}

.back-button svg {
  stroke-width: 2;
}

/* fav icons (grid view) */
i.fa-plus,
.fa-trash {
  font-size: 24px;
  color: currentColor;
}

.fa-heart,
.fa-music {
  font-size: 48px; /* adjust to your container */
  color: currentColor; /* inherits text color */
}

/* Playlist Hero */
.playlist-hero {
  display: flex;
  align-items: flex-end;
  gap: 2rem;
  padding: 3rem 2rem;
  background: linear-gradient(
    180deg,
    var(--side-nav-bg) 0%,
    var(--content-bg) 100%
  );
}

.hero-cover {
  width: 200px;
  height: 200px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  flex-shrink: 0;
}

.liked-hero-cover {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    135deg,
    var(--accent) 0%,
    var(--accent-hover) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.liked-hero-cover svg {
  width: 80px;
  height: 80px;
}

.enhanced-hero-cover {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    135deg,
    var(--accent) 0%,
    var(--accent-hover) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.hero-cover-image {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
}

.hero-default-cover {
  width: 100%;
  height: 100%;
  background: transparent;
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--muted-text);
}

.hero-default-cover svg {
  stroke-width: 1.5;
}

.cover-placeholder-title {
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0;
}

.cover-placeholder-sub {
  font-size: 0.75rem;
  margin: 0;
  opacity: 0.8;
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 1rem;
}

.playlist-type {
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

.playlist-meta {
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
  transition:
    background-color 0.2s ease,
    transform 0.1s ease;
}

.hero-actions .play-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: scale(1.03);
}

.hero-actions .shuffle-btn {
  background: var(--hover-bg);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  transition: background-color 0.2s ease;
}

.hero-actions .shuffle-btn:hover:not(:disabled) {
  background: var(--border-color);
}

.hero-actions button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hero-more {
  position: relative;
}

.more-options-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: var(--hover-bg);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.more-options-btn:hover {
  background: var(--border-color);
}

.hero-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 180px;
  background: var(--side-nav-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 6px;
  z-index: 20;
}

.hero-menu .dropdown-item {
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.hero-menu .dropdown-item:hover {
  background: var(--hover-bg);
}

.hero-menu .dropdown-item.danger {
  color: #ff4a4a;
}

/* Playlist Tracks */
.playlist-tracks {
  padding: 2rem;
}

.tracks-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-2);
}

.tracks-toolbar :deep(.sort-controls) {
  margin-bottom: 0;
}

.playlist-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 4rem 2rem;
  gap: 0.75rem;
}

.playlist-empty-state .empty-icon {
  color: var(--muted-text);
  opacity: 0.4;
  margin-bottom: 0.5rem;
}

.playlist-empty-state h2 {
  margin: 0;
  color: var(--text-color);
  font-size: 1.25rem;
}

.playlist-empty-state p {
  margin: 0;
  color: var(--muted-text);
  font-size: 0.95rem;
}

.playlist-empty-state .accent-btn {
  margin-top: 0.5rem;
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
  margin: 0 0 1.5rem 0;
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
  transition: border-color 0.2s;
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
  transition: all 0.2s;
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

.delete-btn:hover .fa-trash {
  color: var(--accent-hover);
}

.delete-btn {
  position: absolute;
  /* top: 6px; */
  right: 10px;
  width: 28px;
  height: 28px;
  border: none;
  color: var(--text-color);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  cursor: pointer;
  transition:
    opacity 0.15s,
    background 0.2s;
  z-index: 5;
  bottom: 20px;
}

.delete-btn svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.playlist-card:hover .delete-btn {
  opacity: 1;
}

@media (max-width: 768px) {
  .playlists-container {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 1rem;
    padding: 1rem;
  }

  .playlist-card {
    padding: 0.75rem;
  }

  .create-card {
    min-height: 180px;
  }

  .playlist-hero {
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2rem 1rem;
  }

  .hero-cover {
    width: 160px;
    height: 160px;
  }

  .hero-info h1 {
    font-size: 2rem;
  }

  .playlist-tracks {
    padding: 1rem;
  }
}
</style>
