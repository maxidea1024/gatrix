<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const emit = defineEmits<{ (e: 'complete'): void }>();

const DISCONNECT_MESSAGES = [
  { text: 'DISCONNECTING FROM GATRIX...', delay: 0 },
  { text: '', delay: 300 },
  { text: 'SAVING SESSION DATA... OK', delay: 500 },
  { text: 'CLOSING CONNECTIONS... OK', delay: 1000 },
  { text: 'CLEARING CACHE... OK', delay: 1500 },
  { text: '', delay: 1800 },
  { text: 'GOODBYE!', delay: 2000 },
];

const visibleMessages = ref<string[]>([]);
const showGoodbye = ref(false);
const timers: ReturnType<typeof setTimeout>[] = [];

onMounted(() => {
  DISCONNECT_MESSAGES.forEach((msg) => {
    const t = setTimeout(() => {
      visibleMessages.value.push(msg.text);
    }, msg.delay);
    timers.push(t);
  });

  timers.push(setTimeout(() => { showGoodbye.value = true; }, 2200));
  timers.push(setTimeout(() => { emit('complete'); }, 4700));
});

onUnmounted(() => { timers.forEach((t) => clearTimeout(t)); });
</script>

<template>
  <div
    :style="{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', backgroundColor: '#212529', color: '#fff',
      fontFamily: '\'Press Start 2P\', cursive', textAlign: 'center', padding: '24px',
    }"
  >
    <div style="min-height: 200px; margin-bottom: 24px">
      <div
        v-for="(msg, i) in visibleMessages"
        :key="i"
        :style="{
          fontSize: '10px', marginBottom: '8px',
          color: msg === 'GOODBYE!' ? '#e76e55' : '#adafbc',
        }"
      >
        {{ msg || '\u00A0' }}
      </div>
      <div v-if="showGoodbye" style="margin-top: 16px; animation: sad-sway 1s ease-in-out infinite">
        <i class="nes-bcrikko"></i>
      </div>
    </div>
  </div>
</template>
