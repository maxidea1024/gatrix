// Gatrix Svelte SDK - Reactive flag store
import { readable, type Readable } from 'svelte/store';
import { getGatrixClient } from './getGatrixClient';
import { EVENTS } from '@gatrix/js-client-sdk';

/**
 * Reactive flag status interface
 */
export interface FlagState {
  enabled: boolean;
  variantName: string;
  variantEnabled: boolean;
  variantValue: string;
}

function getFlagState(flagName: string, client: ReturnType<typeof getGatrixClient>): FlagState {
  const variant = client.features.getVariant(flagName);
  return {
    enabled: client.features.isEnabled(flagName),
    variantName: variant.name,
    variantEnabled: variant.enabled,
    variantValue: variant.value != null ? String(variant.value) : '',
  };
}

/**
 * Create a reactive store for full flag state (enabled + variant info).
 *
 * @example
 * ```svelte
 * <script>
 *   import { flagState } from '@gatrix/svelte-sdk';
 *   const darkMode = flagState('dark-mode');
 * </script>
 * {#if $darkMode.enabled}
 *   <DarkTheme />
 *   <p>Variant: {$darkMode.variantName}</p>
 * {/if}
 * ```
 */
export function flagState(flagName: string): Readable<FlagState> {
  const client = getGatrixClient();

  return readable<FlagState>(getFlagState(flagName, client), (set) => {
    const update = () => {
      set(getFlagState(flagName, client));
    };

    client.on(EVENTS.FLAGS_CHANGE, update);
    client.on(EVENTS.FLAGS_READY, update);
    client.on(EVENTS.FLAGS_SYNC, update);

    // Watch specific flag
    const unwatch = client.features.watchFlag(
      flagName,
      () => {
        update();
      },
      `svelte_watch_${flagName}`
    );

    return () => {
      client.off(EVENTS.FLAGS_CHANGE, update);
      client.off(EVENTS.FLAGS_READY, update);
      client.off(EVENTS.FLAGS_SYNC, update);
      unwatch();
    };
  });
}

/**
 * Create a reactive boolean store for a flag's enabled state.
 *
 * @example
 * ```svelte
 * <script>
 *   import { flag } from '@gatrix/svelte-sdk';
 *   const isEnabled = flag('my-feature');
 * </script>
 * {#if $isEnabled}
 *   <NewFeature />
 * {/if}
 * ```
 */
export function flag(flagName: string): Readable<boolean> {
  const client = getGatrixClient();

  return readable<boolean>(client.features.isEnabled(flagName), (set) => {
    const update = () => {
      set(client.features.isEnabled(flagName));
    };

    client.on(EVENTS.FLAGS_CHANGE, update);
    client.on(EVENTS.FLAGS_READY, update);
    client.on(EVENTS.FLAGS_SYNC, update);

    const unwatch = client.features.watchFlag(
      flagName,
      () => {
        update();
      },
      `svelte_flag_${flagName}`
    );

    return () => {
      client.off(EVENTS.FLAGS_CHANGE, update);
      client.off(EVENTS.FLAGS_READY, update);
      client.off(EVENTS.FLAGS_SYNC, update);
      unwatch();
    };
  });
}
