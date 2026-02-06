/**
 * FlagProxy - Wrapper for EvaluatedFlag with helper methods
 * Provides convenient variation accessors like .boolVariation(), .stringVariation(), etc.
 */
import { EvaluatedFlag, Variant, VariantType, VariationResult } from './types';
import { GatrixFeatureError, GatrixFeatureErrorCode } from './errors';

const FALLBACK_DISABLED_VARIANT: Variant = {
  name: 'disabled',
  enabled: false,
};

export class FlagProxy {
  private flag: EvaluatedFlag | undefined;

  constructor(flag: EvaluatedFlag | undefined) {
    this.flag = flag;
  }

  /**
   * Get the flag name
   */
  get name(): string {
    return this.flag?.name ?? '';
  }

  /**
   * Check if the flag exists
   */
  get exists(): boolean {
    return this.flag !== undefined;
  }

  /**
   * Check if the flag is enabled
   */
  get enabled(): boolean {
    return this.flag?.enabled ?? false;
  }

  /**
   * Get the variant
   */
  get variant(): Variant {
    return this.flag?.variant ?? FALLBACK_DISABLED_VARIANT;
  }

  /**
   * Get the variant type
   */
  get variantType(): VariantType {
    return this.flag?.variantType ?? 'none';
  }

  /**
   * Get the flag version
   */
  get version(): number {
    return this.flag?.version ?? 0;
  }

  /**
   * Check if impression data is enabled
   */
  get impressionData(): boolean {
    return this.flag?.impressionData ?? false;
  }

  /**
   * Get the raw flag object
   */
  get raw(): EvaluatedFlag | undefined {
    return this.flag;
  }

  // ==================== Variation Methods ====================

  /**
   * Get boolean variation (flag enabled state)
   */
  boolVariation(defaultValue: boolean): boolean {
    if (!this.flag) {
      return defaultValue;
    }
    return this.flag.enabled;
  }

  /**
   * Get string variation from variant payload
   */
  stringVariation(defaultValue: string): string {
    if (!this.flag || this.flag.variant?.payload == null) {
      return defaultValue;
    }
    return String(this.flag.variant.payload);
  }

