import { getGatrixClient } from './getGatrixClient';

/**
 * Store utility to get the track function for sending custom events to Gatrix.
 *
 * @returns A function to track events with `eventName` and optional `properties`.
 *
 * @example
 * ```typescript
 * const track = getTrack();
 * track('user_signup', { plan: 'premium' });
 * ```
 */
export function getTrack() {
    const client = getGatrixClient();

    return (eventName: string, properties?: Record<string, unknown>) => {
        client.track(eventName, properties);
    };
}

export default getTrack;
