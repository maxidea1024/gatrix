/**
 * VariationProvider - Interface for centralized variation logic.
 *
 * This interface defines the internal methods that handle all variation logic:
 * flag lookup, value extraction, and metrics tracking.
 *
 * FeaturesClient implements this interface.
 * FlagProxy holds a reference to this interface (not FeaturesClient directly)
 * to avoid circular dependencies and keep a clean separation.
 */
import { Variant, VariationResult } from './types';

export interface VariationProvider {
    // Core access
    isEnabledInternal(flagName: string): boolean;
    getVariantInternal(flagName: string): Variant;

    // Variation (returns value)
    variationInternal(flagName: string, missingValue: string): string;
    boolVariationInternal(flagName: string, missingValue: boolean): boolean;
    stringVariationInternal(flagName: string, missingValue: string): string;
    numberVariationInternal(flagName: string, missingValue: number): number;
    jsonVariationInternal<T>(flagName: string, missingValue: T): T;

    // Variation Details (returns value + reason)
    boolVariationDetailsInternal(flagName: string, missingValue: boolean): VariationResult<boolean>;
    stringVariationDetailsInternal(flagName: string, missingValue: string): VariationResult<string>;
    numberVariationDetailsInternal(flagName: string, missingValue: number): VariationResult<number>;
    jsonVariationDetailsInternal<T>(flagName: string, missingValue: T): VariationResult<T>;

    // Strict Variation (throws on missing/mismatch)
    boolVariationOrThrowInternal(flagName: string): boolean;
    stringVariationOrThrowInternal(flagName: string): string;
    numberVariationOrThrowInternal(flagName: string): number;
    jsonVariationOrThrowInternal<T>(flagName: string): T;
}
