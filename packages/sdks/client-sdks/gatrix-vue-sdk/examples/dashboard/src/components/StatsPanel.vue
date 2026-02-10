<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useGatrixClient } from '@gatrix/vue-sdk';
import type { GatrixClientConfig } from '@gatrix/js-client-sdk';

const props = defineProps<{
  config: GatrixClientConfig;
  enabledCount: number;
  disabledCount: number;
  totalCount: number;
  lastUpdate: Date | null;
  stats: any;
  errorMessage: string | null;
  context: Record<string, any>;
  flagsReady: boolean;
}>();

const client = useGatrixClient();

const rumbleTotal = ref(false);
const rumbleEnabled = ref(false);
const rumbleDisabled = ref(false);
const isScanning = ref(false);

// Typewriter
const displayText = ref('');
const isTyping = ref(false);
let typewriterCycle = 0;
let typeInterval: ReturnType<typeof setInterval>;
let typeTimer: ReturnType<typeof setTimeout>;

function startTypewriter(text: string) {
  clearInterval(typeInterval);
  clearTimeout(typeTimer);
  if (!text) { displayText.value = ''; isTyping.value = false; return; }
  displayText.value = '';
  isTyping.value = true;
  let index = 0;
  typeInterval = setInterval(() => {
    if (index < text.length) {
      displayText.value = text.substring(0, index + 1);
      index++;
    } else {
      isTyping.value = false;
      clearInterval(typeInterval);
      typeTimer = setTimeout(() => {
        typewriterCycle++;
        startTypewriter(text);
      }, 3000);
    }
  }, 40);
}

// Track count changes for rumble
let prevTotal = 0;
let prevEnabled = 0;
let prevDisabled = 0;

watch(() => props.totalCount, (v) => {
  if (prevTotal !== v && prevTotal !== 0) {
    rumbleTotal.value = true;
    setTimeout(() => { rumbleTotal.value = false; }, 500);
  }
  prevTotal = v;
});

watch(() => props.enabledCount, (v) => {
  if (prevEnabled !== v && prevEnabled !== 0) {
    rumbleEnabled.value = true;
    setTimeout(() => { rumbleEnabled.value = false; }, 500);
  }
  prevEnabled = v;
});

watch(() => props.disabledCount, (v) => {
  if (prevDisabled !== v && prevDisabled !== 0) {
    rumbleDisabled.value = true;
    setTimeout(() => { rumbleDisabled.value = false; }, 500);
  }
  prevDisabled = v;
});

// Scanning animation on fetch
function handleFetch() {
  isScanning.value = true;
  setTimeout(() => { isScanning.value = false; }, 800);
}

onMounted(() => { client.on('flags.fetch', handleFetch); });
onUnmounted(() => {
  client.off('flags.fetch', handleFetch);
  clearInterval(typeInterval);
  clearTimeout(typeTimer);
});

