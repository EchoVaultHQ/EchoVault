<template>
  <div class="setting-card">
    <div class="setting-label">
      <slot name="icon" />
      <div>
        <h3>{{ title }}</h3>
        <p v-if="description">{{ description }}</p>
      </div>
      <slot name="actions" />
    </div>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: "" },
})
</script>

<style scoped>
.setting-card {
  background: var(--side-nav-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 2rem;
  margin-bottom: 1.5rem;
  transition: all 0.2s ease;
}

.setting-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-md);
}

.setting-label {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.setting-label :deep(svg) {
  color: var(--accent);
  margin-top: 0.25rem;
  flex-shrink: 0;
}

.setting-label h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 0.25rem 0;
}

.setting-label p {
  font-size: 0.9rem;
  color: var(--muted-text);
  margin: 0;
}

.setting-label > :last-child:not(div) {
  margin-left: auto;
  align-self: center;
}
</style>
