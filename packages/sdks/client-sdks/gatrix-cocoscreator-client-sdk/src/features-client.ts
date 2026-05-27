/**
 * FeaturesClient - Feature Flags client for Gatrix CocosCreator SDK
 *
 * Differences from JS SDK:
 * - ky → httpGet/httpPost (XMLHttpRequest-based)
 * - URL → UrlBuilder
 * - @microsoft/fetch-event-source (SSE) → WebSocket only
 * - AbortController → CancelToken
 * - crypto.subtle → djb2 hash (synchronous)
 * - LocalStorageProvider → CocosStorageProvider
 */
import { type EventEmitter } from './event-emitter';
import { EVENTS } from './events';
import {
  type GatrixContext,
  type GatrixClientConfig,
  type FeaturesConfig,
  type EvaluatedFlag,
  type Variant,
  type ValueType,
  type FlagsApiResponse,
  type ImpressionEvent,
  type ErrorEvent,
  type SdkState,
  type FeaturesStats,
  type FeaturesLightStats,
  type VariationResult,
  type StreamingConnectionState,
  type FlagsChangedEvent,
} from './types';
import { type StorageProvider } from './storage-provider';
import { CocosStorageProvider } from './cocos-storage-provider';
import { InMemoryStorageProvider } from './in-memory-storage-provider';
import {
  uuidv4,
  deepClone,
  computeContextHash,
  computeEtag,
  isEqualFlag,
} from './utils';
import { buildContextQueryParams, SYSTEM_CONTEXT_FIELDS } from './context-utils';
import { FlagProxy } from './flag-proxy';
import { type VariationProvider } from './variation-provider';
import { WatchFlagGroup } from './watch-flag-group';
import { type Logger, ConsoleLogger } from './logger';
import { Metrics } from './metrics';
import { GatrixError, GatrixFeatureError } from './errors';
import { SDK_NAME, SDK_VERSION } from './version';
import { VALUE_SOURCE } from './value-source';
import { httpGet, httpPost, CancelToken, HttpAbortError } from './http-client';
import { UrlBuilder } from './url-builder';
import { validateAll } from './validate-params';

const STORAGE_KEY_FLAGS = 'flags';
const STORAGE_KEY_SESSION = 'sessionId';
const STORAGE_KEY_ETAG = 'etag';

export class FeaturesClient implements VariationProvider {
  private emitter: EventEmitter;
  private config: GatrixClientConfig;
  private storage: StorageProvider;
  private cancelToken: CancelToken | null = null;
  private logger: Logger;

  // Flag storage
  private realtimeFlags: Map<string, EvaluatedFlag> = new Map();
  private synchronizedFlags: Map<string, EvaluatedFlag> = new Map();

  // Context
  private context: GatrixContext = {};

  // State
  private sdkState: SdkState = 'initializing';
  private lastError: unknown = null;
  private started = false;
  private readyEventEmitted = false;
  private fetchedFromServer = false;
  private isFetchingFlags = false;
  private pendingInvalidationKeys = new Set<string>();
  private timerRef?: ReturnType<typeof setTimeout>;
  private etag = '';
  private consecutiveFailures: number = 0;
  private pollingStopped: boolean = false;
  private refreshInterval: number;
  private connectionId: string;
  private devMode: boolean;
  private pendingSync: boolean = false;

  // Streaming state (WebSocket only)
  private streamingState: StreamingConnectionState = 'disconnected';
  private streamingReconnectAttempt: number = 0;
  private streamingReconnectTimer?: ReturnType<typeof setTimeout>;
  private streamingReconnectCount: number = 0;
  private lastStreamingEventTime: Date | null = null;
  private streamingConnectedCount: number = 0;
  private streamingFlagsChangedCount: number = 0;
  private streamingHeartbeatCount: number = 0;
  private localGlobalRevision: number = 0;

  // WebSocket state
  private webSocket: WebSocket | null = null;
  private webSocketPingTimer?: ReturnType<typeof setInterval>;
  private pendingFetches: Set<string> = new Set();

  // Metrics
  private metrics: Metrics;
  private lastContextHash: string = '';
  private flagsContextHash: string = '';

  // Statistics tracking
  private fetchFlagsCount: number = 0;
  private updateCount: number = 0;
  private notModifiedCount: number = 0;
  private errorCount: number = 0;
  private recoveryCount: number = 0;
  private impressionCount: number = 0;
  private contextChangeCount: number = 0;
  private lastFetchTime: Date | null = null;
  private lastUpdateTime: Date | null = null;
  private lastErrorTime: Date | null = null;
  private lastRecoveryTime: Date | null = null;
  private startTime: Date | null = null;
  private syncFlagsCount: number = 0;
  private metricsSentCount: number = 0;
  private metricsErrorCount: number = 0;
  private watchGroups: Map<string, WatchFlagGroup> = new Map();
  private watchCallbacks: Map<string, Set<(flag: FlagProxy) => void | Promise<void>>> = new Map();
  private syncedWatchCallbacks: Map<string, Set<(flag: FlagProxy) => void | Promise<void>>> =
    new Map();
  private flagEnabledCounts: Map<string, { yes: number; no: number }> = new Map();
  private flagVariantCounts: Map<string, Map<string, number>> = new Map();
  private flagLastChangedTimes: Map<string, Date> = new Map();

  // System context fields (cannot be removed)
  private static readonly SYSTEM_CONTEXT_FIELDS = ['appName'];

  // Feature-specific config shortcuts
  private get featuresConfig() {
    const fc = this.config.features ?? {};
    return { explicitSyncMode: true, ...fc };
  }

  constructor(emitter: EventEmitter, config: GatrixClientConfig) {
    this.emitter = emitter;
    // Normalize apiUrl - remove trailing slash
    this.config = {
      ...config,
      apiUrl: config.apiUrl.replace(/\/+$/, ''),
    };
    this.connectionId = uuidv4();

    // Initialize storage (CocosStorageProvider for CocosCreator)
    const fc = config.features;
    const cachePrefix = fc?.cacheKeyPrefix ? `${fc.cacheKeyPrefix}:` : undefined;
    this.storage =
      fc?.storageProvider ?? new CocosStorageProvider(cachePrefix);

    // Initialize logger
    this.logger = config.logger ?? new ConsoleLogger('GatrixFeatureClient');

    // Dev mode
    this.devMode = config.enableDevMode ?? false;

    // Refresh interval (default: 30 seconds)
    this.refreshInterval = this.featuresConfig.disableRefresh
      ? 0
      : (this.featuresConfig.refreshInterval ?? 30) * 1000;

    // Initial context with system fields
    this.context = {
      appName: config.appName,
      ...config.features?.context,
    };

    // Initialize metrics
    this.metrics = new Metrics({
      appName: config.appName,
      apiUrl: config.apiUrl,
      apiToken: config.apiToken,
      customHeaders: config.customHeaders,
      disableMetrics: this.featuresConfig.disableMetrics,
      logger: this.logger,
      connectionId: this.connectionId,
      emitter: this.emitter,
    });

    // Handle metrics events for statistics
    this.emitter.on(EVENTS.FLAGS_METRICS_SENT, () => {
      this.metricsSentCount++;
    });
    this.emitter.on(EVENTS.FLAGS_METRICS_ERROR, () => {
      this.metricsErrorCount++;
    });

    // Bootstrap data
    const bootstrap = this.featuresConfig.bootstrap;
    if (bootstrap && bootstrap.length > 0) {
      this.setFlags(bootstrap);
    }
  }

  /**
   * Get client connection ID
   */
  public getConnectionId(): string {
    return this.connectionId;
  }

