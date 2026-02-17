/**
 * useVariant - Get a feature flag's variant
 *
 * Returns the variant information for a feature flag.
 * Automatically updates when the variant changes.
 *
 * @param flagName - The name of the feature flag
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
import { useState, useEffect, useRef } from 'react';
import { useGatrixContext } from './useGatrixContext';
import { EVENTS, VARIANT_SOURCE, type Variant } from '@gatrix/js-client-sdk';

/**
 * Check if variant has changed
 */
export const variantHasChanged = (oldVariant: Variant, newVariant?: Variant): boolean => {
  if (!newVariant) return true;

  const variantsAreEqual =
    oldVariant.name === newVariant.name &&
    oldVariant.enabled === newVariant.enabled &&
    JSON.stringify(oldVariant.value) === JSON.stringify(newVariant.value);

  return !variantsAreEqual;
};

export function useVariant(flagName: string): Variant {
  const { getVariant, client } = useGatrixContext();
  const [variant, setVariant] = useState<Variant>(() => getVariant(flagName) || { name: VARIANT_SOURCE.MISSING, enabled: false });
  const variantRef = useRef<Variant>(variant);
  variantRef.current = variant;

  useEffect(() => {
    if (!client) return;

    const updateHandler = () => {
      const newVariant = getVariant(flagName);
      if (variantHasChanged(variantRef.current, newVariant)) {
        variantRef.current = newVariant;
        setVariant(newVariant);
      }
    };

    const readyHandler = () => {
      const newVariant = getVariant(flagName);
      variantRef.current = newVariant;
      setVariant(newVariant);
    };

    client.on(EVENTS.FLAGS_CHANGE, updateHandler);
    client.on(EVENTS.FLAGS_READY, readyHandler);
    client.on(EVENTS.FLAGS_SYNC, updateHandler);

    return () => {
      client.off(EVENTS.FLAGS_CHANGE, updateHandler);
      client.off(EVENTS.FLAGS_READY, readyHandler);
      client.off(EVENTS.FLAGS_SYNC, updateHandler);
    };
  }, [client, flagName]);

  return variant;
}

export default useVariant;
