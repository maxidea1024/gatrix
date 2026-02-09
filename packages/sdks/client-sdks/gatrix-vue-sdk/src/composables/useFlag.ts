import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useGatrixClient } from './useGatrixClient';
import { EVENTS } from '@gatrix/js-client-sdk';
import type { FlagProxy } from '@gatrix/js-client-sdk';

export function useFlagProxy(flagName: string) {
    const client = useGatrixClient();
    const flag = ref<FlagProxy>(client.features.getFlag(flagName));

    let unsubscribe: () => void;

    const updateFlag = () => {
        flag.value = client.features.getFlag(flagName);
    };

    onMounted(() => {
        client.on(EVENTS.FLAGS_CHANGE, updateFlag);
        client.on(EVENTS.FLAGS_READY, updateFlag);
        client.on(EVENTS.FLAGS_SYNC, updateFlag);

        // Specifically watch this flag for changes
        unsubscribe = client.features.watchFlag(flagName, () => {
            updateFlag();
        }, `vue_watch_${flagName}`);
    });

    onUnmounted(() => {
        client.off(EVENTS.FLAGS_CHANGE, updateFlag);
        client.off(EVENTS.FLAGS_READY, updateFlag);
        client.off(EVENTS.FLAGS_SYNC, updateFlag);
        if (unsubscribe) {
            unsubscribe();
        }
    });

    return flag;
}

export function useFlag(flagName: string) {
    const flagProxy = useFlagProxy(flagName);
    return computed(() => flagProxy.value.enabled);
}
