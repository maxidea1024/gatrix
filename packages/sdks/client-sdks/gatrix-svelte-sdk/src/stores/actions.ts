// Gatrix Svelte SDK - Action helpers
import { getGatrixClient } from './getGatrixClient';
import type { GatrixContext } from '@gatrix/js-client-sdk';

/**
 * Get a function to update the evaluation context.
 * Triggers a re-fetch from the server.
 *
 * @example
 * ```svelte
 * <script>
 *   import { updateContext } from '@gatrix/svelte-sdk';
 *   const setContext = updateContext();
 *   setContext({ userId: 'new-user', properties: { level: 10 } });
 * </script>
 * ```
 */
export function updateContext(): (context: Partial<GatrixContext>) => void {
    const client = getGatrixClient();
    return (context: Partial<GatrixContext>) => client.features.updateContext(context);
}

/**
 * Get a function to manually sync flags (explicit sync mode).
 */
export function syncFlags(): (fetchNow?: boolean) => void {
    const client = getGatrixClient();
    return (fetchNow?: boolean) => client.features.syncFlags(fetchNow);
}

/**
 * Get a function to manually trigger a flag fetch.
 */
export function fetchFlags(): () => void {
    const client = getGatrixClient();
    return () => client.features.fetchFlags();
}
