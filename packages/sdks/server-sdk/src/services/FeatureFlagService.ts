/**
 * Feature Flag Service
 * Handles feature flag retrieval and evaluation
 * Uses per-environment API pattern: GET /api/v1/server/:env/features
 *
 * DESIGN PRINCIPLES:
 * - All methods that access cached data MUST receive environment explicitly
 * - Environment resolution is delegated to EnvironmentResolver
 * - Evaluations are performed locally using cached flags
 * - Segments are cached separately and referenced by name for efficiency
 * - Metrics are batched and sent periodically (default: 1 minute)
 */

import { ApiClient } from "../client/ApiClient";
import { Logger } from "../utils/logger";
import { EnvironmentResolver } from "../utils/EnvironmentResolver";
import {
  FeatureFlag,
  FeatureSegment,
  EvaluationContext,
  EvaluationResult,
  Variant,
  FeatureStrategy,
  Constraint,
  FlagMetric,
} from "../types/featureFlags";
import { FeatureFlagError, FeatureFlagErrorCode } from "../utils/errors";
import murmurhash from "murmurhash";

export class FeatureFlagService {
  private apiClient: ApiClient;
  private logger: Logger;
  private envResolver: EnvironmentResolver;
  // Multi-environment flag cache: Map<environment, Map<flagName, FeatureFlag>>
  // Using nested Map for O(1) flag lookup by name
  private cachedFlagsByEnv: Map<string, Map<string, FeatureFlag>> = new Map();
  // Segment cache: Map<segmentName, FeatureSegment> (global, not per-environment)
  private cachedSegments: Map<string, FeatureSegment> = new Map();
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

