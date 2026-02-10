<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useFlags, useGatrixClient, useFlagsStatus, useFetchFlags, useSyncFlags } from '@gatrix/vue-sdk';
import type { GatrixClientConfig, EvaluatedFlag } from '@gatrix/js-client-sdk';
import FlagCard from './FlagCard.vue';
import StatsPanel from './StatsPanel.vue';
import FlagDetailModal from './FlagDetailModal.vue';

const props = defineProps<{ config: GatrixClientConfig }>();

const flags = useFlags();
const client = useGatrixClient();
const { ready: flagsReady, error: flagsError } = useFlagsStatus();
const fetchFlags = useFetchFlags();
const syncFlags = useSyncFlags();

const lastUpdate = ref<Date | null>(null);
const stats = ref<any>(null);
const initialVersions = ref(new Map<string, number>());
const showRecoveryEffect = ref(false);
const showErrorEffect = ref(false);
const prevSdkState = ref<string | null>(null);
const context = ref<Record<string, any>>({});
const isFetching = ref(false);
const viewMode = ref<'detailed' | 'simple' | 'list'>(
  (localStorage.getItem('gatrix-dashboard-view-mode') as any) || 'simple',
);
const searchInput = ref('');
const searchQuery = ref('');
const selectedFlag = ref<EvaluatedFlag | null>(null);

let searchTimer: ReturnType<typeof setTimeout>;
let statsInterval: ReturnType<typeof setInterval>;

function handleSearchChange(value: string) {
  searchInput.value = value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { searchQuery.value = value.toLowerCase(); }, 300);
}

function updateStats() {
  const clientStats = client.getStats();
  const flatStats = { ...clientStats.features, ...clientStats };
  stats.value = flatStats;
  if (clientStats.features?.lastFetchTime) {
    lastUpdate.value = clientStats.features.lastFetchTime;
  }
  context.value = client.features.getContext();
}

function handleReady() {
  const currentFlags = client.features.getAllFlags();
  const newMap = new Map<string, number>();
  for (const flag of currentFlags) {
    if (!initialVersions.value.has(flag.name)) {
      newMap.set(flag.name, flag.version || 0);
    } else {
      newMap.set(flag.name, initialVersions.value.get(flag.name)!);
    }
  }
  initialVersions.value = newMap;
  updateStats();
}

function onFetchStart() { isFetching.value = true; }
function onFetchEnd() { isFetching.value = false; }

onMounted(() => {
  updateStats();
  client.on('flags.change', updateStats);
  client.on('flags.ready', handleReady);
  client.on('flags.sync', updateStats);
  client.on('flags.fetch_start', onFetchStart);
  client.on('flags.fetch_end', onFetchEnd);
  client.on('error', updateStats);
  statsInterval = setInterval(updateStats, 1000);
});

onUnmounted(() => {
  client.off('flags.change', updateStats);
  client.off('flags.ready', handleReady);
  client.off('flags.sync', updateStats);
  client.off('flags.fetch_start', onFetchStart);
  client.off('flags.fetch_end', onFetchEnd);
  client.off('error', updateStats);
  clearInterval(statsInterval);
  clearTimeout(searchTimer);
});

// Detect recovery / error state transitions
watch(() => stats.value?.sdkState, (currentState: string | undefined) => {
  if (!currentState) return;
  if (prevSdkState.value === 'error' && (currentState === 'healthy' || currentState === 'ready')) {
    showRecoveryEffect.value = true;
    setTimeout(() => { showRecoveryEffect.value = false; }, 1000);
  } else if (prevSdkState.value !== 'error' && prevSdkState.value !== null && currentState === 'error') {
    showErrorEffect.value = true;
    setTimeout(() => { showErrorEffect.value = false; }, 1000);
  }
  prevSdkState.value = currentState;
});

const filteredFlags = computed(() => {
  if (!searchQuery.value) return flags.value;
  return flags.value.filter((f) => f.name.toLowerCase().includes(searchQuery.value));
});

const enabledCount = computed(() => flags.value.filter((f) => f.enabled).length);
const disabledCount = computed(() => flags.value.filter((f) => !f.enabled).length);

const isInErrorState = computed(() => stats.value?.sdkState === 'error');
const errorMessage = computed(() => {
  if (!isInErrorState.value) return null;
  return flagsError?.value?.message || stats.value?.lastError?.message || 'Unknown error';
});

const isSearching = computed(() => !(flagsReady as any)?.value && flags.value.length === 0);

