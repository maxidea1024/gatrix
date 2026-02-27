/**
 * useBoolVariation - Get a boolean flag variation
 *
 * Returns the boolean value for a feature flag (its enabled state).
 * Automatically updates when the flag value changes.
 *
 * @param flagName - The name of the feature flag
 * @param fallbackValue - Value to return if flag not found
 * @param forceRealtime - If true, reads from realtimeFlags regardless of explicitSyncMode
 * @returns boolean - The flag's enabled state or fallback value
 *
 * @example
 * ```tsx
 * const darkMode = useBoolVariation('dark-mode', false);
 *
 * return <App theme={darkMode ? 'dark' : 'light'} />;
 * ```
 */
import { useEffect, useState } from 'react';
import { useGatrixContext } from './useGatrixContext';

export function useBoolVariation(
  flagName: string,
  fallbackValue: boolean,
  forceRealtime = false
): boolean {
  const { features } = useGatrixContext();
  const [value, setValue] = useState(() =>
    features.boolVariation(flagName, fallbackValue, forceRealtime)
  );

  useEffect(() => {
    const watchFn = forceRealtime
      ? features.watchRealtimeFlagWithInitialState.bind(features)
      : features.watchSyncedFlagWithInitialState.bind(features);

    return watchFn(flagName, () => {
      setValue(features.boolVariation(flagName, fallbackValue, forceRealtime));
    });
  }, [features, flagName, fallbackValue, forceRealtime]);

  return value;
}

export default useBoolVariation;
