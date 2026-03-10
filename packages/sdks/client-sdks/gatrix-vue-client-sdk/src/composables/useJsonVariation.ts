import { ref, computed, onUnmounted } from 'vue';
import { useGatrixClient } from './useGatrixClient';

export function useJsonVariation<T>(
  flagName: string,
  fallbackValue: T,
  forceRealtime = true
) {
  const client = useGatrixClient();
  const value = ref<T>(
    client.features.jsonVariation<T>(flagName, fallbackValue, forceRealtime)
  );

  const watchFn = forceRealtime
    ? client.features.watchRealtimeFlagWithInitialState.bind(client.features)
    : client.features.watchSyncedFlagWithInitialState.bind(client.features);

  const unwatch = watchFn(flagName, (proxy) => {
    (value as any).value = proxy.jsonVariation<T>(fallbackValue);
  });

  onUnmounted(unwatch);

  return computed(() => value.value as T);
}
