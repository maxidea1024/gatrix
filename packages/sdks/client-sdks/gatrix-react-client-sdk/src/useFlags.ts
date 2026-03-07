/**
 * useFlags - Get all feature flags
 *
 * Returns an array of all evaluated feature flags.
 * Automatically updates when flags change.
 *
 * @returns EvaluatedFlag[] - Array of all flags
 *
 * @example
 * ```tsx
 * const flags = useFlags();
 *
 * return (
 *   <ul>
 *     {flags.map(flag => (
 *       <li key={flag.name}>
 *         {flag.name}: {flag.enabled ? 'ON' : 'OFF'}
 *       </li>
 *     ))}
 *   </ul>
 * );
 * ```
 */
import { useEffect, useState } from 'react';
import { useGatrixContext } from './useGatrixContext';
import { EVENTS, type EvaluatedFlag } from '@gatrix/gatrix-js-client-sdk';

export function useFlags(forceRealtime = true): EvaluatedFlag[] {
  const { features, client } = useGatrixContext();
  const [flags, setFlags] = useState<EvaluatedFlag[]>(() => features.getAllFlags(forceRealtime));

  useEffect(() => {
    if (!client) return;

    const onUpdate = () => {
      setFlags(features.getAllFlags(forceRealtime));
    };

    const onReady = () => {
      setFlags(features.getAllFlags(forceRealtime));
    };

    client.on(EVENTS.FLAGS_CHANGE, onUpdate);
    client.on(EVENTS.FLAGS_READY, onReady);
    client.on(EVENTS.FLAGS_SYNC, onUpdate);

    return () => {
      client.off(EVENTS.FLAGS_CHANGE, onUpdate);
      client.off(EVENTS.FLAGS_READY, onReady);
      client.off(EVENTS.FLAGS_SYNC, onUpdate);
    };
  }, [client, features, forceRealtime]);

  return flags;
}

export default useFlags;
