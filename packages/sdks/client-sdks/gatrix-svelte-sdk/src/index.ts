// Gatrix Svelte SDK - Public API
export {
  GATRIX_CLIENT_KEY,
  GATRIX_READY_KEY,
  GATRIX_HEALTHY_KEY,
  GATRIX_ERROR_KEY,
} from './context';
export { initGatrix, type GatrixInitOptions } from './provider';
export { getGatrixClient } from './stores/getGatrixClient';
export { flag, flagState, type FlagState } from './stores/flag';
export { allFlags } from './stores/flags';
export {
  boolVariation,
  stringVariation,
  numberVariation,
  jsonVariation,
  variant,
} from './stores/variations';
export { flagsStatus, type FlagsStatus } from './stores/status';
export { updateContext, syncFlags, fetchFlags } from './stores/actions';

// Re-export commonly used types and constants from core SDK
export {
  EVENTS,
  type GatrixClientConfig,
  type GatrixContext,
  type EvaluatedFlag,
  type Variant,
  type VariationResult,
} from '@gatrix/js-client-sdk';
