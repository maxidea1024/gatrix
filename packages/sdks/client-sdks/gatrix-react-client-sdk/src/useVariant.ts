/**
 * useVariant - Get a feature flag's variant
 *
 * Returns the variant information for a feature flag.
 * Automatically updates when the variant changes.
 *
 * @param flagName - The name of the feature flag
 * @param forceRealtime - If true, reads from realtimeFlags regardless of explicitSyncMode
 * @returns Variant - The variant object
 *
 * @example
 * ```tsx
 * const variant = useVariant('button-color');
 *
 * return (
 *   <Button color={variant.value || 'blue'}>
 *     Click me
 *   </Button>
 * );
 * ```
 */
import { useEffect, useState } from 'react';
import { useGatrixContext } from './useGatrixContext';
import { VARIANT_SOURCE, type Variant } from '@gatrix/gatrix-js-client-sdk';

/** Check if variant has meaningfully changed (used by external consumers) */
export const variantHasChanged = (oldVariant: Variant, newVariant?: Variant): boolean => {
  if (!newVariant) return true;
  return (
    oldVariant.name !== newVariant.name ||
    oldVariant.enabled !== newVariant.enabled ||
    JSON.stringify(oldVariant.value) !== JSON.stringify(newVariant.value)
  );
};

export function useVariant(flagName: string, forceRealtime = false): Variant {
  const { features } = useGatrixContext();
  const [variant, setVariant] = useState<Variant>(
    () => features.getVariant(flagName, forceRealtime) || { name: VARIANT_SOURCE.MISSING, enabled: false }
  );

  useEffect(() => {
    const watchFn = forceRealtime
      ? features.watchRealtimeFlagWithInitialState.bind(features)
      : features.watchSyncedFlagWithInitialState.bind(features);

    return watchFn(flagName, (proxy) => {
      setVariant(proxy.variant);
    });
  }, [features, flagName, forceRealtime]);

  return variant;
}

export default useVariant;
