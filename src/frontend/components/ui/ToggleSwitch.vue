<template>
  <button
    class="toggle-switch"
    :class="{ active: modelValue }"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span class="toggle-knob"></span>
  </button>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, required: true },
  disabled: { type: Boolean, default: false },
})
defineEmits(["update:modelValue"])
</script>

<style scoped>
.toggle-switch {
  width: 52px;
  height: 28px;
  border-radius: var(--radius-full);
  border: none;
  background: var(--border-color);
  cursor: pointer;
  position: relative;
  padding: 3px;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.toggle-switch.active {
  background: var(--accent);
}

.toggle-switch:disabled {
  opacity: 0.5;
  cursor: default;
}

.toggle-knob {
  display: block;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s ease;
}

.toggle-switch.active .toggle-knob {
  transform: translateX(24px);
}
</style>
