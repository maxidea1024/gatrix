/**
 * useFlagsStatus - Get the current status of feature flags
 *
 * Returns whether flags are ready and any error that occurred.
 *
 * @example
 * ```tsx
 * const { flagsReady, flagsError } = useFlagsStatus();
 *
 * if (!flagsReady) {
 *   return <Loading />;
 * }
 *
 * if (flagsError) {
 *   return <Error message={flagsError.message} />;
 * }
 * ```
 */
import { useGatrixContext } from './useGatrixContext';

export interface FlagsStatus {
    /** Whether flags have been fetched and are ready to use */
    flagsReady: boolean;
    /** Any error that occurred during flag fetching */
    flagsError: any;
}

export function useFlagsStatus(): FlagsStatus {
    const { flagsReady, flagsError } = useGatrixContext();
    return { flagsReady, flagsError };
}

export default useFlagsStatus;
