import { ref, computed, onUnmounted } from 'vue';
import { useGatrixClient } from './useGatrixClient';
import type { FlagProxy } from '@gatrix/gatrix-js-client-sdk';

export function useFlagProxy(flagName: string, forceRealtime = true) {
  const client = useGatrixClient();
  const flag = ref<FlagProxy | null>(null);

  const watchFn = forceRealtime
    ? client.features.watchRealtimeFlagWithInitialState.bind(client.features)
    : client.features.watchSyncedFlagWithInitialState.bind(client.features);

  const unwatch = watchFn(flagName, (proxy: FlagProxy) => {
    flag.value = proxy;
  });

  onUnmounted(unwatch);

  return flag;
}

export function useFlag(flagName: string, forceRealtime = true) {
  const flagProxy = useFlagProxy(flagName, forceRealtime);
  return computed(() => flagProxy.value?.enabled ?? false);
}
