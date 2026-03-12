import { ref, computed, onUnmounted } from 'vue';
import { useGatrixClient } from './useGatrixClient';
import type { Variant } from '@gatrix/gatrix-js-client-sdk';

export function useVariant(flagName: string, forceRealtime = true) {
  const client = useGatrixClient();
  const value = ref<Variant | undefined>(
    client.features.getVariant(flagName, forceRealtime)
  );

  const watchFn = forceRealtime
    ? client.features.watchRealtimeFlagWithInitialState.bind(client.features)
    : client.features.watchSyncedFlagWithInitialState.bind(client.features);

  const unwatch = watchFn(flagName, (proxy) => {
    value.value = proxy.variant;
  });

  onUnmounted(unwatch);

  return computed(() => value.value);
}
