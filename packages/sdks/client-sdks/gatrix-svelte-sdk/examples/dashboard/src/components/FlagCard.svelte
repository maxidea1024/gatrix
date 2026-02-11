<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { EvaluatedFlag } from '@gatrix/js-client-sdk';
  import { getGatrixClient } from '@gatrix/svelte-sdk';

  export let flag: EvaluatedFlag;
  export let viewMode: 'detailed' | 'simple' | 'list';
  export let initialVersion: number | null;
  export let lastChangedTime: Date | null;
  export let onSelect: () => void;

  const client = getGatrixClient();

  let isUpdating = false;
  let timeAgo = formatTimeAgo(lastChangedTime);
  let prevVersion = flag.version;
  let isInitialMount = true;
  let timeInterval: ReturnType<typeof setInterval>;
  let updateTimeout: ReturnType<typeof setTimeout>;

  function formatTimeAgo(date: Date | null): string {
    if (!date) return '-';
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour > 0) return `${diffHour}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    if (diffSec > 5) return `${diffSec}s ago`;
    return 'just now';
  }

  // Register flag access for metrics
  $: client.features.isEnabled(flag.name);

  // Detect flag version changes and trigger flash
  $: {
    if (isInitialMount) {
      isInitialMount = false;
      prevVersion = flag.version;
    } else if (prevVersion !== flag.version) {
      prevVersion = flag.version;
      isUpdating = true;
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => (isUpdating = false), 500);
    }
  }

  // Update time ago every second
  $: {
    timeAgo = formatTimeAgo(lastChangedTime);
  }

  onMount(() => {
    timeInterval = setInterval(() => {
      timeAgo = formatTimeAgo(lastChangedTime);
    }, 1000);
  });

  onDestroy(() => {
    clearInterval(timeInterval);
    if (updateTimeout) clearTimeout(updateTimeout);
  });

  function formatValue(v: unknown): string {
    if (v === '') return 'EMPTY STRING';
    if (typeof v === 'object') {
      const str = JSON.stringify(v, null, 2);
      return str.length > 80 ? str.substring(0, 77) + '...' : str;
    }
    return String(v);
  }

  function getValueSize(v: unknown): number {
    if (v === undefined || v === null) return 0;
    const str = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return new Blob([str]).size;
  }

  $: flagValue = flag.variant?.value;
  $: hasValue = flagValue !== undefined && flagValue !== null;
  $: isEmptyString = flagValue === '';
  $: valueSize = hasValue ? getValueSize(flagValue) : 0;
  $: changeCount = initialVersion !== null ? Math.max(0, (flag.version || 0) - initialVersion) : 0;
</script>

{#if viewMode === 'list'}
  <!-- List View -->
  <div
    class="flag-list-item {isUpdating ? 'flag-card-flash' : ''} {flag.enabled
      ? 'is-enabled'
      : 'is-disabled'}"
    on:click={onSelect}
    on:keydown={(e) => e.key === 'Enter' && onSelect()}
    role="button"
    tabindex="0"
  >
    <div class="col-name">
      <span class="status-dot"></span>
      {flag.name}
    </div>
    <div class="col-status">
      <span class="badge is-small {flag.enabled ? 'badge-success' : 'badge-error'}">
        {flag.enabled ? 'ON' : 'OFF'}
      </span>
    </div>
    <div class="col-version">{flag.version || 0}</div>
    <div class="col-changes">
      {#if changeCount > 0}
        <span class="has-changes">+{changeCount}</span>
      {:else}
        -
      {/if}
    </div>
    <div class="col-time">{timeAgo}</div>
    <div class="col-type">
      <span class="pixel-chip type-chip is-mini">{flag.valueType || 'none'}</span>
    </div>
    <div class="col-variant">
      <span class="pixel-chip variant-chip is-mini">{flag.variant?.name || '-'}</span>
    </div>
    <div class="col-payload">
      <span class="payload-preview">{hasValue ? formatValue(flagValue) : '-'}</span>
    </div>
  </div>
{:else if viewMode === 'simple'}
  <!-- Simple Card -->
  <div
    class="flag-card simple-mode {isUpdating ? 'flag-card-flash' : ''}"
    on:click={onSelect}
    on:keydown={(e) => e.key === 'Enter' && onSelect()}
    role="button"
    tabindex="0"
    title={flag.name}
  >
    <div class="flag-card-inner {flag.enabled ? 'is-enabled' : 'is-disabled'}">
      <div class="flag-header">
        <span class="flag-name" style="font-size:10px">
          <span class="status-dot"></span>
          {flag.name}
        </span>
        <span class="pixel-chip type-chip is-mini" style="font-size:6px">
          {flag.valueType || 'none'}
        </span>
      </div>
      <div class="flag-details" style="margin-top:0">
        <div class="flag-detail" style="padding-bottom:0;margin-bottom:0;border-bottom:none">
          <span
            class="pixel-chip variant-chip is-mini"
            style="font-size:8px;width:100%;text-align:center;color:#000;font-weight:bold"
          >
            {flag.variant?.name || '-'}
          </span>
        </div>
      </div>
    </div>
  </div>
{:else}
  <!-- Detailed Card -->
  <div
    class="flag-card {isUpdating ? 'flag-card-flash' : ''}"
    on:click={onSelect}
    on:keydown={(e) => e.key === 'Enter' && onSelect()}
    role="button"
    tabindex="0"
    style="cursor:pointer"
  >
    <div class="flag-card-inner {flag.enabled ? 'is-enabled' : 'is-disabled'}">
      <div class="flag-header">
        <span class="flag-name">
          <span class="status-dot"></span>
          {flag.name}
        </span>
        <span class="badge {flag.enabled ? 'badge-success' : 'badge-error'}">
          {flag.enabled ? 'ON' : 'OFF'}
        </span>
      </div>

      <div class="flag-details">
        <div class="flag-detail">
          <span class="flag-detail-label">Version</span>
          <span class="flag-detail-value">{flag.version || 0}</span>
        </div>
        <div class="flag-detail">
          <span class="flag-detail-label">Changes</span>
          <span class="flag-detail-value {changeCount > 0 ? 'has-changes' : ''}">
            {changeCount > 0 ? `+${changeCount}` : '-'}
          </span>
        </div>
        <div class="flag-detail">
          <span class="flag-detail-label">Last Change</span>
          <span class="flag-detail-value">{timeAgo}</span>
        </div>
        <div class="flag-detail">
          <span class="flag-detail-label">Type</span>
          <span class="flag-detail-value">
            <span class="pixel-chip type-chip">{flag.valueType || 'none'}</span>
          </span>
        </div>
        <div class="flag-detail">
          <span class="flag-detail-label">Variant</span>
          <span class="flag-detail-value">
            <span class="pixel-chip variant-chip">{flag.variant?.name || '-'}</span>
          </span>
        </div>
        <div class="flag-payload">
          <div class="flag-payload-label">Value</div>
          {#if hasValue}
            <div class="flag-payload-value {isEmptyString ? 'empty-string' : 'has-payload'}">
              {formatValue(flagValue)}
            </div>
            <div class="flag-payload-size">{valueSize} BYTES</div>
          {:else}
            <div class="flag-payload-value no-payload">✕ NO VALUE</div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