function isExplicitSync() { return (client.features as any).isExplicitSyncMode?.() ?? false; }
function canSyncFlags() { return (client.features as any).canSyncFlags?.() ?? false; }

function handleViewModeChange(mode: 'detailed' | 'simple' | 'list') {
  localStorage.setItem('gatrix-dashboard-view-mode', mode);
  viewMode.value = mode;
}
</script>

<template>
  <div :class="['dashboard-content', showRecoveryEffect ? 'recovery-shimmer' : '', showErrorEffect ? 'error-shimmer' : '']">
    <FlagDetailModal v-if="selectedFlag" :flag="selectedFlag" @close="selectedFlag = null" />

    <StatsPanel
      :config="config"
      :enabled-count="enabledCount"
      :disabled-count="disabledCount"
      :total-count="flags.length"
      :last-update="lastUpdate"
      :stats="stats"
      :error-message="errorMessage"
      :context="context"
      :flags-ready="(flagsReady as any)?.value ?? false"
    />

    <section class="flags-section">
      <div class="nes-container is-dark with-title">
        <p class="title" style="background-color: #000">
          FEATURE FLAGS ({{ filteredFlags.length }}{{ searchQuery ? `/${flags.length}` : '' }})
        </p>

        <div style="padding: 10px; display: flex; gap: 15px; align-items: center; margin-bottom: 10px">
          <!-- Search input -->
          <div style="flex: 1; position: relative">
            <input type="text" class="nes-input is-dark" :value="searchInput"
              @input="handleSearchChange(($event.target as HTMLInputElement).value)"
              placeholder="Search flags..." style="width: 100%; font-size: 12px" />
            <button v-if="searchInput" type="button"
              @click="searchInput = ''; searchQuery = ''"
              :style="{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#e76e55', cursor: 'pointer',
                fontSize: '16px', fontWeight: 'bold', padding: '4px 8px',
              }" title="Clear search">✕</button>
          </div>

          <!-- Manual Fetch button -->
          <button v-if="!client.features.isOfflineMode() && client.features.getConfig().refreshInterval === 0"
            type="button" :class="`nes-btn is-primary ${isFetching ? 'is-disabled' : ''}`"
            @click="fetchFlags()" :disabled="isFetching" title="Manual Fetch">
            {{ isFetching ? 'FETCHING...' : 'FETCH FLAGS' }}
          </button>

          <!-- Sync button -->
          <button v-if="isExplicitSync() && !client.features.isOfflineMode()"
            type="button" :class="`nes-btn is-warning ${!canSyncFlags() ? 'is-disabled' : 'sync-available-rumble'}`"
            @click="syncFlags()" :disabled="!canSyncFlags()" title="Synchronize Flags">
            SYNC FLAGS
          </button>

          <!-- View mode -->
          <div class="view-mode-selector nes-select is-dark" style="width: 200px">
            <select id="view-mode-select" :value="viewMode"
              @change="handleViewModeChange(($event.target as HTMLSelectElement).value as any)">
              <option value="detailed">Detailed Card</option>
              <option value="simple">Simple Card</option>
              <option value="list">List View</option>
            </select>
          </div>
        </div>

        <!-- Searching state -->
        <div v-if="isSearching" class="searching-state">
          <div class="searching-icon"><span>🔍</span></div>
          <p class="searching-text">WHERE ARE MY FLAGS?... COME BACK!</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="flags.length === 0" class="empty-state">
          <i class="nes-icon is-large heart is-empty"></i>
          <p class="empty-text">NO FEATURE FLAGS FOUND</p>
        </div>

        <!-- Flags display -->
        <div v-else :class="`flags-display-container mode-${viewMode}`">
          <!-- List header -->
          <div v-if="viewMode === 'list'" class="flag-list-header">
            <div class="col-name">NAME</div>
            <div class="col-status">STATUS</div>
            <div class="col-version">VER</div>
            <div class="col-changes">CHG</div>
            <div class="col-time">LAST</div>
            <div class="col-type">TYPE</div>
            <div class="col-variant">VARIANT</div>
            <div class="col-payload">PAYLOAD</div>
          </div>

          <div :class="viewMode === 'list' ? 'flag-list' : 'flags-grid'">
            <FlagCard
              v-for="flag in filteredFlags"
              :key="flag.name"
              :flag="flag"
              :view-mode="viewMode"
              :initial-version="initialVersions.get(flag.name) ?? null"
              :last-changed-time="stats?.flagLastChangedTimes?.[flag.name] ?? null"
              @select="selectedFlag = flag"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
