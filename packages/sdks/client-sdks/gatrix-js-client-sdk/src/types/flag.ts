/**
 * Flag and variant type definitions
 */
import { type GatrixContext } from './context';

/**
 * Variant information from server evaluation
 */
export interface Variant {
  name: string;
  enabled: boolean;
  value?: string | number | boolean | object; // undefined(none), string, number, boolean, json
}

/**
 * Variant type enum
 */
export type ValueType = 'none' | 'string' | 'number' | 'boolean' | 'json';

/**
 * Evaluated flag from Edge API
 */
export interface EvaluatedFlag {
  name: string;
  enabled: boolean;
  variant: Variant;
  valueType: ValueType;
  enabledValue?: any;
  disabledValue?: any;
  version: number;
  reason?: string;
  impressionData?: boolean;
}

/**
 * API response containing evaluated flags (from Edge or backend)
 */
export interface FlagsApiResponse {
  success: boolean;
  data: {
    flags: EvaluatedFlag[];
  };
  meta: {
    environment: string;
    evaluatedAt: string;
  };
}

/**
 * Variation result with details (value + reason)
 */
export interface VariationResult<T> {
  value: T;
  reason: string;
  flagExists: boolean;
  enabled: boolean;
  /** Variant name reported by the evaluation (e.g. '$type-mismatch', '$missing') */
  variantName?: string;
}

/**
 * Impression event data
 */
export interface ImpressionEvent {
  eventType: 'isEnabled' | 'getFlag' | 'getVariant' | 'watch';
  eventId: string;
  context: GatrixContext;
  enabled: boolean;
  featureName: string;
  impressionData: boolean;
  variantName?: string;
  reason?: string;
}
