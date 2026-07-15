<template>
  <transition name="slide-fade">
    <div v-if="player.showLyricsPanel" class="lyrics-panel">
      <div class="lyrics-panel-header">
        <span class="lyrics-panel-title">{{ t("labels.showLyrics") }}</span>
        <button
          class="lyrics-close-btn"
          :title="t('common.close')"
          @click="player.toggleLyricsPanel()"
        >
          <X :size="18" />
        </button>
      </div>
      <div class="lyrics-panel-body">
        <div v-if="!player.currentTrack?.file_path" class="no-lyrics">
          {{ t('labels.noTrackSelected') }}
        </div>
        <div v-else-if="hasLyrics" class="lyrics-scroll-area">
          <template v-if="player.lyrics.synchronized && player.lyrics.timestamps?.length">
            <div
              v-for="slot in visibleWindow"
              :key="slot.key"
              class="lyric-line"
              :class="`dist-${slot.distance}`"
              v-memo="[slot.line?.text, slot.distance]"
            >
              {{ slot.line?.text }}
            </div>
          </template>
          <template v-else>
            <div v-for="(line, idx) in plainLyricLines" :key="idx" class="lyric-line plain">
              {{ line }}
            </div>
          </template>
        </div>
        <div v-else class="no-lyrics">{{ t('labels.noLyricsFound') }}</div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { useI18n } from "vue-i18n"
import { X } from "@lucide/vue"
import { usePlayerStore } from "../store/player.js"
import { useLyricsSync } from "../utils/playerUtils.js"

const { t } = useI18n()
const player = usePlayerStore()
// Wider radius than ImmersiveMode's fullscreen view — this panel has no
// artwork column competing for space, so more context lines fill it instead
// of leaving the block centered with dead space above/below.
const { hasLyrics, plainLyricLines, visibleWindow } = useLyricsSync(player, 9)
</script>

<style scoped>
.lyrics-panel {
  width: 360px;
  flex-shrink: 0;
  height: 100%;
  background-color: var(--content-bg);
  border-left: 2px solid var(--border-color);
  color: var(--text-color);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.5);
}

.lyrics-panel-header {
  height: 56px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.lyrics-panel-title {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted-text);
}

.lyrics-close-btn {
  width: 32px;
  height: 32px;
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
    color 0.2s ease;
}

.lyrics-close-btn:hover {
  background: var(--hover-bg);
  color: var(--text-color);
}

.lyrics-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.lyrics-scroll-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.lyric-line {
  transition:
    transform 500ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 450ms ease,
    color 450ms ease;
  will-change: transform, opacity;
  transform-origin: left center;
}

.lyric-line.dist-2,
.lyric-line.dist-3 {
  font-size: 18px;
  color: var(--muted-text);
  opacity: 0.4;
}

.lyric-line.dist-1 {
  font-size: 21px;
  color: var(--muted-text);
  opacity: 0.7;
}

.lyric-line.dist-0 {
  font-size: 26px;
  font-weight: 700;
  color: var(--accent);
  opacity: 1;
}

.lyric-line.plain {
  font-size: 19px;
  font-weight: 500;
  line-height: 1.6;
  color: var(--text-color);
  opacity: 0.9;
}

.no-lyrics {
  color: var(--muted-text);
  font-size: 0.95rem;
  text-align: center;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

@media (max-width: 768px) {
  .lyrics-panel {
    width: 100%;
    height: 60vh;
    position: fixed;
    bottom: 80px;
    right: 0;
    left: 0;
    border-left: none;
    border-top: 2px solid var(--border-color);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.4);
    z-index: 9999;
  }
}
</style>
