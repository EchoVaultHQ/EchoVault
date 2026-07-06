<template>
  <div class="list-view" @contextmenu.prevent>
    <table class="track-table">
      <thead>
        <tr>
          <th class="num-col">#</th>
          <th class="title-col">Title</th>
          <th class="album-col">Album</th>
          <th class="duration-col">Duration</th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="(track, index) in tracks"
          :key="track.id"
          class="track-row"
          :class="{ playing: currentTrack?.file_path === track.file_path }"
          @click="$emit('select', track)"
        >
          <!-- Index -->
          <td class="num-col">{{ index + 1 }}</td>

          <!-- Title + Cover -->
          <td class="title-col">
            <div class="track-info">
              <img
                v-if="track.coverDataUrl"
                :src="track.coverDataUrl"
                class="track-cover"
                :alt="track.title"
              />
              <img
                v-else
                src="../assets/images/default-cover.svg"
                class="track-cover"
                :alt="track.title"
              />
              <div class="track-details">
                <div class="track-title">{{ track.title }}</div>
                <div class="track-artist">{{ track.artist }}</div>
              </div>
            </div>
          </td>

          <!-- Album -->
          <td class="album-col">{{ track.album }}</td>

          <!-- Duration + 3 Dots Button -->
          <td class="duration-col">
            <div class="duration-wrapper">
              <span v-if="enhanceStore.isEnhancing(track.id)" class="enhance-progress">
                {{ enhanceLabel(track.id) }}
              </span>
              <span v-else>{{ formatDuration(track.duration) }}</span>

              <button
                class="more-btn"
                @click.stop="toggleMenu(track.id, $event)"
              >
                <i class="fa-solid fa-ellipsis-vertical"></i>
              </button>
            </div>

            <!-- DROPDOWN MENU -->
            <div
              v-if="openMenuId === track.id"
              class="dropdown-menu"
              :style="{ top: menuPos.y + 'px', left: menuPos.x + 'px' }"
            >
              <!-- Remove from playlist -->
              <div
                v-if="currentPlaylistId"
                class="dropdown-item danger"
                @click.stop="removeFromPlaylist(track)"
              >
                Remove from this playlist
              </div>

              <!-- Enhance to FLAC (AI) -->
              <div
                class="dropdown-item"
                :class="{ disabled: enhanceStore.isEnhancing(track.id) }"
                @click.stop="enhanceTrack(track)"
              >
                {{ $t("enhance.enhanceToFlac") }}
              </div>

              <!-- Add to playlist -->
              <div class="dropdown-item has-sub">
                Add to playlist
                <svg class="chevron" viewBox="0 0 24 24">
                  <path d="M9 18l6-6-6-6" />
                </svg>

                <div class="sub-menu">
                  <div
                    v-for="p in availablePlaylists"
                    :key="p.id"
                    class="dropdown-item"
                    @click.stop="addTrackToPlaylist(track, p.id)"
                  >
                    {{ p.name }}
                  </div>

                  <div
                    v-if="availablePlaylists.length === 0"
                    class="dropdown-item disabled"
                  >
                    No playlists found
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue"
import { useEnhanceStore } from "../store/enhance.js"

const enhanceStore = useEnhanceStore()

const props = defineProps({
  tracks: Array,
  currentTrack: Object,
  formatDuration: Function,
  playlists: {
    type: Array,
    default: () => [],
  },
  currentPlaylistId: {
    type: [Number, String, null],
    default: null,
  },
})

const emit = defineEmits(["select", "add-to-playlist", "remove-from-playlist"])

/* === 3 DOTS MENU STATE === */

const openMenuId = ref(null)
const menuPos = ref({ x: 0, y: 0 })

// Only show playlists other than current
const availablePlaylists = computed(() => {
  if (!props.currentPlaylistId) return props.playlists
  return props.playlists.filter((p) => p.id !== props.currentPlaylistId)
})

function toggleMenu(id, event) {
  if (openMenuId.value === id) {
    openMenuId.value = null
    return
  }
  openMenuId.value = id

  const rect = event.target.getBoundingClientRect()
  menuPos.value = {
    x: rect.left - 150 + rect.width,
    y: rect.bottom + 6,
  }
}

