<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { GatrixClientConfig, EvaluatedFlag } from '@gatrix/js-client-sdk';
  import { getGatrixClient, allFlags, flagsStatus } from '@gatrix/svelte-sdk';
  import StatsPanel from './StatsPanel.svelte';
  import FlagCard from './FlagCard.svelte';
  import FlagDetailModal from './FlagDetailModal.svelte';

  export let config: GatrixClientConfig;

  const client = getGatrixClient();
  const flags = allFlags();
  const { ready: flagsReady, error: flagsError } = flagsStatus();

  interface Stats {
    sdkState: string;
    fetchFlagsCount: number;
    updateCount: number;
    notModifiedCount: number;
    errorCount: number;
    recoveryCount: number;
    impressionCount: number;
    etag: string | null;
    startTime: Date | null;
    lastFetchTime: Date | null;
    lastError: Error | null;
    flagLastChangedTimes: Record<string, Date>;
    connectionId: string;
    metricsSentCount?: number;
    metricsErrorCount?: number;
  }

  let stats: Stats | null = null;
  let lastUpdate: Date | null = null;
  let initialVersions = new Map<string, number>();
  let showRecoveryEffect = false;
  let showErrorEffect = false;
  let prevSdkState: string | null = null;
  let context: Record<string, any> = {};
  let isFetching = false;
  let viewMode: 'detailed' | 'simple' | 'list' = 'simple';
  let searchInput = '';
  let searchQuery = '';
  let searchTimer: ReturnType<typeof setTimeout>;
  let selectedFlag: EvaluatedFlag | null = null;

  // Load saved view mode
  onMount(() => {
    viewMode = (localStorage.getItem('gatrix-dashboard-view-mode') as typeof viewMode) || 'simple';
  });

  function handleSearchChange(value: string) {
    searchInput = value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = value.toLowerCase();
    }, 300);
  }

  function clearSearch() {
    searchInput = '';
    searchQuery = '';
  }

  function updateStats() {
    const clientStats = client.getStats();
    const flatStats = { ...clientStats.features, ...clientStats };
    stats = flatStats as unknown as Stats;
    if (clientStats.features?.lastFetchTime) {
      lastUpdate = clientStats.features.lastFetchTime;
    }
    context = client.features.getContext();
  }

  function handleReady() {
    const currentFlags = client.features.getAllFlags();
    const newInitialVersions = new Map<string, number>();
    for (const flag of currentFlags) {
      if (!initialVersions.has(flag.name)) {
        newInitialVersions.set(flag.name, flag.version || 0);
      } else {
        newInitialVersions.set(flag.name, initialVersions.get(flag.name)!);
      }
    }
    initialVersions = newInitialVersions;
    updateStats();
  }

  function handleFetchStart() {
    isFetching = true;
  }
  function handleFetchEnd() {
    isFetching = false;
  }

  let interval: ReturnType<typeof setInterval>;

  onMount(() => {
    updateStats();

    client.on('flags.change', updateStats);
    client.on('flags.ready', handleReady);
    client.on('flags.sync', updateStats);
    client.on('flags.fetch_start', handleFetchStart);
    client.on('flags.fetch_end', handleFetchEnd);
    client.on('error', updateStats);

    interval = setInterval(updateStats, 1000);
  });

  onDestroy(() => {
    client.off('flags.change', updateStats);
    client.off('flags.ready', handleReady);
    client.off('flags.sync', updateStats);
    client.off('flags.fetch_start', handleFetchStart);
    client.off('flags.fetch_end', handleFetchEnd);
    client.off('error', updateStats);
    clearInterval(interval);
  });

  // Detect recovery/error state changes
  $: {
    const currentState = stats?.sdkState || null;
    if (prevSdkState === 'error' && (currentState === 'healthy' || currentState === 'ready')) {
      showRecoveryEffect = true;
      setTimeout(() => (showRecoveryEffect = false), 1000);
    } else if (prevSdkState !== 'error' && prevSdkState !== null && currentState === 'error') {
      showErrorEffect = true;
      setTimeout(() => (showErrorEffect = false), 1000);
    }
    prevSdkState = currentState;
  }

  $: filteredFlags = searchQuery
    ? $flags.filter((f) => f.name.toLowerCase().includes(searchQuery))
    : $flags;

  $: enabledCount = $flags.filter((f) => f.enabled).length;
  $: disabledCount = $flags.filter((f) => !f.enabled).length;
  $: totalCount = $flags.length;

  $: isInErrorState = stats?.sdkState === 'error';
  $: errorMessage = isInErrorState
    ? $flagsError?.message || (stats?.lastError as Error)?.message || 'Unknown error'
    : null;
  $: isSearching = !$flagsReady && $flags.length === 0;

  function changeViewMode(mode: string) {
    viewMode = mode as 'detailed' | 'simple' | 'list';
    localStorage.setItem('gatrix-dashboard-view-mode', mode);
  }

  function isExplicitSyncEnabled(): boolean {
    return config.features?.explicitSyncMode === true;
  }

  function hasPendingSyncFlags(): boolean {
    // Check if there are pending changes
    return client.features.hasPendingSyncFlags?.() ?? false;
  }

  function doFetchFlags() {
    client.features.fetchFlags();
  }

  function doSyncFlags() {
    client.features.syncFlags();
  }