  constructor(
    apiClient: ApiClient,
    logger: Logger,
    envResolver: EnvironmentResolver,
  ) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.envResolver = envResolver;
  }

  /**
   * Set static context (default context merged with per-evaluation context)
   * Static context is applied to all evaluations, with per-evaluation context taking precedence
   */
  setStaticContext(context: EvaluationContext): void {
    this.staticContext = context;
    this.logger.debug("Static context set", { keys: Object.keys(context) });
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
    this.logger.debug("Metrics config updated", { config: this.metricsConfig });
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
   * Start metrics collection
   * Uses configured flushIntervalMs if not provided
   */
  startMetricsCollection(flushIntervalMs?: number): void {
    if (!this.metricsConfig.enabled) {
      this.logger.debug("Metrics collection is disabled");
      return;
    }

    const interval = flushIntervalMs ?? this.metricsConfig.flushIntervalMs;

    if (this.metricsFlushInterval) {
      clearInterval(this.metricsFlushInterval);
    }
    this.metricsFlushInterval = setInterval(() => {
      this.flushMetrics();
    }, interval);

    this.logger.info("Metrics collection started", {
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

  // ==================== API Methods ====================

  /**
   * Fetch all flags for a specific environment
   * GET /api/v1/server/:env/features
   * Also caches referenced segments returned by the backend
   */
  async listByEnvironment(environment: string): Promise<FeatureFlag[]> {
    const endpoint = `/api/v1/server/${encodeURIComponent(environment)}/features`;

    this.logger.debug("Fetching feature flags", { environment });

    const response = await this.apiClient.get<{
      flags: FeatureFlag[];
      segments: FeatureSegment[];
    }>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(
        response.error?.message || "Failed to fetch feature flags",
      );
    }

    const { flags, segments } = response.data;

    // Cache flags by name for O(1) lookup
    const flagMap = new Map<string, FeatureFlag>();
    for (const flag of flags) {
      flagMap.set(flag.name, flag);
    }
    this.cachedFlagsByEnv.set(environment, flagMap);

    // Cache segments (global, not per-environment)
    if (segments && segments.length > 0) {
      for (const segment of segments) {
        this.cachedSegments.set(segment.name, segment);
      }
      this.logger.info("Feature segments cached", { count: segments.length });
    }

    this.logger.info("Feature flags fetched", {
      count: flags.length,
      environment,
    });

    return flags;
  }

  /**
   * Refresh cached flags for a specific environment
   */
  async refreshByEnvironment(environment: string): Promise<FeatureFlag[]> {
    if (!this.featureEnabled) {
      this.logger.warn(
        "FeatureFlagService.refreshByEnvironment() called but feature is disabled",
        { environment },
      );
    }
    this.logger.info("Refreshing feature flags cache", { environment });
    return await this.listByEnvironment(environment);
  }

  /**
   * Fetch and cache feature flags for multiple environments (multi-environment mode)
   * Used by Edge server to handle multiple environments
   */
  async listByEnvironments(environments: string[]): Promise<FeatureFlag[]> {
    const allFlags: FeatureFlag[] = [];

    for (const environment of environments) {
      try {
        const flags = await this.listByEnvironment(environment);
        allFlags.push(...flags);
      } catch (error: any) {
        this.logger.warn("Failed to load feature flags for environment", {
          environment,
          error: error.message,
        });
      }
    }

    this.logger.info("Feature flags loaded for multiple environments", {
      environments: environments.length,
      totalFlags: allFlags.length,
    });

    return allFlags;
  }

  /**
   * Get a single flag by name from cache (O(1) lookup)
   */
  getFlagByName(
    environment: string,
    flagName: string,
  ): FeatureFlag | undefined {
    const envCache = this.cachedFlagsByEnv.get(environment);
    return envCache?.get(flagName);
  }

  /**
   * Get all cached flags as array
   * @param environment Environment name (required)
   */
  getCached(environment: string): FeatureFlag[] {
    const envCache = this.cachedFlagsByEnv.get(environment);
    return envCache ? Array.from(envCache.values()) : [];
  }

  /**
   * Get cached flag count for environment
   */
  getCachedCount(environment: string): number {
    return this.cachedFlagsByEnv.get(environment)?.size ?? 0;
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
    this.logger.debug("Feature flags cache cleared");
  }

  /**
   * Clear cached data for a specific environment
   */
  clearCacheForEnvironment(environment: string): void {
    this.cachedFlagsByEnv.delete(environment);
    this.logger.debug("Feature flags cache cleared for environment", {
      environment,
    });
  }

  // ==================== Segment Methods ====================

  /**
   * Fetch all segments (global, not per-environment)
   * GET /api/v1/server/segments
   */
  async fetchSegments(): Promise<FeatureSegment[]> {
    const endpoint = "/api/v1/server/segments";

    this.logger.debug("Fetching feature segments");

    const response = await this.apiClient.get<{ segments: FeatureSegment[] }>(
      endpoint,
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || "Failed to fetch segments");
    }

    const { segments } = response.data;

    // Cache segments by name for efficient lookup
    this.cachedSegments.clear();
    for (const segment of segments) {
      this.cachedSegments.set(segment.name, segment);
    }

    this.logger.info("Feature segments fetched", { count: segments.length });

    return segments;
  }

  /**
   * Refresh segments cache
   */
  async refreshSegments(): Promise<FeatureSegment[]> {
    this.logger.info("Refreshing feature segments cache");
    return await this.fetchSegments();
  }

  /**
   * Get a segment by name from cache
   */
  getSegment(segmentName: string): FeatureSegment | undefined {
    return this.cachedSegments.get(segmentName);
  }

  /**
   * Get all cached segments
   */
  getAllSegments(): Map<string, FeatureSegment> {
    return this.cachedSegments;
  }

  /**
   * Clear segments cache
   */
  clearSegmentsCache(): void {
    this.cachedSegments.clear();
    this.logger.debug("Feature segments cache cleared");
  }

  /**
   * Update a single segment in cache (for real-time sync)
   */
  updateSegmentInCache(segment: FeatureSegment): void {
    this.cachedSegments.set(segment.name, segment);
    this.logger.debug("Segment updated in cache", {
      segmentName: segment.name,
    });
  }

  /**
   * Remove a segment from cache (for real-time sync)
   */
  removeSegmentFromCache(segmentName: string): void {
    this.cachedSegments.delete(segmentName);
    this.logger.debug("Segment removed from cache", { segmentName });
  }

  // ==================== Evaluation Methods ====================

  /**
   * Check if a feature flag is enabled
   * @param flagName Name of the flag
   * @param context Evaluation context
   * @param environment Environment name
   * @param defaultValue Default value if flag not found
   */
  isEnabled(
    flagName: string,
    context: EvaluationContext,
    environment: string,
    defaultValue: boolean = false,
  ): boolean {
    const result = this.evaluate(flagName, context, environment);
    if (result.reason === "not_found") {
      return defaultValue;
    }
    return result.enabled;
  }

  // ==================== Variation Methods ====================

  /**
   * Get boolean variation
   * Returns the flag's enabled state
   */
  boolVariation(
    flagName: string,
    context: EvaluationContext,
    environment: string,
    defaultValue: boolean = false,
  ): boolean {
    return this.isEnabled(flagName, context, environment, defaultValue);
  }

  /**
   * Get boolean variation with evaluation details
   */
  boolVariationDetail(
    flagName: string,
    context: EvaluationContext,
    environment: string,
    defaultValue: boolean = false,
  ): { value: boolean; reason: EvaluationResult["reason"]; flagName: string } {
    const result = this.evaluate(flagName, context, environment);
    return {
      value: result.reason === "not_found" ? defaultValue : result.enabled,
      reason: result.reason,
      flagName: result.flagName,
    };
  }

  /**
   * Get string variation from variant payload
   */
  stringVariation(
    flagName: string,
    context: EvaluationContext,
    environment: string,
    defaultValue: string = "",
  ): string {
    const result = this.evaluate(flagName, context, environment);
    if (!result.enabled || !result.variant?.payload) {
      return defaultValue;
    }
    return String(
      result.variant.payload.value ?? result.variant.payload ?? defaultValue,
    );
  }

  /**
   * Get string variation with evaluation details
   */
  stringVariationDetail(
    flagName: string,
    context: EvaluationContext,
    environment: string,
    defaultValue: string = "",
  ): {
    value: string;
    reason: EvaluationResult["reason"];
    flagName: string;
    variantName?: string;
  } {
    const result = this.evaluate(flagName, context, environment);
    const value =
      !result.enabled || !result.variant?.payload
        ? defaultValue
        : String(
          result.variant.payload.value ??
          result.variant.payload ??
          defaultValue,
        );
    return {
      value,
      reason: result.reason,
      flagName: result.flagName,
      variantName: result.variant?.name,
    };
  }

  /**
   * Get number variation from variant payload
   */
  numberVariation(
    flagName: string,
    context: EvaluationContext,
    environment: string,
    defaultValue: number = 0,
  ): number {
    const result = this.evaluate(flagName, context, environment);
    if (!result.enabled || !result.variant?.payload) {
      return defaultValue;
    }
    const rawValue = result.variant.payload.value ?? result.variant.payload;
    const num = Number(rawValue);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Get number variation with evaluation details
   */
  numberVariationDetail(
    flagName: string,
    context: EvaluationContext,
    environment: string,
    defaultValue: number = 0,
  ): {
    value: number;
    reason: EvaluationResult["reason"];
    flagName: string;
    variantName?: string;
  } {
    const result = this.evaluate(flagName, context, environment);
    let value = defaultValue;
    if (result.enabled && result.variant?.payload) {
      const rawValue = result.variant.payload.value ?? result.variant.payload;
      const num = Number(rawValue);
      value = isNaN(num) ? defaultValue : num;
    }
    return {
      value,
      reason: result.reason,
      flagName: result.flagName,
      variantName: result.variant?.name,
    };
  }

  /**
   * Get JSON variation from variant payload
   */
  jsonVariation<T = any>(
    flagName: string,
    context: EvaluationContext,
    environment: string,
    defaultValue: T,
  ): T {
    const result = this.evaluate(flagName, context, environment);
    if (!result.enabled || !result.variant?.payload) {
      return defaultValue;
    }
    const rawValue = result.variant.payload.value ?? result.variant.payload;
    if (typeof rawValue === "object") {
      return rawValue as T;
    }
    if (typeof rawValue === "string") {
      try {
        return JSON.parse(rawValue) as T;
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  }

  /**
   * Get JSON variation with evaluation details
   */
  jsonVariationDetail<T = any>(
    flagName: string,
    context: EvaluationContext,
    environment: string,
    defaultValue: T,
  ): {
    value: T;
    reason: EvaluationResult["reason"];
    flagName: string;
    variantName?: string;
  } {
    const result = this.evaluate(flagName, context, environment);
    let value = defaultValue;
    if (result.enabled && result.variant?.payload) {
      const rawValue = result.variant.payload.value ?? result.variant.payload;
      if (typeof rawValue === "object") {
        value = rawValue as T;
      } else if (typeof rawValue === "string") {
        try {
          value = JSON.parse(rawValue) as T;
        } catch {
          // Keep defaultValue
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
   * Throws FeatureFlagError if flag not found, disabled, or no payload
   * Use this when baselinePayload is required in server config
   */
  stringVariationOrThrow(
    flagName: string,
    context: EvaluationContext,
    environment: string,
  ): string {
    const result = this.evaluate(flagName, context, environment);

    if (result.reason === "not_found") {
      throw new FeatureFlagError(
        FeatureFlagErrorCode.FLAG_NOT_FOUND,
        `Feature flag '${flagName}' not found in environment '${environment}'`,
        flagName,
        environment,
      );
    }

    if (!result.enabled) {
      // Flag disabled - check for baselinePayload
      // Note: baselinePayload would be in result.variant if set
      if (result.variant?.payload) {
        const value = result.variant.payload.value ?? result.variant.payload;
        return String(value);
      }
      throw new FeatureFlagError(
        FeatureFlagErrorCode.FLAG_DISABLED,
        `Feature flag '${flagName}' is disabled and has no baseline payload`,
        flagName,
        environment,
      );
    }

    if (!result.variant?.payload) {
      throw new FeatureFlagError(
        FeatureFlagErrorCode.NO_PAYLOAD,
        `Feature flag '${flagName}' has no variant payload`,
        flagName,
        environment,
      );
    }

    return String(result.variant.payload.value ?? result.variant.payload);
  }

  /**
   * Get number variation or throw if not available
   * Throws FeatureFlagError if flag not found, disabled, no payload, or payload is not a valid number
   */
  numberVariationOrThrow(
    flagName: string,
    context: EvaluationContext,
    environment: string,
  ): number {
    const result = this.evaluate(flagName, context, environment);

    if (result.reason === "not_found") {
      throw new FeatureFlagError(
        FeatureFlagErrorCode.FLAG_NOT_FOUND,
        `Feature flag '${flagName}' not found in environment '${environment}'`,
        flagName,
        environment,
      );
    }

    if (!result.enabled) {
      if (result.variant?.payload) {
        const value = result.variant.payload.value ?? result.variant.payload;
        const num = Number(value);
        if (isNaN(num)) {
          throw new FeatureFlagError(
            FeatureFlagErrorCode.INVALID_PAYLOAD_TYPE,
            `Feature flag '${flagName}' baseline payload is not a valid number`,
            flagName,
            environment,
          );
        }
        return num;
      }
      throw new FeatureFlagError(
        FeatureFlagErrorCode.FLAG_DISABLED,
        `Feature flag '${flagName}' is disabled and has no baseline payload`,
        flagName,
        environment,
      );
    }

    if (!result.variant?.payload) {
      throw new FeatureFlagError(
        FeatureFlagErrorCode.NO_PAYLOAD,
        `Feature flag '${flagName}' has no variant payload`,
        flagName,
        environment,
      );
    }

    const rawValue = result.variant.payload.value ?? result.variant.payload;
    const num = Number(rawValue);
    if (isNaN(num)) {
      throw new FeatureFlagError(
        FeatureFlagErrorCode.INVALID_PAYLOAD_TYPE,
        `Feature flag '${flagName}' variant payload is not a valid number`,
        flagName,
        environment,
      );
    }
    return num;
  }

  /**
   * Get JSON variation or throw if not available
   * Throws FeatureFlagError if flag not found, disabled, no payload, or payload is not valid JSON
   */
  jsonVariationOrThrow<T = any>(
    flagName: string,
    context: EvaluationContext,
    environment: string,
  ): T {
    const result = this.evaluate(flagName, context, environment);

    if (result.reason === "not_found") {
      throw new FeatureFlagError(
        FeatureFlagErrorCode.FLAG_NOT_FOUND,
        `Feature flag '${flagName}' not found in environment '${environment}'`,
        flagName,
        environment,
      );
    }

    if (!result.enabled) {
      if (result.variant?.payload) {
        const rawValue = result.variant.payload.value ?? result.variant.payload;
        if (typeof rawValue === "object") {
          return rawValue as T;
        }
        if (typeof rawValue === "string") {
          try {
            return JSON.parse(rawValue) as T;
          } catch {
            throw new FeatureFlagError(
              FeatureFlagErrorCode.INVALID_PAYLOAD_TYPE,
              `Feature flag '${flagName}' baseline payload is not valid JSON`,
              flagName,
              environment,
            );
          }
        }
        throw new FeatureFlagError(
          FeatureFlagErrorCode.INVALID_PAYLOAD_TYPE,
          `Feature flag '${flagName}' baseline payload type is not supported`,
          flagName,
          environment,
        );
      }
      throw new FeatureFlagError(
        FeatureFlagErrorCode.FLAG_DISABLED,
        `Feature flag '${flagName}' is disabled and has no baseline payload`,
        flagName,
        environment,
      );
    }

    if (!result.variant?.payload) {
      throw new FeatureFlagError(
        FeatureFlagErrorCode.NO_PAYLOAD,
        `Feature flag '${flagName}' has no variant payload`,
        flagName,
        environment,
      );
    }

    const rawValue = result.variant.payload.value ?? result.variant.payload;
    if (typeof rawValue === "object") {
      return rawValue as T;
    }
    if (typeof rawValue === "string") {
      try {
        return JSON.parse(rawValue) as T;
      } catch {
        throw new FeatureFlagError(
          FeatureFlagErrorCode.INVALID_PAYLOAD_TYPE,
          `Feature flag '${flagName}' variant payload is not valid JSON`,
          flagName,
          environment,
        );
      }
    }
    throw new FeatureFlagError(
      FeatureFlagErrorCode.INVALID_PAYLOAD_TYPE,
      `Feature flag '${flagName}' variant payload type is not supported`,
      flagName,
      environment,
    );
  }

  // ==================== Legacy Methods ====================

  /**
   * Get variant for a feature flag
   * @param flagName Name of the flag
   * @param context Evaluation context
   * @param environment Environment name
   * @param defaultVariant Default variant if flag not found or has no variants
   * @deprecated Use stringVariation(), numberVariation(), or jsonVariation() instead
   */
  getVariant(
    flagName: string,
    context: EvaluationContext,
    environment: string,
    defaultVariant?: Variant,
  ): Variant | undefined {
    const result = this.evaluate(flagName, context, environment);
    if (result.reason === "not_found" || !result.variant) {
      return defaultVariant;
    }
    return result.variant;
  }

  /**
   * Evaluate a feature flag
   * @param flagName Name of the flag
   * @param context Evaluation context (merged with static context)
   * @param environment Environment name
   */
  evaluate(
    flagName: string,
    context: EvaluationContext,
    environment: string,
  ): EvaluationResult {
    // Merge static context with per-evaluation context
    const mergedContext = this.mergeContext(context);

    // O(1) lookup from cached Map
    const flag = this.getFlagByName(environment, flagName);

    if (!flag) {
      return {
        flagName,
        enabled: false,
        reason: "not_found",
      };
    }

    // If flag is globally disabled
    if (!flag.isEnabled) {
      this.recordMetric(environment, flagName, false);
      return {
        flagName,
        enabled: false,
        reason: "disabled",
      };
    }

    // Evaluate strategies with merged context
    const strategyResult = this.evaluateStrategies(
      flag.strategies,
      mergedContext,
      flag,
    );

    if (strategyResult.enabled) {
      // Select variant using matched strategy's stickiness
      const variant = this.selectVariant(
        flag,
        mergedContext,
        strategyResult.matchedStrategy,
      );
      this.recordMetric(environment, flagName, true, variant?.name);
      return {
        flagName,
        enabled: true,
        variant,
        reason: strategyResult.reason,
      };
    }

    this.recordMetric(environment, flagName, false);
    return {
      flagName,
      enabled: false,
      reason: strategyResult.reason,
    };
  }

  /**
   * Evaluate all strategies for a flag
   * Returns matched strategy for stickiness-based variant selection
   */
  private evaluateStrategies(
    strategies: FeatureStrategy[],
    context: EvaluationContext,
    flag: FeatureFlag,
  ): {
    enabled: boolean;
    reason: EvaluationResult["reason"];
    matchedStrategy?: FeatureStrategy;
  } {
    // Filter enabled strategies (already sorted by backend)
    const enabledStrategies = strategies.filter((s) => s.isEnabled);

    // If no strategies, flag is enabled by default (if globally enabled)
    if (enabledStrategies.length === 0) {
      return { enabled: true, reason: "default" };
    }

    // Evaluate each strategy (any match = enabled)
    for (const strategy of enabledStrategies) {
      const result = this.evaluateStrategy(strategy, context, flag);
      if (result) {
        return {
          enabled: true,
          reason: "strategy_match",
          matchedStrategy: strategy,
        };
      }
    }

    return { enabled: false, reason: "default" };
  }

  /**
   * Evaluate a single strategy
   */
  private evaluateStrategy(
    strategy: FeatureStrategy,
    context: EvaluationContext,
    flag: FeatureFlag,
  ): boolean {
    // Check segment constraints first (all referenced segments must pass)
    if (strategy.segments && strategy.segments.length > 0) {
      for (const segmentName of strategy.segments) {
        const segment = this.cachedSegments.get(segmentName);
        if (!segment) {
          // Segment not found in cache - skip this segment check
          this.logger.warn("Segment not found in cache", {
            segmentName,
            flagName: flag.name,
          });
          continue;
        }
        if (!segment.isActive) {
          // Inactive segment - skip
          continue;
        }
        // All segment constraints must pass
        const segmentPass = segment.constraints.every((c) =>
          this.evaluateConstraint(c, context),
        );
        if (!segmentPass) {
          return false;
        }
      }
    }

    // Check strategy constraints
    if (strategy.constraints && strategy.constraints.length > 0) {
      const allConstraintsPass = strategy.constraints.every((c) =>
        this.evaluateConstraint(c, context),
      );
      if (!allConstraintsPass) {
        return false;
      }
    }

    // Check rollout percentage
    const rollout = strategy.parameters?.rollout ?? 100;
    if (rollout < 100) {
      const stickiness = strategy.parameters?.stickiness || "default";
      const groupId = strategy.parameters?.groupId || flag.name;
      const percentage = this.calculatePercentage(context, stickiness, groupId);
      if (percentage > rollout) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a constraint
   * Supports both legacy operators (eq, neq) and new prefixed operators (str_eq, num_gt)
   */
  private evaluateConstraint(
    constraint: Constraint,
    context: EvaluationContext,
  ): boolean {
    const contextValue = this.getContextValue(constraint.contextName, context);

    if (contextValue === undefined) {
      return constraint.inverted ? true : false;
    }

    let result = false;
    const stringValue = String(contextValue);
    const compareValue = constraint.caseInsensitive
      ? stringValue.toLowerCase()
      : stringValue;
    const targetValue = constraint.value
      ? constraint.caseInsensitive
        ? constraint.value.toLowerCase()
        : constraint.value
      : "";
    const targetValues =
      constraint.values?.map((v) =>
        constraint.caseInsensitive ? v.toLowerCase() : v,
      ) || [];

    switch (constraint.operator) {
      // String operators (both legacy and prefixed)
      case "eq":
      case "str_eq":
        result = compareValue === targetValue;
        break;
      case "neq":
      case "str_neq":
        result = compareValue !== targetValue;
        break;
      case "contains":
      case "str_contains":
        result = compareValue.includes(targetValue);
        break;
      case "startsWith":
      case "str_starts_with":
        result = compareValue.startsWith(targetValue);
        break;
      case "endsWith":
      case "str_ends_with":
        result = compareValue.endsWith(targetValue);
        break;
      case "in":
      case "str_in":
        result = targetValues.includes(compareValue);
        break;
      case "notIn":
      case "str_not_in":
        result = !targetValues.includes(compareValue);
        break;
      // Number operators
      case "gt":
      case "num_gt":
        result = Number(contextValue) > Number(constraint.value);
        break;
      case "gte":
      case "num_gte":
        result = Number(contextValue) >= Number(constraint.value);
        break;
      case "lt":
      case "num_lt":
        result = Number(contextValue) < Number(constraint.value);
        break;
      case "lte":
      case "num_lte":
        result = Number(contextValue) <= Number(constraint.value);
        break;
      case "num_eq":
        result = Number(contextValue) === Number(constraint.value);
        break;
      // Boolean operators
      case "is":
      case "bool_is":
        result = Boolean(contextValue) === (constraint.value === "true");
        break;
      // Date operators
      case "after":
      case "date_gt":
        result = new Date(stringValue) > new Date(targetValue);
        break;
      case "date_gte":
        result = new Date(stringValue) >= new Date(targetValue);
        break;
      case "before":
      case "date_lt":
        result = new Date(stringValue) < new Date(targetValue);
        break;
      case "date_lte":
        result = new Date(stringValue) <= new Date(targetValue);
        break;
      // Semver operators
      case "semverEq":
      case "semver_eq":
        result = this.compareSemver(stringValue, targetValue) === 0;
        break;
      case "semverGt":
      case "semver_gt":
        result = this.compareSemver(stringValue, targetValue) > 0;
        break;
      case "semverGte":
      case "semver_gte":
        result = this.compareSemver(stringValue, targetValue) >= 0;
        break;
      case "semverLt":
      case "semver_lt":
        result = this.compareSemver(stringValue, targetValue) < 0;
        break;
      case "semverLte":
      case "semver_lte":
        result = this.compareSemver(stringValue, targetValue) <= 0;
        break;
      default:
        result = false;
    }

    return constraint.inverted ? !result : result;
  }

  /**
   * Compare semver versions
   * Returns: -1 if a < b, 0 if a === b, 1 if a > b
   */
  private compareSemver(a: string, b: string): number {
    const parseVersion = (v: string): number[] => {
      const cleaned = v.replace(/^v/, "");
      return cleaned.split(".").map((n) => parseInt(n, 10) || 0);
    };

    const aParts = parseVersion(a);
    const bParts = parseVersion(b);
    const maxLen = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLen; i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
    }
    return 0;
  }

  /**
   * Get context value by name
   */
  private getContextValue(
    name: string,
    context: EvaluationContext,
  ): string | number | boolean | undefined {
    switch (name) {
      case "userId":
        return context.userId;
      case "sessionId":
        return context.sessionId;
      case "environmentName":
        return context.environmentName;
      case "appName":
        return context.appName;
      case "appVersion":
        return context.appVersion;
      case "country":
        return context.country;
      case "city":
        return context.city;
      case "ip":
        return context.ip;
      case "userAgent":
        return context.userAgent;
      default:
        return context.properties?.[name];
    }
  }

  /**
   * Calculate a consistent percentage (0-100) based on context and stickiness
   * Uses MurmurHash3 for consistency with backend
   */
  private calculatePercentage(
    context: EvaluationContext,
    stickiness: string,
    groupId: string,
  ): number {
    let stickinessValue: string;

    switch (stickiness) {
      case "userId":
        stickinessValue =
          context.userId || context.sessionId || Math.random().toString();
        break;
      case "sessionId":
        stickinessValue =
          context.sessionId || context.userId || Math.random().toString();
        break;
      case "random":
        stickinessValue = Math.random().toString();
        break;
      default:
        stickinessValue =
          context.userId || context.sessionId || Math.random().toString();
    }

    const seed = `${groupId}:${stickinessValue}`;
    const hash = murmurhash.v3(seed);

    // Normalize to 0-100
    return (hash % 10000) / 100;
  }

  /**
   * Select a variant based on context and weights
   * Uses matched strategy's stickiness for consistent variant assignment
   * Weights are on a 0-100 scale (percentage)
   */
  private selectVariant(
    flag: FeatureFlag,
    context: EvaluationContext,
    matchedStrategy?: FeatureStrategy,
  ): Variant | undefined {
    if (!flag.variants || flag.variants.length === 0) {
      return undefined;
    }

    // Calculate total weight
    const totalWeight = flag.variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight <= 0) {
      return undefined;
    }

    // Use strategy's stickiness, fallback to 'default'
    const stickiness = matchedStrategy?.parameters?.stickiness || "default";
    const percentage = this.calculatePercentage(
      context,
      stickiness,
      `${flag.name}-variant`,
    );

    // Normalize percentage to total weight scale
    const targetWeight = (percentage / 100) * totalWeight;

    // Select variant based on cumulative weight
    let cumulativeWeight = 0;
    for (const variant of flag.variants) {
      cumulativeWeight += variant.weight;
      if (targetWeight <= cumulativeWeight) {
        return variant;
      }
    }

    // Return last variant as fallback
    return flag.variants[flag.variants.length - 1];
  }

  // ==================== Metrics Methods ====================

  /**
   * Record a flag evaluation metric
   */
  private recordMetric(
    environment: string,
    flagName: string,
    enabled: boolean,
    variantName?: string,
  ): void {
    this.metricsBuffer.push({
      environment,
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
        const envMetrics = byEnvironment.get(metric.environment) || [];
        envMetrics.push(metric);
        byEnvironment.set(metric.environment, envMetrics);
      }

      // Process each environment separately
      for (const [environment, envMetrics] of byEnvironment) {
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
          const key = `${metric.flagName}:${metric.enabled}:${metric.variantName || ""}`;
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

        this.logger.debug("Flushing feature flag metrics", {
          environment,
          rawCount: envMetrics.length,
          aggregatedCount: aggregatedMetrics.length,
        });

        // Send aggregated metrics to backend (per environment) with time window
        const bucketStop = new Date();
        await this.apiClient.post(
          `/api/v1/server/${environment}/features/metrics`,
          {
            metrics: aggregatedMetrics,
            bucket: {
              start: this.metricsBucketStartTime.toISOString(),
              stop: bucketStop.toISOString(),
            },
            // Legacy field for backward compatibility
            timestamp: bucketStop.toISOString(),
          },
        );
      }

      // Reset bucket start time for next window
      this.metricsBucketStartTime = new Date();

      this.logger.debug("Feature flag metrics sent successfully");
    } catch (error) {
      this.logger.error("Failed to flush feature flag metrics", { error });
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
   * @param environment Environment name
   * @param isEnabled Optional enabled status (if false, removes from cache)
   */
  async updateSingleFlag(
    flagName: string,
    environment: string,
    isEnabled?: boolean,
  ): Promise<void> {
    try {
      this.logger.debug("Updating single flag in cache", {
        flagName,
        environment,
        isEnabled,
      });

      // If explicitly disabled or archived, remove from cache
      if (isEnabled === false) {
        this.removeFlag(flagName, environment);
        return;
      }

      // Fetch updated flag from server
      const response = await this.apiClient.get<{ flag: FeatureFlag }>(
        `/api/v1/server/${encodeURIComponent(environment)}/features/${encodeURIComponent(flagName)}`,
      );

      if (!response.success || !response.data) {
        this.logger.debug("Flag not found or not active, removing from cache", {
          flagName,
          environment,
        });
        this.removeFlag(flagName, environment);
        return;
      }

      const updatedFlag = response.data.flag;

      // Get or create environment cache Map
      let envCache = this.cachedFlagsByEnv.get(environment);
      if (!envCache) {
        envCache = new Map<string, FeatureFlag>();
        this.cachedFlagsByEnv.set(environment, envCache);
      }

      // Add or update flag in cache (O(1))
      envCache.set(flagName, updatedFlag);
      this.logger.debug("Single flag updated in cache", {
        flagName,
        environment,
      });
    } catch (error: any) {
      this.logger.error("Failed to update single flag in cache", {
        flagName,
        environment,
        error: error.message,
      });
      // Fall back to full refresh
      await this.refreshByEnvironment(environment);
    }
  }

  /**
   * Remove a flag from cache (O(1))
   */
  removeFlag(flagName: string, environment: string): void {
    this.logger.debug("Removing flag from cache", { flagName, environment });

    const envCache = this.cachedFlagsByEnv.get(environment);
    if (envCache) {
      envCache.delete(flagName);
    }

    this.logger.debug("Flag removed from cache", { flagName, environment });
  }
}
