<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import type { GatrixClientConfig } from '@gatrix/js-client-sdk';

const emit = defineEmits<{ (e: 'connect', config: GatrixClientConfig): void }>();

// Dev tokens for local development
const DEV_TOKEN_EDGE = 'gatrix-unsecured-edge-api-token';
const DEV_TOKEN_BACKEND = 'gatrix-unsecured-client-api-token';

// Storage keys
const SK = {
  LOCATION: 'gatrix-dashboard-location',
  SERVER_TYPE: 'gatrix-dashboard-server-type',
  TOKEN: 'gatrix-dashboard-last-token',
  REMEMBER: 'gatrix-dashboard-remember-token',
  API_URL: 'gatrix-dashboard-api-url',
  APP_NAME: 'gatrix-dashboard-app-name',
  ENVIRONMENT: 'gatrix-dashboard-environment',
  OFFLINE_MODE: 'gatrix-dashboard-offline-mode',
  REFRESH_INTERVAL: 'gatrix-dashboard-refresh-interval',
  EXPLICIT_SYNC: 'gatrix-dashboard-explicit-sync',
  MANUAL_POLLING: 'gatrix-dashboard-manual-polling',
  USER_ID: 'gatrix-dashboard-user-id',
};

type ServerLocation = 'local' | 'remote';
type ServerType = 'edge' | 'backend';

function generateRandomUserId(): string {
  return 'user-' + Math.random().toString(36).substring(2, 10);
}

function getLocalUrl(st: ServerType): string {
  return st === 'edge' ? 'http://localhost:3400/api/v1' : 'http://localhost:45000/api/v1';
}

function getDevToken(st: ServerType): string {
  return st === 'edge' ? DEV_TOKEN_EDGE : DEV_TOKEN_BACKEND;
}

const location = ref<ServerLocation>((localStorage.getItem(SK.LOCATION) as ServerLocation) || 'local');
const serverType = ref<ServerType>((localStorage.getItem(SK.SERVER_TYPE) as ServerType) || 'edge');
const apiUrl = ref('');
const apiToken = ref('');
const appName = ref('vue-sdk-app');
const environment = ref('development');
const userId = ref(localStorage.getItem(SK.USER_ID) || generateRandomUserId());
const rememberToken = ref(false);
const showToken = ref(false);
const offlineMode = ref(false);
const refreshInterval = ref(1);
const manualPolling = ref(false);
const explicitSyncMode = ref(false);

const isLocal = () => location.value === 'local';

onMounted(() => {
  const savedRemember = localStorage.getItem(SK.REMEMBER) === 'true';
  const savedToken = localStorage.getItem(SK.TOKEN) || '';
  const savedAppName = localStorage.getItem(SK.APP_NAME);
  const savedEnv = localStorage.getItem(SK.ENVIRONMENT);

  if (savedAppName) appName.value = savedAppName;
  if (savedEnv) environment.value = savedEnv;
  rememberToken.value = savedRemember;

  if (location.value === 'local') {
    apiUrl.value = getLocalUrl(serverType.value);
    apiToken.value = getDevToken(serverType.value);
  } else {
    apiUrl.value = localStorage.getItem(SK.API_URL) || '';
    if (savedRemember && savedToken) apiToken.value = savedToken;
  }

  offlineMode.value = localStorage.getItem(SK.OFFLINE_MODE) === 'true';
  const savedManual = localStorage.getItem(SK.MANUAL_POLLING) === 'true';
  const savedRefresh = parseInt(localStorage.getItem(SK.REFRESH_INTERVAL) || '1', 10);
  manualPolling.value = savedManual;
  refreshInterval.value = !savedManual && savedRefresh === 0 ? 1 : savedRefresh;
  explicitSyncMode.value = localStorage.getItem(SK.EXPLICIT_SYNC) === 'true';
});

// When location or serverType changes, update URL and token
watch([location, serverType], () => {
  localStorage.setItem(SK.LOCATION, location.value);
  localStorage.setItem(SK.SERVER_TYPE, serverType.value);
  if (location.value === 'local') {
    apiUrl.value = getLocalUrl(serverType.value);
    apiToken.value = getDevToken(serverType.value);
  } else {
    apiUrl.value = '';
    apiToken.value = '';
  }
});

function handleManualPollingChange(checked: boolean) {
  manualPolling.value = checked;
  if (!checked && refreshInterval.value === 0) refreshInterval.value = 1;
}

function handleSubmit() {
  localStorage.setItem(SK.LOCATION, location.value);
  localStorage.setItem(SK.SERVER_TYPE, serverType.value);
  localStorage.setItem(SK.ENVIRONMENT, environment.value);
  localStorage.setItem(SK.USER_ID, userId.value);
  localStorage.setItem(SK.OFFLINE_MODE, String(offlineMode.value));
  localStorage.setItem(SK.REFRESH_INTERVAL, String(manualPolling.value ? 0 : refreshInterval.value));
  localStorage.setItem(SK.MANUAL_POLLING, String(manualPolling.value));
  localStorage.setItem(SK.EXPLICIT_SYNC, String(explicitSyncMode.value));

  if (location.value === 'remote') {
    localStorage.setItem(SK.API_URL, apiUrl.value);
    if (rememberToken.value) {
      localStorage.setItem(SK.TOKEN, apiToken.value);
      localStorage.setItem(SK.REMEMBER, 'true');
    } else {
      localStorage.removeItem(SK.TOKEN);
      localStorage.setItem(SK.REMEMBER, 'false');
    }
  }

  emit('connect', {
    apiUrl: apiUrl.value,
    apiToken: apiToken.value,
    appName: appName.value,
    environment: environment.value,
    offlineMode: offlineMode.value,
    context: { userId: userId.value },
    features: {
      refreshInterval: manualPolling.value ? 0 : refreshInterval.value,
      explicitSyncMode: explicitSyncMode.value,
    },
  });
}
</script>

