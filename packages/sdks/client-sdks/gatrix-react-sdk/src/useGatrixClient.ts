/**
 * useGatrixClient - Access the GatrixClient instance
 *
 * Returns the GatrixClient instance from context.
 * Useful for advanced operations like subscribing to events
 * or accessing the full client API.
 *
 * @example
 * ```tsx
 * const client = useGatrixClient();
 *
 * useEffect(() => {
 *   client.on('update', () => console.log('Flags updated'));
 *   return () => client.off('update', callback);
 * }, [client]);
 * ```
 */
import { useGatrixContext } from './useGatrixContext';
import type { GatrixClient } from '@gatrix/js-client-sdk';

export function useGatrixClient(): GatrixClient {
    const { client } = useGatrixContext();
    return client;
}

export default useGatrixClient;
