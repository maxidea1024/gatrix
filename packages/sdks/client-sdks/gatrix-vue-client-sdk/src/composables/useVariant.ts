import { computed } from 'vue';
import { useFlagProxy } from './useFlag';
import type { Variant } from '@gatrix/gatrix-js-client-sdk';

export function useVariant(flagName: string, forceRealtime = true) {
  const flagProxy = useFlagProxy(flagName, forceRealtime);
  return computed(() => flagProxy.value?.variant as Variant | undefined);
}
