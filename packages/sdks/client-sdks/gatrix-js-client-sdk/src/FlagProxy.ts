/**
 * FlagProxy - Single source of truth for flag value extraction.
 *
 * ALL variation logic lives here. FeaturesClient delegates to FlagProxy
 * so that value extraction + metrics tracking happen in one place.
 *
 * Uses null object pattern: this.flag is never undefined.
 * MISSING_FLAG sentinel is used for non-existent flags.
 *
 * onAccess callback is invoked on every variation/enabled call, enabling
 * consistent metrics tracking regardless of how FlagProxy is obtained.
 *
 * Type safety: valueType is checked strictly to prevent misuse.
 */
import { EvaluatedFlag, Variant, ValueType, VariationResult } from './types';
import { GatrixFeatureError } from './errors';

const MISSING_VARIANT: Variant = {
  name: '$missing',
  enabled: false,
};

/** Null object for non-existent flags */
const MISSING_FLAG: EvaluatedFlag = {
  name: '',
  enabled: false,
  variant: MISSING_VARIANT,
  valueType: 'none',
  version: 0,
};

/**
 * Callback invoked on every variation/enabled call.
 * @param flagName - Name of the flag
 * @param flag - The flag object (undefined = missing)
 * @param eventType - 'isEnabled' for bool, 'getVariant' for value variations
 * @param variantName - Variant name (for getVariant events)
 */
export type FlagAccessCallback = (
  flagName: string,
  flag: EvaluatedFlag | undefined,
  eventType: string,
  variantName?: string
) => void;

export class FlagProxy {
  private flag: EvaluatedFlag;
  private _exists: boolean;
  private onAccess?: FlagAccessCallback;
  private _flagName: string;

