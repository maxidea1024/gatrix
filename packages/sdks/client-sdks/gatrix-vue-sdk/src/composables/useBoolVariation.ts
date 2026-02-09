import { computed } from 'vue';
import { useFlagProxy } from './useFlag';

export function useBoolVariation(flagName: string, defaultValue: boolean) {
    const flagProxy = useFlagProxy(flagName);
    return computed(() => flagProxy.value.boolVariation(defaultValue));
}
