<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const emit = defineEmits<{ (e: 'complete'): void }>();

const BOOT_MESSAGES = [
  { text: 'GATRIX FEATURE FLAGS SYSTEM', delay: 0 },
  { text: 'VERSION 1.0.0', delay: 200 },
  { text: '', delay: 350 },
  { text: 'INITIALIZING MEMORY... OK', delay: 500 },
  { text: 'CHECKING API CONNECTION... OK', delay: 800 },
  { text: 'LOADING SDK MODULES... OK', delay: 1100 },
  { text: 'CONFIGURING FEATURE CLIENT...', delay: 1400 },
  { text: 'PREPARING DASHBOARD... OK', delay: 1700 },
  { text: '', delay: 2000 },
  { text: 'SYSTEM READY!', delay: 2200 },
];

const MIN_BOOT_TIME = 3000;

const visibleLines = ref(0);
const progress = ref(0);

let progressInterval: ReturnType<typeof setInterval>;
let completeTimeout: ReturnType<typeof setTimeout>;
const timers: ReturnType<typeof setTimeout>[] = [];

onMounted(() => {
  // Show messages one by one
  BOOT_MESSAGES.forEach((msg, index) => {
    const t = setTimeout(() => { visibleLines.value = index + 1; }, msg.delay);
    timers.push(t);
  });

  // Progress bar animation
  progressInterval = setInterval(() => {
    if (progress.value >= 100) {
      clearInterval(progressInterval);
    } else {
      progress.value++;
    }
  }, 30);

  // Complete after minimum boot time
  completeTimeout = setTimeout(() => { emit('complete'); }, MIN_BOOT_TIME);
});

onUnmounted(() => {
  clearInterval(progressInterval);
  clearTimeout(completeTimeout);
  timers.forEach((t) => clearTimeout(t));
});

const visibleMessages = () => BOOT_MESSAGES.slice(0, visibleLines.value);
</script>

<template>
  <div class="boot-screen">
    <div class="boot-logo">
      <i class="nes-icon trophy is-large"></i>
    </div>

    <div style="min-height: 250px">
      <div
        v-for="(msg, index) in visibleMessages()"
        :key="index"
        class="boot-text"
        :style="{ animationDelay: msg.delay + 'ms' }"
      >
        {{ msg.text || '\u00A0' }}
        <span v-if="index === visibleLines - 1 && msg.text" class="boot-cursor">_</span>
      </div>
    </div>

    <div class="boot-progress">
      <progress class="nes-progress is-success" :value="progress" max="100"></progress>
    </div>

    <div class="boot-text dim" style="margin-top: 24px">
      NOW LOADING...
    </div>
  </div>
</template>
