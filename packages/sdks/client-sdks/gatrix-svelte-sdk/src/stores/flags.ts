// Gatrix Svelte SDK - All flags store
import { readable, type Readable } from 'svelte/store';
import { getGatrixClient } from './getGatrixClient';
import { EVENTS, type EvaluatedFlag } from '@gatrix/js-client-sdk';

/**
 * Reactive store for all evaluated flags.
 *
 * @example
 * ```svelte
 * <script>
 *   import { allFlags } from '@gatrix/svelte-sdk';
 *   const flags = allFlags();
 * </script>
 * {#each $flags as f}
 *   <p>{f.name}: {f.enabled}</p>
 * {/each}
 * ```
 */
export function allFlags(): Readable<EvaluatedFlag[]> {
    const client = getGatrixClient();

    return readable<EvaluatedFlag[]>(client.features.getAllFlags(), (set) => {
        const update = () => {
            set(client.features.getAllFlags());
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
