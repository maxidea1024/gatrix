/**
 * FeaturesClient - Feature Flags client for Gatrix SDK
 * Handles feature flag fetching, caching, and access
 */
import { EventEmitter } from './EventEmitter';
import { EVENTS } from './events';
import {
  GatrixContext,
  GatrixClientConfig,
  EvaluatedFlag,
  Variant,
  FlagsApiResponse,
  ImpressionEvent,
  ErrorEvent,
  SdkState,
  VariationResult,
} from './types';
import { StorageProvider } from './storage-provider';
import { LocalStorageProvider } from './storage-provider-localstorage';
import { InMemoryStorageProvider } from './storage-provider-inmemory';
import { uuidv4, resolveFetch, resolveAbortController, deepClone } from './utils';
import { FlagProxy } from './FlagProxy';
import { WatchFlagGroup } from './WatchFlagGroup';

const STORAGE_KEY_FLAGS = 'flags';
const STORAGE_KEY_SESSION = 'sessionId';
const STORAGE_KEY_ETAG = 'etag';

const FALLBACK_DISABLED_VARIANT: Variant = {
  name: 'disabled',
  enabled: false,
};

export class FeaturesClient {
  private emitter: EventEmitter;
  private config: GatrixClientConfig;
  private storage: StorageProvider;
  private fetch: typeof fetch;
  private createAbortController?: () => AbortController;
  private abortController?: AbortController | null;

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
  private timerRef?: ReturnType<typeof setInterval>;
  private etag = '';
  private refreshInterval: number;
  private connectionId: string;

  // Backoff
  private fetchFailures = 0;

  // Feature-specific config shortcuts
  private get featuresConfig() {
    return this.config.features ?? {};
  }

  constructor(emitter: EventEmitter, config: GatrixClientConfig) {
    this.emitter = emitter;
    this.config = config;
    this.connectionId = uuidv4();

    // Initialize storage
    this.storage =
      config.storageProvider ??
      (typeof window !== 'undefined' ? new LocalStorageProvider() : new InMemoryStorageProvider());

    // Initialize fetch
    const fetchFn = config.fetch ?? resolveFetch();
    if (!fetchFn) {
      console.error(
        'GatrixClient: You must provide a "fetch" implementation or run in an environment where "fetch" is available.'
      );
    }
    this.fetch = fetchFn!;
    this.createAbortController = resolveAbortController();

    // Refresh interval (default: 30 seconds)
    this.refreshInterval = this.featuresConfig.disableRefresh
      ? 0
      : (this.featuresConfig.refreshInterval ?? 30) * 1000;

    // Initial context
    this.context = {
      ...config.context,
    };

    // Bootstrap data
    const bootstrap = this.featuresConfig.bootstrap;
    if (bootstrap && bootstrap.length > 0) {
      this.setFlags(bootstrap);
    }
  }

  /**
   * Initialize the features client
   */
  async init(): Promise<void> {
    // Resolve session ID
    const sessionId = await this.resolveSessionId();
    this.context.sessionId = sessionId;

    // Load cached etag
    const cachedEtag = await this.storage.get(STORAGE_KEY_ETAG);
    if (cachedEtag) {
      this.etag = cachedEtag;
    }

    // Load cached flags
    const cachedFlags = await this.storage.get(STORAGE_KEY_FLAGS);
    if (cachedFlags && Array.isArray(cachedFlags)) {
      this.setFlags(cachedFlags);
    }

    // Handle bootstrap
    const bootstrap = this.featuresConfig.bootstrap;
    const hasBootstrap = bootstrap && bootstrap.length > 0;
    const bootstrapOverride = this.featuresConfig.bootstrapOverride !== false;

    if (hasBootstrap && (bootstrapOverride || this.realtimeFlags.size === 0)) {
      await this.storage.save(STORAGE_KEY_FLAGS, bootstrap);
      this.sdkState = 'healthy';
      this.setReady();
    }

    this.sdkState = 'healthy';
    this.emitter.emit(EVENTS.INIT);
  }

