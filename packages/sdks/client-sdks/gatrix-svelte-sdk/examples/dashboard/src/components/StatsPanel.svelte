<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { GatrixClientConfig } from '@gatrix/js-client-sdk';
  import { getGatrixClient } from '@gatrix/svelte-sdk';

  export let config: GatrixClientConfig;
  export let enabledCount: number;
  export let disabledCount: number;
  export let totalCount: number;
  export let lastUpdate: Date | null;
  export let stats: any;
  export let errorMessage: string | null;
  export let context: Record<string, any>;
  export let flagsReady: boolean;

  const client = getGatrixClient();

  // Rumble tracking
  let prevTotal = 0;
  let prevEnabled = 0;
  let prevDisabled = 0;
  let rumbleTotal = false;
  let rumbleEnabled = false;
  let rumbleDisabled = false;
  let isScanning = false;
  let mounted = false;

  // Typewriter state
  let displayText = '';
  let isTyping = false;
  let typewriterInterval: ReturnType<typeof setInterval>;
  let typewriterTimeout: ReturnType<typeof setTimeout>;
  let prevErrorText = '';

  $: {
    if (mounted && prevTotal !== totalCount && prevTotal !== 0) {
      rumbleTotal = true;
      setTimeout(() => (rumbleTotal = false), 500);
    }
    prevTotal = totalCount;
  }

  $: {
    if (mounted && prevEnabled !== enabledCount && prevEnabled !== 0) {
      rumbleEnabled = true;
      setTimeout(() => (rumbleEnabled = false), 500);
    }
    prevEnabled = enabledCount;
  }

  $: {
    if (mounted && prevDisabled !== disabledCount && prevDisabled !== 0) {
      rumbleDisabled = true;
      setTimeout(() => (rumbleDisabled = false), 500);
    }
    prevDisabled = disabledCount;
  }

  function handleFetch() {
    isScanning = true;
    setTimeout(() => (isScanning = false), 800);
  }

  onMount(() => {
    mounted = true;
    client.on('flags.fetch', handleFetch);
  });

  onDestroy(() => {
    client.off('flags.fetch', handleFetch);
    if (typewriterInterval) clearInterval(typewriterInterval);
    if (typewriterTimeout) clearTimeout(typewriterTimeout);
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

  $: effectiveSdkState = (() => {
    const raw = stats?.sdkState || '';
    if (raw === 'healthy' || raw === 'ready' || raw === 'error') return raw;
    if (errorMessage) return 'error';
    if (flagsReady) return 'ready';
    return raw || 'init';
  })();

  $: isError = effectiveSdkState === 'error' || !!errorMessage;

  function formatErrorMessage(msg: string): string {
    if (msg.includes('ECONNREFUSED')) return 'Connection refused!';
    if (msg.includes('ETIMEDOUT')) return 'Connection timeout!';
    if (msg.includes('ENOTFOUND')) return 'Host not found!';
    if (msg.includes('fetch')) return 'Network error!';
    if (msg.length > 25) return msg.substring(0, 22) + '...';
    return msg;
  }

  $: formattedError = errorMessage ? formatErrorMessage(errorMessage) : '';

  // Typewriter effect - only restart when error message text actually changes
  function startTypewriter(text: string) {
    if (typewriterInterval) clearInterval(typewriterInterval);
    if (typewriterTimeout) clearTimeout(typewriterTimeout);
    displayText = '';
    isTyping = true;
    let index = 0;
    typewriterInterval = setInterval(() => {
      if (index < text.length) {
        displayText = text.substring(0, index + 1);
        index++;
      } else {
        isTyping = false;
        clearInterval(typewriterInterval);
        typewriterTimeout = setTimeout(() => {
          // Loop: restart the typewriter
          startTypewriter(text);
        }, 2000);
      }
    }, 50);
  }

  $: {
    if (formattedError !== prevErrorText) {
      prevErrorText = formattedError;
      if (formattedError) {
        startTypewriter(formattedError);
      } else {
        if (typewriterInterval) clearInterval(typewriterInterval);
        if (typewriterTimeout) clearTimeout(typewriterTimeout);
        displayText = '';
        isTyping = false;
      }
    }
  }

  function formatEtag(etag: string | null): string {
    if (!etag) return '-';
    return etag.replace(/"/g, '').substring(0, 10) + '...';
  }

  $: contextEntries = Object.entries(context || {});
  $: offlineMode = client.features.isOfflineMode();
</script>

<section class="stats-container">
  <div class="nes-container is-dark with-title {isError ? 'is-error-border' : ''}">
    <p class="title" style="background-color:#212529">STATUS</p>

    <div class="stats-grid-layout">
      <!-- Left: Mascot with bubble -->
      <div class="mascot-outer-container" style="display:flex;align-items:center;gap:8px">
        <div
          class="mascot-container clickable {isScanning ? 'mascot-scanning' : ''}"
          on:click={() => !isScanning && client.features.fetchFlags()}
          on:keydown={(e) => e.key === 'Enter' && !isScanning && client.features.fetchFlags()}
          role="button"
          tabindex="0"
          title="Click to Refresh Flags"
        >
          {#if effectiveSdkState === 'error' || errorMessage}
            <div class="mascot-error {isTyping ? 'mascot-talking' : 'mascot-sad'}">
              <i class="nes-bcrikko"></i>
            </div>
          {:else if effectiveSdkState === 'healthy' || effectiveSdkState === 'ready'}
            <div class="mascot-happy">
              <i class="nes-octocat animate"></i>
            </div>
          {:else}
            <div class="mascot-waiting">
              <i class="nes-octocat animate"></i>
            </div>
          {/if}
        </div>
        {#if (effectiveSdkState === 'error' || errorMessage) && formattedError}
          <div
            style="background:#212529;border:2px solid #e76e55;border-radius:4px;padding:8px 12px;font-size:11px;color:#e76e55;max-width:280px;position:relative"
          >
            <p style="margin:0">
              {displayText}
              {#if isTyping}<span class="typewriter-cursor">_</span>{/if}
            </p>
          </div>
        {/if}
      </div>

      <!-- Spacer -->
      <div class="stats-spacer"></div>

      <!-- Right Group -->
      <div class="stats-right-group" style="display:flex;align-items:center;gap:0">
        <!-- Flag Counts -->
        <div class="stats-numbers-compact">
          <div class="stat-mini {rumbleTotal ? 'stat-rumble' : ''}">
            <span class="stat-mini-value total">{totalCount}</span>
            <span class="stat-mini-label">ALL</span>
          </div>
          <div class="stat-mini {rumbleEnabled ? 'stat-rumble' : ''}">
            <span class="stat-mini-value enabled">{enabledCount}</span>
            <span class="stat-mini-label">ON</span>
          </div>
          <div class="stat-mini {rumbleDisabled ? 'stat-rumble' : ''}">
            <span class="stat-mini-value disabled">{disabledCount}</span>
            <span class="stat-mini-label">OFF</span>
          </div>
        </div>

        <div class="stats-separator"></div>

        <!-- Context Info -->
        <div class="stats-info">
          <table class="stats-table">
            <tbody>
              {#each contextEntries as [key, value]}
                <tr>
                  <td class="stats-label">{key}:</td>
                  <td class="stats-value" colspan="5">{String(value)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="stats-separator"></div>

        <!-- Mode/Config -->
        <div class="stats-modes-compact">
          <div class="mode-item {offlineMode ? 'is-warning' : 'is-success'}">
            <span class="mode-label">NETWORK</span>
            <span class="mode-value">{offlineMode ? 'OFFLINE' : 'ONLINE'}</span>
          </div>
          <div
            class="mode-item {config.features?.refreshInterval === 0 && !offlineMode
              ? 'is-warning'
              : 'is-info'}"
          >
            <span class="mode-label">POLLING</span>
            <span class="mode-value">
              {offlineMode
                ? 'OFF'
                : config.features?.refreshInterval === 0
                  ? 'MANUAL'
                  : `${config.features?.refreshInterval}s`}
            </span>
          </div>
          <div
            class="mode-item {config.features?.explicitSyncMode && !offlineMode
              ? 'is-warning'
              : 'is-info'}"
          >
            <span class="mode-label">SYNC</span>
            <span class="mode-value">
              {config.features?.explicitSyncMode && !offlineMode ? 'EXPLICIT' : 'AUTO'}
            </span>
          </div>
        </div>

        <div class="stats-separator"></div>

        <!-- Stats Info -->
        <div class="stats-info">
          <table class="stats-table">
            <tbody>
              <tr>
                <td class="stats-label">API:</td>
                <td class="stats-value" colspan="5">{config.apiUrl}</td>
              </tr>
              <tr>
                <td class="stats-label">CONN ID:</td>
                <td class="stats-value" colspan="5">{stats?.connectionId || '-'}</td>
              </tr>
              <tr>
                <td class="stats-label">APP/ENV:</td>
                <td class="stats-value" colspan="5">{config.appName} / {config.environment}</td>
              </tr>
              <tr>
                <td class="stats-label">STATUS:</td>
                <td
                  class="stats-value {offlineMode
                    ? 'status-offline'
                    : getStatusClass(effectiveSdkState)}"
                >
                  {offlineMode
                    ? '○ OFFLINE'
                    : `${getStatusIcon(effectiveSdkState)} ${effectiveSdkState}`}
                </td>
                <td class="stats-label">UP:</td>
                <td class="stats-value">{formatUptime(stats?.startTime || null)}</td>
                <td class="stats-label">SYNC:</td>
                <td class="stats-value">{formatTime(lastUpdate)}</td>
              </tr>
              <tr>
                <td class="stats-label">FETCH:</td>
                <td class="stats-value">{stats?.fetchFlagsCount || 0}</td>
                <td class="stats-label">UPD:</td>
                <td class="stats-value">{stats?.updateCount || 0}</td>
                <td class="stats-label">304:</td>
                <td class="stats-value">{stats?.notModifiedCount || 0}</td>
              </tr>
              <tr>
                <td class="stats-label">ERR:</td>
                <td class="stats-value">{stats?.errorCount || 0}</td>
                <td class="stats-label">REC:</td>
                <td class="stats-value">{stats?.recoveryCount || 0}</td>
                <td class="stats-label">ETAG:</td>
                <td class="stats-value">{formatEtag(stats?.etag || null)}</td>
              </tr>
              <tr>
                <td class="stats-label">METRIC:</td>
                <td class="stats-value">{stats?.metricsSentCount || 0}</td>
                <td class="stats-label">M-ERR:</td>
                <td class="stats-value">{stats?.metricsErrorCount || 0}</td>
                <td class="stats-label">IMP:</td>
                <td class="stats-value">{stats?.impressionCount || 0}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</section>
