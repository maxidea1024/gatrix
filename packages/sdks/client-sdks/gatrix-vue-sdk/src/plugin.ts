import { ref, type App, type Plugin } from 'vue';
import { GatrixClient, EVENTS, type GatrixClientConfig } from '@gatrix/js-client-sdk';
import { GATRIX_CLIENT_KEY, GATRIX_READY_KEY, GATRIX_HEALTHY_KEY, GATRIX_ERROR_KEY } from './symbols';

export interface GatrixPluginOptions {
    config?: GatrixClientConfig;
    client?: GatrixClient;
    startClient?: boolean;
}

export const GatrixPlugin: Plugin = {
    install(app: App, options: GatrixPluginOptions = {}) {
        const { config, client: existingClient, startClient = true } = options;

        const client = existingClient || new GatrixClient(config!);
        const ready = ref(client.isReady());
        const healthy = ref(true);
        const error = ref<Error | null>(null);

        client.on(EVENTS.FLAGS_READY, () => {
            ready.value = true;
        });

        client.on(EVENTS.SDK_ERROR, (err: Error) => {
            error.value = err;
            healthy.value = false;
        });

        client.on(EVENTS.FLAGS_RECOVERED, () => {
            error.value = null;
            healthy.value = true;
        });

        if (startClient && !client.isReady()) {
            client.start();
        }

        app.provide(GATRIX_CLIENT_KEY, client);
        app.provide(GATRIX_READY_KEY, ready);
        app.provide(GATRIX_HEALTHY_KEY, healthy);
        app.provide(GATRIX_ERROR_KEY, error);

        // Add to globalProperties for convenience in non-composable contexts
        app.config.globalProperties.$gatrix = client;
    },
};
