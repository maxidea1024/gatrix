import { ref, computed, onUnmounted } from 'vue';
import { useGatrixClient } from './useGatrixClient';

export function useFlag(flagName: string, forceRealtime = true) {
  const client = useGatrixClient();
  const value = ref(client.features.isEnabled(flagName, forceRealtime));

  const watchFn = forceRealtime
    ? client.features.watchRealtimeFlagWithInitialState.bind(client.features)
    : client.features.watchSyncedFlagWithInitialState.bind(client.features);

  const unwatch = watchFn(flagName, (proxy) => {
    value.value = proxy.enabled;
  });

  onUnmounted(unwatch);

  return computed(() => value.value);
}
