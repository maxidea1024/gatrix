/**
 * GatrixServerSDK
 * Entry point
 */

export { GatrixServerSDK } from './GatrixServerSDK';

// Export types
export * from './types';

// Export errors
export { GatrixSDKError, ErrorCode, createError, isGatrixSDKError } from './utils/errors';

// Export logger
export { Logger, LogLevel, getLogger } from './utils/logger';

// Export metrics helpers
export { attachExpressMetrics, attachFastifyMetrics } from './utils/metrics';
export { SdkMetrics } from './utils/sdkMetrics';

// Default export
export { GatrixServerSDK as default } from './GatrixServerSDK';