<template>
  <div class="login-container">
    <div class="login-box">
      <div class="nes-container is-dark with-title">
        <p class="title" style="background-color: #000">
          <i class="nes-icon coin is-small"></i> CONNECT TO GATRIX
        </p>

        <form @submit.prevent="handleSubmit">
          <!-- Step 1: Server Location -->
          <div class="form-group">
            <label class="form-label">SERVER LOCATION</label>
            <div style="display: flex; gap: 40px; margin-bottom: 20px">
              <label>
                <input type="radio" class="nes-radio is-dark" name="serverLocation"
                  :checked="location === 'local'" @change="location = 'local'" />
                <span>LOCAL</span>
              </label>
              <label>
                <input type="radio" class="nes-radio is-dark" name="serverLocation"
                  :checked="location === 'remote'" @change="location = 'remote'" />
                <span>REMOTE</span>
              </label>
            </div>
          </div>

          <!-- Step 2: Server type for LOCAL -->
          <div v-if="isLocal()" class="form-group">
            <label class="form-label">SERVER TYPE</label>
            <div style="display: flex; gap: 40px; margin-bottom: 20px">
              <label>
                <input type="radio" class="nes-radio is-dark" name="serverType"
                  :checked="serverType === 'edge'" @change="serverType = 'edge'" />
                <span>EDGE (:3400)</span>
              </label>
              <label>
                <input type="radio" class="nes-radio is-dark" name="serverType"
                  :checked="serverType === 'backend'" @change="serverType = 'backend'" />
                <span>BACKEND (:45000)</span>
              </label>
            </div>
          </div>

          <!-- API URL & TOKEN (remote only) -->
          <template v-if="!isLocal()">
            <div class="form-group">
              <label class="form-label">API URL</label>
              <input type="url" class="nes-input is-dark" v-model="apiUrl"
                placeholder="https://your-server.com/api/v1" required />
            </div>
            <div class="form-group">
              <label class="form-label">API TOKEN</label>
              <div style="position: relative; display: flex; align-items: center">
                <input :type="!showToken ? 'password' : 'text'" class="nes-input is-dark"
                  v-model="apiToken" placeholder="Enter your API token" required
                  style="padding-right: 50px" />
                <button type="button" class="nes-btn is-primary" @click="showToken = !showToken"
                  :style="{ position: 'absolute', right: '4px', padding: '4px 8px', height: '38px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }"
                  :title="showToken ? 'Hide Token' : 'Show Token'">
                  <i :class="`nes-icon is-small ${showToken ? 'close' : 'eye'}`"
                    style="transform: scale(1.2)"></i>
                </button>
              </div>
            </div>
            <div class="checkbox-group">
              <label>
                <input type="checkbox" class="nes-checkbox is-dark" v-model="rememberToken" />
                <span class="checkbox-label">REMEMBER TOKEN</span>
              </label>
            </div>
          </template>

          <hr class="nes-hr" style="margin: 25px 0" />

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">APP NAME</label>
              <input type="text" class="nes-input is-dark" v-model="appName"
                placeholder="vue-sdk-app" required />
            </div>
            <div class="form-group">
              <label class="form-label">ENVIRONMENT</label>
              <input type="text" class="nes-input is-dark" v-model="environment"
                placeholder="development" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">USER ID (CONTEXT)</label>
            <div style="display: flex; gap: 8px">
              <input type="text" class="nes-input is-dark" v-model="userId"
                placeholder="user-abc123" style="flex: 1" />
              <button type="button" class="nes-btn is-warning"
                @click="userId = generateRandomUserId()"
                title="Generate random User ID" style="font-size: 10px; white-space: nowrap">
                🎲 RANDOM
              </button>
            </div>
          </div>

          <hr class="nes-hr" style="margin: 25px 0" />

          <div class="checkbox-group">
            <label>
              <input type="checkbox" class="nes-checkbox is-dark" v-model="offlineMode" />
              <span class="checkbox-label">OFFLINE MODE</span>
            </label>
          </div>

          <template v-if="!offlineMode">
            <div class="form-group">
              <label class="form-label">POLLING INTERVAL (SEC)</label>
              <div style="display: flex; align-items: center; gap: 20px">
                <input type="number" :class="`nes-input is-dark ${manualPolling ? 'is-disabled' : ''}`"
                  :value="refreshInterval"
                  @input="refreshInterval = Math.max(1, parseInt(($event.target as HTMLInputElement).value) || 1)"
                  min="1" :disabled="manualPolling" style="flex: 1" />
                <label style="margin-bottom: 0">
                  <input type="checkbox" class="nes-checkbox is-dark" :checked="manualPolling"
                    @change="handleManualPollingChange(($event.target as HTMLInputElement).checked)" />
                  <span class="checkbox-label">MANUAL</span>
                </label>
              </div>
            </div>
            <div class="checkbox-group">
              <label>
                <input type="checkbox" class="nes-checkbox is-dark" v-model="explicitSyncMode" />
                <span class="checkbox-label">EXPLICIT SYNC</span>
              </label>
            </div>
          </template>

          <button type="submit" class="nes-btn is-success rumble-on-click" style="width: 100%">
            START GAME
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
