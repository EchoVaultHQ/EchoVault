<template>
  <div class="list-view" @contextmenu.prevent>
    <table class="track-table">
      <thead>
        <tr>
          <th class="index-col">{{ t("trackList.number") }}</th>
          <th class="title-col">{{ t("trackList.title") }}</th>
          <th class="artist-col">{{ t("sort.artist") }}</th>
          <th class="album-col">{{ t("sort.album") }}</th>
          <th class="duration-col" :aria-label="t('sort.duration')"><Clock :size="14" /></th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="(track, index) in tracks" :key="track.id" class="track-row"
          :class="{ playing: currentTrack?.file_path === track.file_path }" @click="$emit('select', track)">
          <!-- Index / now-playing indicator -->
          <td class="index-col">
            <AudioLines v-if="currentTrack?.file_path === track.file_path" :size="16" class="playing-icon" />
            <span v-else class="index-number">{{ index + 1 }}</span>
          </td>

          <!-- Title + Cover -->
          <td class="title-col">
            <div class="track-info">
              <div class="cover-wrapper">
                <img v-if="track.coverDataUrl" :src="track.coverDataUrl" class="track-cover" :alt="track.title" />
                <img v-else src="../assets/images/default-cover.svg" class="track-cover" :alt="track.title" />
              </div>
              <div class="track-title">{{ track.title }}</div>
            </div>
          </td>

          <!-- Artist -->
          <td class="artist-col">{{ track.artist }}</td>

          <!-- Album -->
          <td class="album-col">{{ track.album }}</td>

          <!-- Duration + 3 Dots Button -->
          <td class="duration-col">
            <div class="duration-wrapper">
              <span class="duration-value">
                <span class="liked-badge-slot">
                  <span v-if="track.isLiked" class="liked-badge" :title="t('miniPlayer.like')">
                    <i class="fa-solid fa-star"></i>
                  </span>
                </span>
                <span v-if="enhanceStore.isEnhancing(track.id)" class="enhance-progress">
                  {{ enhanceLabel(track.id) }}
                </span>
                <span v-else class="duration-text">{{ formatDuration(track.duration) }}</span>
              </span>

              <button class="more-btn" @click.stop="toggleMenu(track.id, $event)">
                <Ellipsis :size="18" />
              </button>
            </div>

            <!-- DROPDOWN MENU -->
            <div v-if="openMenuId === track.id" class="dropdown-menu"
              :style="{ top: menuPos.y + 'px', right: menuPos.x + 'px' }">
              <div v-for="item in buildMenuItems(track)" :key="item.key" class="dropdown-item"
                :class="{ danger: item.danger, disabled: item.disabled, 'has-sub': item.submenu }"
                @click.stop="!item.disabled && !item.submenu && item.onClick?.()">
                <component :is="item.icon" :size="16" v-bind="item.iconProps" />
                <span class="dropdown-label">{{ item.label }}</span>
                <ChevronRight v-if="item.submenu" class="chevron" :size="14" />

                <div v-if="item.submenu" class="sub-menu">
                  <div v-for="sub in item.submenu" :key="sub.key" class="dropdown-item"
                    :class="{ disabled: sub.disabled }" @click.stop="!sub.disabled && sub.onClick?.()">
                    <span class="dropdown-label">{{ sub.label }}</span>
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
import { useI18n } from "vue-i18n"
import { useEnhanceStore } from "../store/enhance.js"
import { usePlayerStore } from "../store/player.js"
import { useTrackLike } from "../utils/playerUtils.js"
import { Ellipsis, Heart, Sparkles, ListPlus, ChevronRight, Trash2, AudioLines, Clock } from "@lucide/vue"

const { t } = useI18n()
const enhanceStore = useEnhanceStore()
const player = usePlayerStore()
const { toggleLikedSong } = useTrackLike(player)

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
  return props.playlists.filter(
    (p) => String(p.id) !== String(props.currentPlaylistId)
  )
})

