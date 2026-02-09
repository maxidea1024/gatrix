import { computed } from 'vue';
import { useFlagProxy } from './useFlag';

export function useJsonVariation<T>(flagName: string, defaultValue: T) {
    const flagProxy = useFlagProxy(flagName);
    return computed(() => flagProxy.value.jsonVariation(defaultValue));
}
