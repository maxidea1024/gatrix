/**
 * Feature Flag Service
 * Handles feature flag retrieval and evaluation
 * Uses per-environment API pattern: GET /api/v1/server/features
 *
 * DESIGN PRINCIPLES:
 * - All methods that access cached data MUST receive environment explicitly
 * - Environment resolution is delegated to EnvironmentResolver
 * - Evaluations are performed locally using cached flags
 * - Segments are cached separately and referenced by name for efficiency
 * - Metrics are batched and sent periodically (default: 1 minute)
 */

import { ApiClient } from '../client/api-client';
import { ApiClientFactory } from '../client/api-client-factory';
import { Logger } from '../utils/logger';
import { CacheStorageProvider } from '../cache/storage-provider';
import {
  FeatureFlag,
  FeatureSegment,
  EvaluationContext,
  EvaluationResult,
  Variant,
  FlagMetric,
} from '../types/feature-flags';
import { FeatureFlagError, FeatureFlagErrorCode } from '../utils/errors';
import { FeatureFlagEvaluator, VALUE_SOURCE } from '@gatrix/evaluator';
import { SDK_VERSION } from '../version';

export class FeatureFlagService {
  private apiClient: ApiClient;
  private logger: Logger;
  private defaultEnvironmentId: string;
  private storage?: CacheStorageProvider;
  // Multi-token flag cache: Map<token, Map<flagName, FeatureFlag>>
  // Using nested Map for O(1) flag lookup by name (keyed by token)
  private cachedFlagsByEnv: Map<string, Map<string, FeatureFlag>> = new Map();
  // Segment cache: Map<projectId, Map<segmentName, FeatureSegment>> (per-project, not global)
  private cachedSegments: Map<string, Map<string, FeatureSegment>> = new Map();
  // Environment-to-project mapping: environmentId/cacheKey -> projectId
  private envToProjectMap: Map<string, string> = new Map();
  // Metrics buffer for batching
  private metricsBuffer: FlagMetric[] = [];
  private metricsFlushInterval: NodeJS.Timeout | null = null;
  // Track when the current metrics bucket started (for accurate time window reporting)
  private metricsBucketStartTime: Date = new Date();
  // Whether this feature is enabled
  private featureEnabled: boolean = true;
  // Static context (default context merged with per-evaluation context)
  private staticContext: EvaluationContext = {};
  // Metrics configuration
  private metricsConfig = {
    enabled: true,
    flushIntervalMs: 60000, // Default: 1 minute
    maxBufferSize: 1000, // Auto-flush threshold
    maxRetryBufferSize: 10000, // Max buffer size to prevent memory issues
  };
  // Compact mode: strip evaluation data from disabled flags to reduce bandwidth (default: true)
  private compactFlags: boolean = true;
  // Optional factory for multi-token mode (each token gets its own ApiClient with isolated ETag cache)
  private apiClientFactory?: ApiClientFactory;

