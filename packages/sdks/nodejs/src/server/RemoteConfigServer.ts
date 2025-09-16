import axios, { AxiosInstance } from 'axios';
import { RemoteConfigOptions, UserContext, EvaluationResult, RemoteConfigTemplate, MetricsData } from '../types';
import { ConfigEvaluator, BaseSDKClient } from '../utils/ConfigEvaluator';

/**
 * Remote Config Server SDK
 * For server-side applications with enhanced security and caching
 */
export class RemoteConfigServer extends BaseSDKClient {
  private axiosInstance: AxiosInstance;
  private template: RemoteConfigTemplate | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private metricsQueue: MetricsData[] = [];
  private isInitialized: boolean = false;

  constructor(options: RemoteConfigOptions) {
    super(options);
    
    this.axiosInstance = axios.create({
      baseURL: options.apiUrl,
      timeout: this.options.timeout,
      headers: {
        'Authorization': `Bearer ${options.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Start polling for updates
    if (this.options.pollingInterval > 0) {
      this.startPolling();
    }
  }

  /**
   * Initialize the SDK and fetch initial config
   */
  async initialize(): Promise<void> {
    await this.fetchConfig();
    this.isInitialized = true;
  }

  /**
   * Get a config value with evaluation (async for server-side)
   */
  async getValue<T = any>(key: string, defaultValue: T, userContext: UserContext = {}): Promise<T> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (!this.template || !this.template.templateData.configs[key]) {
        return defaultValue;
      }

      const startTime = Date.now();
      const config = this.template.templateData.configs[key];
      const result = ConfigEvaluator.evaluate(key, config, userContext);
      const evaluationTime = Date.now() - startTime;
      
      // Queue metrics
      this.queueMetrics({
        configKey: key,
        value: result.value,
        variant: result.variant,
        userContext,
        timestamp: Date.now(),
        evaluationTime
      });

      return result.value !== undefined ? result.value : defaultValue;
    } catch (error) {
      console.error(`Error evaluating config ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Get a config value synchronously (use cached data)
   */
  getValueSync<T = any>(key: string, defaultValue: T, userContext: UserContext = {}): T {
    try {
      if (!this.template || !this.template.templateData.configs[key]) {
        return defaultValue;
      }

      const config = this.template.templateData.configs[key];
      const result = ConfigEvaluator.evaluate(key, config, userContext);
      
      // Queue metrics
      this.queueMetrics({
        configKey: key,
        value: result.value,
        variant: result.variant,
        userContext,
        timestamp: Date.now(),
        evaluationTime: 0
      });

      return result.value !== undefined ? result.value : defaultValue;
    } catch (error) {
      console.error(`Error evaluating config ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Get multiple config values
   */
  async getValues(keys: string[], userContext: UserContext = {}): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    for (const key of keys) {
      results[key] = await this.getValue(key, null, userContext);
    }
    
    return results;
  }

  /**
   * Get all config values
   */
  async getAllValues(userContext: UserContext = {}): Promise<Record<string, any>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.template) {
      return {};
    }

    const results: Record<string, any> = {};
    const configs = this.template.templateData.configs;
    
    for (const key of Object.keys(configs)) {
      results[key] = await this.getValue(key, null, userContext);
    }
    
    return results;
  }

  /**
   * Check if a feature is enabled
   */
  async isFeatureEnabled(key: string, userContext: UserContext = {}): Promise<boolean> {
    const value = await this.getValue(key, false, userContext);
    return Boolean(value);
  }

  /**
   * Check if a feature is enabled synchronously
   */
  isFeatureEnabledSync(key: string, userContext: UserContext = {}): boolean {
    const value = this.getValueSync(key, false, userContext);
    return Boolean(value);
  }

  /**
   * Get detailed evaluation result
   */
  async getEvaluationResult(key: string, userContext: UserContext = {}): Promise<EvaluationResult | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.template || !this.template.templateData.configs[key]) {
      return null;
    }

    const config = this.template.templateData.configs[key];
    return ConfigEvaluator.evaluate(key, config, userContext);
  }

  /**
   * Batch evaluate multiple configs
   */
  async batchEvaluate(keys: string[], userContext: UserContext = {}): Promise<EvaluationResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const results: EvaluationResult[] = [];
    
    for (const key of keys) {
      const result = await this.getEvaluationResult(key, userContext);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }

  /**
   * Fetch config from server
   */
  private async fetchConfig(): Promise<void> {
    try {
      const cacheKey = `server_template_${this.options.environment}`;
      const cachedEntry = this.getCache(cacheKey);
      
      const headers: any = {};
      if (cachedEntry?.etag) {
        headers['If-None-Match'] = cachedEntry.etag;
      }

      const response = await this.axiosInstance.get(
        `/api/sdk/server/config/${this.options.environment}`,
        { headers }
      );

      if (response.status === 304) {
        // Not modified, use cached version
        this.template = cachedEntry.data;
        return;
      }

      this.template = response.data;
      const etag = response.headers.etag;
      
      if (etag) {
        this.setCache(cacheKey, this.template, etag);
      }

    } catch (error: any) {
      if (error.response?.status === 304) {
        // Not modified, continue with cached version
        return;
      }
      
      console.error('Failed to fetch config:', error);
      throw error;
    }
  }

  /**
   * Start polling for config updates
   */
  private startPolling(): void {
    this.pollingTimer = setInterval(async () => {
      try {
        await this.fetchConfig();
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, this.options.pollingInterval);
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Queue metrics for batch submission
   */
  private queueMetrics(metrics: MetricsData): void {
    this.metricsQueue.push(metrics);
    
    // Auto-submit when queue reaches threshold
    if (this.metricsQueue.length >= 50) { // Higher threshold for server
      this.submitMetrics();
    }
  }

  /**
   * Submit metrics to server
   */
  async submitMetrics(): Promise<void> {
    if (this.metricsQueue.length === 0) return;

    const metrics = [...this.metricsQueue];
    this.metricsQueue = [];

    try {
      await this.axiosInstance.post('/api/sdk/metrics', {
        environment: this.options.environment,
        metrics
      });
    } catch (error) {
      console.error('Failed to submit metrics:', error);
      // Re-queue metrics on failure (with limit to prevent memory issues)
      if (this.metricsQueue.length < 1000) {
        this.metricsQueue.unshift(...metrics.slice(0, 100));
      }
    }
  }

  /**
   * Refresh config manually
   */
  async refresh(): Promise<void> {
    await this.fetchConfig();
  }

  /**
   * Get current template info
   */
  getTemplateInfo(): { version: number; etag: string; lastUpdated: string } | null {
    if (!this.template) return null;
    
    return {
      version: this.template.version,
      etag: this.template.etag,
      lastUpdated: this.template.updatedAt
    };
  }

  /**
   * Check if SDK is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.template !== null;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPolling();
    this.submitMetrics(); // Submit any pending metrics
    this.clearCache();
    this.isInitialized = false;
  }
}
