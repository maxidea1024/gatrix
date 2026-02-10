<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';

export interface LogEntry {
  id: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  args: any[];
}

const props = defineProps<{
  logs: LogEntry[];
}>();

const emit = defineEmits<{ (e: 'close'): void; (e: 'clear'): void }>();

const filterLevel = ref<'all' | 'debug' | 'info' | 'warn' | 'error'>('all');
const searchQuery = ref('');
const autoScroll = ref(true);
const logListRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const savedWidth = parseInt(localStorage.getItem('gatrix-log-panel-width') || '420', 10);
const panelWidth = ref(savedWidth);
const isResizing = ref(false);

// Resize logic
function onResizeStart(e: MouseEvent) {
  e.preventDefault();
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = panelWidth.value;

  function onMouseMove(ev: MouseEvent) {
    // Dragging left edge = smaller clientX means wider panel
    const delta = startX - ev.clientX;
    const newWidth = Math.max(280, Math.min(window.innerWidth * 0.7, startWidth + delta));
    panelWidth.value = newWidth;
  }

  function onMouseUp() {
    isResizing.value = false;
    localStorage.setItem('gatrix-log-panel-width', String(Math.round(panelWidth.value)));
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

const filteredLogs = computed(() => {
  let result = props.logs;
  if (filterLevel.value !== 'all') {
    result = result.filter((l) => l.level === filterLevel.value);
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter((l) => l.message.toLowerCase().includes(q));
  }
  return result;
});

function getLevelColor(level: string): string {
  switch (level) {
    case 'debug': return '#adafbc';
    case 'info': return '#209cee';
    case 'warn': return '#f7d51d';
    case 'error': return '#e76e55';
    default: return '#fff';
  }
}

function getLevelIcon(level: string): string {
  switch (level) {
    case 'debug': return '⚙';
    case 'info': return 'ℹ';
    case 'warn': return '⚠';
    case 'error': return '✕';
    default: return '•';
  }
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function formatArgs(args: any[]): string {
  if (!args || args.length === 0) return '';
  return args.map((a) => {
    try {
      if (typeof a === 'object') return JSON.stringify(a);
      return String(a);
    } catch { return String(a); }
  }).join(' ');
}

const countByLevel = computed(() => {
  const counts = { debug: 0, info: 0, warn: 0, error: 0 };
  for (const log of props.logs) {
    counts[log.level]++;
  }
  return counts;
});

// Auto-scroll when new logs come in
watch(() => props.logs.length, () => {
  if (autoScroll.value) {
    nextTick(() => {
      const el = logListRef.value;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
});
</script>

<template>
  <div
    ref="panelRef"
    class="log-panel"
    :style="{ width: panelWidth + 'px' }"
  >
    <!-- Resize handle -->
    <div
      class="log-panel-resize-handle"
      @mousedown="onResizeStart"
      :class="{ resizing: isResizing }"
    ></div>

    <!-- Header -->
    <div class="log-panel-header">
      <div style="display: flex; align-items: center; gap: 8px">
        <span style="color: #92cc41; font-size: 10px">SDK LOGS</span>
        <span style="font-size: 7px; color: #adafbc">
          ({{ filteredLogs.length }}/{{ logs.length }})
        </span>
      </div>
      <div style="display: flex; gap: 6px; align-items: center">
        <label class="log-panel-autoscroll">
          <input type="checkbox" v-model="autoScroll" />
          <span>AUTO</span>
        </label>
        <button type="button" class="nes-btn is-warning" @click="emit('clear')"
          style="font-size: 7px; padding: 2px 6px">CLR</button>
        <button type="button" class="nes-btn is-error" @click="emit('close')"
          style="font-size: 7px; padding: 2px 6px">✕</button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="log-panel-toolbar">
      <button
        v-for="level in (['all', 'debug', 'info', 'warn', 'error'] as const)"
        :key="level"
        type="button"
        :class="['log-filter-btn', filterLevel === level ? 'active' : '']"
        :style="{ color: level === 'all' ? '#fff' : getLevelColor(level) }"
        @click="filterLevel = level"
      >
        {{ level === 'all' ? `ALL` : `${level.toUpperCase()}` }}
        <span class="log-filter-count">{{ level === 'all' ? logs.length : countByLevel[level] }}</span>
      </button>
      <div style="flex: 1"></div>
      <input type="text" class="nes-input is-dark log-panel-search" v-model="searchQuery"
        placeholder="Filter..." />
    </div>

    <!-- Log list -->
    <div ref="logListRef" class="log-panel-list">
      <div v-if="filteredLogs.length === 0" class="log-panel-empty">
        {{ logs.length === 0 ? 'NO LOGS YET...' : 'NO MATCHING LOGS' }}
      </div>

      <div
        v-for="entry in filteredLogs"
        :key="entry.id"
        :class="['log-entry', `log-entry-${entry.level}`]"
      >
        <span class="log-entry-time">{{ formatTime(entry.timestamp) }}</span>
        <span class="log-entry-icon" :style="{ color: getLevelColor(entry.level) }">
          {{ getLevelIcon(entry.level) }}
        </span>
        <span class="log-entry-msg" :style="{ color: getLevelColor(entry.level) }">
          {{ entry.message }}
          <span v-if="entry.args.length" class="log-entry-args">
            {{ formatArgs(entry.args) }}
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.log-panel {
  display: flex;
  flex-direction: column;
  background-color: #0d1117;
  border-left: 4px solid #333;
  animation: slide-in-right 0.2s ease-out;
  overflow: hidden;
  position: relative;
}

@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.log-panel-resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 10;
  background: transparent;
  transition: background-color 0.15s;
}

.log-panel-resize-handle:hover,
.log-panel-resize-handle.resizing {
  background-color: #92cc41;
}

.log-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 4px solid #333;
  background-color: #1a1c1e;
  flex-shrink: 0;
}

.log-panel-autoscroll {
  font-size: 6px;
  color: #adafbc;
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
}

.log-panel-autoscroll input {
  width: 12px;
  height: 12px;
}

.log-panel-toolbar {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 2px solid #1a1c1e;
  align-items: center;
  background-color: #151920;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.log-filter-btn {
  background: none;
  border: 2px solid #333;
  padding: 4px 8px;
  font-size: 8px;
  cursor: pointer;
  font-family: 'Press Start 2P', cursive;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0.5;
  transition: opacity 0.15s;
}

.log-filter-btn.active {
  opacity: 1;
  border-color: #92cc41;
  background-color: rgba(146, 204, 65, 0.1);
}

.log-filter-btn:hover {
  opacity: 0.8;
}

.log-filter-count {
  font-size: 7px;
  opacity: 0.6;
}

.log-panel-search {
  width: 140px;
  font-size: 9px !important;
  padding: 4px 8px !important;
  height: 30px !important;
}

.log-panel-list {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.log-panel-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #adafbc;
  font-size: 9px;
  font-family: 'Press Start 2P', cursive;
}

.log-entry {
  display: flex;
  gap: 6px;
  padding: 2px 8px;
  font-size: 9px;
  line-height: 1.5;
  border-bottom: 1px solid #1a1c1e;
  font-family: 'Courier New', Consolas, monospace;
}

.log-entry-error {
  background-color: rgba(231, 110, 85, 0.08);
}

.log-entry-warn {
  background-color: rgba(247, 213, 29, 0.04);
}

.log-entry-time {
  color: #555;
  flex-shrink: 0;
  font-size: 8px;
  min-width: 80px;
}

.log-entry-icon {
  flex-shrink: 0;
  width: 12px;
  text-align: center;
}

.log-entry-msg {
  word-break: break-all;
  flex: 1;
}

.log-entry-args {
  color: #555;
  margin-left: 4px;
}
</style>
