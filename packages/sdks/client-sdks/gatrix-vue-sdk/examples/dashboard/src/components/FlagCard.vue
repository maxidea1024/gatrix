<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useGatrixClient } from '@gatrix/vue-sdk';
import type { EvaluatedFlag } from '@gatrix/js-client-sdk';

const props = defineProps<{
  flag: EvaluatedFlag;
  viewMode: 'detailed' | 'simple' | 'list';
  initialVersion: number | null;
  lastChangedTime: Date | null;
}>();

const emit = defineEmits<{ (e: 'select'): void }>();

const client = useGatrixClient();
const isUpdating = ref(false);
const prevVersion = ref(props.flag.version);
const isInitialMount = ref(true);
const timeAgo = ref('-');

function formatTimeAgo(date: Date | null): string {
  if (!date) return '-';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  if (diffSec > 5) return `${diffSec}s ago`;
  return 'just now';
}

function formatPayload(p: unknown): string {
  if (p === '') return 'EMPTY STRING';
  if (typeof p === 'object') {
    const str = JSON.stringify(p, null, 2);
    return str.length > 80 ? str.substring(0, 77) + '...' : str;
  }
  return String(p);
}

function getPayloadSize(p: unknown): number {
  if (p === undefined || p === null) return 0;
  const str = typeof p === 'object' ? JSON.stringify(p) : String(p);
  return new Blob([str]).size;
}

const payload = computed(() => props.flag.variant?.payload);
const hasPayload = computed(() => payload.value !== undefined && payload.value !== null);
const isEmptyString = computed(() => payload.value === '');
const payloadSize = computed(() => hasPayload.value ? getPayloadSize(payload.value) : 0);
const changeCount = computed(() =>
  props.initialVersion !== null ? Math.max(0, (props.flag.version || 0) - props.initialVersion) : 0,
);

// Register flag access for metrics
watch(() => props.flag.version, () => {
  client.features.isEnabled(props.flag.name);
});

// Flash on version change
watch(() => props.flag.version, (newVer) => {
  if (isInitialMount.value) {
    isInitialMount.value = false;
    prevVersion.value = newVer;
    return;
  }
  if (prevVersion.value !== newVer) {
    prevVersion.value = newVer;
    isUpdating.value = true;
    setTimeout(() => { isUpdating.value = false; }, 500);
  }
});

// Update time ago
let timeAgoInterval: ReturnType<typeof setInterval>;

onMounted(() => {
  client.features.isEnabled(props.flag.name);
  timeAgo.value = formatTimeAgo(props.lastChangedTime);
  timeAgoInterval = setInterval(() => {
    timeAgo.value = formatTimeAgo(props.lastChangedTime);
  }, 1000);
});

onUnmounted(() => { clearInterval(timeAgoInterval); });

watch(() => props.lastChangedTime, (val) => {
  timeAgo.value = formatTimeAgo(val);
});
</script>

<template>
  <!-- List View -->
  <div v-if="viewMode === 'list'"
    :class="['flag-list-item', isUpdating ? 'flag-card-flash' : '', flag.enabled ? 'is-enabled' : 'is-disabled']"
    @click="emit('select')">
    <div class="col-name">
      <span class="status-dot"></span>
      {{ flag.name }}
    </div>
    <div class="col-status">
      <span :class="`badge is-small ${flag.enabled ? 'badge-success' : 'badge-error'}`">
        {{ flag.enabled ? 'ON' : 'OFF' }}
      </span>
    </div>
    <div class="col-version">{{ flag.version || 0 }}</div>
    <div class="col-changes">
      <span v-if="changeCount > 0" class="has-changes">+{{ changeCount }}</span>
      <span v-else>-</span>
    </div>
    <div class="col-time">{{ timeAgo }}</div>
    <div class="col-type">
      <span class="pixel-chip type-chip is-mini">{{ flag.variantType || 'none' }}</span>
    </div>
    <div class="col-variant">
      <span class="pixel-chip variant-chip is-mini">{{ flag.variant?.name || '-' }}</span>
    </div>
    <div class="col-payload">
      <span class="payload-preview">{{ hasPayload ? formatPayload(payload) : '-' }}</span>
    </div>
  </div>

  <!-- Simple View -->
  <div v-else-if="viewMode === 'simple'"
    :class="['flag-card', 'simple-mode', isUpdating ? 'flag-card-flash' : '']"
    @click="emit('select')" :title="flag.name">
    <div :class="['flag-card-inner', flag.enabled ? 'is-enabled' : 'is-disabled']">
      <div class="flag-header">
        <span class="flag-name" style="font-size: 10px">
          <span class="status-dot"></span> {{ flag.name }}
        </span>
        <span class="pixel-chip type-chip is-mini" style="font-size: 6px">
          {{ flag.variantType || 'none' }}
        </span>
      </div>
      <div class="flag-details" style="margin-top: 0">
        <div class="flag-detail" style="padding-bottom: 0; margin-bottom: 0; border-bottom: none">
          <span class="pixel-chip variant-chip is-mini"
            style="font-size: 8px; width: 100%; text-align: center; color: #000; font-weight: bold">
            {{ flag.variant?.name || '-' }}
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- Detailed View -->
  <div v-else
    :class="['flag-card', isUpdating ? 'flag-card-flash' : '']"
    @click="emit('select')" style="cursor: pointer">
    <div :class="['flag-card-inner', flag.enabled ? 'is-enabled' : 'is-disabled']">
      <div class="flag-header">
        <span class="flag-name">
          <span class="status-dot"></span> {{ flag.name }}
        </span>
        <span :class="`badge ${flag.enabled ? 'badge-success' : 'badge-error'}`">
          {{ flag.enabled ? 'ON' : 'OFF' }}
        </span>
      </div>

      <div class="flag-details">
        <div class="flag-detail">
          <span class="flag-detail-label">Version</span>
          <span class="flag-detail-value">{{ flag.version || 0 }}</span>
        </div>
        <div class="flag-detail">
          <span class="flag-detail-label">Changes</span>
          <span :class="`flag-detail-value ${changeCount > 0 ? 'has-changes' : ''}`">
            {{ changeCount > 0 ? `+${changeCount}` : '-' }}
          </span>
        </div>
        <div class="flag-detail">
          <span class="flag-detail-label">Last Change</span>
          <span class="flag-detail-value">{{ timeAgo }}</span>
        </div>
        <div class="flag-detail">
          <span class="flag-detail-label">Type</span>
          <span class="flag-detail-value">
            <span class="pixel-chip type-chip">{{ flag.variantType || 'none' }}</span>
          </span>
        </div>
        <div class="flag-detail">
          <span class="flag-detail-label">Variant</span>
          <span class="flag-detail-value">
            <span class="pixel-chip variant-chip">{{ flag.variant?.name || '-' }}</span>
          </span>
        </div>

        <div class="flag-payload">
          <div class="flag-payload-label">Payload</div>
          <template v-if="hasPayload">
            <div :class="`flag-payload-value ${isEmptyString ? 'empty-string' : 'has-payload'}`">
              {{ formatPayload(payload) }}
            </div>
            <div class="flag-payload-size">{{ payloadSize }} BYTES</div>
          </template>
          <div v-else class="flag-payload-value no-payload">✕ NO PAYLOAD</div>
        </div>
      </div>
    </div>
  </div>
</template>
