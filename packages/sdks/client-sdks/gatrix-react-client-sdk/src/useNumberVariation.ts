/**
 * useNumberVariation - Get a number flag variation
 *
 * Returns the number value for a feature flag.
 * Automatically updates when the flag value changes.
 *
 * @param flagName - The name of the feature flag
 * @param fallbackValue - Value to return if flag not found
 * @param forceRealtime - If true, reads from realtimeFlags regardless of explicitSyncMode
 * @returns number - The variant value as number or fallback value
 *
 * @example
 * ```tsx
 * const maxItems = useNumberVariation('max-items', 10);
 *
 * return <List items={items.slice(0, maxItems)} />;
 * ```
 */
import { useEffect, useState } from 'react';
import { useGatrixContext } from './useGatrixContext';

export function useNumberVariation(
  flagName: string,
  fallbackValue: number,
  forceRealtime = false
): number {
  const { features } = useGatrixContext();
  const [value, setValue] = useState(() =>
    features.numberVariation(flagName, fallbackValue, forceRealtime)
  );

  useEffect(() => {
    const watchFn = forceRealtime
      ? features.watchRealtimeFlagWithInitialState.bind(features)
      : features.watchSyncedFlagWithInitialState.bind(features);

    return watchFn(flagName, () => {
      setValue(features.numberVariation(flagName, fallbackValue, forceRealtime));
    });
  }, [features, flagName, fallbackValue, forceRealtime]);

  return value;
}

export default useNumberVariation;