  /**
   * Start polling for flag updates
   */
  async start(): Promise<void> {
    if (this.started) {
      console.warn('FeaturesClient already started');
      return;
    }
    this.started = true;

    // Initial fetch
    await this.fetchFlags();

    // Schedule periodic refresh
    if (this.refreshInterval > 0) {
      this.timerRef = setInterval(() => {
        this.fetchFlags();
      }, this.refreshInterval);
    }
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.timerRef) {
      clearInterval(this.timerRef);
      this.timerRef = undefined;
    }
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
    this.context = { ...this.context, ...context };
    await this.fetchFlags();
  }

  async setContextField(field: string, value: string | number | boolean): Promise<void> {
    const definedFields = ['userId', 'sessionId', 'deviceId', 'currentTime'];

    if (definedFields.includes(field)) {
      (this.context as Record<string, any>)[field] = value;
    } else {
      if (!this.context.properties) {
        this.context.properties = {};
      }
      this.context.properties[field] = value;
    }

    await this.fetchFlags();
  }

  async removeContextField(field: string): Promise<void> {
    const definedFields = ['userId', 'sessionId', 'deviceId', 'currentTime'];

    if (definedFields.includes(field)) {
      delete (this.context as Record<string, any>)[field];
    } else if (this.context.properties) {
      delete this.context.properties[field];
    }

    await this.fetchFlags();
  }

  // ==================== Flag Access ====================

  isEnabled(flagName: string): boolean {
    const flags = this.selectFlags();
    const flag = flags.get(flagName);
    const enabled = flag?.enabled ?? false;

    // Track impression
    this.trackImpression(flagName, enabled, flag, 'isEnabled');

    return enabled;
  }

  getVariant(flagName: string): Variant {
    const flags = this.selectFlags();
    const flag = flags.get(flagName);
    const enabled = flag?.enabled ?? false;
    const variant = flag?.variant ?? FALLBACK_DISABLED_VARIANT;

    // Track impression
    this.trackImpression(flagName, enabled, flag, 'getVariant', variant.name);

    return {
      ...variant,
    };
  }

  getAllFlags(): EvaluatedFlag[] {
    const flags = this.selectFlags();
    return Array.from(flags.values());
  }

  // ==================== Variation Methods ====================

  /**
   * Get the variant name for a flag
   * Returns the variant name or 'disabled' if flag is not found/enabled
   */
  variation(flagName: string, defaultValue: string = 'disabled'): string {
    const flags = this.selectFlags();
    const flag = flags.get(flagName);

    if (!flag || !flag.enabled) {
      return defaultValue;
    }

    this.trackImpression(flagName, flag.enabled, flag, 'getVariant', flag.variant.name);

    return flag.variant?.name ?? defaultValue;
  }

  boolVariation(flagName: string, defaultValue: boolean = false): boolean {
    const flags = this.selectFlags();
    const flag = flags.get(flagName);

    if (!flag) {
      return defaultValue;
    }

    // Track impression
    this.trackImpression(flagName, flag.enabled, flag, 'isEnabled');

    return flag.enabled;
  }

  stringVariation(flagName: string, defaultValue: string = ''): string {
    const flags = this.selectFlags();
    const flag = flags.get(flagName);

    if (!flag || !flag.enabled || flag.variant?.payload == null) {
      return defaultValue;
    }

    // Track impression
    this.trackImpression(flagName, flag.enabled, flag, 'getVariant', flag.variant.name);

    return String(flag.variant.payload);
  }

  numberVariation(flagName: string, defaultValue: number = 0): number {
    const flags = this.selectFlags();
    const flag = flags.get(flagName);

    if (!flag || !flag.enabled || !flag.variant?.payload) {
      return defaultValue;
    }

    const num = Number(flag.variant.payload);
    if (isNaN(num)) {
      return defaultValue;
    }

    // Track impression
    this.trackImpression(flagName, flag.enabled, flag, 'getVariant', flag.variant.name);

    return num;
  }

  jsonVariation<T>(flagName: string, defaultValue: T): T {
    const flags = this.selectFlags();
    const flag = flags.get(flagName);

    if (!flag || !flag.enabled || flag.variant?.payload == null) {
      return defaultValue;
    }

    const payload = flag.variant.payload;

    // If already an object, return directly
    if (typeof payload === 'object') {
      // Track impression
      this.trackImpression(flagName, flag.enabled, flag, 'getVariant', flag.variant.name);
      return payload as T;
    }

    // If string, try to parse as JSON
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload) as T;
        this.trackImpression(flagName, flag.enabled, flag, 'getVariant', flag.variant.name);
        return parsed;
      } catch {
        return defaultValue;
      }
    }

    return defaultValue;
  }

  // ==================== Variation Details ====================

  boolVariationDetails(flagName: string, defaultValue: boolean = false): VariationResult<boolean> {
    const flags = this.selectFlags();
    const flag = flags.get(flagName);

    if (!flag) {
      return {
        value: defaultValue,
        reason: 'flag_not_found',
        flagExists: false,
        enabled: false,
      };
    }

    this.trackImpression(flagName, flag.enabled, flag, 'isEnabled');

    return {
      value: flag.enabled,
      reason: flag.reason ?? 'evaluated',
      flagExists: true,
      enabled: flag.enabled,
    };
  }

  stringVariationDetails(flagName: string, defaultValue: string = ''): VariationResult<string> {
    const flags = this.selectFlags();
    const flag = flags.get(flagName);

    if (!flag) {
      return {
        value: defaultValue,
        reason: 'flag_not_found',
        flagExists: false,
        enabled: false,
      };
    }

    if (!flag.enabled) {
      return {
        value: defaultValue,
        reason: flag.reason ?? 'disabled',
        flagExists: true,
        enabled: false,
      };
    }

    this.trackImpression(flagName, flag.enabled, flag, 'getVariant', flag.variant.name);

    const payload = flag.variant?.payload;
    return {
      value: payload != null ? String(payload) : defaultValue,
      reason: flag.reason ?? 'evaluated',
      flagExists: true,
      enabled: true,
    };
  }

  numberVariationDetails(flagName: string, defaultValue: number = 0): VariationResult<number> {
    const flags = this.selectFlags();
    const flag = flags.get(flagName);

    if (!flag) {
      return {
        value: defaultValue,
        reason: 'flag_not_found',
        flagExists: false,
        enabled: false,
      };
    }

    if (!flag.enabled || !flag.variant?.payload) {
      return {
        value: defaultValue,
        reason: flag.reason ?? 'disabled',
        flagExists: true,
        enabled: flag.enabled,
      };
    }

    const num = Number(flag.variant.payload);
    if (isNaN(num)) {
      return {
        value: defaultValue,
        reason: 'parse_error',
        flagExists: true,
        enabled: true,
      };
    }

    this.trackImpression(flagName, flag.enabled, flag, 'getVariant', flag.variant.name);

    return {
      value: num,
      reason: flag.reason ?? 'evaluated',
      flagExists: true,
      enabled: true,
    };
  }

  jsonVariationDetails<T>(flagName: string, defaultValue: T): VariationResult<T> {
    const flags = this.selectFlags();
    const flag = flags.get(flagName);

    if (!flag) {
      return {
        value: defaultValue,
        reason: 'flag_not_found',
        flagExists: false,
        enabled: false,
      };
    }

    if (!flag.enabled || flag.variant?.payload == null) {
      return {
        value: defaultValue,
        reason: flag.reason ?? 'disabled',
        flagExists: true,
        enabled: flag.enabled,
      };
    }

    const payload = flag.variant.payload;

    // If already an object, return directly
    if (typeof payload === 'object') {
      this.trackImpression(flagName, flag.enabled, flag, 'getVariant', flag.variant.name);
      return {
        value: payload as T,
        reason: flag.reason ?? 'evaluated',
        flagExists: true,
        enabled: true,
      };
    }

    // If string, try to parse as JSON
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload) as T;
        this.trackImpression(flagName, flag.enabled, flag, 'getVariant', flag.variant.name);
        return {
          value: parsed,
          reason: flag.reason ?? 'evaluated',
          flagExists: true,
          enabled: true,
        };
      } catch {
        return {
          value: defaultValue,
          reason: 'parse_error',
          flagExists: true,
          enabled: true,
        };
      }
    }

    return {
      value: defaultValue,
      reason: 'parse_error',
      flagExists: true,
      enabled: true,
    };
  }

  // ==================== Strict Variations (OrThrow) ====================

  boolVariationOrThrow(flagName: string): boolean {
    const result = this.boolVariationDetails(flagName);
    if (!result.flagExists) {
      throw new Error(`Flag "${flagName}" not found`);
    }
    return result.value;
  }

  stringVariationOrThrow(flagName: string): string {
    const result = this.stringVariationDetails(flagName);
    if (!result.flagExists) {
      throw new Error(`Flag "${flagName}" not found`);
    }
    if (!result.enabled) {
      throw new Error(`Flag "${flagName}" is disabled`);
    }
    return result.value;
  }

  numberVariationOrThrow(flagName: string): number {
    const result = this.numberVariationDetails(flagName);
    if (!result.flagExists) {
      throw new Error(`Flag "${flagName}" not found`);
    }
    if (!result.enabled) {
      throw new Error(`Flag "${flagName}" is disabled`);
    }
    if (result.reason === 'parse_error') {
      throw new Error(`Flag "${flagName}" has invalid number payload`);
    }
    return result.value;
  }

  jsonVariationOrThrow<T>(flagName: string): T {
    const result = this.jsonVariationDetails<T>(flagName, undefined as T);
    if (!result.flagExists) {
      throw new Error(`Flag "${flagName}" not found`);
    }
    if (!result.enabled) {
      throw new Error(`Flag "${flagName}" is disabled`);
    }
    if (result.reason === 'parse_error') {
      throw new Error(`Flag "${flagName}" has invalid JSON payload`);
    }
    return result.value;
  }

  // ==================== Explicit Sync Mode ====================

  async syncFlags(fetchNow: boolean = true): Promise<void> {
    if (!this.featuresConfig.explicitSyncMode) {
      return;
    }

    if (fetchNow) {
      await this.fetchFlags();
    }

    this.synchronizedFlags = new Map(this.realtimeFlags);
    this.emitter.emit(EVENTS.SYNC);
  }

  // ==================== Watch ====================

  /**
   * Watch callback type - supports both sync and async callbacks
   */
  watchFlag(flagName: string, callback: (flag: FlagProxy) => void | Promise<void>): () => void {
    const eventName = `flag:${flagName}`;
    const wrappedCallback = (rawFlag: EvaluatedFlag | undefined) => {
      callback(new FlagProxy(rawFlag));
    };
    this.emitter.on(eventName, wrappedCallback);

    return () => {
      this.emitter.off(eventName, wrappedCallback);
    };
  }

  watchFlagWithInitialState(
    flagName: string,
    callback: (flag: FlagProxy) => void | Promise<void>
  ): () => void {
    const eventName = `flag:${flagName}`;
    const wrappedCallback = (rawFlag: EvaluatedFlag | undefined) => {
      callback(new FlagProxy(rawFlag));
    };
    this.emitter.on(eventName, wrappedCallback);

    // Emit initial state
    if (this.readyEventEmitted) {
      const flags = this.selectFlags();
      callback(new FlagProxy(flags.get(flagName)));
    } else {
      this.emitter.once(EVENTS.READY, () => {
        const flags = this.selectFlags();
        callback(new FlagProxy(flags.get(flagName)));
      });
    }

    return () => {
      this.emitter.off(eventName, wrappedCallback);
    };
  }

  /**
   * Create a watch group for batch management of multiple flag watchers
   */
  createWatchGroup(name: string): WatchFlagGroup {
    return new WatchFlagGroup(this, name);
  }

  // ==================== Fetch ====================

  async fetchFlags(): Promise<void> {
    if (!this.fetch) {
      return;
    }

    // Cancel previous request
    if (this.abortController && !this.abortController.signal.aborted) {
      this.abortController.abort();
    }
    this.abortController = this.createAbortController?.() ?? null;

    try {
      const url = new URL(this.config.url);

      // Add context as query params for GET request
      for (const [key, value] of Object.entries(this.context)) {
        if (value === undefined || value === null) continue;

        if (key === 'properties' && typeof value === 'object') {
          for (const [propKey, propValue] of Object.entries(value)) {
            if (propValue !== undefined && propValue !== null) {
              url.searchParams.set(`properties[${propKey}]`, String(propValue));
            }
          }
        } else {
          url.searchParams.set(key, String(value));
        }
      }

      const headers: Record<string, string> = {
        [this.config.headerName ?? 'Authorization']: this.config.apiKey,
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        'X-Gatrix-App': this.config.appName,
        'X-Gatrix-Connection-Id': this.connectionId,
        ...this.config.customHeaders,
      };

      if (this.etag) {
        headers['If-None-Match'] = this.etag;
      }

      const response = await this.fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: this.abortController?.signal,
      });

      // Check for recovery
      if (this.sdkState === 'error' && response.status < 400) {
        this.sdkState = 'healthy';
        this.emitter.emit(EVENTS.RECOVERED);
      }

      if (response.ok) {
        const newEtag = response.headers.get('ETag') ?? '';
        if (newEtag !== this.etag) {
          this.etag = newEtag;
          await this.storage.save(STORAGE_KEY_ETAG, this.etag);
        }

        const data: FlagsApiResponse = await response.json();

        if (data.success && data.data?.flags) {
          const oldFlags = new Map(this.realtimeFlags);
          this.setFlags(data.data.flags);
          await this.storage.save(STORAGE_KEY_FLAGS, data.data.flags);

          // Emit flag change events (using version field)
          this.emitFlagChanges(oldFlags, this.realtimeFlags);

          this.sdkState = 'healthy';
          this.fetchFailures = 0;

          if (!this.fetchedFromServer) {
            this.fetchedFromServer = true;
            this.setReady();
          }

          // In non-explicit sync mode, emit update
          if (!this.featuresConfig.explicitSyncMode) {
            this.emitter.emit(EVENTS.UPDATE, { flags: data.data.flags });
          }
        }
      } else if (response.status === 304) {
        // Not modified - ETag matched
        this.fetchFailures = 0;
      } else {
        this.handleFetchError(response.status);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        return;
      }
      console.error('GatrixClient: Failed to fetch flags', e);
      this.sdkState = 'error';
      this.lastError = e;
      this.emitter.emit(EVENTS.ERROR, {
        type: 'fetch-flags',
        error: e,
      } as ErrorEvent);
    } finally {
      this.abortController = null;
    }
  }

  // ==================== Private Methods ====================

  private setReady(): void {
    this.readyEventEmitted = true;
    this.emitter.emit(EVENTS.READY);
  }

  private selectFlags(): Map<string, EvaluatedFlag> {
    return this.featuresConfig.explicitSyncMode ? this.synchronizedFlags : this.realtimeFlags;
  }

  private setFlags(flags: EvaluatedFlag[]): void {
    this.realtimeFlags.clear();
    for (const flag of flags) {
      this.realtimeFlags.set(flag.name, flag);
    }

    if (!this.featuresConfig.explicitSyncMode) {
      this.synchronizedFlags = new Map(this.realtimeFlags);
    }
  }

  /**
   * Emit flag change events using version field for comparison
   */
  private emitFlagChanges(
    oldFlags: Map<string, EvaluatedFlag>,
    newFlags: Map<string, EvaluatedFlag>
  ): void {
    // Check for changed/new flags (compare by version)
    for (const [name, newFlag] of newFlags) {
      const oldFlag = oldFlags.get(name);
      if (!oldFlag || oldFlag.version !== newFlag.version) {
        this.emitter.emit(`flag:${name}`, newFlag);
      }
    }

    // Check for removed flags
    for (const [name] of oldFlags) {
      if (!newFlags.has(name)) {
        this.emitter.emit(`flag:${name}`, undefined);
      }
    }
  }

  private handleFetchError(statusCode: number): void {
    this.fetchFailures = Math.min(this.fetchFailures + 1, 10);
    this.sdkState = 'error';
    this.lastError = { type: 'HttpError', code: statusCode };
    this.emitter.emit(EVENTS.ERROR, {
      type: 'HttpError',
      code: statusCode,
    } as ErrorEvent);
  }

  private async resolveSessionId(): Promise<string> {
    if (this.context.sessionId) {
      return this.context.sessionId;
    }

    let sessionId = await this.storage.get(STORAGE_KEY_SESSION);
    if (!sessionId) {
      sessionId = String(Math.floor(Math.random() * 1_000_000_000));
      await this.storage.save(STORAGE_KEY_SESSION, sessionId);
    }
    return sessionId;
  }

  private trackImpression(
    flagName: string,
    enabled: boolean,
    flag: EvaluatedFlag | undefined,
    eventType: 'isEnabled' | 'getVariant' | 'notFound',
    variantName?: string
  ): void {
    // Always track not_found events regardless of impressionData setting
    if (eventType !== 'notFound') {
      const shouldTrack = this.featuresConfig.impressionDataAll || flag?.impressionData;
      if (!shouldTrack || this.featuresConfig.disableMetrics) {
        return;
      }
    }

    if (this.featuresConfig.disableMetrics) {
      return;
    }

    const event: ImpressionEvent = {
      eventType,
      eventId: uuidv4(),
      context: this.context,
      enabled,
      featureName: flagName,
      impressionData: flag?.impressionData ?? false,
      variantName,
      reason: flag?.reason ?? (eventType === 'notFound' ? 'not_found' : undefined),
    };

    this.emitter.emit(EVENTS.IMPRESSION, event);
  }
}
