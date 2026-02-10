import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useGatrixClient } from './useGatrixClient';
import { EVENTS } from '@gatrix/js-client-sdk';

export function useStringVariation(flagName: string, missingValue: string) {
    const client = useGatrixClient();
    const value = ref(client.features.stringVariation(flagName, missingValue));

    const update = () => {
        value.value = client.features.stringVariation(flagName, missingValue);
    };

    onMounted(() => {
        client.on(EVENTS.FLAGS_CHANGE, update);
        client.on(EVENTS.FLAGS_READY, update);
        client.on(EVENTS.FLAGS_SYNC, update);
    });

    onUnmounted(() => {
        client.off(EVENTS.FLAGS_CHANGE, update);
        client.off(EVENTS.FLAGS_READY, update);
        client.off(EVENTS.FLAGS_SYNC, update);
    });

    return computed(() => value.value);
}