  /**
   * Get number variation from variant payload
   */
  numberVariation(defaultValue: number): number {
    if (!this.flag || this.flag.variant?.payload == null) {
      return defaultValue;
    }

    const payload = this.flag.variant.payload;
    if (typeof payload === 'number') {
      return payload;
    }

    // Fallback: parse string number (for backward compatibility)
    if (typeof payload === 'string') {
      const parsed = Number(payload);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    return defaultValue;
  }

  /**
   * Get JSON variation from variant payload
   */
  jsonVariation<T>(defaultValue: T): T {
    if (!this.flag || this.flag.variant?.payload == null) {
      return defaultValue;
    }

    const payload = this.flag.variant.payload;

    // Server sends object directly
    if (typeof payload === 'object') {
      return payload as T;
    }

    // Fallback: parse JSON string (for backward compatibility)
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload) as T;
      } catch {
        return defaultValue;
      }
    }

    return defaultValue;
  }

  /**
   * Check if flag is enabled (alias for enabled getter)
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get variant name
   */
  getVariantName(): string {
    return this.variant.name;
  }

  /**
   * Get evaluation reason
   */
  get reason(): string | undefined {
    return this.flag?.reason;
  }

  // ==================== Variation Details Methods ====================

  /**
   * Get boolean variation with details
   */
  boolVariationDetails(defaultValue: boolean): VariationResult<boolean> {
    if (!this.flag) {
      return { value: defaultValue, reason: 'flag_not_found', flagExists: false, enabled: false };
    }
    return {
      value: this.flag.enabled,
      reason: this.flag.reason ?? 'evaluated',
      flagExists: true,
      enabled: this.flag.enabled,
    };
  }

  /**
   * Get string variation with details
   */
  stringVariationDetails(defaultValue: string): VariationResult<string> {
    if (!this.flag) {
      return { value: defaultValue, reason: 'flag_not_found', flagExists: false, enabled: false };
    }
    if (!this.flag.enabled) {
      return {
        value: defaultValue,
        reason: this.flag.reason ?? 'disabled',
        flagExists: true,
        enabled: false,
      };
    }
    if (this.flag.variant?.payload == null) {
      return { value: defaultValue, reason: 'no_payload', flagExists: true, enabled: true };
    }
    return {
      value: String(this.flag.variant.payload),
      reason: this.flag.reason ?? 'evaluated',
      flagExists: true,
      enabled: true,
    };
  }

  /**
   * Get number variation with details
   */
  numberVariationDetails(defaultValue: number): VariationResult<number> {
    if (!this.flag) {
      return { value: defaultValue, reason: 'flag_not_found', flagExists: false, enabled: false };
    }
    if (!this.flag.enabled) {
      return {
        value: defaultValue,
        reason: this.flag.reason ?? 'disabled',
        flagExists: true,
        enabled: false,
      };
    }
    if (this.flag.variant?.payload == null) {
      return { value: defaultValue, reason: 'no_payload', flagExists: true, enabled: true };
    }

    const payload = this.flag.variant.payload;
    if (typeof payload === 'number') {
      return {
        value: payload,
        reason: this.flag.reason ?? 'evaluated',
        flagExists: true,
        enabled: true,
      };
    }

    return {
      value: defaultValue,
      reason: 'type_mismatch:payload_not_number',
      flagExists: true,
      enabled: true,
    };
  }

  /**
   * Get JSON variation with details
   */
  jsonVariationDetails<T>(defaultValue: T): VariationResult<T> {
    if (!this.flag) {
      return { value: defaultValue, reason: 'flag_not_found', flagExists: false, enabled: false };
    }
    if (!this.flag.enabled) {
      return {
        value: defaultValue,
        reason: this.flag.reason ?? 'disabled',
        flagExists: true,
        enabled: false,
      };
    }
    if (this.flag.variant?.payload == null) {
      return { value: defaultValue, reason: 'no_payload', flagExists: true, enabled: true };
    }

    const payload = this.flag.variant.payload;
    if (typeof payload === 'object') {
      return {
        value: payload as T,
        reason: this.flag.reason ?? 'evaluated',
        flagExists: true,
        enabled: true,
      };
    }

    return {
      value: defaultValue,
      reason: 'type_mismatch:payload_not_object',
      flagExists: true,
      enabled: true,
    };
  }

  // ==================== Strict Variation Methods (OrThrow) ====================

  /**
   * Get boolean variation or throw if flag not found
   */
  boolVariationOrThrow(): boolean {
    if (!this.flag) {
      throw GatrixFeatureError.flagNotFound(this.name || 'unknown');
    }
    return this.flag.enabled;
  }

  /**
   * Get string variation or throw if flag not found or no payload
   * Note: disabled flag still returns payload if it exists
   */
  stringVariationOrThrow(): string {
    if (!this.flag) {
      throw GatrixFeatureError.flagNotFound(this.name || 'unknown');
    }
    if (this.flag.variant?.payload == null) {
      throw GatrixFeatureError.noPayload(this.flag.name);
    }
    return String(this.flag.variant.payload);
  }

  /**
   * Get number variation or throw if flag not found or invalid type
   * Note: disabled flag still returns payload if it exists
   */
  numberVariationOrThrow(): number {
    if (!this.flag) {
      throw GatrixFeatureError.flagNotFound('unknown');
    }
    if (this.flag.variant?.payload == null) {
      throw GatrixFeatureError.noPayload(this.flag.name);
    }

    const payload = this.flag.variant.payload;
    if (typeof payload === 'number') {
      return payload;
    }

    throw GatrixFeatureError.typeMismatch(this.flag.name, 'number', typeof payload);
  }

  /**
   * Get JSON variation or throw if flag not found or invalid type
   * Note: disabled flag still returns payload if it exists
   */
  jsonVariationOrThrow<T>(): T {
    if (!this.flag) {
      throw GatrixFeatureError.flagNotFound('unknown');
    }
    if (this.flag.variant?.payload == null) {
      throw GatrixFeatureError.noPayload(this.flag.name);
    }

    const payload = this.flag.variant.payload;

    if (typeof payload === 'object') {
      return payload as T;
    }

    throw GatrixFeatureError.typeMismatch(this.flag.name, 'object', typeof payload);
  }
}
