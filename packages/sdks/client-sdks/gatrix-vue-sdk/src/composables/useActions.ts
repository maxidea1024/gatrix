import { useGatrixClient } from './useGatrixClient';
import type { GatrixContext } from '@gatrix/js-client-sdk';

export function useUpdateContext() {
  const client = useGatrixClient();
  return (context: Partial<GatrixContext>) => client.features.updateContext(context);
}

export function useSyncFlags() {
  const client = useGatrixClient();
  return (fetchNow?: boolean) => client.features.syncFlags(fetchNow);
}

export function useFetchFlags() {
  const client = useGatrixClient();
  return () => client.features.fetchFlags();
}
