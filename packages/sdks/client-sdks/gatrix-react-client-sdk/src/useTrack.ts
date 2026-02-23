import { useCallback } from 'react';
import { useGatrixClient } from './useGatrixClient';

/**
 * Hook to get the track function for sending custom events to Gatrix.
 *
 * @returns A function to track events with `eventName` and optional `properties`.
 *
 * @example
 * ```tsx
 * const track = useTrack();
 * track('user_signup', { plan: 'premium' });
 * ```
 */
export function useTrack() {
    const client = useGatrixClient();

    return useCallback(
        (eventName: string, properties?: Record<string, unknown>) => {
            client.track(eventName, properties);
        },
        [client]
    );
}

export default useTrack;
