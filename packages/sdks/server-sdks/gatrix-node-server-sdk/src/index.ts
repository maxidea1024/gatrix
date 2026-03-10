/**
 * GatrixServerSDK
 * Entry point
 */

export { GatrixServerSDK } from './gatrix-server-sdk';

// Export types
export * from './types';

// Export environment provider interface (for Edge multi-env)
export {
  IEnvironmentProvider,
  EnvironmentEntry,
  ITokenProvider, // Legacy alias
} from './utils/environment-provider';

// Export maintenance watcher types
export {
  MaintenanceEventData,
  MaintenanceStateSnapshot,
} from './cache/maintenance-watcher';

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

// Export environment service for wildcard mode

// Export base service for custom extensions

// Export metrics helpers
export { SdkMetrics } from './utils/sdk-metrics';
export {
  createMetricsServer,
  MetricsServerConfig,
  MetricsServerInstance,
} from './services/metrics-server';
export {
  createHttpMetricsMiddleware,
  HttpMetricsOptions,
} from './utils/http-metrics';

// Export Impact Metrics API
export {
  MetricsAPI,
  ImpactMetricsStaticContext,
} from './impact-metrics/metric-api';
export {
  InMemoryMetricRegistry,
  Counter,
  Gauge,
  Histogram,
  CollectedMetric,
  MetricLabels,
  ImpactMetricRegistry,
  ImpactMetricsDataSource,
} from './impact-metrics/metric-types';

// Export environment resolver

// Export cloud metadata detection utilities
export {
  CloudMetadata,
  CloudProvider,
  detectCloudMetadata,
} from './utils/cloud-metadata';

// Export Feature Flag Evaluator (from @gatrix/shared)
export { FeatureFlagEvaluator } from '@gatrix/evaluator';

// Export SDK version
export { SDK_VERSION } from './version';

// Default export
export { GatrixServerSDK as default } from './gatrix-server-sdk';
