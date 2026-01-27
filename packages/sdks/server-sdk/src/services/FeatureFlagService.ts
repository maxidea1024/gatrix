/**
 * Feature Flag Service
 * Handles feature flag retrieval and evaluation
 * Uses per-environment API pattern: GET /api/v1/server/:env/features
 *
 * DESIGN PRINCIPLES:
 * - All methods that access cached data MUST receive environment explicitly
 * - Environment resolution is delegated to EnvironmentResolver
 * - Evaluations are performed locally using cached flags
 * - Metrics are batched and sent periodically
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { EnvironmentResolver } from '../utils/EnvironmentResolver';
import {
    FeatureFlag,
    EvaluationContext,
    EvaluationResult,
    Variant,
    FeatureStrategy,
    Constraint,
    FlagMetric,
} from '../types/featureFlags';
import murmurhash from 'murmurhash';

export class FeatureFlagService {
    private apiClient: ApiClient;
    private logger: Logger;
    private envResolver: EnvironmentResolver;
    // Multi-environment cache: Map<environment, FeatureFlag[]>
    private cachedFlagsByEnv: Map<string, FeatureFlag[]> = new Map();
    // Metrics buffer for batching
    private metricsBuffer: FlagMetric[] = [];
    private metricsFlushInterval: NodeJS.Timeout | null = null;
    // Whether this feature is enabled
    private featureEnabled: boolean = true;

    constructor(apiClient: ApiClient, logger: Logger, envResolver: EnvironmentResolver) {
        this.apiClient = apiClient;
        this.logger = logger;
        this.envResolver = envResolver;
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
     * @param flushIntervalMs Interval in milliseconds to flush metrics (default: 60000)
     */
    startMetricsCollection(flushIntervalMs: number = 60000): void {
        if (this.metricsFlushInterval) {
            clearInterval(this.metricsFlushInterval);
        }
        this.metricsFlushInterval = setInterval(() => {
            this.flushMetrics();
        }, flushIntervalMs);
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
     */
    async listByEnvironment(environment: string): Promise<FeatureFlag[]> {
        const endpoint = `/api/v1/server/${encodeURIComponent(environment)}/features`;

        this.logger.debug('Fetching feature flags', { environment });

        const response = await this.apiClient.get<{ flags: FeatureFlag[] }>(endpoint);

        if (!response.success || !response.data) {
            throw new Error(response.error?.message || 'Failed to fetch feature flags');
        }

        const { flags } = response.data;
        this.cachedFlagsByEnv.set(environment, flags);

        this.logger.info('Feature flags fetched', { count: flags.length, environment });

        return flags;
    }

    /**
     * Refresh cached flags for a specific environment
     */
    async refreshByEnvironment(environment: string): Promise<FeatureFlag[]> {
        if (!this.featureEnabled) {
            this.logger.warn('FeatureFlagService.refreshByEnvironment() called but feature is disabled', { environment });
        }
        this.logger.info('Refreshing feature flags cache', { environment });
        return await this.listByEnvironment(environment);
    }

    /**
     * Get cached flags
     * @param environment Environment name (required)
     */
    getCached(environment: string): FeatureFlag[] {
        return this.cachedFlagsByEnv.get(environment) || [];
    }

    /**
     * Get all cached flags (all environments)
     */
    getAllCached(): Map<string, FeatureFlag[]> {
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
    clearCacheForEnvironment(environment: string): void {
        this.cachedFlagsByEnv.delete(environment);
        this.logger.debug('Feature flags cache cleared for environment', { environment });
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
        defaultValue: boolean = false
    ): boolean {
        const result = this.evaluate(flagName, context, environment);
        if (result.reason === 'not_found') {
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
        defaultValue: boolean = false
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
        defaultValue: boolean = false
    ): { value: boolean; reason: EvaluationResult['reason']; flagName: string } {
        const result = this.evaluate(flagName, context, environment);
        return {
            value: result.reason === 'not_found' ? defaultValue : result.enabled,
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
        defaultValue: string = ''
    ): string {
        const result = this.evaluate(flagName, context, environment);
        if (!result.enabled || !result.variant?.payload) {
            return defaultValue;
        }
        return String(result.variant.payload.value ?? result.variant.payload ?? defaultValue);
    }

    /**
     * Get string variation with evaluation details
     */
    stringVariationDetail(
        flagName: string,
        context: EvaluationContext,
        environment: string,
        defaultValue: string = ''
    ): { value: string; reason: EvaluationResult['reason']; flagName: string; variantName?: string } {
        const result = this.evaluate(flagName, context, environment);
        const value = (!result.enabled || !result.variant?.payload)
            ? defaultValue
            : String(result.variant.payload.value ?? result.variant.payload ?? defaultValue);
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
        defaultValue: number = 0
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
        defaultValue: number = 0
    ): { value: number; reason: EvaluationResult['reason']; flagName: string; variantName?: string } {
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
        defaultValue: T
    ): T {
        const result = this.evaluate(flagName, context, environment);
        if (!result.enabled || !result.variant?.payload) {
            return defaultValue;
        }
        const rawValue = result.variant.payload.value ?? result.variant.payload;
        if (typeof rawValue === 'object') {
            return rawValue as T;
        }
        if (typeof rawValue === 'string') {
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
        defaultValue: T
    ): { value: T; reason: EvaluationResult['reason']; flagName: string; variantName?: string } {
        const result = this.evaluate(flagName, context, environment);
        let value = defaultValue;
        if (result.enabled && result.variant?.payload) {
            const rawValue = result.variant.payload.value ?? result.variant.payload;
            if (typeof rawValue === 'object') {
                value = rawValue as T;
            } else if (typeof rawValue === 'string') {
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
        defaultVariant?: Variant
    ): Variant | undefined {
        const result = this.evaluate(flagName, context, environment);
        if (result.reason === 'not_found' || !result.variant) {
            return defaultVariant;
        }
        return result.variant;
    }

    /**
     * Evaluate a feature flag
     * @param flagName Name of the flag
     * @param context Evaluation context
     * @param environment Environment name
     */
    evaluate(flagName: string, context: EvaluationContext, environment: string): EvaluationResult {
        const flags = this.getCached(environment);
        const flag = flags.find(f => f.name === flagName);

        if (!flag) {
            return {
                flagName,
                enabled: false,
                reason: 'not_found',
            };
        }

        // If flag is globally disabled
        if (!flag.isEnabled) {
            this.recordMetric(environment, flagName, false);
            return {
                flagName,
                enabled: false,
                reason: 'disabled',
            };
        }

        // Evaluate strategies
        const strategyResult = this.evaluateStrategies(flag.strategies, context, flag);

        if (strategyResult.enabled) {
            // Select variant if applicable
            const variant = this.selectVariant(flag, context);
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
     */
    private evaluateStrategies(
        strategies: FeatureStrategy[],
        context: EvaluationContext,
        flag: FeatureFlag
    ): { enabled: boolean; reason: EvaluationResult['reason'] } {
        // Sort by sortOrder and filter enabled strategies
        const enabledStrategies = strategies
            .filter(s => s.isEnabled)
            .sort((a, b) => a.sortOrder - b.sortOrder);

        // If no strategies, flag is enabled by default (if globally enabled)
        if (enabledStrategies.length === 0) {
            return { enabled: true, reason: 'default' };
        }

        // Evaluate each strategy (any match = enabled)
        for (const strategy of enabledStrategies) {
            const result = this.evaluateStrategy(strategy, context, flag);
            if (result) {
                return { enabled: true, reason: 'strategy_match' };
            }
        }

        return { enabled: false, reason: 'default' };
    }

    /**
     * Evaluate a single strategy
     */
    private evaluateStrategy(strategy: FeatureStrategy, context: EvaluationContext, flag: FeatureFlag): boolean {
        // Check constraints
        if (strategy.constraints && strategy.constraints.length > 0) {
            const allConstraintsPass = strategy.constraints.every(c => this.evaluateConstraint(c, context));
            if (!allConstraintsPass) {
                return false;
            }
        }

        // Check rollout percentage
        const rollout = strategy.parameters?.rollout ?? 100;
        if (rollout < 100) {
            const stickiness = strategy.parameters?.stickiness || 'default';
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
    private evaluateConstraint(constraint: Constraint, context: EvaluationContext): boolean {
        const contextValue = this.getContextValue(constraint.contextName, context);

        if (contextValue === undefined) {
            return constraint.inverted ? true : false;
        }

        let result = false;
        const stringValue = String(contextValue);
        const compareValue = constraint.caseInsensitive ? stringValue.toLowerCase() : stringValue;
        const targetValue = constraint.value ? (constraint.caseInsensitive ? constraint.value.toLowerCase() : constraint.value) : '';
        const targetValues = constraint.values?.map(v => constraint.caseInsensitive ? v.toLowerCase() : v) || [];

        switch (constraint.operator) {
            // String operators (both legacy and prefixed)
            case 'eq':
            case 'str_eq':
                result = compareValue === targetValue;
                break;
            case 'neq':
            case 'str_neq':
                result = compareValue !== targetValue;
                break;
            case 'contains':
            case 'str_contains':
                result = compareValue.includes(targetValue);
                break;
            case 'startsWith':
            case 'str_starts_with':
                result = compareValue.startsWith(targetValue);
                break;
            case 'endsWith':
            case 'str_ends_with':
                result = compareValue.endsWith(targetValue);
                break;
            case 'in':
            case 'str_in':
                result = targetValues.includes(compareValue);
                break;
            case 'notIn':
            case 'str_not_in':
                result = !targetValues.includes(compareValue);
                break;
            // Number operators
            case 'gt':
            case 'num_gt':
                result = Number(contextValue) > Number(constraint.value);
                break;
            case 'gte':
            case 'num_gte':
                result = Number(contextValue) >= Number(constraint.value);
                break;
            case 'lt':
            case 'num_lt':
                result = Number(contextValue) < Number(constraint.value);
                break;
            case 'lte':
            case 'num_lte':
                result = Number(contextValue) <= Number(constraint.value);
                break;
            case 'num_eq':
                result = Number(contextValue) === Number(constraint.value);
                break;
            // Boolean operators
            case 'is':
            case 'bool_is':
                result = Boolean(contextValue) === (constraint.value === 'true');
                break;
            // Date operators
            case 'after':
            case 'date_gt':
                result = new Date(stringValue) > new Date(targetValue);
                break;
            case 'date_gte':
                result = new Date(stringValue) >= new Date(targetValue);
                break;
            case 'before':
            case 'date_lt':
                result = new Date(stringValue) < new Date(targetValue);
                break;
            case 'date_lte':
                result = new Date(stringValue) <= new Date(targetValue);
                break;
            // Semver operators
            case 'semverEq':
            case 'semver_eq':
                result = this.compareSemver(stringValue, targetValue) === 0;
                break;
            case 'semverGt':
            case 'semver_gt':
                result = this.compareSemver(stringValue, targetValue) > 0;
                break;
            case 'semverGte':
            case 'semver_gte':
                result = this.compareSemver(stringValue, targetValue) >= 0;
                break;
            case 'semverLt':
            case 'semver_lt':
                result = this.compareSemver(stringValue, targetValue) < 0;
                break;
            case 'semverLte':
            case 'semver_lte':
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
            const cleaned = v.replace(/^v/, '');
            return cleaned.split('.').map(n => parseInt(n, 10) || 0);
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
    private getContextValue(name: string, context: EvaluationContext): string | number | boolean | undefined {
        switch (name) {
            case 'userId': return context.userId;
            case 'sessionId': return context.sessionId;
            case 'environmentName': return context.environmentName;
            case 'appName': return context.appName;
            case 'appVersion': return context.appVersion;
            case 'country': return context.country;
            case 'city': return context.city;
            case 'ip': return context.ip;
            case 'userAgent': return context.userAgent;
            default:
                return context.properties?.[name];
        }
    }

    /**
     * Calculate a consistent percentage (0-100) based on context and stickiness
     * Uses MurmurHash3 for consistency with backend
     */
    private calculatePercentage(context: EvaluationContext, stickiness: string, groupId: string): number {
        let stickinessValue: string;

        switch (stickiness) {
            case 'userId':
                stickinessValue = context.userId || context.sessionId || Math.random().toString();
                break;
            case 'sessionId':
                stickinessValue = context.sessionId || context.userId || Math.random().toString();
                break;
            case 'random':
                stickinessValue = Math.random().toString();
                break;
            default:
                stickinessValue = context.userId || context.sessionId || Math.random().toString();
        }

        const seed = `${groupId}:${stickinessValue}`;
        const hash = murmurhash.v3(seed);

        // Normalize to 0-100
        return (hash % 10000) / 100;
    }

    /**
     * Select a variant based on context and weights
     * Weights are on a 0-100 scale (percentage)
     */
    private selectVariant(flag: FeatureFlag, context: EvaluationContext): Variant | undefined {
        if (!flag.variants || flag.variants.length === 0) {
            return undefined;
        }

        // Use stickiness from first variant, or 'default' as fallback
        const stickiness = flag.variants[0].stickiness || 'default';
        const percentage = this.calculatePercentage(context, stickiness, `${flag.name}-variant`);

        // Weights are on 0-100 scale, percentage is also 0-100
        let cumulativeWeight = 0;
        for (const variant of flag.variants) {
            cumulativeWeight += variant.weight;
            if (percentage <= cumulativeWeight) {
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
    private recordMetric(environment: string, flagName: string, enabled: boolean, variantName?: string): void {
        this.metricsBuffer.push({
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
     */
    private async flushMetrics(): Promise<void> {
        if (this.metricsBuffer.length === 0) {
            return;
        }

        const metricsToSend = [...this.metricsBuffer];
        this.metricsBuffer = [];

        try {
            // Send batched metrics - this would be implemented when needed
            this.logger.debug('Flushing feature flag metrics', { count: metricsToSend.length });
            // TODO: Implement actual metrics sending to backend
            // await this.apiClient.post('/api/v1/server/features/metrics', { metrics: metricsToSend });
        } catch (error) {
            this.logger.error('Failed to flush feature flag metrics', { error });
            // Re-add failed metrics back to buffer
            this.metricsBuffer.unshift(...metricsToSend);
        }
    }

    // ==================== Cache Update Methods ====================

    /**
     * Update a single flag in cache
     * @param flagName Flag name
     * @param environment Environment name
     * @param isEnabled Optional enabled status (if false, removes from cache)
     */
    async updateSingleFlag(flagName: string, environment: string, isEnabled?: boolean): Promise<void> {
        try {
            this.logger.debug('Updating single flag in cache', { flagName, environment, isEnabled });

            // If explicitly disabled or archived, remove from cache
            if (isEnabled === false) {
                this.removeFlag(flagName, environment);
                return;
            }

            // Fetch updated flag from server
            const response = await this.apiClient.get<{ flag: FeatureFlag }>(
                `/api/v1/server/${encodeURIComponent(environment)}/features/${encodeURIComponent(flagName)}`
            );

            if (!response.success || !response.data) {
                this.logger.debug('Flag not found or not active, removing from cache', { flagName, environment });
                this.removeFlag(flagName, environment);
                return;
            }

            const updatedFlag = response.data.flag;
            const currentFlags = this.cachedFlagsByEnv.get(environment) || [];
            const existsInCache = currentFlags.some(f => f.name === flagName);

            if (existsInCache) {
                // Update existing flag
                const newFlags = currentFlags.map(f => f.name === flagName ? updatedFlag : f);
                this.cachedFlagsByEnv.set(environment, newFlags);
                this.logger.debug('Single flag updated in cache', { flagName, environment });
            } else {
                // Add new flag
                const newFlags = [...currentFlags, updatedFlag];
                this.cachedFlagsByEnv.set(environment, newFlags);
                this.logger.debug('Single flag added to cache', { flagName, environment });
            }
        } catch (error: any) {
            this.logger.error('Failed to update single flag in cache', { flagName, environment, error: error.message });
            // Fall back to full refresh
            await this.refreshByEnvironment(environment);
        }
    }

    /**
     * Remove a flag from cache
     */
    removeFlag(flagName: string, environment: string): void {
        this.logger.debug('Removing flag from cache', { flagName, environment });

        const currentFlags = this.cachedFlagsByEnv.get(environment) || [];
        const newFlags = currentFlags.filter(f => f.name !== flagName);
        this.cachedFlagsByEnv.set(environment, newFlags);

        this.logger.debug('Flag removed from cache', { flagName, environment });
    }
}
