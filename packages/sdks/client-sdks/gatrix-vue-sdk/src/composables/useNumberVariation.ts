import { computed } from 'vue';
import { useFlagProxy } from './useFlag';

export function useNumberVariation(flagName: string, defaultValue: number) {
    const flagProxy = useFlagProxy(flagName);
    return computed(() => flagProxy.value.numberVariation(defaultValue));
}
