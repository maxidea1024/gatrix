import { computed } from 'vue';
import { useFlagProxy } from './useFlag';

export function useStringVariation(flagName: string, defaultValue: string) {
    const flagProxy = useFlagProxy(flagName);
    return computed(() => flagProxy.value.stringVariation(defaultValue));
}
