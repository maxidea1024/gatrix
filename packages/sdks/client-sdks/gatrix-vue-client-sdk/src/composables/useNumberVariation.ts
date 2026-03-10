import { ref, computed, onUnmounted } from 'vue';
import { useGatrixClient } from './useGatrixClient';

export function useNumberVariation(
  flagName: string,
  fallbackValue: number,
  forceRealtime = true
) {
  const client = useGatrixClient();
  const value = ref(
    client.features.numberVariation(flagName, fallbackValue, forceRealtime)
  );

  const watchFn = forceRealtime
    ? client.features.watchRealtimeFlagWithInitialState.bind(client.features)
    : client.features.watchSyncedFlagWithInitialState.bind(client.features);

  const unwatch = watchFn(flagName, (proxy) => {
    value.value = proxy.numberVariation(fallbackValue);
  });

  onUnmounted(unwatch);

  return computed(() => value.value);
}
