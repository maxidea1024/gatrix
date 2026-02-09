<script lang="ts">
  import { onMount } from 'svelte';
  import type { GatrixClientConfig } from '@gatrix/js-client-sdk';

  export let onConnect: (config: GatrixClientConfig) => void;

  const DEV_TOKEN_EDGE = 'gatrix-unsecured-edge-api-token';
  const DEV_TOKEN_BACKEND = 'gatrix-unsecured-client-api-token';
  const STORAGE_KEY_LOCATION = 'gatrix-dashboard-location';
  const STORAGE_KEY_SERVER_TYPE = 'gatrix-dashboard-server-type';
  const STORAGE_KEY_TOKEN = 'gatrix-dashboard-last-token';
  const STORAGE_KEY_REMEMBER = 'gatrix-dashboard-remember-token';
  const STORAGE_KEY_API_URL = 'gatrix-dashboard-api-url';
  const STORAGE_KEY_APP_NAME = 'gatrix-dashboard-app-name';
  const STORAGE_KEY_ENVIRONMENT = 'gatrix-dashboard-environment';
  const STORAGE_KEY_OFFLINE_MODE = 'gatrix-dashboard-offline-mode';
  const STORAGE_KEY_REFRESH_INTERVAL = 'gatrix-dashboard-refresh-interval';
  const STORAGE_KEY_EXPLICIT_SYNC = 'gatrix-dashboard-explicit-sync';
  const STORAGE_KEY_MANUAL_POLLING = 'gatrix-dashboard-manual-polling';
  const STORAGE_KEY_USER_ID = 'gatrix-dashboard-user-id';

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

  let location: ServerLocation = 'local';
  let serverType: ServerType = 'edge';
  let apiUrl = '';
  let apiToken = '';
  let appName = 'my-app';
  let environment = 'development';
  let userId = '';
  let rememberToken = false;
  let showToken = false;
  let offlineMode = false;
  let refreshInterval = 1;
  let manualPolling = false;
  let explicitSyncMode = false;

  $: isLocal = location === 'local';

  onMount(() => {
    location = (localStorage.getItem(STORAGE_KEY_LOCATION) as ServerLocation) || 'local';
    serverType = (localStorage.getItem(STORAGE_KEY_SERVER_TYPE) as ServerType) || 'edge';
    userId = localStorage.getItem(STORAGE_KEY_USER_ID) || generateRandomUserId();

    const savedAppName = localStorage.getItem(STORAGE_KEY_APP_NAME);
    const savedEnvironment = localStorage.getItem(STORAGE_KEY_ENVIRONMENT);
    if (savedAppName) appName = savedAppName;
    if (savedEnvironment) environment = savedEnvironment;

    const savedRemember = localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN) || '';
    rememberToken = savedRemember;

    if (location === 'local') {
      apiUrl = getLocalUrl(serverType);
      apiToken = getDevToken(serverType);
    } else {
      apiUrl = localStorage.getItem(STORAGE_KEY_API_URL) || '';
      if (savedRemember && savedToken) apiToken = savedToken;
    }

    offlineMode = localStorage.getItem(STORAGE_KEY_OFFLINE_MODE) === 'true';
    manualPolling = localStorage.getItem(STORAGE_KEY_MANUAL_POLLING) === 'true';
    const savedInterval = parseInt(localStorage.getItem(STORAGE_KEY_REFRESH_INTERVAL) || '1', 10);
    refreshInterval = !manualPolling && savedInterval === 0 ? 1 : savedInterval;
    explicitSyncMode = localStorage.getItem(STORAGE_KEY_EXPLICIT_SYNC) === 'true';
  });

  function handleLocationChange(loc: ServerLocation) {
    location = loc;
    localStorage.setItem(STORAGE_KEY_LOCATION, loc);
    if (loc === 'local') {
      apiUrl = getLocalUrl(serverType);
      apiToken = getDevToken(serverType);
    } else {
      apiUrl = '';
      apiToken = '';
    }
  }

  function handleServerTypeChange(st: ServerType) {
    serverType = st;
    localStorage.setItem(STORAGE_KEY_SERVER_TYPE, st);
    if (location === 'local') {
      apiUrl = getLocalUrl(st);
      apiToken = getDevToken(st);
    }
  }

  function handleManualPollingChange(checked: boolean) {
    manualPolling = checked;
    if (!checked && refreshInterval === 0) refreshInterval = 1;
  }

  function handleSubmit() {
    localStorage.setItem(STORAGE_KEY_LOCATION, location);
    localStorage.setItem(STORAGE_KEY_SERVER_TYPE, serverType);
    localStorage.setItem(STORAGE_KEY_ENVIRONMENT, environment);
    localStorage.setItem(STORAGE_KEY_USER_ID, userId);
    localStorage.setItem(STORAGE_KEY_APP_NAME, appName);
    localStorage.setItem(STORAGE_KEY_OFFLINE_MODE, String(offlineMode));
    localStorage.setItem(STORAGE_KEY_REFRESH_INTERVAL, String(manualPolling ? 0 : refreshInterval));
    localStorage.setItem(STORAGE_KEY_MANUAL_POLLING, String(manualPolling));
    localStorage.setItem(STORAGE_KEY_EXPLICIT_SYNC, String(explicitSyncMode));

    if (!isLocal) {
      localStorage.setItem(STORAGE_KEY_API_URL, apiUrl);
      if (rememberToken) {
        localStorage.setItem(STORAGE_KEY_TOKEN, apiToken);
        localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.setItem(STORAGE_KEY_REMEMBER, 'false');
      }
    }

    onConnect({
      apiUrl,
      apiToken,
      appName,
      environment,
      offlineMode,
      context: { userId },
      features: {
        refreshInterval: manualPolling ? 0 : refreshInterval,
        explicitSyncMode,
      },
    });
  }
