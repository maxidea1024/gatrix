<script setup lang="ts">
defineProps<{ title: string; message: string }>();
const emit = defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>();
</script>

<template>
  <div class="confirm-overlay">
    <div class="nes-container is-dark with-title confirm-dialog rumble-on-pop">
      <p class="title" style="background-color: #000">{{ title }}</p>
      <p class="confirm-message">{{ message }}</p>
      <div class="confirm-buttons" style="display: flex; gap: 12px; justify-content: center">
        <button type="button" class="nes-btn" @click="emit('cancel')">CANCEL</button>
        <button type="button" class="nes-btn is-error" @click="emit('confirm')">POWER OFF</button>
      </div>
    </div>
  </div>
</template>
