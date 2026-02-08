/**
 * useUpdateContext - Get the context update function
 *
 * Returns a function to update the Gatrix context.
 * Context updates trigger a re-fetch of evaluated flags.
 *
 * @example
 * ```tsx
 * const updateContext = useUpdateContext();
 *
 * const handleLogin = async (userId: string) => {
 *   await updateContext({ userId });
 * };
 * ```
 */
import { useGatrixContext } from './useGatrixContext';
import type { GatrixContext } from '@gatrix/js-client-sdk';

export type UpdateContextFunction = (context: Partial<GatrixContext>) => Promise<void>;

export function useUpdateContext(): UpdateContextFunction {
  const { updateContext } = useGatrixContext();
  return updateContext;
}

export default useUpdateContext;
