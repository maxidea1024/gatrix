/**
 * useJsonVariation - Get a JSON flag variation
 *
 * Returns the parsed JSON value from a feature flag's variant payload.
 * Automatically updates when the flag value changes.
 *
 * @param flagName - The name of the feature flag
 * @param fallbackValue - Value to return if flag not found
 * @param forceRealtime - If true, reads from realtimeFlags regardless of explicitSyncMode
 * @returns T - The variant value as parsed JSON or fallback value
 *
 * @example
 * ```tsx
 * const config = useJsonVariation<{ timeout: number }>('api-config', { timeout: 30 });
 *
 * return <Fetcher timeout={config.timeout} />;
 * ```
 */
import { useEffect, useState } from 'react';
import { useGatrixContext } from './useGatrixContext';

export function useJsonVariation<T>(flagName: string, fallbackValue: T, forceRealtime = false): T {
  const { features } = useGatrixContext();
  const [value, setValue] = useState<T>(() =>
    features.jsonVariation<T>(flagName, fallbackValue, forceRealtime)
  );

  useEffect(() => {
    const watchFn = forceRealtime
      ? features.watchRealtimeFlagWithInitialState.bind(features)
      : features.watchSyncedFlagWithInitialState.bind(features);

    return watchFn(flagName, () => {
      setValue(features.jsonVariation<T>(flagName, fallbackValue, forceRealtime));
    });
  }, [features, flagName, fallbackValue, forceRealtime]);

  return value;
}

export default useJsonVariation;
