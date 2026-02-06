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
import { EVENTS, type EvaluatedFlag } from '@gatrix/js-client-sdk';

export function useFlags(): EvaluatedFlag[] {
    const { features, client } = useGatrixContext();
    const [flags, setFlags] = useState<EvaluatedFlag[]>(() => features.getAllFlags());

    useEffect(() => {
        if (!client) return;

        const onUpdate = () => {
            setFlags(features.getAllFlags());
        };

        const onReady = () => {
            setFlags(features.getAllFlags());
        };

        client.on(EVENTS.UPDATE, onUpdate);
        client.on(EVENTS.READY, onReady);

        return () => {
            client.off(EVENTS.UPDATE, onUpdate);
            client.off(EVENTS.READY, onReady);
        };
    }, [client, features]);

    return flags;
}

export default useFlags;
