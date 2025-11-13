/**
 * SDK internal metrics helper
 * - No side effects at import time; prom-client is required lazily
 * - Allows passing a custom registry from the host app to merge HTTP + SDK metrics
 */

export type SdkMetricsOptions = {
  enabled?: boolean;
  applicationName?: string;
  registry?: any; // prom-client Registry (typed as any to avoid hard dep on types)
};

export class SdkMetrics {
  private enabled: boolean;
  private registry: any | undefined;
  private client: any | undefined;

  private cacheRefreshCounter: any | undefined;
  private cacheRefreshDuration: any | undefined;
  private lastRefreshGauge: any | undefined;
  private eventsReceivedCounter: any | undefined;
  private eventsPublishedCounter: any | undefined;
  private redisConnectedGauge: any | undefined;
  private redisReconnectsCounter: any | undefined;
  private errorsCounter: any | undefined;

  // HTTP client metrics
  private httpRequestsCounter: any | undefined;
  private httpRequestDuration: any | undefined;

  constructor(opts: SdkMetricsOptions = {}) {
    this.enabled = opts.enabled !== false;

    if (!this.enabled) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const promClient = require('prom-client');
      this.client = promClient;
      this.registry = opts.registry || new promClient.Registry();

      // Default labels to help multi-instance setups
      this.registry.setDefaultLabels({
        sdk: 'gatrix-server-sdk',
        application: opts.applicationName || 'unknown',
      });

      // Core metrics
      this.cacheRefreshCounter = new promClient.Counter({
        name: 'sdk_cache_refresh_total',
        help: 'Total number of cache refresh operations',
        labelNames: ['target'],
        registers: [this.registry],
      });

      this.cacheRefreshDuration = new promClient.Histogram({
        name: 'sdk_cache_refresh_duration_seconds',
        help: 'Duration of cache refresh operations in seconds',
        labelNames: ['target'],
        buckets: [0.05, 0.1, 0.3, 1, 3, 5, 10],
        registers: [this.registry],
      });

      this.lastRefreshGauge = new promClient.Gauge({
        name: 'sdk_cache_last_refresh_timestamp_seconds',
        help: 'Unix timestamp of the last successful cache refresh',
        labelNames: ['target'],
        registers: [this.registry],
      });

      this.eventsReceivedCounter = new promClient.Counter({
        name: 'sdk_events_received_total',
        help: 'Total number of SDK events received',
        labelNames: ['type'],
        registers: [this.registry],
      });

      this.eventsPublishedCounter = new promClient.Counter({
        name: 'sdk_events_published_total',
        help: 'Total number of SDK events published',
        labelNames: ['type'],
        registers: [this.registry],
      });

      this.redisConnectedGauge = new promClient.Gauge({
        name: 'sdk_redis_connected',
        help: 'Redis connection state (1 connected, 0 disconnected)',
        registers: [this.registry],
      });

      this.redisReconnectsCounter = new promClient.Counter({
        name: 'sdk_redis_reconnect_total',
        help: 'Total number of Redis reconnect occurrences',
        registers: [this.registry],
      });

      this.errorsCounter = new promClient.Counter({
        name: 'sdk_errors_total',
        help: 'Total number of SDK errors',
        labelNames: ['scope', 'op'],
        registers: [this.registry],
      });

      // HTTP client metrics
      this.httpRequestsCounter = new promClient.Counter({
        name: 'sdk_http_requests_total',
        help: 'Total number of HTTP requests made by the SDK ApiClient',
        labelNames: ['method', 'route', 'status'],
        registers: [this.registry],
      });

      this.httpRequestDuration = new promClient.Histogram({
        name: 'sdk_http_request_duration_seconds',
        help: 'Duration of HTTP requests made by the SDK ApiClient in seconds',
        labelNames: ['method', 'route', 'status'],
        buckets: [0.05, 0.1, 0.3, 1, 3, 5, 10],
        registers: [this.registry],
      });
    } catch (_) {
      this.enabled = false;
    }
  }

  getRegistry(): any | undefined {
    return this.registry;
  }

  incRefresh(target: string): void {
    try { this.cacheRefreshCounter?.labels(target).inc(); } catch (_) {}
  }

  observeRefresh(target: string, durationSeconds: number): void {
    try { this.cacheRefreshDuration?.labels(target).observe(durationSeconds); } catch (_) {}
  }

  setLastRefresh(target: string, date: Date = new Date()): void {
    try { this.lastRefreshGauge?.labels(target).set(Math.floor(date.getTime() / 1000)); } catch (_) {}
  }

  incEventReceived(type: string): void {
    try { this.eventsReceivedCounter?.labels(type).inc(); } catch (_) {}
  }

  incEventPublished(type: string): void {
    try { this.eventsPublishedCounter?.labels(type).inc(); } catch (_) {}
  }

  setRedisConnected(connected: boolean): void {
    try { this.redisConnectedGauge?.set(connected ? 1 : 0); } catch (_) {}
  }

  incRedisReconnect(): void {
    try { this.redisReconnectsCounter?.inc(); } catch (_) {}
  }

  incError(scope: string, op: string = 'unknown'): void {
    try { this.errorsCounter?.labels(scope, op).inc(); } catch (_) {}
  }
}

