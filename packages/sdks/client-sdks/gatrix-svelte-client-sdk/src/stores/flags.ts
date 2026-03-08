// Gatrix Svelte SDK - All flags store
import { readable, type Readable } from 'svelte/store';
import { getGatrixClient } from './getGatrixClient';
import { EVENTS, type EvaluatedFlag } from '@gatrix/gatrix-js-client-sdk';

/**
 * Reactive store for all evaluated flags.
 * @param forceRealtime - If true, reads from realtimeFlags regardless of explicitSyncMode
 *
 * @example
 * ```svelte
 * <script>
 *   import { allFlags } from '@gatrix/gatrix-svelte-client-sdk';
 *   const flags = allFlags();
 * </script>
 * {#each $flags as f}
 *   <p>{f.name}: {f.enabled}</p>
 * {/each}
 * ```
 */
export function allFlags(forceRealtime = true): Readable<EvaluatedFlag[]> {
  const client = getGatrixClient();

  return readable<EvaluatedFlag[]>(client.features.getAllFlags(forceRealtime), (set) => {
    const update = () => {
      set(client.features.getAllFlags(forceRealtime));
    };

    client.on(EVENTS.FLAGS_CHANGE, update);
    client.on(EVENTS.FLAGS_READY, update);
    client.on(EVENTS.FLAGS_SYNC, update);

    return () => {
      client.off(EVENTS.FLAGS_CHANGE, update);
      client.off(EVENTS.FLAGS_READY, update);
      client.off(EVENTS.FLAGS_SYNC, update);
    };
  });
}
