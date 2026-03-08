import { ref, computed, onUnmounted } from 'vue';
import { useGatrixClient } from './useGatrixClient';

export function useBoolVariation(
  flagName: string,
  fallbackValue: boolean,
  forceRealtime = true
) {
  const client = useGatrixClient();
  const value = ref(
    client.features.boolVariation(flagName, fallbackValue, forceRealtime)
  );

  const watchFn = forceRealtime
    ? client.features.watchRealtimeFlagWithInitialState.bind(client.features)
    : client.features.watchSyncedFlagWithInitialState.bind(client.features);

  const unwatch = watchFn(flagName, () => {
    value.value = client.features.boolVariation(
      flagName,
      fallbackValue,
      forceRealtime
    );
  });

  onUnmounted(unwatch);

  return computed(() => value.value);
}
