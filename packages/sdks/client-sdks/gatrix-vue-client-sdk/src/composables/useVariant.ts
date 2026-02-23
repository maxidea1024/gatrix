import { computed } from 'vue';
import { useFlagProxy } from './useFlag';

export function useVariant(flagName: string) {
  const flagProxy = useFlagProxy(flagName);
  return computed(() => flagProxy.value.variant);
}
