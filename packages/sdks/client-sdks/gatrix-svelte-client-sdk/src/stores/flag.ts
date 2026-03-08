// Gatrix Svelte SDK - Reactive flag store
import { readable, type Readable } from 'svelte/store';
import { getGatrixClient } from './getGatrixClient';
import type { FlagProxy } from '@gatrix/gatrix-js-client-sdk';

/**
 * Reactive flag status interface
 */
export interface FlagState {
  enabled: boolean;
  variantName: string;
  variantEnabled: boolean;
  variantValue: string;
}

function proxyToFlagState(proxy: FlagProxy): FlagState {
  return {
    enabled: proxy.enabled,
    variantName: proxy.variant.name,
    variantEnabled: proxy.variant.enabled,
    variantValue: proxy.variant.value != null ? String(proxy.variant.value) : '',
  };
}

/**
 * Create a reactive store for full flag state (enabled + variant info).
 * @param flagName - Feature flag key
 * @param forceRealtime - If true, reads from realtimeFlags regardless of explicitSyncMode
 *
 * @example
 * ```svelte
 * <script>
 *   import { flagState } from '@gatrix/gatrix-svelte-client-sdk';
 *   const darkMode = flagState('dark-mode');
 * </script>
 * {#if $darkMode.enabled}
 *   <DarkTheme />
 *   <p>Variant: {$darkMode.variantName}</p>
 * {/if}
 * ```
 */
export function flagState(flagName: string, forceRealtime = true): Readable<FlagState> {
  const client = getGatrixClient();
  const initial: FlagState = {
    enabled: client.features.isEnabled(flagName, forceRealtime),
    variantName: client.features.getVariant(flagName, forceRealtime).name,
    variantEnabled: client.features.getVariant(flagName, forceRealtime).enabled,
    variantValue: (() => {
      const v = client.features.getVariant(flagName, forceRealtime).value;
      return v != null ? String(v) : '';
    })(),
  };

  return readable<FlagState>(initial, (set) => {
    const watchFn = forceRealtime
      ? client.features.watchRealtimeFlagWithInitialState.bind(client.features)
      : client.features.watchSyncedFlagWithInitialState.bind(client.features);
    return watchFn(flagName, (proxy) => {
      set(proxyToFlagState(proxy));
    });
  });
}

/**
 * Create a reactive boolean store for a flag's enabled state.
 * @param flagName - Feature flag key
 * @param forceRealtime - If true, reads from realtimeFlags regardless of explicitSyncMode
 *
 * @example
 * ```svelte
 * <script>
 *   import { flag } from '@gatrix/gatrix-svelte-client-sdk';
 *   const isEnabled = flag('my-feature');
 * </script>
 * {#if $isEnabled}
 *   <NewFeature />
 * {/if}
 * ```
 */
export function flag(flagName: string, forceRealtime = true): Readable<boolean> {
  const client = getGatrixClient();
  return readable<boolean>(client.features.isEnabled(flagName, forceRealtime), (set) => {
    const watchFn = forceRealtime
      ? client.features.watchRealtimeFlagWithInitialState.bind(client.features)
      : client.features.watchSyncedFlagWithInitialState.bind(client.features);
    return watchFn(flagName, (proxy) => {
      set(proxy.enabled);
    });
  });
}
