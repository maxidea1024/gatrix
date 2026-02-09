/**
 * Gatrix Client SDK
 * Client-side SDK for feature flags and other Gatrix services
 */

// Main client
export { GatrixClient } from './GatrixClient';
export { FeaturesClient } from './FeaturesClient';
export { FlagProxy } from './FlagProxy';
export { WatchFlagGroup } from './WatchFlagGroup';

// Events
export { EVENTS } from './events';
export type { EventType } from './events';

// Types
export type {
  GatrixClientConfig,
  GatrixContext,
  FeaturesConfig,
  EvaluatedFlag,
  Variant,
  VariantType,
  VariationResult,
  ImpressionEvent,
  ErrorEvent,
  FlagsApiResponse,
  SdkState,
  GatrixSdkStats,
  FeaturesStats,
} from './types';

// Storage Providers
export { StorageProvider } from './StorageProvider';
export { LocalStorageProvider } from './LocalStorageProvider';
export { InMemoryStorageProvider } from './InMemoryStorageProvider';

// Version
export { SDK_VERSION, SDK_NAME } from './version';
