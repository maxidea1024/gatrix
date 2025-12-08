/**
 * GatrixServerSDK
 * Entry point
 */

export { GatrixServerSDK } from './GatrixServerSDK';

// Export types
export * from './types';

// Export maintenance watcher types
export { MaintenanceEventData, MaintenanceStateSnapshot } from './cache/MaintenanceWatcher';

// Export errors
export {
  GatrixSDKError,
  ErrorCode,
  createError,
  isGatrixSDKError,
  // Coupon-specific errors
  CouponRedeemError,
  CouponRedeemErrorCode,
  isCouponRedeemError,
} from './utils/errors';

// Export logger
export { Logger, LogLevel, LogFormat, getLogger } from './utils/logger';

// Export metrics helpers
export { SdkMetrics } from './utils/sdkMetrics';
export { createMetricsServer, MetricsServerConfig, MetricsServerInstance } from './services/MetricsServer';

// Default export
export { GatrixServerSDK as default } from './GatrixServerSDK';
