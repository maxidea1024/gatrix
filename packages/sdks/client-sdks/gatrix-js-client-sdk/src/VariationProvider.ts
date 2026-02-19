/**
 * VariationProvider - Interface for centralized variation logic.
 *
 * This interface defines the internal methods that handle all variation logic:
 * flag lookup, value extraction, and metrics tracking.
 *
 * FeaturesClient implements this interface.
 * FlagProxy holds a reference to this interface (not FeaturesClient directly)
 * to avoid circular dependencies and keep a clean separation.
 *
 * All methods accept an optional `forceRealtime` parameter (default: false).
 * When true, the method reads from realtimeFlags directly, bypassing
 * explicitSyncMode's synchronizedFlags.
 */
import { EvaluatedFlag, Variant, ValueType, VariationResult } from './types';

export interface VariationProvider {
  // Core access
  isEnabledInternal(flagName: string, forceRealtime?: boolean): boolean;
  getVariantInternal(flagName: string, forceRealtime?: boolean): Variant;

  // Metadata access (no metrics tracking)
  hasFlagInternal(flagName: string, forceRealtime?: boolean): boolean;
  getValueTypeInternal(flagName: string, forceRealtime?: boolean): ValueType;
  getVersionInternal(flagName: string, forceRealtime?: boolean): number;
  getReasonInternal(flagName: string, forceRealtime?: boolean): string | undefined;
  getImpressionDataInternal(flagName: string, forceRealtime?: boolean): boolean;
  getRawFlagInternal(flagName: string, forceRealtime?: boolean): EvaluatedFlag | undefined;

  // Variation (returns value)
  variationInternal(flagName: string, fallbackValue: string, forceRealtime?: boolean): string;
  boolVariationInternal(flagName: string, fallbackValue: boolean, forceRealtime?: boolean): boolean;
  stringVariationInternal(flagName: string, fallbackValue: string, forceRealtime?: boolean): string;
  numberVariationInternal(flagName: string, fallbackValue: number, forceRealtime?: boolean): number;
  jsonVariationInternal<T>(flagName: string, fallbackValue: T, forceRealtime?: boolean): T;

  // Variation Details (returns value + reason)
  boolVariationDetailsInternal(
    flagName: string,
    fallbackValue: boolean,
    forceRealtime?: boolean
  ): VariationResult<boolean>;
  stringVariationDetailsInternal(
    flagName: string,
    fallbackValue: string,
    forceRealtime?: boolean
  ): VariationResult<string>;
  numberVariationDetailsInternal(
    flagName: string,
    fallbackValue: number,
    forceRealtime?: boolean
  ): VariationResult<number>;
  jsonVariationDetailsInternal<T>(
    flagName: string,
    fallbackValue: T,
    forceRealtime?: boolean
  ): VariationResult<T>;

  // Strict Variation (throws on missing/mismatch)
  boolVariationOrThrowInternal(flagName: string, forceRealtime?: boolean): boolean;
  stringVariationOrThrowInternal(flagName: string, forceRealtime?: boolean): string;
  numberVariationOrThrowInternal(flagName: string, forceRealtime?: boolean): number;
  jsonVariationOrThrowInternal<T>(flagName: string, forceRealtime?: boolean): T;
}
