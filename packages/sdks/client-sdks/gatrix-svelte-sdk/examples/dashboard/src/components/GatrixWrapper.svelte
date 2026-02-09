<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { GatrixClientConfig } from '@gatrix/js-client-sdk';
  import { initGatrix } from '@gatrix/svelte-sdk';
  import Dashboard from './Dashboard.svelte';

  export let config: GatrixClientConfig;
  export let onDisconnect: () => void;

  // Initialize Gatrix SDK within this component's context
  const client = initGatrix({
    config: {
      ...config,
      features: {
        metricsIntervalInitial: 1,
        metricsInterval: 5,
        ...config.features,
      },
    },
  });

  onDestroy(() => {
    client.stop();
  });
</script>

<div class="dashboard-container">
  <header class="header">
    <h1 class="header-title">
      <i class="nes-icon trophy is-small"></i>
      &nbsp;GATRIX FEATURE FLAGS
    </h1>
    <div style="display:flex;gap:12px">
      <button type="button" class="nes-btn is-error" on:click={onDisconnect}> POWER OFF </button>
    </div>
  </header>
  <Dashboard {config} />
</div>
