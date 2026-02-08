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
 *   <Button color={variant.payload?.value || 'blue'}>
 *     Click me
 *   </Button>
 * );
 * ```
 */
import { useState, useEffect, useRef } from 'react';
import { useGatrixContext } from './useGatrixContext';
import { EVENTS, type Variant } from '@gatrix/js-client-sdk';

/**
 * Check if variant has changed
 */
export const variantHasChanged = (oldVariant: Variant, newVariant?: Variant): boolean => {
  if (!newVariant) return true;

  const variantsAreEqual =
    oldVariant.name === newVariant.name &&
    oldVariant.enabled === newVariant.enabled &&
    JSON.stringify(oldVariant.payload) === JSON.stringify(newVariant.payload);

  return !variantsAreEqual;
};

const DISABLED_VARIANT: Variant = { name: 'disabled', enabled: false };

export function useVariant(flagName: string): Variant {
  const { getVariant, client } = useGatrixContext();
  const [variant, setVariant] = useState<Variant>(() => getVariant(flagName) || DISABLED_VARIANT);
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

    client.on(EVENTS.CHANGE, updateHandler);
    client.on(EVENTS.READY, readyHandler);
    client.on(EVENTS.SYNC, updateHandler);

    return () => {
      client.off(EVENTS.CHANGE, updateHandler);
      client.off(EVENTS.READY, readyHandler);
      client.off(EVENTS.SYNC, updateHandler);
    };
  }, [client, flagName]);

  return variant;
}

export default useVariant;