function closeMenu() {
  openMenuId.value = null
}

function addTrackToPlaylist(track, playlistId) {
  emit("add-to-playlist", { track, playlistId })
  // send add track notif
  window.api.showToast?.(
    `"${track.title || "Track"}" has been added to the playlist.`,
    "success"
  )
  closeMenu()
}

function enhanceTrack(track) {
  closeMenu()
  enhanceStore.enhance(track)
}

function enhanceLabel(id) {
  const p = enhanceStore.progress[id]
  if (!p) return ""
  const icon = p.phase === "download" ? "⬇" : "✨"
  return p.pct == null ? icon : `${icon} ${p.pct}%`
}

function removeFromPlaylist(track) {
  emit("remove-from-playlist", {
    track,
    playlistId: props.currentPlaylistId,
  })
  // send remove track notif
  window.api.showToast?.(
    `"${track.title || "Track"}" has been removed from the playlist.`,
    "success"
  )
  closeMenu()
}

onMounted(() => {
  document.addEventListener("click", closeMenu)
})

onUnmounted(() => {
  document.removeEventListener("click", closeMenu)
})
</script>

<style scoped>
/* Container */
.list-view {
  width: 100%;
  position: relative;
}

/* Table */
.track-table {
  width: 100%;
  border-collapse: collapse;
}

.track-table th {
  text-align: left;
  padding: 12px 16px;
  color: var(--muted-text);
  font-size: 12px;
  text-transform: uppercase;
}

.track-table td {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

/* Columns */
.num-col {
  width: 50px;
}

.title-col {
  width: 45%;
}

.album-col {
  width: 35%;
}

.duration-col {
  width: 120px;
  position: relative;
  white-space: nowrap;
}

.duration-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.enhance-progress {
  color: var(--accent);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Track Row */
.track-row {
  cursor: pointer;
  transition: background 0.2s;
}

/* Track Info */
.track-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.track-cover {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
}

.track-title {
  font-size: 15px;
  color: var(--text-color);
}

.track-artist {
  font-size: 13px;
  color: var(--muted-text);
}

/* === 3 DOTS BUTTON === */
.more-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  margin-left: 10px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.more-btn:hover {
  opacity: 1;
}

.more-btn svg {
  width: 18px;
  height: 18px;
}

/* === DROPDOWN MENU === */

.dropdown-menu {
  position: fixed;
  min-width: 180px;
  background: var(--side-nav-bg);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  padding: 6px 0;
  box-shadow: 0 8px 20px rgb(0 0 0 / 0.4);
  z-index: 9999;
}

.dropdown-item {
  padding: 10px 14px;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  cursor: pointer;
}

.dropdown-item:hover {
  background: var(--hover-bg);
}

.dropdown-item.danger {
  color: #ff4a4a;
}

.dropdown-item.disabled {
  color: var(--muted-text);
  cursor: not-allowed;
}

/* Submenu */
.has-sub {
  position: relative;
}

.chevron {
  width: 14px;
  opacity: 0.6;
}

.sub-menu {
  display: none;
  position: absolute;
  right: 100%;
  top: 0;
  min-width: 180px;
  background: var(--side-nav-bg);
  padding: 6px 0;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  box-shadow: 0 8px 20px rgb(0 0 0 / 0.4);
}

.has-sub:hover .sub-menu {
  display: block;
}

/* Alternating row backgrounds */
.track-table tbody tr:nth-child(odd) {
  background-color: var(--side-nav-bg);
}

.track-table tbody tr:nth-child(even) {
  background-color: transparent;
}

/* Hover and active states */
.track-table tbody tr.track-row:hover {
  background: var(--hover-bg);
}

.track-row.playing {
  background: var(--hover-bg);
  transition: background 0.3s;
  box-shadow: inset 2px 0 0 var(--accent);
}

.track-card.playing {
  outline: 2px solid var(--accent);
  background: var(--hover-bg);
  transition: background 0.3s;
}
</style>
