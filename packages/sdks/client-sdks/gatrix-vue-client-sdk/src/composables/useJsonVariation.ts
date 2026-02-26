import { ref, computed, onUnmounted } from 'vue';
import { useGatrixClient } from './useGatrixClient';

export function useJsonVariation<T>(flagName: string, fallbackValue: T, forceRealtime = false) {
  const client = useGatrixClient();
  const value = ref<T>(client.features.jsonVariation<T>(flagName, fallbackValue, forceRealtime));

  const watchFn = forceRealtime
    ? client.features.watchRealtimeFlagWithInitialState.bind(client.features)
    : client.features.watchSyncedFlagWithInitialState.bind(client.features);

  const unwatch = watchFn(flagName, () => {
    (value as any).value = client.features.jsonVariation<T>(flagName, fallbackValue, forceRealtime);
  });

  onUnmounted(unwatch);

  return computed(() => value.value as T);
}
