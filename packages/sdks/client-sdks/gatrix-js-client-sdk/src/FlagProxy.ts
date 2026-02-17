/**
 * FlagProxy - Convenience wrapper for flag data access.
 *
 * FlagProxy is a thin shell that provides a convenient API for accessing
 * flag values. All variation logic (flag lookup + value extraction +
 * metrics tracking) is handled by FeaturesClient's *Internal methods.
 *
 * FlagProxy delegates all variation calls to FeaturesClient.
 * It only retains read-only property accessors for flag data.
 *
 * Uses null object pattern: this.flag is never undefined.
 * MISSING_FLAG sentinel is used for non-existent flags.
 */
import { EvaluatedFlag, Variant, ValueType, VariationResult } from './types';
import { VariationProvider } from './VariationProvider';
import { VARIANT_SOURCE } from './variantSource';

/** Create a missing flag sentinel with per-flag context */
function createMissingFlag(flagName: string): EvaluatedFlag {
  return {
    name: flagName,
    enabled: false,
    variant: { name: VARIANT_SOURCE.MISSING, enabled: false },
    valueType: 'none',
    version: 0,
  };
}

export class FlagProxy {
  private flag: EvaluatedFlag;
  private _exists: boolean;
  private _flagName: string;
  private client: VariationProvider;

  constructor(flag: EvaluatedFlag | undefined, client: VariationProvider, flagName?: string) {
    this._exists = flag !== undefined;
    this._flagName = flagName ?? flag?.name ?? '';
    // Deep-clone so FlagProxy holds an immutable snapshot
    this.flag = flag
      ? {
        ...flag,
        variant: { ...flag.variant },
      }
      : createMissingFlag(this._flagName);
    this.client = client;
  }

  // ==================== Properties ====================

  get name(): string {
    return this._flagName;
  }

  get exists(): boolean {
    return this._exists;
  }

  /**
   * Check if the flag is enabled.
   * Delegates to FeaturesClient for metrics tracking.
   */
  get enabled(): boolean {
    return this.client.isEnabledInternal(this._flagName);
  }

  get variant(): Variant {
    return { ...this.flag.variant }; // defensive copy
  }

  get valueType(): ValueType {
    return this.flag.valueType;
  }

  get version(): number {
    return this.flag.version;
  }

  get impressionData(): boolean {
    return this.flag.impressionData ?? false;
  }

  get raw(): EvaluatedFlag | undefined {
    return this._exists ? this.flag : undefined;
  }

  get reason(): string | undefined {
    return this.flag.reason;
  }

  // ==================== Variation Methods ====================
  // All methods delegate to FeaturesClient's internal methods.
  // FlagProxy is a convenience shell - no own logic.

  variation(fallbackValue: string): string {
    return this.client.variationInternal(this._flagName, fallbackValue);
  }

  boolVariation(fallbackValue: boolean): boolean {
    return this.client.boolVariationInternal(this._flagName, fallbackValue);
  }

  stringVariation(fallbackValue: string): string {
    return this.client.stringVariationInternal(this._flagName, fallbackValue);
  }

  numberVariation(fallbackValue: number): number {
    return this.client.numberVariationInternal(this._flagName, fallbackValue);
  }

  jsonVariation<T>(fallbackValue: T): T {
    return this.client.jsonVariationInternal(this._flagName, fallbackValue);
  }

  // ==================== Variation Details ====================

  boolVariationDetails(fallbackValue: boolean): VariationResult<boolean> {
    return this.client.boolVariationDetailsInternal(this._flagName, fallbackValue);
  }

  stringVariationDetails(fallbackValue: string): VariationResult<string> {
    return this.client.stringVariationDetailsInternal(this._flagName, fallbackValue);
  }

  numberVariationDetails(fallbackValue: number): VariationResult<number> {
    return this.client.numberVariationDetailsInternal(this._flagName, fallbackValue);
  }

  jsonVariationDetails<T>(fallbackValue: T): VariationResult<T> {
    return this.client.jsonVariationDetailsInternal(this._flagName, fallbackValue);
  }

  // ==================== Strict Variation Methods (OrThrow) ====================

  boolVariationOrThrow(): boolean {
    return this.client.boolVariationOrThrowInternal(this._flagName);
  }

  stringVariationOrThrow(): string {
    return this.client.stringVariationOrThrowInternal(this._flagName);
  }

  numberVariationOrThrow(): number {
    return this.client.numberVariationOrThrowInternal(this._flagName);
  }

  jsonVariationOrThrow<T>(): T {
    return this.client.jsonVariationOrThrowInternal<T>(this._flagName);
  }
}