</script>

<div
  class="dashboard-content {showRecoveryEffect ? 'recovery-shimmer' : ''} {showErrorEffect
    ? 'error-shimmer'
    : ''}"
>
  {#if selectedFlag}
    <FlagDetailModal flag={selectedFlag} onClose={() => (selectedFlag = null)} />
  {/if}

  <StatsPanel
    {config}
    {enabledCount}
    {disabledCount}
    {totalCount}
    {lastUpdate}
    {stats}
    {errorMessage}
    {context}
    flagsReady={$flagsReady}
  />

  <section class="flags-section">
    <div class="nes-container is-dark with-title">
      <p class="title" style="background-color:#000">
        FEATURE FLAGS ({filteredFlags.length}{searchQuery ? `/${$flags.length}` : ''})
      </p>

      <div style="padding:10px;display:flex;gap:15px;align-items:center;margin-bottom:10px">
        <!-- Search input -->
        <div style="flex:1;position:relative">
          <input
            type="text"
            class="nes-input is-dark"
            value={searchInput}
            on:input={(e) => handleSearchChange(e.currentTarget.value)}
            placeholder="Search flags..."
            style="width:100%;font-size:12px"
          />
          {#if searchInput}
            <button
              type="button"
              on:click={clearSearch}
              style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:#e76e55;cursor:pointer;font-size:16px;font-weight:bold;padding:4px 8px"
              title="Clear search">✕</button
            >
          {/if}
        </div>

        {#if !client.features.isOfflineMode() && client.features.getConfig().refreshInterval === 0}
          <button
            type="button"
            class="nes-btn is-primary {isFetching ? 'is-disabled' : ''}"
            on:click={doFetchFlags}
            disabled={isFetching}
            title="Manual Fetch"
          >
            {isFetching ? 'FETCHING...' : 'FETCH FLAGS'}
          </button>
        {/if}

        {#if isExplicitSyncEnabled() && !client.features.isOfflineMode()}
          <button
            type="button"
            class="nes-btn is-warning {!hasPendingSyncFlags() ? 'is-disabled' : 'sync-available-rumble'}"
            on:click={doSyncFlags}
            disabled={!hasPendingSyncFlags()}
            title="Synchronize Flags"
          >
            SYNC FLAGS
          </button>
        {/if}

        <div class="view-mode-selector nes-select is-dark" style="width:200px">
          <select
            id="view-mode-select"
            value={viewMode}
            on:change={(e) => changeViewMode(e.currentTarget.value)}
          >
            <option value="detailed">Detailed Card</option>
            <option value="simple">Simple Card</option>
            <option value="list">List View</option>
          </select>
        </div>
      </div>

      {#if isSearching}
        <div class="searching-state">
          <div class="searching-icon">
            <span role="img" aria-label="searching">🔍</span>
          </div>
          <p class="searching-text">WHERE ARE MY FLAGS?... COME BACK!</p>
        </div>
      {:else if $flags.length === 0}
        <div class="empty-state">
          <i class="nes-icon is-large heart is-empty"></i>
          <p class="empty-text">NO FEATURE FLAGS FOUND</p>
        </div>
      {:else}
        <div class="flags-display-container mode-{viewMode}">
          {#if viewMode === 'list'}
            <div class="flag-list-header">
              <div class="col-name">NAME</div>
              <div class="col-status">STATUS</div>
              <div class="col-version">VER</div>
              <div class="col-changes">CHG</div>
              <div class="col-time">LAST</div>
              <div class="col-type">TYPE</div>
              <div class="col-variant">VARIANT</div>
              <div class="col-payload">PAYLOAD</div>
            </div>
          {/if}
          <div class={viewMode === 'list' ? 'flag-list' : 'flags-grid'}>
            {#each filteredFlags as flag (flag.name)}
              <FlagCard
                {flag}
                {viewMode}
                initialVersion={initialVersions.get(flag.name) ?? null}
                lastChangedTime={stats?.flagLastChangedTimes?.[flag.name] ?? null}
                onSelect={() => (selectedFlag = flag)}
              />
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </section>
</div>
