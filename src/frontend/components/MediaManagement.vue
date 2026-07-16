<template>
  <div class="media-page">
    <div class="media-header">
      <div class="media-header-text">
        <p class="media-eyebrow">{{ t("media.eyebrow") }}</p>
        <h1 class="media-title">{{ t("media.title") }}</h1>
        <p class="media-subtitle">{{ t("media.subtitle") }}</p>
        <div class="media-stats-row">
          <span class="stat-item">
            <strong class="stat-value">{{ folderCount }}</strong>
            <span class="stat-label">{{ t("library.folders") }}</span>
          </span>
          <span class="stat-item">
            <strong class="stat-value">{{ totalTracks }}</strong>
            <span class="stat-label">{{ t("labels.tracks") }}</span>
          </span>
          <span v-if="lastScannedLabel" class="stat-item stat-muted">
            {{ t("media.lastScanned", { time: lastScannedLabel }) }}
          </span>
        </div>
      </div>

      <div class="media-controls" v-if="folders.length > 0">
        <div class="view-toggle">
          <button
            :class="['toggle-btn', { active: viewMode === 'grid' }]"
            @click="viewMode = 'grid'"
            :title="t('media.gridView')"
          >
            <i class="fas fa-th-large"></i>
          </button>
          <button
            :class="['toggle-btn', { active: viewMode === 'list' }]"
            @click="viewMode = 'list'"
            :title="t('media.listView')"
          >
            <i class="fas fa-bars"></i>
          </button>
        </div>

        <button class="btn-outline" @click="rescanLibrary" :disabled="scanStore.isScanning">
          <span v-if="!scanStore.isScanning">
            <i class="fas fa-sync-alt"></i> {{ t("home.rescan") }}
          </span>
          <span v-else class="scanning">
            <span class="spinner"></span> {{ t("media.scanning") }}
          </span>
        </button>

        <button class="accent-btn" @click="addFolder" :disabled="scanStore.isScanning">
          <i class="fas fa-plus btn-icon"></i>
          {{ t("home.import.addFolder") }}
        </button>
      </div>
      <button v-else class="accent-btn" @click="addFolder" :disabled="scanStore.isScanning">
        <i class="fas fa-plus btn-icon"></i>
        {{ t("home.import.addFolder") }}
      </button>
    </div>

    <!-- Scan Progress -->
    <div v-if="scanStore.isScanning" class="scan-progress-panel">
      <div class="scan-progress-row">
        <div class="scan-progress-track">
          <div class="scan-progress-fill" :style="{ width: scanStore.progress.pct + '%' }"></div>
        </div>
        <span class="scan-progress-pct">{{ scanStore.progress.pct }}%</span>
      </div>
      <div class="scan-progress-status">
        <span v-if="scanStore.progress.total">
          {{ t("media.scanningProgress", { current: scanStore.progress.current, total: scanStore.progress.total }) }}
        </span>
        <span v-else>{{ t("media.scanningPreparing") }}</span>
        <span v-if="scanStore.progress.message" class="scan-progress-file"> — {{ scanStore.progress.message }}</span>
      </div>
    </div>

    <!-- Grid View -->
    <div v-if="viewMode === 'grid' && folders.length > 0" class="folder-grid">
      <div v-for="folder in paginatedFolders" :key="folder.id" class="folder-card">
        <div class="folder-card-top">
          <div class="folder-icon-tile"><i class="fas fa-folder"></i></div>
          <button
            class="folder-card-delete"
            @click="removeFolder(folder.path)"
            :disabled="removingFolders.has(folder.path) || scanStore.isFolderScanning(folder.path)"
            :title="t('table.removeFolder')"
          >
            <span v-if="removingFolders.has(folder.path)" class="spinner"></span>
            <i v-else class="fas fa-trash-can"></i>
          </button>
        </div>
        <div class="folder-card-name" :title="folder.path">
          {{ getFolderName(folder.path) }}
        </div>
        <div class="folder-card-path">{{ folder.path }}</div>
        <span v-if="scanStore.isFolderScanning(folder.path)" class="folder-scanning-badge">
          <span class="spinner"></span> {{ t("media.scanning") }}
        </span>
        <div class="folder-card-divider"></div>
        <div class="folder-card-footer">
          <span>{{ folder.trackCount || 0 }} {{ t("labels.tracks") }}</span>
          <span>{{ formatSize(folder.totalSize) }}</span>
        </div>
      </div>
    </div>

    <!-- List View -->
    <div v-if="viewMode === 'list' && folders.length > 0" class="folder-table-wrapper">
      <table class="folder-table">
        <thead>
          <tr>
            <th>{{ t("table.folderHeader") }}</th>
            <th class="col-tracks">{{ t("media.tracksHeader") }}</th>
            <th class="col-size">{{ t("media.sizeHeader") }}</th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="folder in paginatedFolders" :key="folder.id" class="folder-row">
            <td>
              <div class="folder-row-info">
                <div class="folder-icon-tile"><i class="fas fa-folder"></i></div>
                <div>
                  <div class="folder-row-name">{{ getFolderName(folder.path) }}</div>
                  <div class="folder-row-path">{{ folder.path }}</div>
                  <span v-if="scanStore.isFolderScanning(folder.path)" class="folder-scanning-badge">
                    <span class="spinner"></span> {{ t("media.scanning") }}
                  </span>
                </div>
              </div>
            </td>
            <td class="col-tracks">{{ folder.trackCount || 0 }}</td>
            <td class="col-size">{{ formatSize(folder.totalSize) }}</td>
            <td class="col-actions">
              <button
                class="folder-row-delete"
                @click="removeFolder(folder.path)"
                :disabled="removingFolders.has(folder.path) || scanStore.isFolderScanning(folder.path)"
                :title="t('table.removeFolder')"
              >
                <span v-if="removingFolders.has(folder.path)" class="spinner"></span>
                <i v-else class="fas fa-trash-can"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div v-if="folders.length === 0" class="folder-empty-state">
      <div class="empty-icon"><i class="fas fa-music"></i></div>
      <div class="empty-text">{{ t("home.emptyCollection") }}</div>
      <div class="empty-subtext">{{ t("library.addFolderCta") }}</div>
    </div>

    <!-- Pagination -->
    <div v-if="totalFolderPages > 1" class="pagination">
      <button class="page-btn" @click="currentPage--" :disabled="currentPage === 1">
        <i class="fas fa-chevron-left"></i>
      </button>
      <span class="page-info">Page {{ currentPage }} of {{ totalFolderPages }}</span>
      <button
        class="page-btn"
        @click="currentPage++"
        :disabled="currentPage === totalFolderPages"
      >
        <i class="fas fa-chevron-right"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import { useI18n } from "vue-i18n"
