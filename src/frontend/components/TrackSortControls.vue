<template>
  <div class="sort-controls">
    <div class="sort-dropdown">
      <button class="sort-btn" @click="fieldOpen = !fieldOpen" @blur="onFieldBlur">
        <ArrowUpDown :size="14" />
        <span>{{ t(`sort.${sortField}`) }}</span>
        <ChevronDown :size="14" />
      </button>
      <div v-if="fieldOpen" class="sort-menu">
        <div
          v-for="field in SORT_FIELDS"
          :key="field"
          class="sort-menu-item"
          :class="{ active: field === sortField }"
          @mousedown.prevent="selectField(field)"
        >
          {{ t(`sort.${field}`) }}
        </div>
      </div>
    </div>

    <div class="sort-dropdown" :class="{ disabled: sortField === 'default' }">
      <button
        class="sort-btn"
        :disabled="sortField === 'default'"
        @click="directionOpen = !directionOpen"
        @blur="onDirectionBlur"
      >
        <ArrowUpDown :size="14" />
        <span>{{ t(`sort.${sortDirection === 'desc' ? 'descending' : 'ascending'}`) }}</span>
        <ChevronDown :size="14" />
      </button>
      <div v-if="directionOpen" class="sort-menu">
        <div
          class="sort-menu-item"
          :class="{ active: sortDirection === 'asc' }"
          @mousedown.prevent="selectDirection('asc')"
        >
          {{ t("sort.ascending") }}
        </div>
        <div
          class="sort-menu-item"
          :class="{ active: sortDirection === 'desc' }"
          @mousedown.prevent="selectDirection('desc')"
        >
          {{ t("sort.descending") }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue"
import { useI18n } from "vue-i18n"
import { ArrowUpDown, ChevronDown } from "@lucide/vue"
import { SORT_FIELDS } from "../utils/useTrackSort.js"

const { t } = useI18n()

defineProps({
  sortField: { type: String, required: true },
  sortDirection: { type: String, required: true },
})
const emit = defineEmits(["update:sortField", "update:sortDirection"])

const fieldOpen = ref(false)
const directionOpen = ref(false)

function selectField(field) {
  emit("update:sortField", field)
  fieldOpen.value = false
}

function selectDirection(direction) {
  emit("update:sortDirection", direction)
  directionOpen.value = false
}

function onFieldBlur() {
  setTimeout(() => (fieldOpen.value = false), 0)
}

function onDirectionBlur() {
  setTimeout(() => (directionOpen.value = false), 0)
}
</script>

<style scoped>
.sort-controls {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  margin-bottom: var(--space-3);
}

.sort-dropdown {
  position: relative;
}

.sort-dropdown.disabled {
  opacity: 0.5;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--side-nav-bg);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
}

.sort-btn:disabled {
  cursor: not-allowed;
}

.sort-btn:hover:not(:disabled) {
  background: var(--hover-bg);
}

.sort-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  min-width: 160px;
  background: var(--side-nav-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 6px 0;
  z-index: 20;
}

.sort-menu-item {
  padding: 8px 14px;
  font-size: 14px;
  cursor: pointer;
}

.sort-menu-item:hover {
  background: var(--hover-bg);
}

.sort-menu-item.active {
  color: var(--accent);
  font-weight: 600;
}
</style>
