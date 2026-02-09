<script lang="ts">
  import type { EvaluatedFlag } from '@gatrix/js-client-sdk';

  export let flag: EvaluatedFlag;
  export let onClose: () => void;

  $: payload = flag.variant?.payload;
  $: hasPayload = payload !== undefined && payload !== null;
  $: isEmptyString = payload === '';

  function formatPayload(p: unknown): string {
    try {
      if (typeof p === 'object') return JSON.stringify(p, null, 2);
      return String(p);
    } catch {
      return String(p);
    }
  }

  function getPayloadSize(p: unknown): number {
    if (p === undefined || p === null) return 0;
    const str = typeof p === 'object' ? JSON.stringify(p) : String(p);
    return new Blob([str]).size;
  }

  $: payloadSize = hasPayload ? getPayloadSize(payload) : 0;

  function handleOverlayClick() {
    onClose();
  }

  function handleContentClick(e: MouseEvent) {
    e.stopPropagation();
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="modal-overlay" on:click={handleOverlayClick} style="z-index:5000" role="dialog">
  <div
    class="modal-content flag-card-inner rumble-on-pop {flag.enabled
      ? 'is-enabled'
      : 'is-disabled'}"
    on:click={handleContentClick}
    role="document"
    style="max-width:700px;width:90%;max-height:85vh;padding:0;overflow:hidden;background-color:#fff;box-shadow:0 0 40px rgba(0,0,0,0.5);cursor:default;display:flex;flex-direction:column"
  >
    <div class="flag-header" style="margin:0;padding:8px 16px">
      <span class="flag-name" style="font-size:12px">
        <span class="status-dot" style="width:10px;height:10px"></span>
        {flag.name}
      </span>
      <span class="badge {flag.enabled ? 'badge-success' : 'badge-error'}" style="font-size:9px">
        {flag.enabled ? 'ON' : 'OFF'}
      </span>
    </div>

    <div class="modal-scroll-area" style="padding:12px;margin:0;flex:1;overflow-y:auto">
      <div class="flag-details">
        <div
          class="detail-grid"
          style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;border-bottom:4px solid #eee;padding-bottom:12px"
        >
          <div
            class="flag-detail"
            style="margin:0;border:none;flex-direction:column;align-items:flex-start;gap:4px"
          >
            <span class="flag-detail-label">Version</span>
            <span class="flag-detail-value">{flag.version || 0}</span>
          </div>
          <div
            class="flag-detail"
            style="margin:0;border:none;flex-direction:column;align-items:flex-start;gap:4px"
          >
            <span class="flag-detail-label">Type</span>
            <span class="flag-detail-value">
              <span class="pixel-chip type-chip">{flag.variantType || 'none'}</span>
            </span>
          </div>
          <div
            class="flag-detail"
            style="margin:0;border:none;flex-direction:column;align-items:flex-start;gap:4px"
          >
            <span class="flag-detail-label">Variant</span>
            <span class="flag-detail-value">
              <span class="pixel-chip variant-chip">{flag.variant?.name || '-'}</span>
            </span>
          </div>
        </div>

        <div class="flag-payload" style="margin-top:12px">
          <div class="flag-payload-label" style="margin-bottom:6px">Payload Detail</div>
          {#if hasPayload}
            <pre
              class="flag-payload-value {isEmptyString ? 'empty-string' : 'has-payload'}"
              style="white-space:pre-wrap;font-size:9px;line-height:1.5;border:4px solid #ddd;background-color:#f9f9f9;color:#1b5e20;padding:12px;margin:0">{formatPayload(
                payload
              )}</pre>
            <div
              class="flag-payload-size"
              style="font-size:8px;color:#888;margin-top:6px;text-align:right"
            >
              {payloadSize} BYTES
            </div>
          {:else}
            <div class="flag-payload-value no-payload" style="padding:20px">✕ NO PAYLOAD</div>
          {/if}
        </div>

        {#if flag.impressionData}
          <div
            class="flag-detail"
            style="margin-top:12px;border:none;justify-content:flex-start;gap:10px"
          >
            <span class="flag-detail-label">Impressions:</span>
            <span
              class="pixel-chip"
              style="background-color:#e8f5e9;color:#2e7d32;border-color:#2e7d32">ENABLED</span
            >
          </div>
        {/if}
      </div>
    </div>

    <div
      class="modal-footer"
      style="padding:8px 16px;border-top:4px solid #eee;display:flex;justify-content:flex-end;background-color:#f5f5f5"
    >
      <button
        type="button"
        class="nes-btn is-primary"
        on:click={onClose}
        style="font-size:9px;padding:6px 12px"
      >
        CLOSE
      </button>
    </div>
  </div>
</div>
