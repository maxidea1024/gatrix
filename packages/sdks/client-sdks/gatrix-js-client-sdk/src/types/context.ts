/**
 * Evaluation context type definition
 */

/**
 * Evaluation context (global for client-side)
 * appName and environment are system fields - always present and cannot be removed
 */
export interface GatrixContext {
    /** Application name (system field - cannot be removed) */
    appName?: string;
    /** Environment name (system field - cannot be removed) */
    environment?: string;
    userId?: string;
    sessionId?: string;
    currentTime?: string;
    properties?: Record<string, string | number | boolean>;
}
