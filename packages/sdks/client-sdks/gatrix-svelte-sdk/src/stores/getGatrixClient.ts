// Gatrix Svelte SDK - Core store: getGatrixClient
import { getContext } from 'svelte';
import { GATRIX_CLIENT_KEY } from '../context';
import type { GatrixClient } from '@gatrix/js-client-sdk';

/**
 * Get the GatrixClient instance from the Svelte context.
 * Must be called within a component that is a descendant of a component
 * that called initGatrix().
 */
export function getGatrixClient(): GatrixClient {
    const client = getContext<GatrixClient>(GATRIX_CLIENT_KEY);
    if (!client) {
        throw new Error(
            'Gatrix not initialized. Call initGatrix() in a parent component.'
        );
    }
    return client;
}
