import axios, { AxiosInstance } from 'axios';
import { RemoteConfigOptions, UserContext, EvaluationResult, RemoteConfigTemplate, MetricsData } from '../types';
import { ConfigEvaluator, BaseSDKClient } from '../utils/ConfigEvaluator';

/**
 * Remote Config Client SDK
 * For client-side applications (web, mobile)
 */
export class RemoteConfigClient extends BaseSDKClient {
  private axiosInstance: AxiosInstance;
  private template: RemoteConfigTemplate | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private metricsQueue: MetricsData[] = [];

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
  }

  /**
   * Get a config value with evaluation
   */
  getValue<T = any>(key: string, defaultValue: T, userContext: UserContext = {}): T {
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
        evaluationTime: 0 // Client-side evaluation is instant
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
  getValues(keys: string[], userContext: UserContext = {}): Record<string, any> {
    const results: Record<string, any> = {};
    
    for (const key of keys) {
      results[key] = this.getValue(key, null, userContext);
    }
    
    return results;
  }

  /**
   * Get all config values
   */
  getAllValues(userContext: UserContext = {}): Record<string, any> {
    if (!this.template) {
      return {};
    }

    const results: Record<string, any> = {};
    const configs = this.template.templateData.configs;
    
    for (const key of Object.keys(configs)) {
      results[key] = this.getValue(key, null, userContext);
    }
    
    return results;
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(key: string, userContext: UserContext = {}): boolean {
    const value = this.getValue(key, false, userContext);
    return Boolean(value);
  }

  /**
   * Get detailed evaluation result
   */
  getEvaluationResult(key: string, userContext: UserContext = {}): EvaluationResult | null {
    if (!this.template || !this.template.templateData.configs[key]) {
      return null;
    }

    const config = this.template.templateData.configs[key];
    return ConfigEvaluator.evaluate(key, config, userContext);
  }

  /**
   * Fetch config from server
   */
  private async fetchConfig(): Promise<void> {
    try {
      const cacheKey = `client_template_${this.options.environment}`;
      const cachedEntry = this.getCache(cacheKey);
      
      const headers: any = {};
      if (cachedEntry?.etag) {
        headers['If-None-Match'] = cachedEntry.etag;
      }

      const response = await this.axiosInstance.get(
        `/api/sdk/client/config/${this.options.environment}`,
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
    if (this.metricsQueue.length >= 10) {
      this.submitMetrics();
    }
  }

  /**
   * Submit metrics to server
   */
  async submitMetrics(): Promise<void> {
    if (this.metricsQueue.length === 0) return;

    try {
      const metrics = [...this.metricsQueue];
      this.metricsQueue = [];

      await this.axiosInstance.post('/api/sdk/metrics', {
        environment: this.options.environment,
        metrics
      });
    } catch (error) {
      console.error('Failed to submit metrics:', error);
      // Re-queue metrics on failure
      this.metricsQueue.unshift(...this.metricsQueue);
    }
  }

  /**
   * Refresh config manually
   */
  async refresh(): Promise<void> {
    await this.fetchConfig();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPolling();
    this.submitMetrics(); // Submit any pending metrics
    this.clearCache();
  }
}