  constructor(
    apiClient: ApiClient,
    logger: Logger,
    defaultEnvironmentId: string,
    storage?: CacheStorageProvider
  ) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironmentId = defaultEnvironmentId;
    this.storage = storage;
  }

  /**
   * Set static context (default context merged with per-evaluation context)
   * Static context is applied to all evaluations, with per-evaluation context taking precedence
   */
  setStaticContext(context: EvaluationContext): void {
    this.staticContext = context;
    this.logger.debug('Static context set', { keys: Object.keys(context) });
  }

  /**
   * Get static context
   */
  getStaticContext(): EvaluationContext {
    return { ...this.staticContext };
  }

  /**
   * Merge static context with per-evaluation context
   * Per-evaluation context takes precedence over static context
   */
  private mergeContext(context: EvaluationContext): EvaluationContext {
    // Static context first, then per-evaluation context (for precedence)
    return {
      ...this.staticContext,
      ...context,
      // Merge properties separately
      properties: {
        ...this.staticContext.properties,
        ...context.properties,
      },
    };
  }

  /**
   * Configure metrics collection options
   */
  setMetricsConfig(config: {
    enabled?: boolean;
    flushIntervalMs?: number;
    maxBufferSize?: number;
    maxRetryBufferSize?: number;
  }): void {
    this.metricsConfig = { ...this.metricsConfig, ...config };
    this.logger.debug('Metrics config updated', { config: this.metricsConfig });
  }

  /**
   * Get current metrics configuration
   */
  getMetricsConfig() {
    return { ...this.metricsConfig };
  }

  /**
   * Set feature enabled flag
   */
  setFeatureEnabled(enabled: boolean): void {
    this.featureEnabled = enabled;
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(): boolean {
    return this.featureEnabled;
  }

  /**
   * Set compact flags mode
   * When enabled, disabled flags are fetched without strategies/variants/enabledValue
   */
  setCompactFlags(enabled: boolean): void {
    this.compactFlags = enabled;
    this.logger.debug('Compact flags mode set', { enabled });
  }

  /**
   * Set ApiClientFactory for multi-token mode.
   * When set, listByEnvironment() uses the factory to get a per-token ApiClient.
   */
  setApiClientFactory(factory: ApiClientFactory): void {
    this.apiClientFactory = factory;
  }

  /**
   * Get the appropriate ApiClient for a given token.
   * Uses the factory if available, otherwise falls back to the default client.
   */
  private getApiClient(token?: string): ApiClient {
    if (this.apiClientFactory) {
      return this.apiClientFactory.getClient(token);
    }
    return this.apiClient;
  }

  /**
   * Start metrics collection
   * Uses configured flushIntervalMs if not provided
   */
  startMetricsCollection(flushIntervalMs?: number): void {
    if (!this.metricsConfig.enabled) {
      this.logger.debug('Metrics collection is disabled');
      return;
    }

    const interval = flushIntervalMs ?? this.metricsConfig.flushIntervalMs;

    if (this.metricsFlushInterval) {
      clearInterval(this.metricsFlushInterval);
    }
    this.metricsFlushInterval = setInterval(() => {
      this.flushMetrics();
    }, interval);

    this.logger.info('Metrics collection started', {
      flushIntervalMs: interval,
    });
  }

  /**
   * Stop metrics collection
   */
  stopMetricsCollection(): void {
    if (this.metricsFlushInterval) {
      clearInterval(this.metricsFlushInterval);
      this.metricsFlushInterval = null;
    }
    // Flush remaining metrics
    this.flushMetrics();
  }

  /**
   * Initialize the service by loading definitions from local storage
   */
  async initializeAsync(environmentId: string): Promise<void> {
    if (!this.storage) return;

    const flagsKey = `FeatureFlags_${environmentId}_flags`;
    // Load projectId mapping from local storage
    const projectIdKey = `FeatureFlags_${environmentId}_projectId`;

    try {
      const [flagsJson, projectId] = await Promise.all([
        this.storage.get(flagsKey),
        this.storage.get(projectIdKey),
      ]);

      if (flagsJson) {
        const flags = JSON.parse(flagsJson) as FeatureFlag[];
        const flagMap = new Map<string, FeatureFlag>();
        for (const flag of flags) {
          flagMap.set(flag.name, flag);
        }
        this.cachedFlagsByEnv.set(environmentId, flagMap);
        this.logger.debug(`Loaded ${flags.length} flags from local storage`, {
          environmentId,
        });
      }

      // Load segments per project
      if (projectId) {
        this.envToProjectMap.set(environmentId, projectId);
        const segmentsKey = `FeatureFlags_${projectId}_segments`;
        const segmentsJson = await this.storage.get(segmentsKey);
        if (segmentsJson) {
          const segments = JSON.parse(segmentsJson) as FeatureSegment[];
          const segmentMap = this.getOrCreateProjectSegments(projectId);
          for (const segment of segments) {
            segmentMap.set(segment.name, segment);
          }
          this.logger.debug(
            `Loaded ${segments.length} segments from local storage`,
            {
              environmentId,
              projectId,
            }
          );
        }
      }
    } catch (error: any) {
      this.logger.warn('Failed to load feature flags from local storage', {
        environmentId,
        error: error.message,
      });
    }
  }

  // ==================== API Methods ====================

  /**
   * Fetch all flags for a specific environment
   * GET /api/v1/server/features
   * Also caches referenced segments returned by the backend
   */
  async listByEnvironment(environmentId: string): Promise<FeatureFlag[]> {
    let endpoint = `/api/v1/server/features`;

    // Append compact query param when enabled
    if (this.compactFlags) {
      endpoint += '?compact=true';
    }

    this.logger.debug('Fetching feature flags', {
      environmentId,
      compact: this.compactFlags,
    });

    const client = this.getApiClient(environmentId);
    const response = await client.get<{
      flags: FeatureFlag[];
      segments: FeatureSegment[];
      projectId?: string;
    }>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(
        response.error?.message || 'Failed to fetch feature flags'
      );
    }

    const { flags, segments, projectId } = response.data;

    // Cache flags by name for O(1) lookup
    const flagMap = new Map<string, FeatureFlag>();
    for (const flag of flags) {
      flagMap.set(flag.name, flag);
    }
    this.cachedFlagsByEnv.set(environmentId, flagMap);

    // Cache segments per project (not global)
    if (projectId) {
      this.envToProjectMap.set(environmentId, projectId);
      if (segments && segments.length > 0) {
        const segmentMap = this.getOrCreateProjectSegments(projectId);
        for (const segment of segments) {
          segmentMap.set(segment.name, segment);
        }
        this.logger.info('Feature segments cached', {
          count: segments.length,
          projectId,
        });
      }
    }

    // Save to local storage if available
    if (this.storage) {
      const saveOps = [
        this.storage.save(
          `FeatureFlags_${environmentId}_flags`,
          JSON.stringify(flags)
        ),
      ];
      if (projectId) {
        saveOps.push(
          this.storage.save(
            `FeatureFlags_${environmentId}_projectId`,
            projectId
          ),
          this.storage.save(
            `FeatureFlags_${projectId}_segments`,
            JSON.stringify(segments || [])
          )
        );
      }
      await Promise.all(saveOps);
    }

    this.logger.info('Feature flags fetched', {
      count: flags.length,
      environmentId,
      projectId,
    });

    return flags;
  }

  /**
   * Refresh cached flags for a specific environment
   * Invalidates ETag cache before fetching to ensure fresh data
   */
  async refreshByEnvironment(environmentId: string): Promise<FeatureFlag[]> {
    if (!this.featureEnabled) {
      this.logger.warn(
        'FeatureFlagService.refreshByEnvironment() called but feature is disabled',
        {
          environmentId,
        }
      );
    }
    this.logger.info('Refreshing feature flags cache', { environmentId });

    // Invalidate ETag cache for features endpoint to avoid stale 304 responses
    const client = this.getApiClient(environmentId);
    client.invalidateEtagCache('/api/v1/server/features');

    return await this.listByEnvironment(environmentId);
  }

  /**
   * Refresh cached flags for ALL cached environments
   * Used when global changes (like segment updates) affect all flags
   */
  async refreshAll(): Promise<void> {
    if (!this.featureEnabled) {
      this.logger.warn(
        'FeatureFlagService.refreshAll() called but feature is disabled'
      );
      return;
    }

    const environments = Array.from(this.cachedFlagsByEnv.keys());
    if (environments.length === 0) {
      this.logger.debug('No environments cached, skipping refreshAll');
      return;
    }

    this.logger.info('Refreshing feature flags cache for all environments', {
      count: environments.length,
      environments,
    });

    // Also refresh segments since they may have changed
    await this.refreshSegments();

    // Refresh all environments in parallel
    await Promise.all(
      environments.map((env) =>
        this.listByEnvironment(env).catch((error) => {
          this.logger.warn('Failed to refresh feature flags for environment', {
            environment: env,
            error: error.message,
          });
        })
      )
    );

    this.logger.info('Feature flags cache refreshed for all environments');
  }

  /**
   * Fetch and cache feature flags for multiple environments (multi-environment mode)
   * Used by Edge server to handle multiple environments
   */
  async listByEnvironments(environments: string[]): Promise<FeatureFlag[]> {
    const allFlags: FeatureFlag[] = [];

    for (const environmentId of environments) {
      try {
        const flags = await this.listByEnvironment(environmentId);
        allFlags.push(...flags);
      } catch (error: any) {
        this.logger.warn('Failed to load feature flags for environment', {
          environmentId,
          error: error.message,
        });
      }
    }

    this.logger.info('Feature flags loaded for multiple environments', {
      environments: environments.length,
      totalFlags: allFlags.length,
    });

    return allFlags;
  }

  /**
   * Get a single flag by name from cache (O(1) lookup)
   */
  getFlagByName(
    environmentId: string,
    flagName: string
  ): FeatureFlag | undefined {
    const envCache = this.cachedFlagsByEnv.get(environmentId);
    return envCache?.get(flagName);
  }

  /**
   * Get all cached flags as array
   * @param environmentId environment ID or cache key. Defaults to defaultToken in single-token mode.
   */
  getCached(environmentId?: string): FeatureFlag[] {
    const key = environmentId || this.defaultEnvironmentId;
    const envCache =
      this.cachedFlagsByEnv.get(key) ||
      this.cachedFlagsByEnv.get(this.defaultEnvironmentId);
    return envCache ? Array.from(envCache.values()) : [];
  }

  /**
   * Get cached flag count for environment
   */
  getCachedCount(environmentId: string): number {
    return this.cachedFlagsByEnv.get(environmentId)?.size ?? 0;
  }

  /**
   * Get all cached flags (all environments) - returns the internal Map structure
   */
  getAllCached(): Map<string, Map<string, FeatureFlag>> {
    return this.cachedFlagsByEnv;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cachedFlagsByEnv.clear();
    this.logger.debug('Feature flags cache cleared');
  }

  /**
   * Clear cached data for a specific environment
   */
  clearCacheForEnvironment(environmentId: string): void {
    this.cachedFlagsByEnv.delete(environmentId);
    this.logger.debug('Feature flags cache cleared for environment', {
      environmentId,
    });
  }

  // ==================== Segment Methods ====================

  /**
   * Get or create the segment map for a given project
   */
  private getOrCreateProjectSegments(
    projectId: string
  ): Map<string, FeatureSegment> {
    let segmentMap = this.cachedSegments.get(projectId);
    if (!segmentMap) {
      segmentMap = new Map<string, FeatureSegment>();
      this.cachedSegments.set(projectId, segmentMap);
    }
    return segmentMap;
  }

  /**
   * Resolve projectId from environmentId/cacheKey
   */
  getProjectIdForEnvironment(environmentId: string): string | undefined {
    return this.envToProjectMap.get(environmentId);
  }

  /**
   * Fetch all segments for a project
   * GET /api/v1/server/segments
   */
  async fetchSegments(): Promise<FeatureSegment[]> {
    const endpoint = '/api/v1/server/segments';

    this.logger.debug('Fetching feature segments');

    const response = await this.apiClient.get<{
      segments: FeatureSegment[];
      projectId?: string;
    }>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch segments');
    }

    const { segments, projectId } = response.data;

    // Cache segments per project
    if (projectId) {
      const segmentMap = this.getOrCreateProjectSegments(projectId);
      segmentMap.clear();
      for (const segment of segments) {
        segmentMap.set(segment.name, segment);
      }

      // Save to local storage if available
      if (this.storage) {
        await this.storage.save(
          `FeatureFlags_${projectId}_segments`,
          JSON.stringify(segments)
        );
      }
    }

    this.logger.info('Feature segments fetched', {
      count: segments.length,
      projectId,
    });

    return segments;
  }

  /**
   * Refresh segments cache
   */
  async refreshSegments(): Promise<FeatureSegment[]> {
    this.logger.info('Refreshing feature segments cache');
    return await this.fetchSegments();
  }

  /**
   * Get a segment by name from cache for a specific project
   */
  getSegment(
    segmentName: string,
    projectId?: string
  ): FeatureSegment | undefined {
    if (projectId) {
      return this.cachedSegments.get(projectId)?.get(segmentName);
    }
    // Fallback: search all projects
    for (const segmentMap of this.cachedSegments.values()) {
      const seg = segmentMap.get(segmentName);
      if (seg) return seg;
    }
    return undefined;
  }

  /**
   * Get all cached segments for a specific project
   * If no projectId given, returns a merged map of all segments
   */
  getAllSegments(projectId?: string): Map<string, FeatureSegment> {
    if (projectId) {
      return this.cachedSegments.get(projectId) || new Map();
    }
    // Fallback: merge all projects (for backward compatibility)
    const merged = new Map<string, FeatureSegment>();
    for (const segmentMap of this.cachedSegments.values()) {
      for (const [name, segment] of segmentMap) {
        merged.set(name, segment);
      }
    }
    return merged;
  }

  /**
   * Clear segments cache (all projects or specific project)
   */
  clearSegmentsCache(projectId?: string): void {
    if (projectId) {
      this.cachedSegments.delete(projectId);
    } else {
      this.cachedSegments.clear();
    }
    this.logger.debug('Feature segments cache cleared', { projectId });
  }

  /**
   * Update a single segment in cache (for real-time sync)
   */
  updateSegmentInCache(segment: FeatureSegment, projectId?: string): void {
    if (projectId) {
      const segmentMap = this.getOrCreateProjectSegments(projectId);
      segmentMap.set(segment.name, segment);
    } else {
      // Fallback: update in all projects that have this segment
      for (const segmentMap of this.cachedSegments.values()) {
        if (segmentMap.has(segment.name)) {
          segmentMap.set(segment.name, segment);
        }
      }
    }
    this.logger.debug('Segment updated in cache', {
      segmentName: segment.name,
      projectId,
    });
  }

  /**
   * Remove a segment from cache (for real-time sync)
   */
  removeSegmentFromCache(segmentName: string, projectId?: string): void {
    if (projectId) {
      this.cachedSegments.get(projectId)?.delete(segmentName);
    } else {
      // Fallback: remove from all projects
      for (const segmentMap of this.cachedSegments.values()) {
        segmentMap.delete(segmentName);
      }
    }
    this.logger.debug('Segment removed from cache', { segmentName, projectId });
  }

  // ==================== Flag Query Methods ====================

  /**
   * Check if a feature flag exists in the cache
   * @param flagName Name of the flag
   * @param environmentId environment ID
   * @returns true if the flag is defined, false otherwise
   */
  hasFlag(flagName: string, environmentId: string): boolean {
    const flagMap = this.cachedFlagsByEnv.get(environmentId);
    if (!flagMap) return false;
    return flagMap.has(flagName);
  }

  // ==================== Evaluation Methods ====================

  /**
   * Resolve overload arguments for (context?, environmentId?) pattern.
   * Used by evaluate, OrThrow methods, and getVariant.
   */
  private resolveContextArgs(
    contextOrEnvId?: EvaluationContext | string,
    environmentId?: string
  ): [context: EvaluationContext | undefined, envId: string | undefined] {
    if (typeof contextOrEnvId === 'string') {
      return [undefined, contextOrEnvId];
    }
    if (contextOrEnvId && typeof contextOrEnvId === 'object') {
      return [contextOrEnvId, environmentId];
    }
    return [undefined, environmentId];
  }

  /**
   * Internal evaluation logic — no overloads.
   * All variation methods call this directly to avoid double-dispatch overhead.
   */
  private evaluateInternal(
    flagName: string,
    context?: EvaluationContext,
    environmentId?: string
  ): EvaluationResult {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    const mergedContext = this.mergeContext(context || {});
    const flag = this.getFlagByName(resolvedEnv, flagName);

    if (!flag) {
      return {
        id: '',
        flagName,
        enabled: false,
        reason: 'not_found',
        variant: {
          name: VALUE_SOURCE.MISSING,
          weight: 100,
          enabled: false,
          value: null,
        },
      };
    }

    const projectId = this.envToProjectMap.get(resolvedEnv);
    const segments = projectId
      ? this.cachedSegments.get(projectId) || new Map<string, FeatureSegment>()
      : this.getAllSegments();
    const result = FeatureFlagEvaluator.evaluate(flag, mergedContext, segments);

    this.recordMetric(
      resolvedEnv,
      flagName,
      result.enabled,
      result.variant?.name
    );

    return result;
  }

  /**
   * Check if a feature flag is enabled
   */
  isEnabled(
    flagName: string,
    fallbackValue: boolean,
    environmentId?: string
  ): boolean;
  isEnabled(
    flagName: string,
    context: EvaluationContext,
    fallbackValue: boolean,
    environmentId?: string
  ): boolean;
  isEnabled(
    flagName: string,
    contextOrFallback: EvaluationContext | boolean,
    fallbackOrEnvId?: boolean | string,
    environmentId?: string
  ): boolean {
    const isWithoutContext = typeof contextOrFallback === 'boolean';
    const context = isWithoutContext ? undefined : contextOrFallback;
    const fallbackValue = isWithoutContext
      ? contextOrFallback
      : (fallbackOrEnvId as boolean);
    const envId = isWithoutContext
      ? (fallbackOrEnvId as string | undefined)
      : environmentId;

    const result = this.evaluateInternal(flagName, context, envId);
    return result.reason === 'not_found' ? fallbackValue : result.enabled;
  }

  // ==================== Variation Methods ====================

  /**
   * Get boolean variation
   * Returns the flag's enabled state
   */
  boolVariation(
    flagName: string,
    fallbackValue: boolean,
    environmentId?: string
  ): boolean;
  boolVariation(
    flagName: string,
    context: EvaluationContext,
    fallbackValue: boolean,
    environmentId?: string
  ): boolean;
  boolVariation(
    flagName: string,
    contextOrFallback: EvaluationContext | boolean,
    fallbackOrEnvId?: boolean | string,
    environmentId?: string
  ): boolean {
    if (typeof contextOrFallback === 'boolean') {
      return this.isEnabled(flagName, contextOrFallback, fallbackOrEnvId as string | undefined);
    }
    return this.isEnabled(flagName, contextOrFallback, fallbackOrEnvId as boolean, environmentId);
  }

  /**
   * Get boolean variation with evaluation details
   */
  boolVariationDetail(
    flagName: string,
    fallbackValue: boolean,
    environmentId?: string
  ): { value: boolean; reason: EvaluationResult['reason']; flagName: string };
  boolVariationDetail(
    flagName: string,
    context: EvaluationContext,
    fallbackValue: boolean,
    environmentId?: string
  ): { value: boolean; reason: EvaluationResult['reason']; flagName: string };
  boolVariationDetail(
    flagName: string,
    contextOrFallback: EvaluationContext | boolean,
    fallbackOrEnvId?: boolean | string,
    environmentId?: string
  ): { value: boolean; reason: EvaluationResult['reason']; flagName: string } {
    const isWithoutContext = typeof contextOrFallback === 'boolean';
    const context = isWithoutContext ? undefined : contextOrFallback;
    const fallbackValue = isWithoutContext
      ? contextOrFallback
      : (fallbackOrEnvId as boolean);
    const envId = isWithoutContext
      ? (fallbackOrEnvId as string | undefined)
      : environmentId;

    const result = this.evaluateInternal(flagName, context, envId);
    return {
      value: result.reason === 'not_found' ? fallbackValue : result.enabled,
      reason: result.reason,
      flagName: result.flagName,
    };
  }

  /**
   * Get string variation from variant value
   */
  stringVariation(
    flagName: string,
    fallbackValue: string,
    environmentId?: string
  ): string;
  stringVariation(
    flagName: string,
    context: EvaluationContext,
    fallbackValue: string,
    environmentId?: string
  ): string;
  stringVariation(
    flagName: string,
    contextOrFallback: EvaluationContext | string,
    fallbackOrEnvId?: string,
    environmentId?: string
  ): string {
    const isWithoutContext = typeof contextOrFallback === 'string';
    const context = isWithoutContext ? undefined : contextOrFallback;
    const fallbackValue = isWithoutContext
      ? contextOrFallback
      : (fallbackOrEnvId as string);
    const envId = isWithoutContext ? fallbackOrEnvId : environmentId;

    const result = this.evaluateInternal(flagName, context, envId);
    if (result.reason === 'not_found' || result.variant?.value == null) {
      return fallbackValue;
    }
    return String(result.variant.value);
  }

  /**
   * Get string variation with evaluation details
   */
  stringVariationDetail(
    flagName: string,
    fallbackValue: string,
    environmentId?: string
  ): {
    value: string;
    reason: EvaluationResult['reason'];
    flagName: string;
    variantName?: string;
  };
  stringVariationDetail(
    flagName: string,
    context: EvaluationContext,
    fallbackValue: string,
    environmentId?: string
  ): {
    value: string;
    reason: EvaluationResult['reason'];
    flagName: string;
    variantName?: string;
  };
  stringVariationDetail(
    flagName: string,
    contextOrFallback: EvaluationContext | string,
    fallbackOrEnvId?: string,
    environmentId?: string
  ): {
    value: string;
    reason: EvaluationResult['reason'];
    flagName: string;
    variantName?: string;
  } {
    const isWithoutContext = typeof contextOrFallback === 'string';
    const context = isWithoutContext ? undefined : contextOrFallback;
    const fallbackValue = isWithoutContext
      ? contextOrFallback
      : (fallbackOrEnvId as string);
    const envId = isWithoutContext ? fallbackOrEnvId : environmentId;

    const result = this.evaluateInternal(flagName, context, envId);
    const value =
      result.reason === 'not_found' || result.variant?.value == null
        ? fallbackValue
        : String(result.variant.value);
    return {
      value,
      reason: result.reason,
      flagName: result.flagName,
      variantName: result.variant?.name,
    };
  }

  /**
   * Get number variation from variant value
   */
  numberVariation(
    flagName: string,
    fallbackValue: number,
    environmentId?: string
  ): number;
  numberVariation(
    flagName: string,
    context: EvaluationContext,
    fallbackValue: number,
    environmentId?: string
  ): number;
  numberVariation(
    flagName: string,
    contextOrFallback: EvaluationContext | number,
    fallbackOrEnvId?: number | string,
    environmentId?: string
  ): number {
    const isWithoutContext = typeof contextOrFallback === 'number';
    const context = isWithoutContext ? undefined : contextOrFallback;
    const fallbackValue = isWithoutContext
      ? contextOrFallback
      : (fallbackOrEnvId as number);
    const envId = isWithoutContext
      ? (fallbackOrEnvId as string | undefined)
      : environmentId;

    const result = this.evaluateInternal(flagName, context, envId);
    if (result.reason === 'not_found' || result.variant?.value == null) {
      return fallbackValue;
    }
    const num = Number(result.variant.value);
    return isNaN(num) ? fallbackValue : num;
  }

  /**
   * Get number variation with evaluation details
   */
  numberVariationDetail(
    flagName: string,
    fallbackValue: number,
    environmentId?: string
  ): {
    value: number;
    reason: EvaluationResult['reason'];
    flagName: string;
    variantName?: string;
  };
  numberVariationDetail(
    flagName: string,
    context: EvaluationContext,
    fallbackValue: number,
    environmentId?: string
  ): {
    value: number;
    reason: EvaluationResult['reason'];
    flagName: string;
    variantName?: string;
  };
  numberVariationDetail(
    flagName: string,
    contextOrFallback: EvaluationContext | number,
    fallbackOrEnvId?: number | string,
    environmentId?: string
  ): {
    value: number;
    reason: EvaluationResult['reason'];
    flagName: string;
    variantName?: string;
  } {
    const isWithoutContext = typeof contextOrFallback === 'number';
    const context = isWithoutContext ? undefined : contextOrFallback;
    const fallbackValue = isWithoutContext
      ? contextOrFallback
      : (fallbackOrEnvId as number);
    const envId = isWithoutContext
      ? (fallbackOrEnvId as string | undefined)
      : environmentId;

    const result = this.evaluateInternal(flagName, context, envId);
    let value = fallbackValue;
    if (result.reason !== 'not_found' && result.variant?.value != null) {
      const num = Number(result.variant.value);
      value = isNaN(num) ? fallbackValue : num;
    }
    return {
      value,
      reason: result.reason,
      flagName: result.flagName,
      variantName: result.variant?.name,
    };
  }

  /**
   * Get JSON variation from variant value
   */
  jsonVariation<T = any>(
    flagName: string,
    fallbackValue: T,
    environmentId?: string
  ): T;
  jsonVariation<T = any>(
    flagName: string,
    context: EvaluationContext,
    fallbackValue: T,
    environmentId?: string
  ): T;
  jsonVariation<T = any>(
    flagName: string,
    contextOrFallback: EvaluationContext | T,
    fallbackOrEnvId?: T | string,
    environmentId?: string
  ): T {
    // Resolve overload by argument count and type:
    // 4 args → (flagName, context, fallback, envId)
    // 3 args + 3rd=string → (flagName, fallback, envId)
    // 3 args + 3rd=non-string → (flagName, context, fallback)
    // 2 args → (flagName, fallback)
    let context: EvaluationContext | undefined;
    let fallbackValue: T;
    let envId: string | undefined;

    if (environmentId !== undefined) {
      context = contextOrFallback as EvaluationContext;
      fallbackValue = fallbackOrEnvId as T;
      envId = environmentId;
    } else if (fallbackOrEnvId === undefined) {
      fallbackValue = contextOrFallback as T;
    } else if (typeof fallbackOrEnvId === 'string') {
      fallbackValue = contextOrFallback as T;
      envId = fallbackOrEnvId;
    } else {
      context = contextOrFallback as EvaluationContext;
      fallbackValue = fallbackOrEnvId as T;
    }

    const result = this.evaluateInternal(flagName, context, envId);
    if (result.reason === 'not_found' || result.variant?.value == null) {
      return fallbackValue;
    }
    const rawValue = result.variant.value;
    if (typeof rawValue === 'object') {
      return rawValue as T;
    }
    if (typeof rawValue === 'string') {
      try {
        return JSON.parse(rawValue) as T;
      } catch {
        return fallbackValue;
      }
    }
    return fallbackValue;
  }

  /**
   * Get JSON variation with evaluation details
   */
  jsonVariationDetail<T = any>(
    flagName: string,
    fallbackValue: T,
    environmentId?: string
  ): {
    value: T;
    reason: EvaluationResult['reason'];
    flagName: string;
    variantName?: string;
  };
  jsonVariationDetail<T = any>(
    flagName: string,
    context: EvaluationContext,
    fallbackValue: T,
    environmentId?: string
  ): {
    value: T;
    reason: EvaluationResult['reason'];
    flagName: string;
    variantName?: string;
  };
  jsonVariationDetail<T = any>(
    flagName: string,
    contextOrFallback: EvaluationContext | T,
    fallbackOrEnvId?: T | string,
    environmentId?: string
  ): {
    value: T;
    reason: EvaluationResult['reason'];
    flagName: string;
    variantName?: string;
  } {
    let context: EvaluationContext | undefined;
    let fallbackValue: T;
    let envId: string | undefined;

    if (environmentId !== undefined) {
      context = contextOrFallback as EvaluationContext;
      fallbackValue = fallbackOrEnvId as T;
      envId = environmentId;
    } else if (fallbackOrEnvId === undefined) {
      fallbackValue = contextOrFallback as T;
    } else if (typeof fallbackOrEnvId === 'string') {
      fallbackValue = contextOrFallback as T;
      envId = fallbackOrEnvId;
    } else {
      context = contextOrFallback as EvaluationContext;
      fallbackValue = fallbackOrEnvId as T;
    }

    const result = this.evaluateInternal(flagName, context, envId);
    let value = fallbackValue;
    if (result.reason !== 'not_found' && result.variant?.value != null) {
      const rawValue = result.variant.value;
      if (typeof rawValue === 'object') {
        value = rawValue as T;
      } else if (typeof rawValue === 'string') {
        try {
          value = JSON.parse(rawValue) as T;
        } catch {
          // Keep fallbackValue
        }
      }
    }
    return {
      value,
      reason: result.reason,
      flagName: result.flagName,
      variantName: result.variant?.name,
    };
  }

  // ==================== Strict Variation Methods (OrThrow) ====================

  /**
   * Get string variation or throw if not available
   * Throws FeatureFlagError if flag not found or has no value
   */
  stringVariationOrThrow(flagName: string, environmentId?: string): string;
  stringVariationOrThrow(
    flagName: string,
    context: EvaluationContext,
    environmentId?: string
  ): string;
  stringVariationOrThrow(
    flagName: string,
    contextOrEnvId?: EvaluationContext | string,
    environmentId?: string
  ): string {
    const [context, envId] = this.resolveContextArgs(
      contextOrEnvId,
      environmentId
    );
    const result = this.evaluateInternal(flagName, context, envId);

    if (result.reason === 'not_found') {
      throw new FeatureFlagError(
        FeatureFlagErrorCode.FLAG_NOT_FOUND,
        `Feature flag '${flagName}' not found in environment '${envId}'`,
        flagName,
        envId
      );
    }

    if (result.variant?.value == null) {
      throw new FeatureFlagError(
        FeatureFlagErrorCode.NO_VALUE,
        `Feature flag '${flagName}' has no variant value`,
        flagName,
        envId
      );
    }

    return String(result.variant.value);
  }

  /**
   * Get number variation or throw if not available
   * Throws FeatureFlagError if flag not found, has no value, or value is not a valid number
   */
  numberVariationOrThrow(flagName: string, environmentId?: string): number;
  numberVariationOrThrow(
    flagName: string,
    context: EvaluationContext,
    environmentId?: string
  ): number;
  numberVariationOrThrow(
    flagName: string,
    contextOrEnvId?: EvaluationContext | string,
    environmentId?: string
  ): number {
    const [context, envId] = this.resolveContextArgs(
      contextOrEnvId,
      environmentId
    );
    const result = this.evaluateInternal(flagName, context, envId);

    if (result.reason === 'not_found') {
      throw new FeatureFlagError(
        FeatureFlagErrorCode.FLAG_NOT_FOUND,
        `Feature flag '${flagName}' not found in environment '${envId}'`,
        flagName,
        envId
      );
    }

    if (result.variant?.value == null) {
      throw new FeatureFlagError(
        FeatureFlagErrorCode.NO_VALUE,
        `Feature flag '${flagName}' has no variant value`,
        flagName,
        envId
      );
    }

    const num = Number(result.variant.value);
    if (isNaN(num)) {
      throw new FeatureFlagError(
        FeatureFlagErrorCode.INVALID_VALUE_TYPE,
        `Feature flag '${flagName}' variant value is not a valid number`,
        flagName,
        envId
      );
    }
    return num;
  }

  /**
   * Get JSON variation or throw if not available
   * Throws FeatureFlagError if flag not found, has no value, or value is not valid JSON
   */
  jsonVariationOrThrow<T = any>(
    flagName: string,
    environmentId?: string
  ): T;
  jsonVariationOrThrow<T = any>(
    flagName: string,
    context: EvaluationContext,
    environmentId?: string
  ): T;
  jsonVariationOrThrow<T = any>(
    flagName: string,
    contextOrEnvId?: EvaluationContext | string,
    environmentId?: string
  ): T {
    const [context, envId] = this.resolveContextArgs(
      contextOrEnvId,
      environmentId
    );
    const result = this.evaluateInternal(flagName, context, envId);

    if (result.reason === 'not_found') {
      throw new FeatureFlagError(
        FeatureFlagErrorCode.FLAG_NOT_FOUND,
        `Feature flag '${flagName}' not found in environment '${envId}'`,
        flagName,
        envId
      );
    }

    if (result.variant?.value == null) {
      throw new FeatureFlagError(
        FeatureFlagErrorCode.NO_VALUE,
        `Feature flag '${flagName}' has no variant value`,
        flagName,
        envId
      );
    }

    const rawValue = result.variant.value;
    if (typeof rawValue === 'object') {
      return rawValue as T;
    }
    if (typeof rawValue === 'string') {
      try {
        return JSON.parse(rawValue) as T;
      } catch {
        throw new FeatureFlagError(
          FeatureFlagErrorCode.INVALID_VALUE_TYPE,
          `Feature flag '${flagName}' variant value is not valid JSON`,
          flagName,
          envId
        );
      }
    }
    throw new FeatureFlagError(
      FeatureFlagErrorCode.INVALID_VALUE_TYPE,
      `Feature flag '${flagName}' variant value type is not supported`,
      flagName,
      envId
    );
  }

  // ==================== Legacy Methods ====================

  /**
   * Get variant for a feature flag
   * @deprecated Use stringVariation(), numberVariation(), or jsonVariation() instead
   */
  getVariant(
    flagName: string,
    defaultVariant?: Variant,
    environmentId?: string
  ): Variant | undefined;
  getVariant(
    flagName: string,
    defaultVariant: Variant | undefined,
    context: EvaluationContext,
    environmentId?: string
  ): Variant | undefined;
  getVariant(
    flagName: string,
    defaultVariant?: Variant,
    contextOrEnvId?: EvaluationContext | string,
    environmentId?: string
  ): Variant | undefined {
    const [context, envId] = this.resolveContextArgs(
      contextOrEnvId,
      environmentId
    );
    const result = this.evaluateInternal(flagName, context, envId);
    if (result.reason === 'not_found' || !result.variant) {
      return defaultVariant;
    }
    return result.variant;
  }

  /**
   * Evaluate a feature flag (public API)
   * Uses FeatureFlagEvaluator from @gatrix/shared for consistent evaluation logic
   */
  evaluate(flagName: string, environmentId?: string): EvaluationResult;
  evaluate(
    flagName: string,
    context: EvaluationContext,
    environmentId?: string
  ): EvaluationResult;
  evaluate(
    flagName: string,
    contextOrEnvId?: EvaluationContext | string,
    environmentId?: string
  ): EvaluationResult {
    const [context, envId] = this.resolveContextArgs(
      contextOrEnvId,
      environmentId
    );
    return this.evaluateInternal(flagName, context, envId);
  }

  // ==================== Metrics Methods ====================

  /**
   * Record a flag evaluation metric
   */
  private recordMetric(
    environmentId: string,
    flagName: string,
    enabled: boolean,
    variantName?: string
  ): void {
    this.metricsBuffer.push({
      environmentId,
      flagName,
      enabled,
      variantName,
      timestamp: new Date(),
    });

    // Auto-flush if buffer gets too large
    if (this.metricsBuffer.length >= 1000) {
      this.flushMetrics();
    }
  }

  /**
   * Flush metrics buffer to the server
   * Aggregates metrics before sending for efficiency
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const metricsToSend = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      // Group metrics by environment first
      const byEnvironment = new Map<string, typeof metricsToSend>();
      for (const metric of metricsToSend) {
        const envMetrics = byEnvironment.get(metric.environmentId) || [];
        envMetrics.push(metric);
        byEnvironment.set(metric.environmentId, envMetrics);
      }

      // Process each environment separately
      for (const [environmentId, envMetrics] of byEnvironment) {
        // Aggregate metrics by flagName + enabled + variantName
        const aggregated = new Map<
          string,
          {
            flagName: string;
            enabled: boolean;
            variantName?: string;
            count: number;
          }
        >();

        for (const metric of envMetrics) {
          const key = `${metric.flagName}:${metric.enabled}:${metric.variantName || ''}`;
          const existing = aggregated.get(key);
          if (existing) {
            existing.count++;
          } else {
            aggregated.set(key, {
              flagName: metric.flagName,
              enabled: metric.enabled,
              variantName: metric.variantName,
              count: 1,
            });
          }
        }

        const aggregatedMetrics = Array.from(aggregated.values());

        this.logger.debug('Flushing feature flag metrics', {
          environmentId,
          rawCount: envMetrics.length,
          aggregatedCount: aggregatedMetrics.length,
        });

        // Send aggregated metrics to backend (per environment) with time window
        const bucketStop = new Date();
        await this.apiClient.post(
          `/api/v1/server/features/metrics`,
          {
            metrics: aggregatedMetrics,
            bucket: {
              start: this.metricsBucketStartTime.toISOString(),
              stop: bucketStop.toISOString(),
            },
            // Legacy field for backward compatibility
            timestamp: bucketStop.toISOString(),
            sdkVersion: SDK_VERSION, // Also send in body for robustness
          },
          {
            headers: {
              'X-SDK-Version': SDK_VERSION,
            },
          }
        );
      }

      // Reset bucket start time for next window
      this.metricsBucketStartTime = new Date();

      this.logger.debug('Feature flag metrics sent successfully');
    } catch (error) {
      this.logger.error('Failed to flush feature flag metrics', { error });
      // Re-add failed metrics back to buffer (limit to prevent memory issues)
      if (this.metricsBuffer.length < 10000) {
        this.metricsBuffer.unshift(...metricsToSend);
      }
    }
  }

  // ==================== Cache Update Methods ====================

  /**
   * Update a single flag in cache
   * @param flagName Flag name
   * @param environmentId environment ID
   * @param isEnabled Optional enabled status (if false, removes from cache)
   */
  async updateSingleFlag(
    flagName: string,
    environmentId: string,
    isEnabled?: boolean
  ): Promise<void> {
    try {
      this.logger.debug('Updating single flag in cache', {
        flagName,
        environmentId,
        isEnabled,
      });

      // If explicitly disabled or archived, remove from cache
      if (isEnabled === false) {
        this.removeFlag(flagName, environmentId);
        return;
      }

      // Invalidate ETag cache for this specific flag endpoint
      const client = this.getApiClient(environmentId);
      client.invalidateEtagCache(
        `/api/v1/server/features/${encodeURIComponent(flagName)}`
      );

      // Fetch updated flag from server
      const response = await client.get<{ flag: FeatureFlag }>(
        `/api/v1/server/features/${encodeURIComponent(flagName)}`
      );

      if (!response.success || !response.data) {
        this.logger.debug('Flag not found or not active, removing from cache', {
          flagName,
          environmentId,
        });
        this.removeFlag(flagName, environmentId);
        return;
      }

      const updatedFlag = response.data.flag;

      // Get or create environment cache Map
      let envCache = this.cachedFlagsByEnv.get(environmentId);
      if (!envCache) {
        envCache = new Map<string, FeatureFlag>();
        this.cachedFlagsByEnv.set(environmentId, envCache);
      }

      // Add or update flag in cache (O(1))
      envCache.set(flagName, updatedFlag);
      this.logger.debug('Single flag updated in cache', {
        flagName,
        environmentId,
      });
    } catch (error: any) {
      this.logger.error('Failed to update single flag in cache', {
        flagName,
        environmentId,
        error: error.message,
      });
      // Fall back to full refresh
      await this.refreshByEnvironment(environmentId);
    }
  }

  /**
   * Remove a flag from cache (O(1))
   */
  removeFlag(flagName: string, environmentId: string): void {
    this.logger.debug('Removing flag from cache', { flagName, environmentId });

    const envCache = this.cachedFlagsByEnv.get(environmentId);
    if (envCache) {
      envCache.delete(flagName);
    }

    this.logger.debug('Flag removed from cache', { flagName, environmentId });
  }
}
