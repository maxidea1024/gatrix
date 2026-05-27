/**
 * Evaluation context type definition
 */

/**
 * Evaluation context (global for client-side)
 * System fields (appName) are auto-managed by the SDK.
 * They cannot be removed via updateContext(null) but can be overridden.
 */
export interface GatrixContext {
  /** User identifier */
  userId?: string;
  /** Session identifier */
  sessionId?: string;
  /** Application name (system field - cannot be removed) */
  appName?: string;
  /** Remote address / client IP */
  remoteAddress?: string;
  /** Current time in ISO 8601 format (truncated to minute precision) */
  currentTime?: string;
  /** Custom properties for targeting */
  properties?: Record<string, string | number | boolean>;
}
