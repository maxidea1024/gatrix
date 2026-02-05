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
  ImpressionEvent,
  ErrorEvent,
  FlagsApiResponse,
  SdkState,
} from './types';

// Storage Providers
export { StorageProvider } from './storage-provider';
export { LocalStorageProvider } from './storage-provider-localstorage';
export { InMemoryStorageProvider } from './storage-provider-inmemory';

// Version
export { SDK_VERSION, SDK_NAME } from './version';
