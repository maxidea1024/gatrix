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
import { createHash } from 'crypto';

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

    /**
     * Get variant for a feature flag
     * @param flagName Name of the flag
     * @param context Evaluation context
     * @param environment Environment name
     * @param defaultVariant Default variant if flag not found or has no variants
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
            case 'eq':
                result = compareValue === targetValue;
                break;
            case 'neq':
                result = compareValue !== targetValue;
                break;
            case 'contains':
                result = compareValue.includes(targetValue);
                break;
            case 'startsWith':
                result = compareValue.startsWith(targetValue);
                break;
            case 'endsWith':
                result = compareValue.endsWith(targetValue);
                break;
            case 'in':
                result = targetValues.includes(compareValue);
                break;
            case 'notIn':
                result = !targetValues.includes(compareValue);
                break;
            case 'gt':
                result = Number(contextValue) > Number(constraint.value);
                break;
            case 'gte':
                result = Number(contextValue) >= Number(constraint.value);
                break;
            case 'lt':
                result = Number(contextValue) < Number(constraint.value);
                break;
            case 'lte':
                result = Number(contextValue) <= Number(constraint.value);
                break;
            case 'is':
                result = Boolean(contextValue) === (constraint.value === 'true');
                break;
            // Date and semver operators would need additional implementation
            default:
                result = false;
        }

        return constraint.inverted ? !result : result;
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

        const hash = createHash('sha256')
            .update(`${groupId}:${stickinessValue}`)
            .digest('hex');

        // Use first 8 hex chars (32 bits) for percentage calculation
        const hashValue = parseInt(hash.substring(0, 8), 16);
        return (hashValue / 0xFFFFFFFF) * 100;
    }

    /**
     * Select a variant based on context and weights
     */
    private selectVariant(flag: FeatureFlag, context: EvaluationContext): Variant | undefined {
        if (!flag.variants || flag.variants.length === 0) {
            return undefined;
        }

        const stickiness = flag.variants[0].payloadType || 'default';
        const percentage = this.calculatePercentage(context, stickiness, `${flag.name}-variant`);

        // Normalize percentage to 0-1000 (weight unit)
        const normalizedValue = percentage * 10;

        let cumulativeWeight = 0;
        for (const variant of flag.variants) {
            cumulativeWeight += variant.weight;
            if (normalizedValue < cumulativeWeight) {
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