import { useLibraryScanStore } from "../store/libraryScan.js"

const { t } = useI18n()
const scanStore = useLibraryScanStore()

const folders = ref([])
const viewMode = ref("grid")
const currentPage = ref(1)
const itemsPerPage = ref(12)
const lastScannedAt = ref(null)
const removingFolders = ref(new Set())

const totalFolderPages = computed(() =>
  Math.ceil(folders.value.length / itemsPerPage.value)
)

const paginatedFolders = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return folders.value.slice(start, end)
})

const folderCount = computed(() => folders.value.length)

const totalTracks = computed(() =>
  folders.value.reduce((sum, f) => sum + (f.trackCount || 0), 0)
)

function formatRelativeTime(sqliteDatetime) {
  if (!sqliteDatetime) return ""
  const then = new Date(sqliteDatetime.replace(" ", "T") + "Z").getTime()
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (diffSec < 60) return t("labels.justNow")
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  return `${diffDay}d ago`
}

const lastScannedLabel = computed(() => formatRelativeTime(lastScannedAt.value))

function formatSize(bytes) {
  if (!bytes) return "0 MB"
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${Math.round(mb)} MB`
}

function getFolderName(path) {
  return path.split(/[/\\]/).pop() || path
}

async function loadFolders() {
  folders.value = await window.api.getFolders()
}

async function loadLastScanned() {
  lastScannedAt.value = await window.api.getLastScannedAt()
}

async function addFolder() {
  scanStore.start("add")
  try {
    folders.value = await window.api.addFolder()
    currentPage.value = 1
    await loadLastScanned()
  } finally {
    scanStore.clear()
  }
}

async function removeFolder(path) {
  removingFolders.value.add(path)
  try {
    folders.value = await window.api.removeFolder(path)
    if (paginatedFolders.value.length === 0 && currentPage.value > 1) {
      currentPage.value--
    }
  } finally {
    removingFolders.value.delete(path)
  }
}

async function rescanLibrary() {
  scanStore.start("rescan")
  try {
    folders.value = await window.api.rescanLibrary()
    await loadLastScanned()
    window.api.showToast?.(t("media.rescanComplete"), "success")
  } finally {
    scanStore.clear()
  }
}

onMounted(() => {
  loadFolders()
  loadLastScanned()
})
</script>

<style scoped>
.media-page {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  animation: fadeIn 0.6s ease;
}

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

.media-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: var(--space-6);
}

.media-eyebrow {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  font-weight: 600;
  margin: 0 0 var(--space-1);
}

.media-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--text-color);
  margin: 0 0 var(--space-2);
}

.media-subtitle {
  color: var(--muted-text);
  font-size: var(--font-size-sm);
  max-width: 44rem;
  margin: 0 0 var(--space-3);
}

.media-stats-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.stat-item {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: var(--font-size-sm);
}

.stat-value {
  color: var(--text-color);
  font-weight: 700;
}

.stat-label {
  color: var(--muted-text);
}

.stat-muted {
  color: var(--muted-text);
}

.media-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
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
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.accent-btn:hover {
  background-color: var(--accent-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.btn-icon {
  font-size: 1rem;
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 10px 18px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-sm);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  transition: all 0.2s ease;
}

.btn-outline:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-outline:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* View toggle */
.view-toggle {
  display: flex;
  gap: 2px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 2px;
}

.toggle-btn {
  background: transparent;
  border: none;
  color: var(--muted-text);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  color: var(--text-color);
}

.toggle-btn.active {
  background: var(--accent);
  color: #fff;
}

/* Folder grid view */
.folder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.folder-card {
  background: var(--topbar-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  transition: border-color 0.2s ease;
}

.folder-card:hover {
  border-color: var(--accent);
}

.folder-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.folder-icon-tile {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--hover-bg);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  flex-shrink: 0;
}

.folder-card-delete,
.folder-row-delete {
  background: none;
  border: none;
  color: var(--muted-text);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.folder-card-delete:hover,
.folder-row-delete:hover {
  color: var(--accent);
  background: var(--hover-bg);
}

.folder-card-name {
  font-weight: 600;
  color: var(--text-color);
  margin-top: var(--space-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-card-path {
  font-size: var(--font-size-xs);
  color: var(--muted-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.folder-card-divider {
  height: 1px;
  background: var(--border-color);
  margin: var(--space-3) 0;
}

.folder-card-footer {
  display: flex;
  justify-content: space-between;
  color: var(--muted-text);
  font-size: var(--font-size-sm);
}

/* Folder list view */
.folder-table-wrapper {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: var(--space-6);
}

.folder-table {
  width: 100%;
  border-collapse: collapse;
}

.folder-table th {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted-text);
  font-weight: 600;
  border-bottom: 1px solid var(--border-color);
}

.folder-table td {
  padding: var(--space-3) var(--space-4);
  text-align: left;
}

.folder-row:not(:last-child) td {
  border-bottom: 1px solid var(--border-color);
}

.folder-row:hover {
  background: var(--hover-bg);
}

.col-tracks,
.col-size {
  width: 120px;
  text-align: right;
}

.col-actions {
  width: 50px;
  text-align: center;
}

.folder-row-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.folder-row-name {
  font-weight: 600;
  color: var(--text-color);
  font-size: var(--font-size-sm);
}

.folder-row-path {
  font-size: var(--font-size-xs);
  color: var(--muted-text);
  margin-top: 2px;
}

/* Empty state */
.folder-empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.folder-empty-state .empty-icon {
  font-size: 4rem;
  margin-bottom: var(--space-4);
  opacity: 0.5;
  color: var(--muted-text);
}

.folder-empty-state .empty-text {
  font-size: var(--font-size-lg);
  color: var(--text-color);
  margin-bottom: var(--space-2);
}

.folder-empty-state .empty-subtext {
  color: var(--muted-text);
  font-size: var(--font-size-sm);
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-4);
  margin-top: var(--space-4);
  margin-bottom: var(--space-6);
}

.page-btn {
  background: var(--topbar-bg);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 8px 14px;
  border-radius: var(--radius-sm);
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
  font-size: var(--font-size-sm);
}

.scanning {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Scan progress panel */
.scan-progress-panel {
  margin-bottom: var(--space-6);
}

.scan-progress-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.scan-progress-track {
  flex: 1;
  height: 3px;
  border-radius: 3px;
  background: var(--border-color);
  overflow: hidden;
}

.scan-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  filter: drop-shadow(0 0 4px var(--accent));
  transition: width 0.2s ease;
}

.scan-progress-pct {
  font-size: var(--font-size-xs);
  color: var(--muted-text);
  font-variant-numeric: tabular-nums;
  min-width: 2.5em;
  text-align: right;
}

.scan-progress-status {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--muted-text);
}

.scan-progress-file {
  color: var(--text-color);
}

.folder-scanning-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: var(--space-2);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--hover-bg);
  color: var(--accent);
  font-size: var(--font-size-xs);
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .media-page {
    padding: 1rem;
  }

  .media-title {
    font-size: 1.75rem;
  }

  .media-header {
    flex-direction: column;
  }

  .media-controls {
    flex-wrap: wrap;
  }

  .folder-grid {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-3);
  }
}
</style>
