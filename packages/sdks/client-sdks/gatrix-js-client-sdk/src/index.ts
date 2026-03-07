/**
 * Gatrix Client SDK
 * Client-side SDK for feature flags and other Gatrix services
 */

// Main client
export { GatrixClient } from './gatrix-client';
export { FeaturesClient } from './features-client';
export { FlagProxy } from './flag-proxy';
export { VariationProvider } from './variation-provider';
export { WatchFlagGroup } from './watch-flag-group';

// Events
export { EVENTS } from './events';
export type { EventType } from './events';

// Types
export type {
  GatrixClientConfig,
  GatrixContext,
  FeaturesConfig,
  StreamingConfig,
  StreamingTransport,
  SseStreamingConfig,
  WebSocketStreamingConfig,
  EvaluatedFlag,
  Variant,
  ValueType,
  VariationResult,
  ImpressionEvent,
  ErrorEvent,
  FlagsApiResponse,
  SdkState,
  GatrixSdkStats,
  GatrixSdkLightStats,
  FeaturesStats,
  FeaturesLightStats,
} from './types';

// Storage Providers
export { StorageProvider } from './storage-provider';
export { LocalStorageProvider } from './local-storage-provider';
export { InMemoryStorageProvider } from './in-memory-storage-provider';

// Version
export { SDK_VERSION, SDK_NAME } from './version';

// Value source constants
export { VALUE_SOURCE } from './value-source';