  /**
   * Initialize and start polling for flag updates.
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    this.startTime = new Date();
    this.consecutiveFailures = 0;
    this.pollingStopped = false;

    // --- Initialization phase ---

    // Resolve session ID
    const sessionId = await this.resolveSessionId();
    if (!this.started) return;
    this.context.sessionId = sessionId;

    // Load cached etag
    const cachedEtag = await this.storage.get(STORAGE_KEY_ETAG);
    if (!this.started) return;
    if (cachedEtag) {
      this.etag = cachedEtag;
    }

    // Load cached flags
    const cachedFlags = await this.storage.get(STORAGE_KEY_FLAGS);
    if (cachedFlags && Array.isArray(cachedFlags)) {
      this.setFlags(cachedFlags, true);
      if (!this.readyEventEmitted && cachedFlags.length > 0) {
        this.setReady();
      }
    }

    // Handle bootstrap
    const bootstrap = this.featuresConfig.bootstrap;
    const hasBootstrap = bootstrap && bootstrap.length > 0;
    const bootstrapOverride = this.featuresConfig.bootstrapOverride !== false;

    this.sdkState = 'healthy';
    this.emitter.emit(EVENTS.FLAGS_INIT);

    if (hasBootstrap && (bootstrapOverride || this.realtimeFlags.size === 0)) {
      await this.storage.save(STORAGE_KEY_FLAGS, bootstrap);
      this.setFlags(bootstrap, true);
      this.setReady();
    }

    // --- Start phase ---

    this.devLog(
      `start() called. offlineMode=${this.featuresConfig.offlineMode}, refreshInterval=${this.refreshInterval}ms, explicitSyncMode=${this.featuresConfig.explicitSyncMode}, enableStreaming=${this.featuresConfig.streaming?.enabled !== false}`
    );

    // Offline mode: skip all network requests
    if (this.featuresConfig.offlineMode) {
      if (this.realtimeFlags.size === 0) {
        const error = new GatrixError(
          'offlineMode requires bootstrap data or cached flags, but none are available'
        );
        this.sdkState = 'error';
        this.lastError = error;
        this.emitter.emit(EVENTS.SDK_ERROR, { type: 'offline_no_data', error });
        throw error;
      }
      this.setReady();
      this.metrics.start();
      return;
    }

    // Compute context hash (synchronous in CocosCreator SDK)
    this.lastContextHash = computeContextHash(this.context);
    if (!this.started) return;

    // Initial fetch
    await this.fetchFlagsInternal('init');
    if (!this.started) return;

    // Start streaming if enabled (default: true)
    if (this.featuresConfig.streaming?.enabled !== false) {
      this.connectStreaming();
    }

    // Start metrics collection
    this.metrics.start();
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.devLog('stop() called');
    if (this.timerRef) {
      clearTimeout(this.timerRef);
      this.timerRef = undefined;
    }
    this.disconnectStreaming();
    this.pollingStopped = true;
    this.consecutiveFailures = 0;
    this.metrics.stop();
    this.started = false;
  }

  /**
   * Check if ready
   */
  isReady(): boolean {
    return this.readyEventEmitted;
  }

  /**
   * Get last error
   */
  getError(): unknown {
    return this.sdkState === 'error' ? this.lastError : undefined;
  }

  // ==================== Context Management ====================

  getContext(): GatrixContext {
    return deepClone(this.context);
  }

  async updateContext(context: GatrixContext): Promise<void> {
    const newContext: GatrixContext = { ...this.context };

    for (const [key, value] of Object.entries(context)) {
      if (SYSTEM_CONTEXT_FIELDS.has(key)) {
        if (value !== null && value !== undefined) {
          (newContext as any)[key] = value;
        }
      } else if (key === 'properties') {
        if (value && typeof value === 'object') {
          const newProps = { ...(newContext.properties || {}) };
          for (const [pKey, pValue] of Object.entries(value as Record<string, any>)) {
            if (pValue === null || pValue === undefined) {
              delete newProps[pKey];
            } else {
              newProps[pKey] = pValue;
            }
          }
          newContext.properties = Object.keys(newProps).length > 0 ? newProps : undefined;
        } else if (value === null || value === undefined) {
          delete newContext.properties;
        }
      } else {
        if (value === null || value === undefined) {
          delete (newContext as any)[key];
        } else {
          (newContext as any)[key] = value;
        }
      }
    }

    // Synchronous hash in CocosCreator
    const newHash = computeContextHash(newContext);
    if (newHash === this.lastContextHash) {
      return;
    }

    this.context = newContext;
    this.lastContextHash = newHash;
    this.contextChangeCount++;
    await this.fetchFlagsInternal('contextChange');
  }

  // ==================== Flag Access ====================

  private createProxyForWatch(flagName: string, forceRealtime: boolean = true): FlagProxy {
    const flags = this.selectFlags(forceRealtime);
    const flag = flags.get(flagName);
    this.trackFlagAccess(flagName, flag, 'watch', flag?.variant.name);
    return new FlagProxy(this, flagName, forceRealtime);
  }

  private trackFlagAccess(
    flagName: string,
    flag: EvaluatedFlag | undefined,
    eventType: 'isEnabled' | 'getFlag' | 'getVariant' | 'watch',
    variantName?: string
  ): void {
    if (!flag) {
      this.metrics.countMissing(flagName);
      return;
    }

    this.metrics.count(flagName, flag.enabled);
    if (variantName) {
      this.metrics.countVariant(flagName, variantName);
    }

    this.trackFlagEnabledCount(flagName, flag.enabled);
    if (variantName) {
      this.trackVariantCount(flagName, variantName);
    }

    this.trackImpression(flagName, flag.enabled, flag, eventType, variantName);
  }

  private lookupFlag(flagName: string, forceRealtime: boolean = true): EvaluatedFlag | undefined {
    return this.selectFlags(forceRealtime).get(flagName);
  }

  isEnabled(flagName: string, forceRealtime: boolean = true): boolean {
    validateAll([{ param: 'flagName', value: flagName, type: 'string' }]);
    return this.isEnabledInternal(flagName, forceRealtime);
  }

