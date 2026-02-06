/**
 * useFlag - Check if a feature flag is enabled
 *
 * Returns a boolean indicating whether the flag is enabled.
 * Automatically updates when the flag value changes.
 *
 * @param flagName - The name of the feature flag
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
import { useEffect, useState, useRef } from 'react';
import { useGatrixContext } from './useGatrixContext';
import { EVENTS } from '@gatrix/js-client-sdk';

export function useFlag(flagName: string): boolean {
  const { isEnabled, client } = useGatrixContext();
  const [flag, setFlag] = useState<boolean>(() => !!isEnabled(flagName));
  const flagRef = useRef<boolean>(flag);
  flagRef.current = flag;

  useEffect(() => {
    if (!client) return;

    const updateHandler = () => {
      const enabled = isEnabled(flagName);
      if (enabled !== flagRef.current) {
        flagRef.current = enabled;
        setFlag(enabled);
      }
    };

    const readyHandler = () => {
      const enabled = isEnabled(flagName);
      flagRef.current = enabled;
      setFlag(enabled);
    };

    client.on(EVENTS.UPDATE, updateHandler);
    client.on(EVENTS.READY, readyHandler);

    return () => {
      client.off(EVENTS.UPDATE, updateHandler);
      client.off(EVENTS.READY, readyHandler);
    };
  }, [client, flagName]);

  return flag;
}

export default useFlag;
