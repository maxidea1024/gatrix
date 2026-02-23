import { useGatrixClient } from './useGatrixClient';

/**
 * Composable to get the track function for sending custom events to Gatrix.
 *
 * @returns A function to track events with `eventName` and optional `properties`.
 *
 * @example
 * ```typescript
 * const track = useTrack();
 * track('user_signup', { plan: 'premium' });
 * ```
 */
export function useTrack() {
    const client = useGatrixClient();

    const track = (eventName: string, properties?: Record<string, unknown>) => {
        client.track(eventName, properties);
    };

    return track;
}

export default useTrack;
