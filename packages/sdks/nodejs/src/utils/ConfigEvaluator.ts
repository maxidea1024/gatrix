import { ConfigItem, ConfigVariant, TargetingCondition, UserContext, EvaluationResult } from '../types';

/**
 * Base SDK Client - Common functionality for both client and server SDKs
 */
export abstract class BaseSDKClient {
  protected options: any;
  protected cache: Map<string, any> = new Map();
  protected lastFetch: number = 0;

  constructor(options: any) {
    this.options = {
      pollingInterval: 30000,
      timeout: 5000,
      retryAttempts: 3,
      enableCache: true,
      cacheTimeout: 300000,
      ...options
    };
  }

  /**
   * Check if cache is valid
   */
  protected isCacheValid(key: string): boolean {
    if (!this.options.enableCache) return false;

    const entry = this.cache.get(key);
    if (!entry) return false;

    return Date.now() < entry.expiresAt;
  }

  /**
   * Set cache entry
   */
  protected setCache(key: string, data: any, etag: string): void {
    if (!this.options.enableCache) return;

    this.cache.set(key, {
      data,
      etag,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.options.cacheTimeout
    });
  }

  /**
   * Get cache entry
   */
  protected getCache(key: string): any {
    if (!this.options.enableCache) return null;
    return this.cache.get(key);
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Config Evaluator - Handles config evaluation logic
 */
export class ConfigEvaluator {
  /**
   * Evaluate a config item for a given user context
   */
  static evaluate(
    key: string,
    config: ConfigItem,
    userContext: UserContext = {}
  ): EvaluationResult {
    try {
      // Check if config has variants
      if (config.variants && config.variants.length > 0) {
        const variantResult = this.evaluateVariants(key, config, userContext);
        if (variantResult) {
          return variantResult;
        }
      }

      // Check targeting conditions
      if (config.conditions && config.conditions.length > 0) {
        const conditionsMet = this.evaluateConditions(config.conditions, userContext);
        if (conditionsMet) {
          return {
            key,
            value: config.value.value,
            reason: 'targeting'
          };
        }
      }

      // Return default config value
      return {
        key,
        value: config.value.value,
        reason: 'config'
      };
    } catch (error) {
      return {
        key,
        value: config.value.defaultValue,
        reason: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Evaluate variants for a config
   */
  private static evaluateVariants(
    key: string,
    config: ConfigItem,
    userContext: UserContext
  ): EvaluationResult | null {
    if (!config.variants || config.variants.length === 0) {
      return null;
    }

    // Filter variants that match targeting conditions
    const eligibleVariants = config.variants.filter(variant => {
      if (!variant.conditions || variant.conditions.length === 0) {
        return true;
      }
      return this.evaluateConditions(variant.conditions, userContext);
    });

    if (eligibleVariants.length === 0) {
      return null;
    }

    // Select variant based on weight distribution
    const selectedVariant = this.selectVariantByWeight(eligibleVariants, userContext.userId || '');
    
    return {
      key,
      value: selectedVariant.value.value,
      variant: selectedVariant.name,
      reason: 'variant'
    };
  }

  /**
   * Select variant based on weight distribution
   */
  private static selectVariantByWeight(variants: ConfigVariant[], userId: string): ConfigVariant {
    // Normalize weights
    const totalWeight = variants.reduce((sum, variant) => sum + variant.weight, 0);
    
    if (totalWeight === 0) {
      return variants[0];
    }

    // Create a deterministic hash based on userId
    const hash = this.hashString(userId);
    const normalizedHash = hash % 100; // 0-99

    let cumulativeWeight = 0;
    for (const variant of variants) {
      cumulativeWeight += (variant.weight / totalWeight) * 100;
      if (normalizedHash < cumulativeWeight) {
        return variant;
      }
    }

    return variants[variants.length - 1];
  }

  /**
   * Evaluate targeting conditions
   */
  private static evaluateConditions(conditions: TargetingCondition[], userContext: UserContext): boolean {
    return conditions.every(condition => this.evaluateCondition(condition, userContext));
  }

  /**
   * Evaluate a single targeting condition
   */
  private static evaluateCondition(condition: TargetingCondition, userContext: UserContext): boolean {
    const contextValue = this.getContextValue(condition.field, userContext);
    const conditionValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return contextValue === conditionValue;
      
      case 'not_equals':
        return contextValue !== conditionValue;
      
      case 'contains':
        return typeof contextValue === 'string' && contextValue.includes(conditionValue);
      
      case 'not_contains':
        return typeof contextValue === 'string' && !contextValue.includes(conditionValue);
      
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(contextValue);
      
      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(contextValue);
      
      case 'greater_than':
        return typeof contextValue === 'number' && contextValue > conditionValue;
      
      case 'less_than':
        return typeof contextValue === 'number' && contextValue < conditionValue;
      
      case 'regex':
        try {
          const regex = new RegExp(conditionValue);
          return typeof contextValue === 'string' && regex.test(contextValue);
        } catch {
          return false;
        }
      
      default:
        return false;
    }
  }

  /**
   * Get value from user context by field path
   */
  private static getContextValue(field: string, userContext: UserContext): any {
    if (field.includes('.')) {
      const parts = field.split('.');
      let value: any = userContext;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      return value;
    }
    
    return (userContext as any)[field];
  }

  /**
   * Simple hash function for consistent variant selection
   */
  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
