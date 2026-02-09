<script lang="ts">
  import { onMount } from 'svelte';
  import type { GatrixClientConfig } from '@gatrix/js-client-sdk';
  import GatrixWrapper from './components/GatrixWrapper.svelte';
  import ConfigForm from './components/ConfigForm.svelte';
  import BootScreen from './components/BootScreen.svelte';
  import DisconnectScreen from './components/DisconnectScreen.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import MatrixBackground from './components/MatrixBackground.svelte';
  import './styles.css';

  let config: GatrixClientConfig | null = null;
  let isBooting = false;
  let bootComplete = false;
  let isDisconnecting = false;
  let showConfirmDialog = false;

  onMount(() => {
    const saved = localStorage.getItem('gatrix-dashboard-config');
    if (saved) {
      try {
        config = JSON.parse(saved);
      } catch {
        config = null;
      }
    }
  });

  function handleConnect(newConfig: GatrixClientConfig) {
    localStorage.setItem('gatrix-dashboard-config', JSON.stringify(newConfig));
    config = newConfig;
    isBooting = true;
    bootComplete = false;
  }

  function handleBootComplete() {
    isBooting = false;
    bootComplete = true;
  }

  function handleDisconnectRequest() {
    showConfirmDialog = true;
  }

  function handleConfirmDisconnect() {
    showConfirmDialog = false;
    isDisconnecting = true;
  }

  function handleCancelDisconnect() {
    showConfirmDialog = false;
  }

  function handleDisconnectComplete() {
    localStorage.removeItem('gatrix-dashboard-config');
    config = null;
    isBooting = false;
    bootComplete = false;
    isDisconnecting = false;
  }
</script>

{#if config && isBooting && !bootComplete}
  <BootScreen onComplete={handleBootComplete} />
{:else if isDisconnecting}
  <DisconnectScreen onComplete={handleDisconnectComplete} />
{:else}
  <div class="app">
    {#if showConfirmDialog}
      <ConfirmDialog
        title="POWER OFF"
        message="Are you sure you want to shut down the connection?"
        onConfirm={handleConfirmDisconnect}
        onCancel={handleCancelDisconnect}
      />
    {/if}

    {#if !config}
      <div class="center-container">
        <MatrixBackground />
        <ConfigForm onConnect={handleConnect} />
      </div>
    {:else}
      <GatrixWrapper {config} onDisconnect={handleDisconnectRequest} />
    {/if}
  </div>
{/if}
