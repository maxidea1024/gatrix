/**
 * Gatrix Angular Client SDK
 *
 * Angular bindings for Gatrix feature flags
 */

// Re-export types from js-client-sdk
export type {
  GatrixClientConfig,
  GatrixContext,
  FeaturesConfig,
  EvaluatedFlag,
  Variant,
  ValueType,
  VariationResult,
  ImpressionEvent,
  ErrorEvent,
  SdkState,
  GatrixSdkStats,
  GatrixSdkLightStats,
  FeaturesStats,
  FeaturesLightStats,
  StreamingConfig,
  StreamingTransport,
  SseStreamingConfig,
  WebSocketStreamingConfig,
} from '@gatrix/gatrix-js-client-sdk';

// Re-export classes from js-client-sdk
export {
  GatrixClient,
  FeaturesClient,
  WatchFlagGroup,
  EVENTS,
  LocalStorageProvider,
  InMemoryStorageProvider,
  SDK_VERSION,
  SDK_NAME,
} from '@gatrix/gatrix-js-client-sdk';

export type { StorageProvider } from '@gatrix/gatrix-js-client-sdk';

// Module
export { GatrixModule } from './gatrix.module';

// Service
export { GatrixService } from './gatrix.service';

// Tokens
export { GATRIX_CONFIG, GATRIX_CLIENT, GATRIX_START_CLIENT } from './tokens';

// Standalone API
export { provideGatrix, provideGatrixClient } from './provide-gatrix';

// Inject functions
export {
  injectGatrixClient,
  injectGatrixService,
  injectFlagsStatus,
  injectFlag,
  injectVariant,
  injectFlags,
  injectBoolVariation,
  injectStringVariation,
  injectNumberVariation,
  injectJsonVariation,
  injectUpdateContext,
  injectSyncFlags,
  injectFetchFlags,
  injectTrack,
} from './inject-functions';
