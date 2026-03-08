// Gatrix Svelte SDK - Variation stores
import { readable, type Readable } from 'svelte/store';
import { getGatrixClient } from './getGatrixClient';
import type { Variant } from '@gatrix/gatrix-js-client-sdk';

/**
 * Reactive boolean variation store.
 * @param flagName - Feature flag key
 * @param fallbackValue - Value to return if flag not found
 * @param forceRealtime - If true, reads from realtimeFlags regardless of explicitSyncMode
 * @example
 * ```svelte
 * <script>
 *   import { boolVariation } from '@gatrix/gatrix-svelte-client-sdk';
 *   const darkMode = boolVariation('dark-mode', false);
 * </script>
 * ```
 */
export function boolVariation(
  flagName: string,
  fallbackValue: boolean,
  forceRealtime = true
): Readable<boolean> {
  const client = getGatrixClient();
  return readable<boolean>(
    client.features.boolVariation(flagName, fallbackValue, forceRealtime),
    (set) => {
      const watchFn = forceRealtime
        ? client.features.watchRealtimeFlagWithInitialState.bind(
            client.features
          )
        : client.features.watchSyncedFlagWithInitialState.bind(client.features);
      return watchFn(flagName, () => {
        set(
          client.features.boolVariation(flagName, fallbackValue, forceRealtime)
        );
      });
    }
  );
}

/**
 * Reactive string variation store.
 * @param flagName - Feature flag key
 * @param fallbackValue - Value to return if flag not found
 * @param forceRealtime - If true, reads from realtimeFlags regardless of explicitSyncMode
 */
export function stringVariation(
  flagName: string,
  fallbackValue: string,
  forceRealtime = true
): Readable<string> {
  const client = getGatrixClient();
  return readable<string>(
    client.features.stringVariation(flagName, fallbackValue, forceRealtime),
    (set) => {
      const watchFn = forceRealtime
        ? client.features.watchRealtimeFlagWithInitialState.bind(
            client.features
          )
        : client.features.watchSyncedFlagWithInitialState.bind(client.features);
      return watchFn(flagName, () => {
        set(
          client.features.stringVariation(
            flagName,
            fallbackValue,
            forceRealtime
          )
        );
      });
    }
  );
}

/**
 * Reactive number variation store.
 * @param flagName - Feature flag key
 * @param fallbackValue - Value to return if flag not found
 * @param forceRealtime - If true, reads from realtimeFlags regardless of explicitSyncMode
 */
export function numberVariation(
  flagName: string,
  fallbackValue: number,
  forceRealtime = true
): Readable<number> {
  const client = getGatrixClient();
  return readable<number>(
    client.features.numberVariation(flagName, fallbackValue, forceRealtime),
    (set) => {
      const watchFn = forceRealtime
        ? client.features.watchRealtimeFlagWithInitialState.bind(
            client.features
          )
        : client.features.watchSyncedFlagWithInitialState.bind(client.features);
      return watchFn(flagName, () => {
        set(
          client.features.numberVariation(
            flagName,
            fallbackValue,
            forceRealtime
          )
        );
      });
    }
  );
}

/**
 * Reactive JSON variation store.
 * @param flagName - Feature flag key
 * @param fallbackValue - Value to return if flag not found
 * @param forceRealtime - If true, reads from realtimeFlags regardless of explicitSyncMode
 */
export function jsonVariation<T = unknown>(
  flagName: string,
  fallbackValue: T,
  forceRealtime = true
): Readable<T> {
  const client = getGatrixClient();
  return readable<T>(
    client.features.jsonVariation(flagName, fallbackValue, forceRealtime),
    (set) => {
      const watchFn = forceRealtime
        ? client.features.watchRealtimeFlagWithInitialState.bind(
            client.features
          )
        : client.features.watchSyncedFlagWithInitialState.bind(client.features);
      return watchFn(flagName, () => {
        set(
          client.features.jsonVariation(flagName, fallbackValue, forceRealtime)
        );
      });
    }
  );
}

/**
 * Reactive variant store.
 * @param flagName - Feature flag key
 * @param forceRealtime - If true, reads from realtimeFlags regardless of explicitSyncMode
 */
export function variant(
  flagName: string,
  forceRealtime = true
): Readable<Variant> {
  const client = getGatrixClient();
  return readable<Variant>(
    client.features.getVariant(flagName, forceRealtime),
    (set) => {
      const watchFn = forceRealtime
        ? client.features.watchRealtimeFlagWithInitialState.bind(
            client.features
          )
        : client.features.watchSyncedFlagWithInitialState.bind(client.features);
      return watchFn(
        flagName,
        (proxy: import('@gatrix/gatrix-js-client-sdk').FlagProxy) => {
          set(proxy.variant);
        }
      );
    }
  );
}
