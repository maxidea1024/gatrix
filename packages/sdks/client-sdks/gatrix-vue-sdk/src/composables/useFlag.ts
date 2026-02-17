import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useGatrixClient } from './useGatrixClient';
import type { FlagProxy } from '@gatrix/js-client-sdk';

export function useFlagProxy(flagName: string) {
  const client = useGatrixClient();

  // Initialize with a lightweight placeholder; watchFlagWithInitialState
  // will fire immediately with the real proxy.
  const flag = ref<FlagProxy | null>(null);

  let unsubscribe: (() => void) | undefined;

  onMounted(() => {
    unsubscribe = client.features.watchFlagWithInitialState(
      flagName,
      (proxy: FlagProxy) => {
        flag.value = proxy;
      },
      `vue_watch_${flagName}`
    );
  });

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });

  return flag;
}

export function useFlag(flagName: string) {
  const flagProxy = useFlagProxy(flagName);
  return computed(() => flagProxy.value?.enabled ?? false);
}
