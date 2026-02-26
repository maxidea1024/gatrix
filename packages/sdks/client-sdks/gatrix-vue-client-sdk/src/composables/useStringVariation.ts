import { ref, computed, onUnmounted } from 'vue';
import { useGatrixClient } from './useGatrixClient';

export function useStringVariation(flagName: string, fallbackValue: string, forceRealtime = false) {
  const client = useGatrixClient();
  const value = ref(client.features.stringVariation(flagName, fallbackValue, forceRealtime));

  const watchFn = forceRealtime
    ? client.features.watchRealtimeFlagWithInitialState.bind(client.features)
    : client.features.watchSyncedFlagWithInitialState.bind(client.features);

  const unwatch = watchFn(flagName, () => {
    value.value = client.features.stringVariation(flagName, fallbackValue, forceRealtime);
  });

  onUnmounted(unwatch);

  return computed(() => value.value);
}
