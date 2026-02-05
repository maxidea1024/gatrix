/**
 * FlagProxy - Wrapper for EvaluatedFlag with helper methods
 * Provides convenient variation accessors like .boolVariation(), .stringVariation(), etc.
 */
import { EvaluatedFlag, Variant, VariantType } from './types';

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
  boolVariation(defaultValue: boolean = false): boolean {
    if (!this.flag) {
      return defaultValue;
    }
    return this.flag.enabled;
  }

  /**
   * Get string variation from variant payload
   */
  stringVariation(defaultValue: string = ''): string {
    if (!this.flag || !this.flag.enabled || this.flag.variant?.payload == null) {
      return defaultValue;
    }
    return String(this.flag.variant.payload);
  }

  /**
   * Get number variation from variant payload
   */
  numberVariation(defaultValue: number = 0): number {
    if (!this.flag || !this.flag.enabled || this.flag.variant?.payload == null) {
      return defaultValue;
    }

    const payload = this.flag.variant.payload;
    if (typeof payload === 'number') {
      return payload;
    }
    const num = Number(payload);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Get JSON variation from variant payload
   */
  jsonVariation<T>(defaultValue: T): T {
    if (!this.flag || !this.flag.enabled || this.flag.variant?.payload == null) {
      return defaultValue;
    }

    const payload = this.flag.variant.payload;

    // If already an object, return directly
    if (typeof payload === 'object') {
      return payload as T;
    }

    // If string, try to parse as JSON
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
}
