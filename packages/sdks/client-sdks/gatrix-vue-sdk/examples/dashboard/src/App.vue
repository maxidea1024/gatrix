<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import type { GatrixClientConfig } from '@gatrix/js-client-sdk';
import ConfigForm from './components/ConfigForm.vue';
import BootScreen from './components/BootScreen.vue';
import DisconnectScreen from './components/DisconnectScreen.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import Dashboard from './components/Dashboard.vue';
import MatrixBackground from './components/MatrixBackground.vue';
import GatrixPluginWrapper from './components/GatrixPluginWrapper.vue';
import LogViewer from './components/LogViewer.vue';
import type { LogEntry } from './components/LogViewer.vue';
import './styles.css';

// Log capture system
let logIdCounter = 0;
const logs = reactive<LogEntry[]>([]);

/**
 * Custom Logger that captures all SDK logs and also forwards to console
 */
const captureLogger = {
  debug(message: string, ...args: any[]) {
    logs.push({ id: logIdCounter++, level: 'debug', message, timestamp: new Date(), args });
    console.debug(`[GatrixClient] ${message}`, ...args);
  },
  info(message: string, ...args: any[]) {
    logs.push({ id: logIdCounter++, level: 'info', message, timestamp: new Date(), args });
    console.info(`[GatrixClient] ${message}`, ...args);
  },
  warn(message: string, ...args: any[]) {
    logs.push({ id: logIdCounter++, level: 'warn', message, timestamp: new Date(), args });
    console.warn(`[GatrixClient] ${message}`, ...args);
  },
  error(message: string, ...args: any[]) {
    logs.push({ id: logIdCounter++, level: 'error', message, timestamp: new Date(), args });
    console.error(`[GatrixClient] ${message}`, ...args);
  },
};

// Load persisted config
const loadedConfig = (() => {
  const saved = localStorage.getItem('gatrix-dashboard-config');
  if (saved) {
    try { return JSON.parse(saved) as GatrixClientConfig; } catch { return null; }
  }
  return null;
})();
const config = ref<GatrixClientConfig | null>(loadedConfig);

const isBooting = ref(false);
const bootComplete = ref(false);
const isDisconnecting = ref(false);
const showConfirmDialog = ref(false);
const showLogViewer = ref(false);

// Unique key to force remount GatrixPluginWrapper when config changes
const pluginKey = ref(0);

function handleConnect(newConfig: GatrixClientConfig) {
  localStorage.setItem('gatrix-dashboard-config', JSON.stringify(newConfig));
  config.value = newConfig;
  isBooting.value = true;
  bootComplete.value = false;
  logs.length = 0; // Clear logs on new connection
  logIdCounter = 0;
  pluginKey.value++;
}

function handleBootComplete() {
  isBooting.value = false;
  bootComplete.value = true;
}

function handleDisconnectRequest() {
  showConfirmDialog.value = true;
}

function handleConfirmDisconnect() {
  showConfirmDialog.value = false;
  isDisconnecting.value = true;
}

function handleCancelDisconnect() {
  showConfirmDialog.value = false;
}

function handleDisconnectComplete() {
  localStorage.removeItem('gatrix-dashboard-config');
  config.value = null;
  isBooting.value = false;
  bootComplete.value = false;
  isDisconnecting.value = false;
}

function handleClearLogs() {
  logs.length = 0;
  logIdCounter = 0;
}

const gatrixConfig = computed<GatrixClientConfig | null>(() => {
  if (!config.value) return null;
  return {
    ...config.value,
    logger: captureLogger,
    enableDevMode: true,
    features: {
      metricsIntervalInitial: 1,
      metricsInterval: 5,
      ...config.value.features,
    },
  };
});

// Error log count for badge display
const errorLogCount = computed(() => logs.filter((l) => l.level === 'error').length);

const shouldShowBoot = computed(() => config.value && isBooting.value && !bootComplete.value);
const shouldShowDashboard = computed(() => config.value && !isBooting.value);
</script>

<template>
  <!-- Boot screen -->
  <BootScreen v-if="shouldShowBoot" @complete="handleBootComplete" />

  <!-- Disconnect screen -->
  <DisconnectScreen v-else-if="isDisconnecting" @complete="handleDisconnectComplete" />

  <!-- Main app -->
  <div v-else class="app">
    <ConfirmDialog
      v-if="showConfirmDialog"
      title="POWER OFF"
      message="Are you sure you want to shut down the connection?"
      @confirm="handleConfirmDisconnect"
      @cancel="handleCancelDisconnect"
    />

    <!-- Config form (no connection yet) -->
    <div v-if="!config" class="center-container">
      <MatrixBackground />
      <ConfigForm @connect="handleConnect" />
    </div>

    <!-- Dashboard (connected, using GatrixPluginWrapper) -->
    <GatrixPluginWrapper
      v-else-if="gatrixConfig"
      :key="pluginKey"
      :config="gatrixConfig"
    >
      <div style="display: flex; height: 100%; overflow: hidden">
        <!-- Main content area -->
        <div class="dashboard-container" style="flex: 1; min-width: 0; overflow-y: auto">
          <header class="header">
            <h1 class="header-title">
              <i class="nes-icon trophy is-small"></i>
              &nbsp;GATRIX FEATURE FLAGS (Vue SDK)
            </h1>
            <div style="display: flex; gap: 12px">
              <button
                type="button"
                class="nes-btn is-error"
                @click="handleDisconnectRequest"
              >
                POWER OFF
              </button>
            </div>
          </header>
          <Dashboard :config="gatrixConfig" />
        </div>

        <!-- Log side panel -->
        <LogViewer
          v-if="showLogViewer"
          :logs="logs"
          @close="showLogViewer = false"
          @clear="handleClearLogs"
        />
      </div>

      <!-- Floating log toggle button -->
      <button
        v-if="!showLogViewer"
        type="button"
        class="log-fab"
        @click="showLogViewer = true"
        title="Toggle SDK Logs"
      >
        📋
        <span v-if="errorLogCount > 0" class="log-fab-badge">
          {{ errorLogCount > 99 ? '99+' : errorLogCount }}
        </span>
      </button>
    </GatrixPluginWrapper>
  </div>
</template>

<style scoped>
.log-fab {
  position: fixed;
  right: -16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3000;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 4px solid #333;
  background-color: #212529;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transition: all 0.2s;
}

.log-fab:hover {
  right: -4px;
  border-color: #92cc41;
  box-shadow: 0 4px 16px rgba(146, 204, 65, 0.3);
}

.log-fab-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background-color: #e76e55;
  color: #fff;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 7px;
  font-weight: bold;
  font-family: 'Press Start 2P', cursive;
  border: 2px solid #212529;
}
</style>
