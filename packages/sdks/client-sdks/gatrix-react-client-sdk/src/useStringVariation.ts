/**
 * useStringVariation - Get a string flag variation
 *
 * Returns the string value from a feature flag's variant payload.
 * Automatically updates when the flag value changes.
 *
 * @param flagName - The name of the feature flag
 * @param fallbackValue - Value to return if flag not found
 * @param forceRealtime - If true, reads from realtimeFlags regardless of explicitSyncMode
 * @returns string - The variant value as string or fallback value
 *
 * @example
 * ```tsx
 * const buttonText = useStringVariation('cta-button-text', 'Get Started');
 *
 * return <Button>{buttonText}</Button>;
 * ```
 */
import { useEffect, useState } from 'react';
import { useGatrixContext } from './useGatrixContext';

export function useStringVariation(
  flagName: string,
  fallbackValue: string,
  forceRealtime = true
): string {
  const { features } = useGatrixContext();
  const [value, setValue] = useState(() =>
    features.stringVariation(flagName, fallbackValue, forceRealtime)
  );

  useEffect(() => {
    const watchFn = forceRealtime
      ? features.watchRealtimeFlagWithInitialState.bind(features)
      : features.watchSyncedFlagWithInitialState.bind(features);

    return watchFn(flagName, () => {
      setValue(
        features.stringVariation(flagName, fallbackValue, forceRealtime)
      );
    });
  }, [features, flagName, fallbackValue, forceRealtime]);

  return value;
}

export default useStringVariation;
