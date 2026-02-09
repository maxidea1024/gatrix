// Gatrix Svelte SDK - Status store
import { getContext } from 'svelte';
import { GATRIX_READY_KEY, GATRIX_HEALTHY_KEY, GATRIX_ERROR_KEY } from '../context';
import type { Readable } from 'svelte/store';

export interface FlagsStatus {
    ready: Readable<boolean>;
    healthy: Readable<boolean>;
    error: Readable<Error | null>;
}

/**
 * Get reactive stores for SDK status (ready, healthy, error).
 *
 * @example
 * ```svelte
 * <script>
 *   import { flagsStatus } from '@gatrix/svelte-sdk';
 *   const { ready, healthy, error } = flagsStatus();
 * </script>
 * {#if !$ready}
 *   <LoadingSpinner />
 * {:else if $error}
 *   <ErrorBanner message={$error.message} />
 * {/if}
 * ```
 */
export function flagsStatus(): FlagsStatus {
    const ready = getContext<Readable<boolean>>(GATRIX_READY_KEY);
    const healthy = getContext<Readable<boolean>>(GATRIX_HEALTHY_KEY);
    const error = getContext<Readable<Error | null>>(GATRIX_ERROR_KEY);

    if (!ready) {
        throw new Error('Gatrix not initialized. Call initGatrix() in a parent component.');
    }

    return { ready, healthy, error };
}
