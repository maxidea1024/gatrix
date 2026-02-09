import { inject } from 'vue';
import { GATRIX_CLIENT_KEY } from '../symbols';
import type { GatrixClient } from '@gatrix/js-client-sdk';

export function useGatrixClient(): GatrixClient {
    const client = inject(GATRIX_CLIENT_KEY);
    if (!client) {
        throw new Error('GatrixPlugin not installed. Use app.use(GatrixPlugin, { config }) in your main.ts');
    }
    return client;
}
