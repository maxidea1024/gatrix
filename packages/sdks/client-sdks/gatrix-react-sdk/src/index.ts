/**
 * Gatrix React SDK
 *
 * React bindings for Gatrix feature flags
 */

// Re-export everything from js-client-sdk
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
  SdkState,
  GatrixSdkStats,
  FeaturesStats,
} from '@gatrix/js-client-sdk';

export {
  GatrixClient,
  FeaturesClient,
  FlagProxy,
  WatchFlagGroup,
  EVENTS,
  LocalStorageProvider,
  InMemoryStorageProvider,
  SDK_VERSION,
  SDK_NAME,
} from '@gatrix/js-client-sdk';

export type { StorageProvider } from '@gatrix/js-client-sdk';

// React Context
export { default as GatrixFlagContext, type GatrixContextValue } from './GatrixContext';

// Provider
export { default as GatrixProvider, type GatrixProviderProps } from './GatrixProvider';

// Core Hooks
export { useGatrixClient } from './useGatrixClient';
export { useFlagsStatus, type FlagsStatus } from './useFlagsStatus';
export { useUpdateContext, type UpdateContextFunction } from './useUpdateContext';
export { useGatrixContext } from './useGatrixContext';

// Flag Access Hooks
export { useFlag } from './useFlag';
export { useFlags } from './useFlags';
export { useVariant, variantHasChanged } from './useVariant';

// Variation Hooks
export { useBoolVariation } from './useBoolVariation';
export { useStringVariation } from './useStringVariation';
export { useNumberVariation } from './useNumberVariation';
export { useJsonVariation } from './useJsonVariation';

// Default export
export { default } from './GatrixProvider';