function toggleMenu(id, event) {
  if (openMenuId.value === id) {
    openMenuId.value = null
    return
  }
  openMenuId.value = id

  const rect = event.target.getBoundingClientRect()
  menuPos.value = {
    x: window.innerWidth - rect.right,
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

// Declarative menu-item list: adding a future operation means pushing one
// object here, not writing a new template block.
function buildMenuItems(track) {
  const items = [
    {
      key: "like",
      label: track.isLiked ? t("miniPlayer.unlike") : t("miniPlayer.like"),
      icon: Heart,
      iconProps: { fill: track.isLiked ? "currentColor" : "none" },
      onClick: () => {
        toggleLikedSong(track)
        closeMenu()
      },
    },
    {
      key: "enhance",
      label: t("enhance.enhanceToFlac"),
      icon: Sparkles,
      disabled: enhanceStore.isEnhancing(track.id),
      onClick: () => enhanceTrack(track),
    },
    {
      key: "add-to-playlist",
      label: "Add to playlist",
      icon: ListPlus,
      submenu:
        availablePlaylists.value.length > 0
          ? availablePlaylists.value.map((p) => ({
              key: p.id,
              label: p.name,
              onClick: () => addTrackToPlaylist(track, p.id),
            }))
          : [{ key: "none", label: "No playlists found", disabled: true }],
    },
  ]

  if (props.currentPlaylistId) {
    items.push({
      key: "remove-from-playlist",
      label: "Remove from this playlist",
      icon: Trash2,
      danger: true,
      onClick: () => removeFromPlaylist(track),
    })
  }

  return items
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
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0 4px;
}

.track-table th {
  text-align: left;
  padding: 10px 12px;
  color: var(--muted-text);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.track-table td {
  padding: 10px 12px;
  font-size: 14px;
  vertical-align: middle;
}

.track-table tbody td:first-child {
  border-radius: var(--radius-md) 0 0 var(--radius-md);
}

.track-table tbody td:last-child {
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

/* Columns */
.index-col {
  width: 40px;
  text-align: center;
  color: var(--muted-text);
  font-variant-numeric: tabular-nums;
}

.playing-icon {
  color: var(--accent);
}

.title-col {
  width: 33%;
}

.artist-col {
  width: 21%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  color: var(--accent);
  font-size: 13px;
}

.album-col {
  width: 17%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  color: var(--muted-text);
  font-size: 13px;
}

.duration-col {
  width: 90px;
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

.duration-value {
  display: flex;
  align-items: center;
  gap: 8px;
}

.liked-badge-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  flex-shrink: 0;
}

.liked-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  background: var(--hover-bg);
  color: var(--accent);
  font-size: 11px;
  flex-shrink: 0;
}

.duration-text {
  min-width: 38px;
  text-align: right;
  font-variant-numeric: tabular-nums;
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

.cover-wrapper {
  position: relative;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.track-cover {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.track-title {
  flex: 1;
  min-width: 0;

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
}

.artist-col {
  font-size: 12px;
  color: var(--accent);
}

/* === 3 DOTS BUTTON === */
.more-btn {
  width: 28px;
  height: 28px;

  display: flex;
  align-items: center;
  justify-content: center;

  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--muted-text);

  margin-left: 2px;

  cursor: pointer;

  opacity: .75;

  flex-shrink: 0;

  transition: .2s;
}

.more-btn:hover {
  opacity: 1;
  color: var(--accent);
  background-color: var(--hover-bg);
}

/* === DROPDOWN MENU === */

.dropdown-menu {
  position: fixed;
  min-width: 200px;
  background: var(--side-nav-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  padding: 6px;
  box-shadow: var(--shadow-lg);
  z-index: 9999;
}

.dropdown-item {
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
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

.dropdown-label {
  flex: 1;
  white-space: nowrap;
}

/* Submenu */
.has-sub {
  position: relative;
}

.chevron {
  margin-left: auto;
  opacity: 0.6;
  flex-shrink: 0;
}

.sub-menu {
  display: none;
  position: absolute;
  right: 100%;
  top: 0;
  min-width: 180px;
  background: var(--side-nav-bg);
  padding: 6px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
}

.sub-menu .dropdown-item {
  gap: 0;
}

.has-sub:hover .sub-menu {
  display: block;
}

/* Alternating row backgrounds */
.track-table tbody tr:nth-child(odd) td {
  background-color: var(--side-nav-bg);
}

.track-table tbody tr:nth-child(even) td {
  background-color: transparent;
}

/* Hover and active states */
.track-table tbody tr.track-row:hover td {
  background-color: var(--hover-bg);
}

.track-row.playing td {
  background-color: color-mix(in srgb, var(--accent) 35%, var(--side-nav-bg));
  color: var(--text-color);
  transition: background-color 0.3s;
}

.track-row.playing .artist-col {
  color: var(--text-color);
  opacity: 0.85;
}

.track-row.playing td:first-child {
  box-shadow: inset 2px 0 0 var(--accent);
}

.track-card.playing {
  outline: 2px solid var(--accent);
  background: var(--hover-bg);
  transition: background 0.3s;
}
</style>
