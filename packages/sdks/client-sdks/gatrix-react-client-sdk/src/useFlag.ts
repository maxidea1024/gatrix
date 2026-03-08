/**
 * useFlag - Check if a feature flag is enabled
 *
 * Returns a boolean indicating whether the flag is enabled.
 * Automatically updates when the flag value changes.
 *
 * @param flagName - The name of the feature flag
 * @param forceRealtime - If true, reads from realtimeFlags regardless of explicitSyncMode
 * @returns boolean - Whether the flag is enabled
 *
 * @example
 * ```tsx
 * const isNewUIEnabled = useFlag('new-ui');
 *
 * if (isNewUIEnabled) {
 *   return <NewUI />;
 * }
 * return <OldUI />;
 * ```
 */
import { useEffect, useState } from 'react';
import { useGatrixContext } from './useGatrixContext';

export function useFlag(flagName: string, forceRealtime = true): boolean {
  const { features } = useGatrixContext();
  const [flag, setFlag] = useState(() =>
    features.isEnabled(flagName, forceRealtime)
  );

  useEffect(() => {
    const watchFn = forceRealtime
      ? features.watchRealtimeFlagWithInitialState.bind(features)
      : features.watchSyncedFlagWithInitialState.bind(features);

    return watchFn(flagName, (proxy) => {
      setFlag(proxy.enabled);
    });
  }, [features, flagName, forceRealtime]);

  return flag;
}

export default useFlag;
