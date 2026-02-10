<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { GatrixClientConfig } from '@gatrix/js-client-sdk';
  import { initGatrix } from '@gatrix/svelte-sdk';
  import Dashboard from './Dashboard.svelte';
  import LogViewer from './LogViewer.svelte';
  import type { LogEntry } from './LogViewer.svelte';

  export let config: GatrixClientConfig;
  export let onDisconnect: () => void;

  let logs: LogEntry[] = [];
  let logIdCounter = 0;
  let showLogViewer = false;

  // Custom logger that captures all SDK log messages
  const captureLogger = {
    debug(message: string, ...args: any[]) {
      logs = [
        ...logs,
        { id: logIdCounter++, level: 'debug', message, timestamp: new Date(), args },
      ];
      console.debug(`[GatrixClient] ${message}`, ...args);
    },
    info(message: string, ...args: any[]) {
      logs = [...logs, { id: logIdCounter++, level: 'info', message, timestamp: new Date(), args }];
      console.info(`[GatrixClient] ${message}`, ...args);
    },
    warn(message: string, ...args: any[]) {
      logs = [...logs, { id: logIdCounter++, level: 'warn', message, timestamp: new Date(), args }];
      console.warn(`[GatrixClient] ${message}`, ...args);
    },
    error(message: string, ...args: any[]) {
      logs = [
        ...logs,
        { id: logIdCounter++, level: 'error', message, timestamp: new Date(), args },
      ];
      console.error(`[GatrixClient] ${message}`, ...args);
    },
  };

  $: errorLogCount = logs.filter((l) => l.level === 'error').length;

  // Initialize Gatrix SDK within this component's context
  const client = initGatrix({
    config: {
      ...config,
      logger: captureLogger,
      enableDevMode: true,
      features: {
        metricsIntervalInitial: 1,
        metricsInterval: 5,
        ...config.features,
      },
    },
  });

  function handleClearLogs() {
    logs = [];
    logIdCounter = 0;
  }

  onDestroy(() => {
    client.stop();
  });
</script>

<div style="display:flex;height:100%;overflow:hidden">
  <div class="dashboard-container" style="flex:1;min-width:0;overflow-y:auto">
    <header class="header">
      <h1 class="header-title">
        <i class="nes-icon trophy is-small"></i>
        &nbsp;GATRIX FEATURE FLAGS (Svelte SDK)
      </h1>
      <div style="display:flex;gap:12px">
        <button type="button" class="nes-btn is-error" on:click={onDisconnect}> POWER OFF </button>
      </div>
    </header>
    <Dashboard {config} />
  </div>

  {#if showLogViewer}
    <LogViewer {logs} onClose={() => (showLogViewer = false)} onClear={handleClearLogs} />
  {/if}
</div>

<!-- Floating log toggle button -->
{#if !showLogViewer}
  <button
    type="button"
    class="log-fab"
    on:click={() => (showLogViewer = true)}
    title="Toggle SDK Logs"
  >
    📋
    {#if errorLogCount > 0}
      <span class="log-fab-badge">
        {errorLogCount > 99 ? '99+' : errorLogCount}
      </span>
    {/if}
  </button>
{/if}
