import { ref, computed, watch } from "vue"

export const SORT_FIELDS = ["default", "name", "artist", "album", "duration"]

export function useTrackSort(tracksRef, storageKey) {
  const stored = JSON.parse(localStorage.getItem(storageKey) || "null")
  const sortField = ref(stored?.field ?? "default")
  const sortDirection = ref(stored?.direction ?? "asc")

  watch([sortField, sortDirection], () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ field: sortField.value, direction: sortDirection.value })
    )
  })

  const sortedTracks = computed(() => {
    const list = tracksRef.value
    if (sortField.value === "default") return list
    const dir = sortDirection.value === "desc" ? -1 : 1
    const key = sortField.value === "name" ? "title" : sortField.value
    return [...list].sort((a, b) => {
      if (key === "duration") return ((a.duration ?? 0) - (b.duration ?? 0)) * dir
      return String(a[key] ?? "").localeCompare(String(b[key] ?? "")) * dir
    })
  })

  function setSortField(field) {
    sortField.value = field
  }

  function setSortDirection(direction) {
    sortDirection.value = direction
  }

  return { sortField, sortDirection, sortedTracks, setSortField, setSortDirection }
}