  getFlag(flagName: string, forceRealtime: boolean = true): EvaluatedFlag | undefined {
    validateAll([{ param: 'flagName', value: flagName, type: 'string' }]);
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) {
      this.trackFlagAccess(flagName, undefined, 'getFlag');
      return undefined;
    }
    this.trackFlagAccess(flagName, flag, 'getFlag', flag.variant.name);
    return flag;
  }

  getVariant(flagName: string, forceRealtime: boolean = true): Variant {
    validateAll([{ param: 'flagName', value: flagName, type: 'string' }]);
    return this.getVariantInternal(flagName, forceRealtime);
  }

  getAllFlags(forceRealtime: boolean = true): EvaluatedFlag[] {
    const flags = this.selectFlags(forceRealtime);
    return Array.from(flags.values());
  }

  hasFlag(flagName: string, forceRealtime: boolean = true): boolean {
    validateAll([{ param: 'flagName', value: flagName, type: 'string' }]);
    const flags = this.selectFlags(forceRealtime);
    return flags.has(flagName);
  }

  // ==================== Internal Variation Methods ====================

  isEnabledInternal(flagName: string, forceRealtime: boolean = true): boolean {
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) {
      this.trackFlagAccess(flagName, undefined, 'isEnabled');
      return false;
    }
    this.trackFlagAccess(flagName, flag, 'isEnabled', flag.variant.name);
    return flag.enabled;
  }

  getVariantInternal(flagName: string, forceRealtime: boolean = true): Variant {
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) {
      this.trackFlagAccess(flagName, undefined, 'getVariant');
      return { name: VALUE_SOURCE.MISSING, enabled: false };
    }
    this.trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    return { ...flag.variant };
  }

  // ==================== Metadata Access Internal Methods ====================

  hasFlagInternal(flagName: string, forceRealtime: boolean = true): boolean {
    return this.lookupFlag(flagName, forceRealtime) !== undefined;
  }

  getValueTypeInternal(flagName: string, forceRealtime: boolean = true): ValueType {
    const flag = this.lookupFlag(flagName, forceRealtime);
    return flag?.valueType ?? 'none';
  }

  getVersionInternal(flagName: string, forceRealtime: boolean = true): number {
    const flag = this.lookupFlag(flagName, forceRealtime);
    return flag?.version ?? 0;
  }

  getReasonInternal(flagName: string, forceRealtime: boolean = true): string | undefined {
    const flag = this.lookupFlag(flagName, forceRealtime);
    return flag?.reason;
  }

  getImpressionDataInternal(flagName: string, forceRealtime: boolean = true): boolean {
    const flag = this.lookupFlag(flagName, forceRealtime);
    return flag?.impressionData ?? false;
  }

  getRawFlagInternal(flagName: string, forceRealtime: boolean = true): EvaluatedFlag | undefined {
    return this.lookupFlag(flagName, forceRealtime);
  }

  variationInternal(
    flagName: string,
    fallbackValue: string,
    forceRealtime: boolean = true
  ): string {
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) {
      this.trackFlagAccess(flagName, undefined, 'getVariant');
      return fallbackValue;
    }
    this.trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    return flag.variant.name;
  }

  boolVariationInternal(
    flagName: string,
    fallbackValue: boolean,
    forceRealtime: boolean = true
  ): boolean {
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) {
      this.trackFlagAccess(flagName, undefined, 'getVariant');
      return fallbackValue;
    }
    if (flag.valueType !== 'boolean') {
      this.trackFlagAccess(flagName, flag, 'getVariant', VALUE_SOURCE.TYPE_MISMATCH);
      return fallbackValue;
    }
    this.trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    return Boolean(flag.variant.value);
  }

  stringVariationInternal(
    flagName: string,
    fallbackValue: string,
    forceRealtime: boolean = true
  ): string {
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) {
      this.trackFlagAccess(flagName, undefined, 'getVariant');
      return fallbackValue;
    }
    if (flag.valueType !== 'string') {
      this.trackFlagAccess(flagName, flag, 'getVariant', VALUE_SOURCE.TYPE_MISMATCH);
      return fallbackValue;
    }
    this.trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    return String(flag.variant.value);
  }

  numberVariationInternal(
    flagName: string,
    fallbackValue: number,
    forceRealtime: boolean = true
  ): number {
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) {
      this.trackFlagAccess(flagName, undefined, 'getVariant');
      return fallbackValue;
    }
    if (flag.valueType !== 'number') {
      this.trackFlagAccess(flagName, flag, 'getVariant', VALUE_SOURCE.TYPE_MISMATCH);
      return fallbackValue;
    }
    this.trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    const value = Number(flag.variant.value);
    return isNaN(value) ? fallbackValue : value;
  }

  jsonVariationInternal<T>(flagName: string, fallbackValue: T, forceRealtime: boolean = true): T {
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) {
      this.trackFlagAccess(flagName, undefined, 'getVariant');
      return fallbackValue;
    }
    if (flag.valueType !== 'json') {
      this.trackFlagAccess(flagName, flag, 'getVariant', VALUE_SOURCE.TYPE_MISMATCH);
      return fallbackValue;
    }
    this.trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    const value = flag.variant.value;
    if (typeof value !== 'object' || value === null) {
      return fallbackValue;
    }
    return value as T;
  }

  // ==================== Internal Variation Details ====================

  boolVariationDetailsInternal(
    flagName: string,
    fallbackValue: boolean,
    forceRealtime: boolean = true
  ): VariationResult<boolean> {
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) {
      this.trackFlagAccess(flagName, undefined, 'getVariant');
      return { value: fallbackValue, reason: 'flag_not_found', flagExists: false, enabled: false, variantName: VALUE_SOURCE.MISSING };
    }
    if (flag.valueType !== 'boolean') {
      this.trackFlagAccess(flagName, flag, 'getVariant', VALUE_SOURCE.TYPE_MISMATCH);
      return { value: fallbackValue, reason: `type_mismatch:expected_boolean_got_${flag.valueType}`, flagExists: true, enabled: flag.enabled, variantName: VALUE_SOURCE.TYPE_MISMATCH };
    }
    this.trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    return { value: Boolean(flag.variant.value), reason: flag.reason ?? 'evaluated', flagExists: true, enabled: flag.enabled, variantName: flag.variant.name };
  }

  stringVariationDetailsInternal(
    flagName: string,
    fallbackValue: string,
    forceRealtime: boolean = true
  ): VariationResult<string> {
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) {
      this.trackFlagAccess(flagName, undefined, 'getVariant');
      return { value: fallbackValue, reason: 'flag_not_found', flagExists: false, enabled: false, variantName: VALUE_SOURCE.MISSING };
    }
    if (flag.valueType !== 'string') {
      this.trackFlagAccess(flagName, flag, 'getVariant', VALUE_SOURCE.TYPE_MISMATCH);
      return { value: fallbackValue, reason: `type_mismatch:expected_string_got_${flag.valueType}`, flagExists: true, enabled: flag.enabled, variantName: VALUE_SOURCE.TYPE_MISMATCH };
    }
    this.trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    return { value: String(flag.variant.value), reason: flag.reason ?? 'evaluated', flagExists: true, enabled: flag.enabled, variantName: flag.variant.name };
  }

  numberVariationDetailsInternal(
    flagName: string,
    fallbackValue: number,
    forceRealtime: boolean = true
  ): VariationResult<number> {
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) {
      this.trackFlagAccess(flagName, undefined, 'getVariant');
      return { value: fallbackValue, reason: 'flag_not_found', flagExists: false, enabled: false, variantName: VALUE_SOURCE.MISSING };
    }
    if (flag.valueType !== 'number') {
      this.trackFlagAccess(flagName, flag, 'getVariant', VALUE_SOURCE.TYPE_MISMATCH);
      return { value: fallbackValue, reason: `type_mismatch:expected_number_got_${flag.valueType}`, flagExists: true, enabled: flag.enabled, variantName: VALUE_SOURCE.TYPE_MISMATCH };
    }
    this.trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    const value = Number(flag.variant.value);
    return {
      value: isNaN(value) ? fallbackValue : value,
      reason: isNaN(value) ? 'type_mismatch:value_not_number' : (flag.reason ?? 'evaluated'),
      flagExists: true, enabled: flag.enabled,
      variantName: isNaN(value) ? VALUE_SOURCE.TYPE_MISMATCH : flag.variant.name,
    };
  }

  jsonVariationDetailsInternal<T>(
    flagName: string,
    fallbackValue: T,
    forceRealtime: boolean = true
  ): VariationResult<T> {
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) {
      this.trackFlagAccess(flagName, undefined, 'getVariant');
      return { value: fallbackValue, reason: 'flag_not_found', flagExists: false, enabled: false, variantName: VALUE_SOURCE.MISSING };
    }
    if (flag.valueType !== 'json') {
      this.trackFlagAccess(flagName, flag, 'getVariant', VALUE_SOURCE.TYPE_MISMATCH);
      return { value: fallbackValue, reason: `type_mismatch:expected_json_got_${flag.valueType}`, flagExists: true, enabled: flag.enabled, variantName: VALUE_SOURCE.TYPE_MISMATCH };
    }
    this.trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    const value = flag.variant.value;
    if (typeof value !== 'object' || value === null) {
      return { value: fallbackValue, reason: 'type_mismatch:value_not_object', flagExists: true, enabled: flag.enabled, variantName: VALUE_SOURCE.TYPE_MISMATCH };
    }
    return { value: value as T, reason: flag.reason ?? 'evaluated', flagExists: true, enabled: flag.enabled, variantName: flag.variant.name };
  }

  // ==================== Strict Variation (OrThrow) ====================

  boolVariationOrThrowInternal(flagName: string, forceRealtime: boolean = true): boolean {
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) { this.trackFlagAccess(flagName, undefined, 'isEnabled'); throw GatrixFeatureError.flagNotFound(flagName); }
    this.trackFlagAccess(flagName, flag, 'isEnabled', flag.variant.name);
    if (flag.valueType !== 'boolean') { throw GatrixFeatureError.typeMismatch(flagName, 'boolean', flag.valueType); }
    return Boolean(flag.variant.value);
  }

  stringVariationOrThrowInternal(flagName: string, forceRealtime: boolean = true): string {
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) { this.trackFlagAccess(flagName, undefined, 'getVariant'); throw GatrixFeatureError.flagNotFound(flagName); }
    this.trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    if (flag.valueType !== 'string') { throw GatrixFeatureError.typeMismatch(flagName, 'string', flag.valueType); }
    return String(flag.variant.value);
  }

  numberVariationOrThrowInternal(flagName: string, forceRealtime: boolean = true): number {
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) { this.trackFlagAccess(flagName, undefined, 'getVariant'); throw GatrixFeatureError.flagNotFound(flagName); }
    this.trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    if (flag.valueType !== 'number') { throw GatrixFeatureError.typeMismatch(flagName, 'number', flag.valueType); }
    const value = Number(flag.variant.value);
    if (isNaN(value)) { throw GatrixFeatureError.typeMismatch(flagName, 'number', typeof flag.variant.value); }
    return value;
  }

  jsonVariationOrThrowInternal<T>(flagName: string, forceRealtime: boolean = true): T {
    const flag = this.lookupFlag(flagName, forceRealtime);
    if (!flag) { this.trackFlagAccess(flagName, undefined, 'getVariant'); throw GatrixFeatureError.flagNotFound(flagName); }
    this.trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    if (flag.valueType !== 'json') { throw GatrixFeatureError.typeMismatch(flagName, 'json', flag.valueType); }
    const value = flag.variant.value;
    if (typeof value !== 'object' || value === null) { throw GatrixFeatureError.typeMismatch(flagName, 'json', typeof value); }
    return value as T;
  }

  // ==================== Public Variation Methods ====================

  variation(flagName: string, fallbackValue: string, forceRealtime: boolean = true): string {
    return this.variationInternal(flagName, fallbackValue, forceRealtime);
  }

  boolVariation(flagName: string, fallbackValue: boolean, forceRealtime: boolean = true): boolean {
    return this.boolVariationInternal(flagName, fallbackValue, forceRealtime);
  }

  stringVariation(flagName: string, fallbackValue: string, forceRealtime: boolean = true): string {
    return this.stringVariationInternal(flagName, fallbackValue, forceRealtime);
  }

  numberVariation(flagName: string, fallbackValue: number, forceRealtime: boolean = true): number {
    return this.numberVariationInternal(flagName, fallbackValue, forceRealtime);
  }

  jsonVariation<T>(flagName: string, fallbackValue: T, forceRealtime: boolean = true): T {
    return this.jsonVariationInternal(flagName, fallbackValue, forceRealtime);
  }

  // ==================== Strict Variation Methods ====================

  boolVariationOrThrow(flagName: string, forceRealtime: boolean = true): boolean { return this.boolVariationOrThrowInternal(flagName, forceRealtime); }
  stringVariationOrThrow(flagName: string, forceRealtime: boolean = true): string { return this.stringVariationOrThrowInternal(flagName, forceRealtime); }
  numberVariationOrThrow(flagName: string, forceRealtime: boolean = true): number { return this.numberVariationOrThrowInternal(flagName, forceRealtime); }
  jsonVariationOrThrow<T>(flagName: string, forceRealtime: boolean = true): T { return this.jsonVariationOrThrowInternal<T>(flagName, forceRealtime); }

  // ==================== Variation Details ====================

  boolVariationDetails(flagName: string, fallbackValue: boolean, forceRealtime: boolean = true): VariationResult<boolean> { return this.boolVariationDetailsInternal(flagName, fallbackValue, forceRealtime); }
  stringVariationDetails(flagName: string, fallbackValue: string, forceRealtime: boolean = true): VariationResult<string> { return this.stringVariationDetailsInternal(flagName, fallbackValue, forceRealtime); }
  numberVariationDetails(flagName: string, fallbackValue: number, forceRealtime: boolean = true): VariationResult<number> { return this.numberVariationDetailsInternal(flagName, fallbackValue, forceRealtime); }
  jsonVariationDetails<T>(flagName: string, fallbackValue: T, forceRealtime: boolean = true): VariationResult<T> { return this.jsonVariationDetailsInternal(flagName, fallbackValue, forceRealtime); }

  // ==================== Sync ====================

  async syncFlags(fetchNow: boolean = true): Promise<void> {
    if (!this.featuresConfig.explicitSyncMode) { return; }
    if (fetchNow) { await this.fetchFlagsInternal('syncFlags'); }
    const oldSynchronizedFlags = new Map(this.synchronizedFlags);
    this.synchronizedFlags = new Map(this.realtimeFlags);
    this.invokeWatchCallbacks(this.syncedWatchCallbacks, oldSynchronizedFlags, this.synchronizedFlags, false);
    this.pendingSync = false;
    this.syncFlagsCount++;
    this.emitter.emit(EVENTS.FLAGS_SYNC);
  }

  public isExplicitSyncEnabled(): boolean { return !!this.featuresConfig.explicitSyncMode; }

  public setExplicitSyncMode(enabled: boolean): void {
    if (!!this.featuresConfig.explicitSyncMode === enabled) { return; }
    const config = this.config.features ?? {};
    config.explicitSyncMode = enabled;
    this.config.features = config;
    this.synchronizedFlags = new Map(this.realtimeFlags);
    this.pendingSync = false;
    this.devLog(`setExplicitSyncMode: ${enabled}`);
  }

  public hasPendingSyncFlags(): boolean { return this.isExplicitSyncEnabled() ? this.pendingSync : false; }
  public isOfflineMode(): boolean { return !!this.featuresConfig.offlineMode; }
  public getConfig(): FeaturesConfig { return this.featuresConfig; }
  public isFetching(): boolean { return this.isFetchingFlags; }

  // ==================== Watch ====================

  watchRealtimeFlag(flagName: string, callback: (flag: FlagProxy) => void | Promise<void>): () => void {
    if (!this.watchCallbacks.has(flagName)) { this.watchCallbacks.set(flagName, new Set()); }
    this.watchCallbacks.get(flagName)!.add(callback);
    return () => { this.watchCallbacks.get(flagName)?.delete(callback); };
  }

  watchRealtimeFlagWithInitialState(flagName: string, callback: (flag: FlagProxy) => void | Promise<void>): () => void {
    if (!this.watchCallbacks.has(flagName)) { this.watchCallbacks.set(flagName, new Set()); }
    this.watchCallbacks.get(flagName)!.add(callback);
    if (this.readyEventEmitted) { void callback(this.createProxyForWatch(flagName, true)); }
    else { this.emitter.once(EVENTS.FLAGS_READY, () => { void callback(this.createProxyForWatch(flagName, true)); }); }
    return () => { this.watchCallbacks.get(flagName)?.delete(callback); };
  }

  watchSyncedFlag(flagName: string, callback: (flag: FlagProxy) => void | Promise<void>): () => void {
    if (!this.syncedWatchCallbacks.has(flagName)) { this.syncedWatchCallbacks.set(flagName, new Set()); }
    this.syncedWatchCallbacks.get(flagName)!.add(callback);
    return () => { this.syncedWatchCallbacks.get(flagName)?.delete(callback); };
  }

  watchSyncedFlagWithInitialState(flagName: string, callback: (flag: FlagProxy) => void | Promise<void>): () => void {
    if (!this.syncedWatchCallbacks.has(flagName)) { this.syncedWatchCallbacks.set(flagName, new Set()); }
    this.syncedWatchCallbacks.get(flagName)!.add(callback);
    if (this.readyEventEmitted) { void callback(this.createProxyForWatch(flagName, false)); }
    else { this.emitter.once(EVENTS.FLAGS_READY, () => { void callback(this.createProxyForWatch(flagName, false)); }); }
    return () => { this.syncedWatchCallbacks.get(flagName)?.delete(callback); };
  }

  createWatchFlagGroup(name: string): WatchFlagGroup {
    const group = new WatchFlagGroup(this, name);
    this.watchGroups.set(name, group);
    return group;
  }

  // ==================== Fetch ====================

  async fetchFlags(): Promise<void> { return this.fetchFlagsInternal('manual'); }

  private async fetchFlagsInternal(
    caller: 'init' | 'polling' | 'manual' | 'syncFlags' | 'contextChange' | 'gap_recovery' | 'pending_invalidation'
  ): Promise<void> {
    if (this.featuresConfig.offlineMode) { this.logger.warn('fetchFlags called but client is in offline mode, ignoring'); return; }
    if (this.isFetchingFlags) { return; }

    this.isFetchingFlags = true;
    this.pollingStopped = false;
    const fetchStartContextHash = this.lastContextHash;
    this.logger.info(`fetchFlags [${caller}]: starting fetch. etag=${this.etag}`);
    this.emitter.emit(EVENTS.FLAGS_FETCH_START);

    if (this.timerRef) { clearTimeout(this.timerRef); this.timerRef = undefined; }

    // Cancel previous request
    if (this.cancelToken) { this.cancelToken.cancel(); }
    this.cancelToken = new CancelToken();

    try {
      this.fetchFlagsCount++;
      this.lastFetchTime = new Date();

      const url = new UrlBuilder(`${this.config.apiUrl}/client/features/eval`);
      const headers = this.buildHeaders();
      if (this.etag) { headers['If-None-Match'] = this.etag; }
      this.emitter.emit(EVENTS.FLAGS_FETCH, { etag: this.etag || null });

      const retryOptions = this.featuresConfig.fetchRetryOptions ?? {};
      const timeout = retryOptions.timeout ?? 30000;
      const nonRetryableStatusCodes = retryOptions.nonRetryableStatusCodes ?? [401, 403];

      let response;

      if (this.featuresConfig.usePOSTrequests) {
        headers['Content-Type'] = 'application/json';
        response = await httpPost(
          url.toString(),
          { context: this.context },
          { headers, cancelToken: this.cancelToken, timeout }
        );
      } else {
        buildContextQueryParams(url, this.context);
        response = await httpGet(url.toString(), { headers, cancelToken: this.cancelToken, timeout });
      }

      // Check for recovery
      if (this.sdkState === 'error' && response.status < 400) {
        this.sdkState = 'healthy';
        this.recoveryCount++;
        this.lastRecoveryTime = new Date();
        this.logger.info(`SDK recovered from error state (recovery #${this.recoveryCount})`);
        this.emitter.emit(EVENTS.FLAGS_RECOVERED);
      }

      if (response.ok) {
        const newEtag = response.headers.get('ETag') ?? '';
        if (newEtag !== this.etag) {
          this.etag = newEtag;
          await this.storage.save(STORAGE_KEY_ETAG, this.etag);
        }
        const data: FlagsApiResponse = response.json();
        if (data.success && data.data?.flags) {
          const isInitialFetch = !this.fetchedFromServer;
          await this.storeFlags(data.data.flags, isInitialFetch);
          this.updateCount++;
          this.lastUpdateTime = new Date();
          if (!this.fetchedFromServer) { this.fetchedFromServer = true; this.setReady(); }
        }
        this.consecutiveFailures = 0;
        this.scheduleNextRefresh();
        this.emitter.emit(EVENTS.FLAGS_FETCH_SUCCESS);
      } else if (response.status === 304) {
        this.notModifiedCount++;
        if (!this.fetchedFromServer) { this.fetchedFromServer = true; this.setReady(); }
        this.consecutiveFailures = 0;
        this.scheduleNextRefresh();
        this.emitter.emit(EVENTS.FLAGS_FETCH_SUCCESS);
      } else if (nonRetryableStatusCodes.includes(response.status)) {
        this.handleFetchError(response.status);
        this.pollingStopped = true;
        this.logger.error(`Polling stopped due to non-retryable status code ${response.status}. Call fetchFlags() manually to retry.`);
        this.emitter.emit(EVENTS.FLAGS_FETCH_ERROR, { status: response.status, retryable: false });
      } else {
        this.handleFetchError(response.status);
        this.consecutiveFailures++;
        this.emitter.emit(EVENTS.FLAGS_FETCH_ERROR, { status: response.status, retryable: true });
        this.scheduleNextRefresh();
      }
    } catch (e: unknown) {
      if (e instanceof HttpAbortError) { return; }
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.logger.error('Failed to fetch flags:', errorMessage);
      this.sdkState = 'error';
      this.lastError = e;
      this.errorCount++;
      this.lastErrorTime = new Date();
      this.emitter.emit(EVENTS.SDK_ERROR, { type: 'fetch-flags', message: errorMessage } as ErrorEvent);
      this.emitter.emit(EVENTS.FLAGS_FETCH_ERROR, { error: e, message: errorMessage });
      this.consecutiveFailures++;
      this.scheduleNextRefresh();
    } finally {
      this.isFetchingFlags = false;
      this.cancelToken = null;
      this.emitter.emit(EVENTS.FLAGS_FETCH_END);

      if (this.lastContextHash !== fetchStartContextHash) {
        this.devLog('Context changed during fetch, triggering re-fetch with new context');
        this.etag = '';
        this.pendingInvalidationKeys.clear();
        void this.fetchFlagsInternal('contextChange');
      } else if (this.pendingInvalidationKeys.size > 0) {
        const pendingKeys = new Set(this.pendingInvalidationKeys);
        this.pendingInvalidationKeys.clear();
        if (pendingKeys.has('*')) {
          this.etag = '';
          void this.fetchFlagsInternal('pending_invalidation');
        } else {
          const totalFlags = this.realtimeFlags.size;
          if (totalFlags === 0 || pendingKeys.size >= totalFlags / 2) {
            this.etag = '';
            void this.fetchFlagsInternal('pending_invalidation');
          } else {
            void this.fetchPartialFlagsInternal(pendingKeys);
          }
        }
      }
    }
  }

  // ==================== Private Methods ====================

  private setReady(): void {
    this.readyEventEmitted = true;
    this.devLog(`SDK ready. Total flags: ${this.realtimeFlags.size}`);
    this.emitter.emit(EVENTS.FLAGS_READY);
  }

  private scheduleNextRefresh(): void {
    if (this.refreshInterval <= 0 || !this.started || this.pollingStopped) { return; }
    const isStreamingEnabled = this.featuresConfig.streaming?.enabled !== false;
    if (isStreamingEnabled && this.streamingState !== 'degraded') {
      this.devLog(`scheduleNextRefresh: Skipped because streaming is enabled and state is '${this.streamingState}'`);
      return;
    }
    if (this.timerRef) { clearTimeout(this.timerRef); }
    let delay = this.refreshInterval;
    if (this.consecutiveFailures > 0) {
      const retryOptions = this.featuresConfig.fetchRetryOptions ?? {};
      const initialBackoff = retryOptions.initialBackoff ?? 1;
      const maxBackoff = retryOptions.maxBackoff ?? 60;
      const backoffDelay = Math.min(initialBackoff * Math.pow(2, this.consecutiveFailures - 1), maxBackoff);
      delay = backoffDelay * 1000;
      this.logger.warn(`Scheduling retry after ${backoffDelay}s (consecutive failures: ${this.consecutiveFailures})`);
    }
    this.devLog(`scheduleNextRefresh: delay=${delay}ms, consecutiveFailures=${this.consecutiveFailures}`);
    this.timerRef = setTimeout(async () => { await this.fetchFlagsInternal('polling'); }, delay);
  }

  private devLog(message: string): void {
    if (this.devMode) { this.logger.debug(`[DEV] ${message}`); }
  }

  private selectFlags(forceRealtime: boolean): Map<string, EvaluatedFlag> {
    if (forceRealtime) { return this.realtimeFlags; }
    return this.featuresConfig.explicitSyncMode ? this.synchronizedFlags : this.realtimeFlags;
  }

  private setFlags(flags: EvaluatedFlag[], forceSync: boolean = false): void {
    this.realtimeFlags.clear();
    for (const flag of flags) { this.realtimeFlags.set(flag.name, flag); }
    this.devLog(`setFlags: ${flags.length} flags loaded, forceSync=${forceSync}`);
    if (!this.featuresConfig.explicitSyncMode || forceSync) {
      this.synchronizedFlags = new Map(this.realtimeFlags);
      this.pendingSync = false;
    } else {
      const wasPending = this.pendingSync;
      this.pendingSync = true;
      if (!wasPending) { this.emitter.emit(EVENTS.FLAGS_PENDING_SYNC); }
    }
  }

  private async storeFlags(flags: EvaluatedFlag[], forceSync: boolean = false): Promise<void> {
    const oldFlags = new Map(this.realtimeFlags);
    const oldContextHash = this.flagsContextHash;
    const newContextHash = this.lastContextHash;
    this.setFlags(flags, forceSync);
    this.flagsContextHash = newContextHash;
    await this.storage.save(STORAGE_KEY_FLAGS, flags);
    this.emitRealtimeFlagChanges(oldFlags, this.realtimeFlags, oldContextHash, newContextHash);
    this.invokeWatchCallbacks(this.watchCallbacks, oldFlags, this.realtimeFlags, true, oldContextHash, newContextHash);
    if (!this.featuresConfig.explicitSyncMode || forceSync) {
      this.invokeWatchCallbacks(this.syncedWatchCallbacks, oldFlags, this.realtimeFlags, false, oldContextHash, newContextHash);
    }
    this.sdkState = 'healthy';
    if (!this.featuresConfig.explicitSyncMode || forceSync) { this.emitter.emit(EVENTS.FLAGS_CHANGE, { flags }); }
  }

  private mergeFlags(flags: EvaluatedFlag[], requestedKeys: Set<string>): void {
    for (const flag of flags) { this.realtimeFlags.set(flag.name, flag); }
    const returnedNames = new Set(flags.map((f) => f.name));
    for (const key of requestedKeys) { if (!returnedNames.has(key)) { this.realtimeFlags.delete(key); } }
    if (!this.featuresConfig.explicitSyncMode) {
      this.synchronizedFlags = new Map(this.realtimeFlags);
      this.pendingSync = false;
    } else {
      const wasPending = this.pendingSync;
      this.pendingSync = true;
      if (!wasPending) { this.emitter.emit(EVENTS.FLAGS_PENDING_SYNC); }
    }
  }

  private async storePartialFlags(flags: EvaluatedFlag[], requestedKeys: Set<string>): Promise<void> {
    const oldFlags = new Map(this.realtimeFlags);
    const oldContextHash = this.flagsContextHash;
    const newContextHash = this.lastContextHash;
    this.mergeFlags(flags, requestedKeys);
    this.flagsContextHash = newContextHash;
    const allFlags = Array.from(this.realtimeFlags.values());
    const newEtag = computeEtag(allFlags, newContextHash);
    if (newEtag && newEtag !== this.etag) {
      this.etag = newEtag;
      await this.storage.save(STORAGE_KEY_ETAG, this.etag);
    }
    await this.storage.save(STORAGE_KEY_FLAGS, allFlags);
    this.emitRealtimeFlagChanges(oldFlags, this.realtimeFlags, oldContextHash, newContextHash);
    this.invokeWatchCallbacks(this.watchCallbacks, oldFlags, this.realtimeFlags, true, oldContextHash, newContextHash);
    if (!this.featuresConfig.explicitSyncMode) {
      this.invokeWatchCallbacks(this.syncedWatchCallbacks, oldFlags, this.realtimeFlags, false, oldContextHash, newContextHash);
    }
    this.sdkState = 'healthy';
    if (!this.featuresConfig.explicitSyncMode) { this.emitter.emit(EVENTS.FLAGS_CHANGE, { flags: allFlags }); }
  }

  private emitRealtimeFlagChanges(oldFlags: Map<string, EvaluatedFlag>, newFlags: Map<string, EvaluatedFlag>, oldContextHash?: string, newContextHash?: string): void {
    const isInitialLoad = oldFlags.size === 0;
    const now = new Date();
    for (const [name, newFlag] of newFlags) {
      const oldFlag = oldFlags.get(name);
      if (!oldFlag || !isEqualFlag(oldFlag, newFlag, oldContextHash, newContextHash)) {
        const changeType = oldFlag ? 'updated' : 'created';
        if (!isInitialLoad) { this.flagLastChangedTimes.set(name, now); }
        this.emitter.emit(`flags.${name}.change`, newFlag, oldFlag, changeType);
      }
    }
    const removedNames: string[] = [];
    for (const [name] of oldFlags) { if (!newFlags.has(name)) { removedNames.push(name); this.flagLastChangedTimes.set(name, now); } }
    if (removedNames.length > 0) { this.emitter.emit(EVENTS.FLAGS_REMOVED, removedNames); }
  }

  private invokeWatchCallbacks(
    callbackMap: Map<string, Set<(flag: FlagProxy) => void | Promise<void>>>,
    oldFlags: Map<string, EvaluatedFlag>, newFlags: Map<string, EvaluatedFlag>,
    forceRealtime: boolean, oldContextHash?: string, newContextHash?: string
  ): void {
    const now = new Date();
    for (const [name, newFlag] of newFlags) {
      const oldFlag = oldFlags.get(name);
      if (!oldFlag || !isEqualFlag(oldFlag, newFlag, oldContextHash, newContextHash)) {
        this.flagLastChangedTimes.set(name, now);
        const callbacks = callbackMap.get(name);
        if (callbacks && callbacks.size > 0) {
          const proxy = this.createProxyForWatch(name, forceRealtime);
          callbacks.forEach((callback) => { try { void callback(proxy); } catch (error) { this.logger.error(`Error in watch callback for ${name}:`, error); } });
        }
      }
    }
    const removedNames: string[] = [];
    for (const [name] of oldFlags) {
      if (!newFlags.has(name)) {
        removedNames.push(name); this.flagLastChangedTimes.set(name, now);
        const callbacks = callbackMap.get(name);
        if (callbacks && callbacks.size > 0) {
          const proxy = this.createProxyForWatch(name, forceRealtime);
          callbacks.forEach((callback) => { try { void callback(proxy); } catch (error) { this.logger.error(`Error in watch callback for removed flag ${name}:`, error); } });
        }
      }
    }
    if (removedNames.length > 0) { this.emitter.emit(EVENTS.FLAGS_REMOVED, removedNames); }
  }

  private handleFetchError(statusCode: number): void {
    this.sdkState = 'error';
    this.lastError = { type: 'HttpError', code: statusCode };
    this.errorCount++;
    this.lastErrorTime = new Date();
    this.emitter.emit(EVENTS.SDK_ERROR, { type: 'HttpError', code: statusCode } as ErrorEvent);
  }

  private async resolveSessionId(): Promise<string> {
    if (this.context.sessionId) { return this.context.sessionId; }
    let sessionId = await this.storage.get(STORAGE_KEY_SESSION);
    if (!sessionId) {
      sessionId = String(Math.floor(Math.random() * 1_000_000_000));
      await this.storage.save(STORAGE_KEY_SESSION, sessionId);
    }
    return sessionId;
  }

  private trackImpression(flagName: string, enabled: boolean, flag: EvaluatedFlag | undefined, eventType: 'isEnabled' | 'getFlag' | 'getVariant' | 'watch', variantName?: string): void {
    const shouldTrack = this.featuresConfig.impressionDataAll || flag?.impressionData;
    if (!shouldTrack) { return; }
    const event: ImpressionEvent = { eventType, eventId: uuidv4(), context: this.context, enabled, featureName: flagName, impressionData: flag?.impressionData ?? false, variantName, reason: flag?.reason };
    this.impressionCount++;
    this.emitter.emit(EVENTS.FLAGS_IMPRESSION, event);
  }

  // ==================== Headers ====================

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Token': this.config.apiToken,
      'X-Application-Name': this.config.appName,
      'X-Connection-Id': this.connectionId,
      'X-SDK-Version': `${SDK_NAME}/${SDK_VERSION}`,
      'X-Gatrix-Context-Hash': this.lastContextHash,
      ...this.config.customHeaders,
    };
  }

  // ==================== Streaming (WebSocket only) ====================

  private connectStreaming(): void {
    if (this.streamingState === 'connected' || this.streamingState === 'connecting') { return; }
    this.connectWebSocket();
  }

  private connectWebSocket(): void {
    this.streamingState = 'connecting';
    this.devLog('Connecting to WebSocket streaming endpoint...');
    const baseUrl = this.featuresConfig.streaming?.websocket?.url ?? `${this.config.apiUrl}/client/features/stream/ws`;
    const wsUrl = baseUrl.replace(/^http/, 'ws');
    const url = new UrlBuilder(wsUrl);
    url.searchParams.set('x-api-token', this.config.apiToken);
    url.searchParams.set('appName', this.config.appName);
    if (this.connectionId) { url.searchParams.set('connectionId', this.connectionId); }
    url.searchParams.set('sdkVersion', `${SDK_NAME}/${SDK_VERSION}`);

    try { this.webSocket = new WebSocket(url.toString()); }
    catch (err) {
      this.logger.error('Failed to create WebSocket:', String(err));
      this.streamingState = 'reconnecting';
      this.scheduleStreamingReconnect();
      return;
    }

    this.webSocket.onopen = () => {
      this.streamingState = 'connected';
      this.streamingReconnectAttempt = 0;
      this.devLog(`WebSocket connected. URL: ${wsUrl}`);
      if (this.timerRef) { clearTimeout(this.timerRef); this.timerRef = undefined; }
      this.emitter.emit(EVENTS.FLAGS_STREAMING_CONNECTED, {});
      const pingInterval = (this.featuresConfig.streaming?.websocket?.pingInterval ?? 30) * 1000;
      this.webSocketPingTimer = setInterval(() => {
        if (this.webSocket?.readyState === WebSocket.OPEN) { this.webSocket.send(JSON.stringify({ type: 'ping' })); }
      }, pingInterval);
    };

    this.webSocket.onmessage = (event) => {
      this.lastStreamingEventTime = new Date();
      try {
        const msg = JSON.parse(event.data as string) as { type: string; data: Record<string, any> };
        switch (msg.type) {
          case 'connected': {
            const data = msg.data as { globalRevision: number };
            this.devLog(`WS 'connected' event: globalRevision=${data.globalRevision}`);
            this.emitter.emit(EVENTS.FLAGS_STREAMING_CONNECTED, { globalRevision: data.globalRevision });
            if (data.globalRevision > this.localGlobalRevision && this.localGlobalRevision > 0) {
              this.devLog(`Gap detected: server=${data.globalRevision}, local=${this.localGlobalRevision}. Triggering recovery.`);
              void this.fetchFlagsInternal('gap_recovery');
            } else if (this.localGlobalRevision === 0) { this.localGlobalRevision = data.globalRevision; }
            this.streamingConnectedCount++;
            break;
          }
          case 'flags_changed': {
            const data = msg.data as { globalRevision: number; changedKeys: string[]; timestamp: number };
            this.devLog(`WS 'flags_changed': globalRevision=${data.globalRevision}, changedKeys=[${data.changedKeys.join(',')}]`);
            if (data.globalRevision > this.localGlobalRevision) {
              this.localGlobalRevision = data.globalRevision;
              this.emitter.emit(EVENTS.FLAGS_INVALIDATED, { globalRevision: data.globalRevision, changedKeys: data.changedKeys });
              this.handleStreamingInvalidation(data.changedKeys);
            } else { this.devLog(`Ignoring stale event: server=${data.globalRevision} <= local=${this.localGlobalRevision}`); }
            this.streamingFlagsChangedCount++;
            break;
          }
          case 'heartbeat': { this.devLog('WS heartbeat received'); this.streamingHeartbeatCount++; break; }
          case 'pong': { this.devLog('WS pong received'); break; }
          default: this.devLog(`Unknown WS event: ${msg.type}`); break;
        }
      } catch (e) { this.logger.warn('Failed to parse WebSocket message:', String(e)); }
    };

    this.webSocket.onclose = () => {
      if (this.streamingState === 'disconnected') { return; }
      this.devLog('WebSocket connection closed by server');
      this.clearWebSocketPing();
      this.streamingState = 'reconnecting';
      this.emitter.emit(EVENTS.FLAGS_STREAMING_DISCONNECTED);
      this.scheduleStreamingReconnect();
    };

    this.webSocket.onerror = (err) => {
      if (this.streamingState === 'disconnected') { return; }
      this.logger.warn('WebSocket error:', String(err));
      this.emitter.emit(EVENTS.FLAGS_STREAMING_ERROR, { error: err });
    };
  }

  private clearWebSocketPing(): void {
    if (this.webSocketPingTimer) { clearInterval(this.webSocketPingTimer); this.webSocketPingTimer = undefined; }
  }

  private disconnectStreaming(): void {
    this.devLog('Disconnecting streaming');
    this.streamingState = 'disconnected';
    if (this.streamingReconnectTimer) { clearTimeout(this.streamingReconnectTimer); this.streamingReconnectTimer = undefined; }
    this.clearWebSocketPing();
    if (this.webSocket) { this.webSocket.onclose = null; this.webSocket.close(); this.webSocket = null; }
  }

  private scheduleStreamingReconnect(): void {
    if (this.streamingState === 'disconnected' || !this.started) { return; }
    if (this.streamingReconnectTimer) { clearTimeout(this.streamingReconnectTimer); }
    this.streamingReconnectAttempt++;
    this.streamingReconnectCount++;
    const streamConfig = this.featuresConfig.streaming?.websocket;
    const baseMs = (streamConfig?.reconnectBase ?? 1) * 1000;
    const maxMs = (streamConfig?.reconnectMax ?? 30) * 1000;
    const exponentialDelay = Math.min(baseMs * Math.pow(2, this.streamingReconnectAttempt - 1), maxMs);
    const jitter = Math.floor(Math.random() * 1000);
    const delayMs = exponentialDelay + jitter;
    this.devLog(`Scheduling streaming reconnect: attempt=${this.streamingReconnectAttempt}, delay=${delayMs}ms`);
    this.emitter.emit(EVENTS.FLAGS_STREAMING_RECONNECTING, { attempt: this.streamingReconnectAttempt, delayMs });
    if (this.streamingReconnectAttempt >= 5 && this.streamingState !== 'degraded') {
      this.streamingState = 'degraded';
      this.logger.warn('Streaming degraded: falling back to polling-only mode');
      this.scheduleNextRefresh();
    }
    this.streamingReconnectTimer = setTimeout(() => {
      this.streamingReconnectTimer = undefined;
      this.clearWebSocketPing();
      if (this.webSocket) { this.webSocket.onclose = null; this.webSocket.close(); this.webSocket = null; }
      this.connectStreaming();
    }, delayMs);
  }

  private handleStreamingInvalidation(changedKeys: string[]): void {
    const totalFlags = this.realtimeFlags.size;
    if (changedKeys.length === 0 || totalFlags === 0 || changedKeys.length >= totalFlags / 2) {
      this.etag = '';
      if (!this.isFetchingFlags) { void this.fetchFlagsInternal('manual'); }
      else { this.pendingInvalidationKeys.clear(); this.pendingInvalidationKeys.add('*'); }
      return;
    }
    if (!this.isFetchingFlags) { void this.fetchPartialFlagsInternal(new Set(changedKeys)); }
    else { for (const key of changedKeys) { this.pendingInvalidationKeys.add(key); } }
  }

  private async fetchPartialFlagsInternal(flagKeys: Set<string>): Promise<void> {
    if (this.featuresConfig.offlineMode || flagKeys.size === 0) { return; }
    if (this.isFetchingFlags) return;
    this.isFetchingFlags = true;
    const fetchStartContextHash = this.lastContextHash;
    const keysStr = Array.from(flagKeys).join(',');
    this.devLog(`fetchPartialFlags: starting partial fetch for keys=[${keysStr}]`);

    try {
      this.emitter.emit(EVENTS.FLAGS_FETCH_START);
      this.fetchFlagsCount++;
      this.lastFetchTime = new Date();
      const url = new UrlBuilder(`${this.config.apiUrl}/client/features/eval`);
      const headers = this.buildHeaders();
      this.emitter.emit(EVENTS.FLAGS_FETCH, { etag: null, partial: true });
      if (this.cancelToken) { this.cancelToken.cancel(); }
      this.cancelToken = new CancelToken();
      const retryOptions = this.featuresConfig.fetchRetryOptions ?? {};
      const timeout = retryOptions.timeout ?? 30000;
      let response;

      if (this.featuresConfig.usePOSTrequests) {
        headers['Content-Type'] = 'application/json';
        response = await httpPost(url.toString(), { context: this.context, flagNames: Array.from(flagKeys) }, { headers, cancelToken: this.cancelToken, timeout });
      } else {
        for (const [key, value] of Object.entries(this.context)) {
          if (value === undefined || value === null) continue;
          if (key === 'properties' && typeof value === 'object') {
            for (const [propKey, propValue] of Object.entries(value)) {
              if (propValue !== undefined && propValue !== null) { url.searchParams.set(`properties[${propKey}]`, String(propValue)); }
            }
          } else { url.searchParams.set(key, String(value)); }
        }
        url.searchParams.set('flagNames', keysStr);
        response = await httpGet(url.toString(), { headers, cancelToken: this.cancelToken, timeout });
      }

      if (response.ok) {
        const data: FlagsApiResponse = response.json();
        if (data.success && data.data?.flags) {
          await this.storePartialFlags(data.data.flags, flagKeys);
          this.updateCount++;
          this.lastUpdateTime = new Date();
        }
        this.consecutiveFailures = 0;
        this.emitter.emit(EVENTS.FLAGS_FETCH_SUCCESS);
      } else {
        this.devLog(`fetchPartialFlags: error ${response.status}, falling back to full fetch`);
        this.etag = '';
        this.isFetchingFlags = false;
        void this.fetchFlagsInternal('manual');
        return;
      }
    } catch (e: unknown) {
      if (e instanceof HttpAbortError) { return; }
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.logger.error('Failed to fetch partial flags:', errorMessage);
    } finally {
      this.isFetchingFlags = false;
      this.emitter.emit(EVENTS.FLAGS_FETCH_END);
      if (this.lastContextHash !== fetchStartContextHash) {
        this.devLog('Context changed during partial fetch, triggering full re-fetch');
        this.etag = '';
        this.pendingInvalidationKeys.clear();
        void this.fetchFlagsInternal('contextChange');
      } else if (this.pendingInvalidationKeys.size > 0) {
        const pendingKeys = new Set(this.pendingInvalidationKeys);
        this.pendingInvalidationKeys.clear();
        if (pendingKeys.has('*')) { this.etag = ''; void this.fetchFlagsInternal('pending_invalidation'); }
        else {
          const totalFlags = this.realtimeFlags.size;
          if (totalFlags === 0 || pendingKeys.size >= totalFlags / 2) { this.etag = ''; void this.fetchFlagsInternal('pending_invalidation'); }
          else { void this.fetchPartialFlagsInternal(pendingKeys); }
        }
      }
    }
  }

  // ==================== Statistics ====================

  private trackFlagEnabledCount(flagName: string, enabled: boolean): void {
    if (this.featuresConfig.disableStats) return;
    const counts = this.flagEnabledCounts.get(flagName) ?? { yes: 0, no: 0 };
    if (enabled) { counts.yes++; } else { counts.no++; }
    this.flagEnabledCounts.set(flagName, counts);
  }

  private trackVariantCount(flagName: string, variantName: string): void {
    if (this.featuresConfig.disableStats) return;
    let variantCounts = this.flagVariantCounts.get(flagName);
    if (!variantCounts) { variantCounts = new Map<string, number>(); this.flagVariantCounts.set(flagName, variantCounts); }
    variantCounts.set(variantName, (variantCounts.get(variantName) ?? 0) + 1);
  }

  getStats(): FeaturesStats {
    const flags = this.selectFlags(true);
    const flagEnabledCounts: Record<string, { yes: number; no: number }> = {};
    for (const [name, counts] of this.flagEnabledCounts) { flagEnabledCounts[name] = counts; }
    const flagVariantCounts: Record<string, Record<string, number>> = {};
    for (const [flagName, variantMap] of this.flagVariantCounts) { flagVariantCounts[flagName] = {}; for (const [variantName, count] of variantMap) { flagVariantCounts[flagName][variantName] = count; } }
    const activeWatchGroups: string[] = [];
    for (const [name, group] of this.watchGroups) { if (group.size > 0) { activeWatchGroups.push(name); } }
    return {
      totalFlagCount: flags.size, missingFlags: this.metrics.getMissingFlags(), fetchFlagsCount: this.fetchFlagsCount,
      updateCount: this.updateCount, notModifiedCount: this.notModifiedCount, recoveryCount: this.recoveryCount,
      errorCount: this.errorCount, sdkState: this.sdkState, lastError: this.lastError, startTime: this.startTime,
      lastFetchTime: this.lastFetchTime, lastUpdateTime: this.lastUpdateTime, lastRecoveryTime: this.lastRecoveryTime,
      lastErrorTime: this.lastErrorTime, flagEnabledCounts, flagVariantCounts, syncFlagsCount: this.syncFlagsCount,
      activeWatchGroups, etag: this.etag || null, impressionCount: this.impressionCount,
      contextChangeCount: this.contextChangeCount, flagLastChangedTimes: Object.fromEntries(this.flagLastChangedTimes),
      metricsSentCount: this.metricsSentCount, metricsErrorCount: this.metricsErrorCount,
      streamingState: this.streamingState, streamingReconnectCount: this.streamingReconnectCount,
      lastStreamingEventTime: this.lastStreamingEventTime, streamingConnectedCount: this.streamingConnectedCount,
      streamingFlagsChangedCount: this.streamingFlagsChangedCount, streamingHeartbeatCount: this.streamingHeartbeatCount,
    };
  }

  getLightStats(): FeaturesLightStats {
    return {
      sdkState: this.sdkState, lastError: this.lastError, startTime: this.startTime,
      lastFetchTime: this.lastFetchTime, lastUpdateTime: this.lastUpdateTime, lastRecoveryTime: this.lastRecoveryTime,
      lastErrorTime: this.lastErrorTime, fetchFlagsCount: this.fetchFlagsCount, updateCount: this.updateCount,
      notModifiedCount: this.notModifiedCount, recoveryCount: this.recoveryCount, errorCount: this.errorCount,
      syncFlagsCount: this.syncFlagsCount, impressionCount: this.impressionCount,
      contextChangeCount: this.contextChangeCount, metricsSentCount: this.metricsSentCount,
      metricsErrorCount: this.metricsErrorCount, etag: this.etag || null,
      streamingState: this.streamingState, streamingReconnectCount: this.streamingReconnectCount,
      lastStreamingEventTime: this.lastStreamingEventTime, streamingConnectedCount: this.streamingConnectedCount,
      streamingFlagsChangedCount: this.streamingFlagsChangedCount, streamingHeartbeatCount: this.streamingHeartbeatCount,
    };
  }
}
