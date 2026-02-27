/**
 * Evaluation context type definition
 */

/**
 * Evaluation context (global for client-side)
 * System fields (appName, environment) are auto-managed by the SDK.
 * They cannot be removed via updateContext(null) but can be overridden.
 */
export interface GatrixContext {
  /** Application name (system field - cannot be removed) */
  appName?: string;
  /** Environment name (system field - cannot be removed) */
  environment?: string;
  /** Remote address / client IP */
  remoteAddress?: string;
  /** User identifier */
  userId?: string;
  /** Session identifier */
  sessionId?: string;
  /** Current time in ISO 8601 format (truncated to minute precision) */
  currentTime?: string;
  /** Custom properties for targeting */
  properties?: Record<string, string | number | boolean>;
}
