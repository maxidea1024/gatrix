// Gatrix Svelte SDK - Provider setup
// Call initGatrix() in your root layout/component to initialize the SDK

import { setContext } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import { GatrixClient, EVENTS, type GatrixClientConfig } from '@gatrix/js-client-sdk';
import { GATRIX_CLIENT_KEY, GATRIX_READY_KEY, GATRIX_HEALTHY_KEY, GATRIX_ERROR_KEY } from './context';

export interface GatrixInitOptions {
    config?: GatrixClientConfig;
    client?: GatrixClient;
    /** Whether to auto-start the client. Defaults to true. */
    startClient?: boolean;
}

/**
 * Initialize the Gatrix SDK in a Svelte component tree.
 * Must be called during component initialization (in top-level script).
 *
 * @example
 * ```svelte
 * <script>
 *   import { initGatrix } from '@gatrix/svelte-sdk';
 *   initGatrix({
 *     config: {
 *       apiUrl: 'http://localhost:3400/api/v1',
 *       apiToken: 'your-token',
 *       appName: 'MyApp',
 *       environment: 'development',
 *     }
 *   });
 * </script>
 * ```
 */
export function initGatrix(options: GatrixInitOptions = {}): GatrixClient {
    const { config, client: existingClient, startClient = true } = options;

    const client = existingClient || new GatrixClient(config!);
    const ready: Writable<boolean> = writable(client.isReady());
    const healthy: Writable<boolean> = writable(true);
    const error: Writable<Error | null> = writable(null);

    client.on(EVENTS.FLAGS_READY, () => {
        ready.set(true);
    });

    client.on(EVENTS.SDK_ERROR, (err: Error) => {
        error.set(err);
        healthy.set(false);
    });

    client.on(EVENTS.FLAGS_RECOVERED, () => {
        error.set(null);
        healthy.set(true);
    });

    if (startClient && !client.isReady()) {
        client.start();
    }

    setContext(GATRIX_CLIENT_KEY, client);
    setContext(GATRIX_READY_KEY, ready);
    setContext(GATRIX_HEALTHY_KEY, healthy);
    setContext(GATRIX_ERROR_KEY, error);

    return client;
}