</script>

<div class="login-container">
  <div class="login-box">
    <div class="nes-container is-dark with-title">
      <p class="title" style="background-color:#000">
        <i class="nes-icon coin is-small"></i> CONNECT TO GATRIX
      </p>

      <form on:submit|preventDefault={handleSubmit}>
        <!-- Server Location -->
        <div class="form-group">
          <label class="form-label">SERVER LOCATION</label>
          <div style="display:flex;gap:40px;margin-bottom:20px">
            <label>
              <input
                type="radio"
                class="nes-radio is-dark"
                name="serverLocation"
                checked={location === 'local'}
                on:change={() => handleLocationChange('local')}
              />
              <span>LOCAL</span>
            </label>
            <label>
              <input
                type="radio"
                class="nes-radio is-dark"
                name="serverLocation"
                checked={location === 'remote'}
                on:change={() => handleLocationChange('remote')}
              />
              <span>REMOTE</span>
            </label>
          </div>
        </div>

        <!-- Server Type (local only) -->
        {#if isLocal}
          <div class="form-group">
            <label class="form-label">SERVER TYPE</label>
            <div style="display:flex;gap:40px;margin-bottom:20px">
              <label>
                <input
                  type="radio"
                  class="nes-radio is-dark"
                  name="serverType"
                  checked={serverType === 'edge'}
                  on:change={() => handleServerTypeChange('edge')}
                />
                <span>EDGE (:3400)</span>
              </label>
              <label>
                <input
                  type="radio"
                  class="nes-radio is-dark"
                  name="serverType"
                  checked={serverType === 'backend'}
                  on:change={() => handleServerTypeChange('backend')}
                />
                <span>BACKEND (:45000)</span>
              </label>
            </div>
          </div>
        {/if}

        <!-- API URL & TOKEN (remote only) -->
        {#if !isLocal}
          <div class="form-group">
            <label class="form-label">API URL</label>
            <input
              type="url"
              class="nes-input is-dark"
              bind:value={apiUrl}
              placeholder="https://your-server.com/api/v1"
              required
            />
          </div>
          <div class="form-group">
            <label class="form-label">API TOKEN</label>
            <div style="position:relative;display:flex;align-items:center">
              {#if showToken}
                <input
                  type="text"
                  class="nes-input is-dark"
                  bind:value={apiToken}
                  placeholder="Enter your API token"
                  required
                  style="padding-right:50px"
                />
              {:else}
                <input
                  type="password"
                  class="nes-input is-dark"
                  bind:value={apiToken}
                  placeholder="Enter your API token"
                  required
                  style="padding-right:50px"
                />
              {/if}
              <button
                type="button"
                class="nes-btn is-primary"
                on:click={() => (showToken = !showToken)}
                style="position:absolute;right:4px;padding:4px 8px;height:38px;display:flex;align-items:center;justify-content:center"
                title={showToken ? 'Hide Token' : 'Show Token'}
              >
                <i
                  class="nes-icon is-small {showToken ? 'close' : 'eye'}"
                  style="transform:scale(1.2)"
                ></i>
              </button>
            </div>
          </div>
          <div class="checkbox-group">
            <label>
              <input type="checkbox" class="nes-checkbox is-dark" bind:checked={rememberToken} />
              <span class="checkbox-label">REMEMBER TOKEN</span>
            </label>
          </div>
        {/if}

        <hr class="nes-hr" style="margin:25px 0" />

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">APP NAME</label>
            <input
              type="text"
              class="nes-input is-dark"
              bind:value={appName}
              placeholder="my-app"
              required
            />
          </div>
          <div class="form-group">
            <label class="form-label">ENVIRONMENT</label>
            <input
              type="text"
              class="nes-input is-dark"
              bind:value={environment}
              placeholder="development"
              required
            />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">USER ID (CONTEXT)</label>
          <div style="display:flex;gap:8px">
            <input
              type="text"
              class="nes-input is-dark"
              bind:value={userId}
              placeholder="user-abc123"
              style="flex:1"
            />
            <button
              type="button"
              class="nes-btn is-warning"
              on:click={() => (userId = generateRandomUserId())}
              title="Generate random User ID"
              style="font-size:10px;white-space:nowrap"
            >
              🎲 RANDOM
            </button>
          </div>
        </div>

        <hr class="nes-hr" style="margin:25px 0" />

        <div class="checkbox-group">
          <label>
            <input type="checkbox" class="nes-checkbox is-dark" bind:checked={offlineMode} />
            <span class="checkbox-label">OFFLINE MODE</span>
          </label>
        </div>

        <div class="form-group {offlineMode ? 'is-disabled-section' : ''}">
          <label class="form-label" style="opacity:{offlineMode ? 0.5 : 1}"
            >POLLING INTERVAL (SEC)</label
          >
          <div style="display:flex;align-items:center;gap:20px">
            <input
              type="number"
              class="nes-input is-dark {manualPolling || offlineMode ? 'is-disabled' : ''}"
              bind:value={refreshInterval}
              min="1"
              disabled={manualPolling || offlineMode}
              style="flex:1"
            />
            <label style="margin-bottom:0;opacity:{offlineMode ? 0.5 : 1}">
              <input
                type="checkbox"
                class="nes-checkbox is-dark"
                checked={manualPolling && !offlineMode}
                on:change={(e) => handleManualPollingChange(e.currentTarget.checked)}
                disabled={offlineMode}
              />
              <span class="checkbox-label">MANUAL</span>
            </label>
          </div>
        </div>

        <div class="checkbox-group" style="opacity:{offlineMode ? 0.5 : 1}">
          <label>
            <input
              type="checkbox"
              class="nes-checkbox is-dark"
              checked={explicitSyncMode && !offlineMode}
              on:change={(e) => (explicitSyncMode = e.currentTarget.checked)}
              disabled={offlineMode}
            />
            <span class="checkbox-label">EXPLICIT SYNC</span>
          </label>
        </div>

        <button type="submit" class="nes-btn is-success rumble-on-click" style="width:100%">
          START GAME
        </button>
      </form>
    </div>
  </div>
</div>