function formatTime(date: Date | null): string {
  if (!date) return '--:--:--';
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatUptime(startTime: Date | null): string {
  if (!startTime) return '-';
  const ms = Date.now() - startTime.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function getStatusClass(state: string): string {
  if (state === 'healthy' || state === 'ready') return 'status-healthy';
  if (state === 'error') return 'status-error';
  return '';
}

function getStatusIcon(state: string): string {
  if (state === 'healthy' || state === 'ready') return '●';
  if (state === 'error') return '●';
  return '○';
}

const effectiveSdkState = computed(() => {
  const raw = props.stats?.sdkState || '';
  if (raw === 'healthy' || raw === 'ready' || raw === 'error') return raw;
  if (props.errorMessage) return 'error';
  if (props.flagsReady) return 'ready';
  return raw || 'init';
});

const isError = computed(() => effectiveSdkState.value === 'error' || !!props.errorMessage);

function formatErrorMessage(msg: string): string {
  if (msg.includes('ECONNREFUSED')) return 'Connection refused!';
  if (msg.includes('ETIMEDOUT')) return 'Connection timeout!';
  if (msg.includes('ENOTFOUND')) return 'Host not found!';
  if (msg.includes('fetch')) return 'Network error!';
  if (msg.length > 25) return msg.substring(0, 22) + '...';
  return msg;
}

const formattedError = computed(() => props.errorMessage ? formatErrorMessage(props.errorMessage) : '');

watch(formattedError, (v) => { startTypewriter(v); }, { immediate: true });

function formatEtag(etag: string | null): string {
  if (!etag) return '-';
  return etag.replace(/"/g, '').substring(0, 10) + '...';
}
</script>

<template>
  <section class="stats-container">
    <div :class="['nes-container', 'is-dark', 'with-title', isError ? 'is-error-border' : '']">
      <p class="title" style="background-color: #212529">STATUS</p>

      <div class="stats-grid-layout">
        <!-- Mascot -->
        <div class="mascot-outer-container" style="display: flex; align-items: center; gap: 8px">
          <div :class="['mascot-container', 'clickable', isScanning ? 'mascot-scanning' : '']"
            @click="!isScanning && client.features.fetchFlags()" title="Click to Refresh Flags">
            <!-- Error mascot -->
            <div v-if="effectiveSdkState === 'error' || errorMessage"
              :class="['mascot-error', isTyping ? 'mascot-talking' : 'mascot-sad']">
              <i class="nes-bcrikko"></i>
            </div>
            <!-- Healthy mascot -->
            <div v-else-if="effectiveSdkState === 'healthy' || effectiveSdkState === 'ready'" class="mascot-happy">
              <i class="nes-octocat animate"></i>
            </div>
            <!-- Waiting mascot -->
            <div v-else class="mascot-waiting">
              <i class="nes-octocat animate"></i>
            </div>
          </div>

          <!-- Error bubble -->
          <div v-if="(effectiveSdkState === 'error' || errorMessage) && formattedError"
            :style="{
              background: '#212529', border: '2px solid #e76e55', borderRadius: '4px',
              padding: '8px 12px', fontSize: '11px', color: '#e76e55', maxWidth: '280px',
              position: 'relative',
            }"
          >
            <p style="margin: 0">
              {{ displayText }}
              <span v-if="isTyping" class="typewriter-cursor">_</span>
            </p>
          </div>
        </div>

        <div class="stats-spacer"></div>

        <!-- Right Group -->
        <div class="stats-right-group" style="display: flex; align-items: center; gap: 0">
          <!-- Flag Counts -->
          <div class="stats-numbers-compact">
            <div :class="['stat-mini', rumbleTotal ? 'stat-rumble' : '']">
              <span class="stat-mini-value total">{{ totalCount }}</span>
              <span class="stat-mini-label">ALL</span>
            </div>
            <div :class="['stat-mini', rumbleEnabled ? 'stat-rumble' : '']">
              <span class="stat-mini-value enabled">{{ enabledCount }}</span>
              <span class="stat-mini-label">ON</span>
            </div>
            <div :class="['stat-mini', rumbleDisabled ? 'stat-rumble' : '']">
              <span class="stat-mini-value disabled">{{ disabledCount }}</span>
              <span class="stat-mini-label">OFF</span>
            </div>
          </div>

          <div class="stats-separator"></div>

          <!-- Context -->
          <div class="stats-info">
            <table class="stats-table"><tbody>
              <tr v-for="(value, key) in context" :key="key">
                <td class="stats-label">{{ key }}:</td>
                <td class="stats-value" colspan="5">{{ String(value) }}</td>
              </tr>
            </tbody></table>
          </div>

          <div class="stats-separator"></div>

          <!-- Mode/Config -->
          <div class="stats-modes-compact">
            <div :class="['mode-item', client.features.isOfflineMode() ? 'is-warning' : 'is-success']">
              <span class="mode-label">NETWORK</span>
              <span class="mode-value">{{ client.features.isOfflineMode() ? 'OFFLINE' : 'ONLINE' }}</span>
            </div>
            <div :class="['mode-item', config.features?.refreshInterval === 0 && !client.features.isOfflineMode() ? 'is-warning' : 'is-info']">
              <span class="mode-label">POLLING</span>
              <span class="mode-value">
                {{ client.features.isOfflineMode() ? 'OFF' : config.features?.refreshInterval === 0 ? 'MANUAL' : `${config.features?.refreshInterval}s` }}
              </span>
            </div>
            <div :class="['mode-item', (config.features as any)?.explicitSyncMode && !client.features.isOfflineMode() ? 'is-warning' : 'is-info']">
              <span class="mode-label">SYNC</span>
              <span class="mode-value">
                {{ (config.features as any)?.explicitSyncMode && !client.features.isOfflineMode() ? 'EXPLICIT' : 'AUTO' }}
              </span>
            </div>
          </div>

          <div class="stats-separator"></div>

          <!-- Stats -->
          <div class="stats-info">
            <table class="stats-table"><tbody>
              <tr>
                <td class="stats-label">API:</td>
                <td class="stats-value" colspan="5">{{ config.apiUrl }}</td>
              </tr>
              <tr>
                <td class="stats-label">CONN ID:</td>
                <td class="stats-value" colspan="5">{{ stats?.connectionId || '-' }}</td>
              </tr>
              <tr>
                <td class="stats-label">APP/ENV:</td>
                <td class="stats-value" colspan="5">{{ config.appName }} / {{ config.environment }}</td>
              </tr>
              <tr>
                <td class="stats-label">STATUS:</td>
                <td :class="['stats-value', client.features.isOfflineMode() ? 'status-offline' : getStatusClass(effectiveSdkState)]">
                  {{ client.features.isOfflineMode() ? '○ OFFLINE' : `${getStatusIcon(effectiveSdkState)} ${effectiveSdkState}` }}
                </td>
                <td class="stats-label">UP:</td>
                <td class="stats-value">{{ formatUptime(stats?.startTime || null) }}</td>
                <td class="stats-label">SYNC:</td>
                <td class="stats-value">{{ formatTime(lastUpdate) }}</td>
              </tr>
              <tr>
                <td class="stats-label">FETCH:</td>
                <td class="stats-value">{{ stats?.fetchFlagsCount || 0 }}</td>
                <td class="stats-label">UPD:</td>
                <td class="stats-value">{{ stats?.updateCount || 0 }}</td>
                <td class="stats-label">304:</td>
                <td class="stats-value">{{ stats?.notModifiedCount || 0 }}</td>
              </tr>
              <tr>
                <td class="stats-label">ERR:</td>
                <td class="stats-value">{{ stats?.errorCount || 0 }}</td>
                <td class="stats-label">REC:</td>
                <td class="stats-value">{{ stats?.recoveryCount || 0 }}</td>
                <td class="stats-label">ETAG:</td>
                <td class="stats-value">{{ formatEtag(stats?.etag || null) }}</td>
              </tr>
              <tr>
                <td class="stats-label">METRIC:</td>
                <td class="stats-value">{{ stats?.metricsSentCount || 0 }}</td>
                <td class="stats-label">M-ERR:</td>
                <td class="stats-value">{{ stats?.metricsErrorCount || 0 }}</td>
                <td class="stats-label">IMP:</td>
                <td class="stats-value">{{ stats?.impressionCount || 0 }}</td>
              </tr>
            </tbody></table>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
