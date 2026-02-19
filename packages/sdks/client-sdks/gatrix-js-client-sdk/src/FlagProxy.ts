/**
 * FlagProxy - Thin shell that delegates ALL logic to VariationProvider.
 *
 * Architecture per CLIENT_SDK_SPEC:
 * - Holds only flagName + forceRealtime + client reference.
 * - ALL property reads and variation methods delegate to the client.
 * - No deep copy of flag data — always reads live state from FeaturesClient cache.
 * - isRealtime property indicates the proxy's operational mode.
 * - Client is always present (never null).
 */
import { EvaluatedFlag, Variant, ValueType, VariationResult } from './types';
import { VariationProvider } from './VariationProvider';

export class FlagProxy {
  private _flagName: string;
  private _forceRealtime: boolean;
  private client: VariationProvider;

  constructor(client: VariationProvider, flagName: string, forceRealtime: boolean = false) {
    this._flagName = flagName ?? '';
    this._forceRealtime = forceRealtime;
    this.client = client;
  }

  // ==================== Properties ====================

  get name(): string {
    return this._flagName;
  }

  /** Whether this proxy was created in realtime mode. */
  get isRealtime(): boolean {
    return this._forceRealtime;
  }

  /** Whether the flag exists in the current cache. */
  get exists(): boolean {
    return this.client.hasFlagInternal(this._flagName, this._forceRealtime);
  }

  /**
   * Check if the flag is enabled.
   * Delegates to FeaturesClient for metrics tracking.
   */
  get enabled(): boolean {
    return this.client.isEnabledInternal(this._flagName, this._forceRealtime);
  }

  get variant(): Variant {
    return this.client.getVariantInternal(this._flagName, this._forceRealtime);
  }

  get valueType(): ValueType {
    return this.client.getValueTypeInternal(this._flagName, this._forceRealtime);
  }

  get version(): number {
    return this.client.getVersionInternal(this._flagName, this._forceRealtime);
  }

  get impressionData(): boolean {
    return this.client.getImpressionDataInternal(this._flagName, this._forceRealtime);
  }

  get raw(): EvaluatedFlag | undefined {
    return this.client.getRawFlagInternal(this._flagName, this._forceRealtime);
  }

  get reason(): string | undefined {
    return this.client.getReasonInternal(this._flagName, this._forceRealtime);
  }

  // ==================== Variation Methods ====================
  // All methods delegate to FeaturesClient's internal methods.
  // FlagProxy is a convenience shell - no own logic.

  variation(fallbackValue: string): string {
    return this.client.variationInternal(this._flagName, fallbackValue, this._forceRealtime);
  }

  boolVariation(fallbackValue: boolean): boolean {
    return this.client.boolVariationInternal(this._flagName, fallbackValue, this._forceRealtime);
  }

  stringVariation(fallbackValue: string): string {
    return this.client.stringVariationInternal(this._flagName, fallbackValue, this._forceRealtime);
  }

  numberVariation(fallbackValue: number): number {
    return this.client.numberVariationInternal(this._flagName, fallbackValue, this._forceRealtime);
  }

  jsonVariation<T>(fallbackValue: T): T {
    return this.client.jsonVariationInternal(this._flagName, fallbackValue, this._forceRealtime);
  }

  // ==================== Variation Details ====================

  boolVariationDetails(fallbackValue: boolean): VariationResult<boolean> {
    return this.client.boolVariationDetailsInternal(this._flagName, fallbackValue, this._forceRealtime);
  }

  stringVariationDetails(fallbackValue: string): VariationResult<string> {
    return this.client.stringVariationDetailsInternal(this._flagName, fallbackValue, this._forceRealtime);
  }

  numberVariationDetails(fallbackValue: number): VariationResult<number> {
    return this.client.numberVariationDetailsInternal(this._flagName, fallbackValue, this._forceRealtime);
  }

  jsonVariationDetails<T>(fallbackValue: T): VariationResult<T> {
    return this.client.jsonVariationDetailsInternal(this._flagName, fallbackValue, this._forceRealtime);
  }

  // ==================== Strict Variation Methods (OrThrow) ====================

  boolVariationOrThrow(): boolean {
    return this.client.boolVariationOrThrowInternal(this._flagName, this._forceRealtime);
  }

  stringVariationOrThrow(): string {
    return this.client.stringVariationOrThrowInternal(this._flagName, this._forceRealtime);
  }

  numberVariationOrThrow(): number {
    return this.client.numberVariationOrThrowInternal(this._flagName, this._forceRealtime);
  }

  jsonVariationOrThrow<T>(): T {
    return this.client.jsonVariationOrThrowInternal<T>(this._flagName, this._forceRealtime);
  }
}