  constructor(flag: EvaluatedFlag | undefined, onAccess?: FlagAccessCallback, flagName?: string) {
    this._exists = flag !== undefined;
    this.flag = flag ?? MISSING_FLAG;
    this.onAccess = onAccess;
    this._flagName = flagName ?? this.flag.name;
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
   * Triggers metrics tracking via onAccess callback.
   */
  get enabled(): boolean {
    if (!this._exists) {
      this.onAccess?.(this._flagName, undefined, 'isEnabled');
      return false;
    }
    this.onAccess?.(this._flagName, this.flag, 'isEnabled', this.flag.variant.name);
    return this.flag.enabled;
  }

  get variant(): Variant {
    return this.flag.variant;
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
  // Single source of truth for value extraction.
  // Each call tracks metrics via onAccess callback.
  // Type safety: valueType is checked strictly to prevent misuse.

  /**
   * Get boolean variation from variant value.
   * Strict: valueType must be 'boolean'.
   */
  boolVariation(missingValue: boolean): boolean {
    if (!this._exists) {
      this.onAccess?.(this._flagName, undefined, 'getVariant');
      return missingValue;
    }
    this.onAccess?.(this._flagName, this.flag, 'getVariant', this.flag.variant.name);
    if (this.flag.valueType !== 'boolean') {
      return missingValue;
    }
    return Boolean(this.flag.variant.value);
  }

  /**
   * Get the variant name for this flag
   */
  variation(missingValue: string): string {
    if (!this._exists) {
      this.onAccess?.(this._flagName, undefined, 'getVariant');
      return missingValue;
    }
    this.onAccess?.(this._flagName, this.flag, 'getVariant', this.flag.variant.name);
    return this.flag.variant.name;
  }

  /**
   * Get string variation from variant value.
   * Strict: valueType must be 'string'.
   */
  stringVariation(missingValue: string): string {
    if (!this._exists) {
      this.onAccess?.(this._flagName, undefined, 'getVariant');
      return missingValue;
    }
    this.onAccess?.(this._flagName, this.flag, 'getVariant', this.flag.variant.name);
    if (this.flag.valueType !== 'string') {
      return missingValue;
    }
    return String(this.flag.variant.value);
  }

  /**
   * Get number variation from variant value.
   * Strict: valueType must be 'number'.
   * Returns missingValue if the value cannot be converted to a valid number.
   */
  numberVariation(missingValue: number): number {
    if (!this._exists) {
      this.onAccess?.(this._flagName, undefined, 'getVariant');
      return missingValue;
    }
    this.onAccess?.(this._flagName, this.flag, 'getVariant', this.flag.variant.name);
    if (this.flag.valueType !== 'number') {
      return missingValue;
    }
    const value = Number(this.flag.variant.value);
    return isNaN(value) ? missingValue : value;
  }

  /**
   * Get JSON variation from variant value.
   * Strict: valueType must be 'json' and value must be an object.
   */
  jsonVariation<T>(missingValue: T): T {
    if (!this._exists) {
      this.onAccess?.(this._flagName, undefined, 'getVariant');
      return missingValue;
    }
    this.onAccess?.(this._flagName, this.flag, 'getVariant', this.flag.variant.name);
    if (this.flag.valueType !== 'json') {
      return missingValue;
    }
    const value = this.flag.variant.value;
    if (typeof value !== 'object' || value === null) {
      return missingValue;
    }
    return value as T;
  }

  // ==================== Variation Details ====================

  boolVariationDetails(missingValue: boolean): VariationResult<boolean> {
    if (!this._exists) {
      this.onAccess?.(this._flagName, undefined, 'getVariant');
      return { value: missingValue, reason: 'flag_not_found', flagExists: false, enabled: false };
    }
    this.onAccess?.(this._flagName, this.flag, 'getVariant', this.flag.variant.name);
    if (this.flag.valueType !== 'boolean') {
      return {
        value: missingValue,
        reason: `type_mismatch:expected_boolean_got_${this.flag.valueType}`,
        flagExists: true, enabled: this.flag.enabled,
      };
    }
    return {
      value: Boolean(this.flag.variant.value),
      reason: this.flag.reason ?? 'evaluated',
      flagExists: true, enabled: this.flag.enabled,
    };
  }

  stringVariationDetails(missingValue: string): VariationResult<string> {
    if (!this._exists) {
      this.onAccess?.(this._flagName, undefined, 'getVariant');
      return { value: missingValue, reason: 'flag_not_found', flagExists: false, enabled: false };
    }
    this.onAccess?.(this._flagName, this.flag, 'getVariant', this.flag.variant.name);
    if (this.flag.valueType !== 'string') {
      return {
        value: missingValue,
        reason: `type_mismatch:expected_string_got_${this.flag.valueType}`,
        flagExists: true, enabled: this.flag.enabled,
      };
    }
    return {
      value: String(this.flag.variant.value),
      reason: this.flag.reason ?? 'evaluated',
      flagExists: true, enabled: this.flag.enabled,
    };
  }

  numberVariationDetails(missingValue: number): VariationResult<number> {
    if (!this._exists) {
      this.onAccess?.(this._flagName, undefined, 'getVariant');
      return { value: missingValue, reason: 'flag_not_found', flagExists: false, enabled: false };
    }
    this.onAccess?.(this._flagName, this.flag, 'getVariant', this.flag.variant.name);
    if (this.flag.valueType !== 'number') {
      return {
        value: missingValue,
        reason: `type_mismatch:expected_number_got_${this.flag.valueType}`,
        flagExists: true, enabled: this.flag.enabled,
      };
    }
    const value = Number(this.flag.variant.value);
    return {
      value: isNaN(value) ? missingValue : value,
      reason: isNaN(value) ? 'type_mismatch:value_not_number' : (this.flag.reason ?? 'evaluated'),
      flagExists: true, enabled: this.flag.enabled,
    };
  }

  jsonVariationDetails<T>(missingValue: T): VariationResult<T> {
    if (!this._exists) {
      this.onAccess?.(this._flagName, undefined, 'getVariant');
      return { value: missingValue, reason: 'flag_not_found', flagExists: false, enabled: false };
    }
    this.onAccess?.(this._flagName, this.flag, 'getVariant', this.flag.variant.name);
    if (this.flag.valueType !== 'json') {
      return {
        value: missingValue,
        reason: `type_mismatch:expected_json_got_${this.flag.valueType}`,
        flagExists: true, enabled: this.flag.enabled,
      };
    }
    const value = this.flag.variant.value;
    if (typeof value !== 'object' || value === null) {
      return {
        value: missingValue,
        reason: 'type_mismatch:value_not_object',
        flagExists: true, enabled: this.flag.enabled,
      };
    }
    return {
      value: value as T,
      reason: this.flag.reason ?? 'evaluated',
      flagExists: true, enabled: this.flag.enabled,
    };
  }

  // ==================== Strict Variation Methods (OrThrow) ====================

  boolVariationOrThrow(): boolean {
    if (!this._exists) {
      this.onAccess?.(this._flagName, undefined, 'isEnabled');
      throw GatrixFeatureError.flagNotFound(this._flagName);
    }
    this.onAccess?.(this._flagName, this.flag, 'isEnabled', this.flag.variant.name);
    if (this.flag.valueType !== 'boolean') {
      throw GatrixFeatureError.typeMismatch(this._flagName, 'boolean', this.flag.valueType);
    }
    return Boolean(this.flag.variant.value);
  }

  stringVariationOrThrow(): string {
    if (!this._exists) {
      this.onAccess?.(this._flagName, undefined, 'getVariant');
      throw GatrixFeatureError.flagNotFound(this._flagName);
    }
    this.onAccess?.(this._flagName, this.flag, 'getVariant', this.flag.variant.name);
    if (this.flag.valueType !== 'string') {
      throw GatrixFeatureError.typeMismatch(this._flagName, 'string', this.flag.valueType);
    }
    return String(this.flag.variant.value);
  }

  numberVariationOrThrow(): number {
    if (!this._exists) {
      this.onAccess?.(this._flagName, undefined, 'getVariant');
      throw GatrixFeatureError.flagNotFound(this._flagName);
    }
    this.onAccess?.(this._flagName, this.flag, 'getVariant', this.flag.variant.name);
    if (this.flag.valueType !== 'number') {
      throw GatrixFeatureError.typeMismatch(this._flagName, 'number', this.flag.valueType);
    }
    const value = Number(this.flag.variant.value);
    if (isNaN(value)) {
      throw GatrixFeatureError.typeMismatch(this._flagName, 'number', typeof this.flag.variant.value);
    }
    return value;
  }

  jsonVariationOrThrow<T>(): T {
    if (!this._exists) {
      this.onAccess?.(this._flagName, undefined, 'getVariant');
      throw GatrixFeatureError.flagNotFound(this._flagName);
    }
    this.onAccess?.(this._flagName, this.flag, 'getVariant', this.flag.variant.name);
    if (this.flag.valueType !== 'json') {
      throw GatrixFeatureError.typeMismatch(this._flagName, 'json', this.flag.valueType);
    }
    const value = this.flag.variant.value;
    if (typeof value !== 'object' || value === null) {
      throw GatrixFeatureError.typeMismatch(this._flagName, 'json', typeof value);
    }
    return value as T;
  }
}
