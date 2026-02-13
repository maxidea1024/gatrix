/**
 * Impact Metrics Service
 *
 * Handles:
 * 1. Receiving impact metrics from SDK and registering them into a separate prom-client Registry
 * 2. Exposing the registry for Prometheus scraping (merged with main /metrics endpoint)
 * 3. Querying Prometheus HTTP API for time-series data (for chart visualization and safeguard evaluation)
 */

import logger from '../config/logger';
import config from '../config';

// ==================== Types ====================

export interface NumericSample {
  labels: Record<string, string>;
  value: number;
}

export interface BucketSample {
  labels: Record<string, string>;
  count: number;
  sum: number;
  buckets: Array<{ le: number | '+Inf'; count: number }>;
}

export interface CollectedMetric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  samples: (NumericSample | BucketSample)[];
}

export interface ImpactMetricsTimeSeriesQuery {
  series: string; // metric name
  range: 'hour' | 'day' | 'week' | 'month';
  aggregationMode?: 'rps' | 'count' | 'avg' | 'sum' | 'p50' | 'p95' | 'p99';
  aggregationMode?: 'rps' | 'count' | 'avg' | 'sum' | 'p50' | 'p95' | 'p99';
  labels?: Record<string, string[]>;
  groupBy?: string[];
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface TimeSeriesSeries {
  metric: Record<string, string>;
  data: [number, number][]; // [timestamp, value]
}

export interface ImpactMetricsTimeSeriesResponse {
  start?: string;
  end?: string;
  step?: string;
  series: TimeSeriesSeries[];
  debug?: {
    query?: string;
    isTruncated?: boolean;
  };
}

// ==================== Metric prefix for isolation ====================
const METRIC_PREFIX = 'gatrix_impact_';

// ==================== Service ====================

class ImpactMetricsService {
  private registry: any | null = null;
  private promClient: any | null = null;
  private registeredMetrics: Map<string, any> = new Map();
  private prometheusUrl: string;

  constructor() {
    // Prometheus URL from config or env var
    this.prometheusUrl =
      process.env.PROMETHEUS_URL || (config as any).prometheus?.url || 'http://prometheus:9090';
  }

  /**
   * Initialize the impact metrics registry
   * Call this during app startup
   */
  initialize(): any | null {
    // Reload Prometheus URL in case environment loaded late or changed
    this.prometheusUrl =
      process.env.PROMETHEUS_URL || (config as any).prometheus?.url || 'http://prometheus:9090';

    try {
      const promClient = require('prom-client');
      this.promClient = promClient;
      this.registry = new promClient.Registry();

      // Set default labels
      this.registry.setDefaultLabels({
        origin: 'sdk',
      });

      logger.info('[ImpactMetrics] Registry initialized');
      return this.registry;
    } catch (error) {
      logger.warn('[ImpactMetrics] prom-client not available, metrics will be ignored');
      return null;
    }
  }

  /**
   * Get the registry for merging with main metrics endpoint
   */
  getRegistry(): any | null {
    return this.registry;
  }

  /**
   * Process impact metrics received from SDK
   * Registers/updates metrics in the impact registry
   */
  processImpactMetrics(metrics: CollectedMetric[]): void {
    if (!this.registry || !this.promClient || !metrics || metrics.length === 0) {
      return;
    }

    for (const metric of metrics) {
      try {
        const prefixedName = METRIC_PREFIX + metric.name;

        switch (metric.type) {
          case 'counter':
            this.processCounter(prefixedName, metric);
            break;
          case 'gauge':
            this.processGauge(prefixedName, metric);
            break;
          case 'histogram':
            this.processHistogram(prefixedName, metric);
            break;
          default:
            logger.warn(`[ImpactMetrics] Unknown metric type: ${metric.type}`);
        }
      } catch (error: any) {
        logger.error(`[ImpactMetrics] Failed to process metric: ${metric.name}`, {
          error: error.message,
        });
      }
    }

    logger.debug('[ImpactMetrics] Processed impact metrics', {
      count: metrics.length,
    });
  }

  /**
   * Process counter metric - counters only go up
   */
  private processCounter(name: string, metric: CollectedMetric): void {
    const numericSamples = metric.samples as NumericSample[];
    let counter = this.registeredMetrics.get(name);

    if (!counter) {
      // Collect all unique label names from samples
      const labelNames = this.extractLabelNames(numericSamples);
      counter = new this.promClient.Counter({
        name,
        help: metric.help || `Impact metric: ${metric.name}`,
        labelNames,
        registers: [this.registry],
      });
      this.registeredMetrics.set(name, counter);
    }

    for (const sample of numericSamples) {
      if (sample.value > 0) {
        counter.labels(sample.labels).inc(sample.value);
      }
    }
  }

  /**
   * Process gauge metric - can go up and down
   */
  private processGauge(name: string, metric: CollectedMetric): void {
    const numericSamples = metric.samples as NumericSample[];
    let gauge = this.registeredMetrics.get(name);

    if (!gauge) {
      const labelNames = this.extractLabelNames(numericSamples);
      gauge = new this.promClient.Gauge({
        name,
        help: metric.help || `Impact metric: ${metric.name}`,
        labelNames,
        registers: [this.registry],
      });
      this.registeredMetrics.set(name, gauge);
    }

    for (const sample of numericSamples) {
      gauge.labels(sample.labels).set(sample.value);
    }
  }

  /**
   * Process histogram metric
   */
  private processHistogram(name: string, metric: CollectedMetric): void {
    const bucketSamples = metric.samples as BucketSample[];
    let histogram = this.registeredMetrics.get(name);

    if (!histogram) {
      // Extract bucket boundaries from first sample
      const firstSample = bucketSamples[0];
      const buckets = firstSample
        ? firstSample.buckets
            .map((b) => (b.le === '+Inf' ? Infinity : (b.le as number)))
            .filter((b) => b !== Infinity)
        : [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

      const labelNames = this.extractLabelNames(bucketSamples);
      histogram = new this.promClient.Histogram({
        name,
        help: metric.help || `Impact metric: ${metric.name}`,
        labelNames,
        buckets,
        registers: [this.registry],
      });
      this.registeredMetrics.set(name, histogram);
    }

    for (const sample of bucketSamples) {
      // Observe each data point
      // For cumulative histograms from SDK, we extract the average value
      if (sample.count > 0) {
        const avgValue = sample.sum / sample.count;
        // Observe multiple times to approximate the original distribution
        for (let i = 0; i < sample.count; i++) {
          histogram.labels(sample.labels).observe(avgValue);
        }
      }
    }
  }

  /**
   * Extract unique label names from samples
   */
  private extractLabelNames(samples: (NumericSample | BucketSample)[]): string[] {
    const labelNameSet = new Set<string>();
    for (const sample of samples) {
      if (sample.labels) {
        for (const key of Object.keys(sample.labels)) {
          labelNameSet.add(key);
        }
      }
    }
    return Array.from(labelNameSet);
  }

  // ==================== Prometheus Query API ====================

  /**
   * Query Prometheus for time-series data
   * Used for chart visualization and safeguard evaluation
   */
  async queryTimeSeries(
    query: ImpactMetricsTimeSeriesQuery
  ): Promise<ImpactMetricsTimeSeriesResponse> {
    const { series, range, aggregationMode, labels, groupBy } = query;

    // Build PromQL query
    // If the metric name does not start with gatrix_impact_, assume it's a raw prometheus metric
    const metricName = series.startsWith(METRIC_PREFIX) ? series : series; // Logic changed: do not force prefix
    // Actually, let's keep the prefix logic consistent. If the user selects a metric from the list, it might or might not have the prefix.
    // The getAvailableMetrics will return names. If we are using internal registry, we strip prefix.
    // If we are using Prometheus, we use the full name.
    // Let's rely on the frontend passing the correct name.

    // However, existing code prepends METRIC_PREFIX.
    // We should detect if it already has the prefix or not, or if we should prepend it.
    // For now, let's assume if we are allowing ANY prometheus metric, we shouldn't force prefix.

    const promqlQuery = this.buildPromQL(series, aggregationMode, labels, range, groupBy);

    // Calculate time range
    const end = Math.floor(Date.now() / 1000);
    const rangeSeconds = this.getRangeSeconds(range);
    const start = end - rangeSeconds;
    const step = this.getStepSeconds(range);

    try {
      // Query Prometheus range API
      const url = new URL(`${this.prometheusUrl}/api/v1/query_range`);
      url.searchParams.set('query', promqlQuery);
      url.searchParams.set('start', String(start));
      url.searchParams.set('end', String(end));
      url.searchParams.set('step', String(step));

      const response = await fetch(url.toString());
      const data: any = await response.json();

      if (data.status !== 'success') {
        logger.error('[ImpactMetrics] Prometheus query failed', {
          query: promqlQuery,
          error: data.error,
        });
        return { series: [], debug: { query: promqlQuery } };
      }

      // Transform Prometheus response to our format
      const result = data.data?.result || [];
      const transformedSeries: TimeSeriesSeries[] = result.map((r: any) => ({
        metric: r.metric || {},
        data: (r.values || []).map((v: any) => [Number(v[0]), parseFloat(v[1])]),
      }));

      return {
        start: String(start),
        end: String(end),
        step: String(step),
        series: transformedSeries,
        debug: { query: promqlQuery, isTruncated: transformedSeries.length > 50 },
      };
    } catch (error: any) {
      logger.error('[ImpactMetrics] Prometheus query error', {
        query: promqlQuery,
        error: error.message,
      });
      return { series: [], debug: { query: promqlQuery } };
    }
  }

  /**
   * Query Prometheus for a single instant value (for safeguard evaluation)
   */
  async queryInstant(
    metricName: string,
    aggregationMode?: string,
    labels?: Record<string, string[]>,
    timeRange?: string
  ): Promise<number | null> {
    // For instant query, we also shouldn't force prefix if we want to support generic metrics
    // But for safeguards, we usually look at internal impact metrics.
    // Let's check if it starts with the prefix.
    const effectiveName = metricName.startsWith(METRIC_PREFIX)
      ? metricName
      : METRIC_PREFIX + metricName;
    // Wait, if I change getAvailableMetrics to return full names, then I shouldn't prepend prefix blindly.

    const promqlQuery = this.buildPromQL(
      effectiveName,
      aggregationMode,
      labels,
      timeRange || 'hour'
    );

    try {
      const url = new URL(`${this.prometheusUrl}/api/v1/query`);
      url.searchParams.set('query', promqlQuery);

      const response = await fetch(url.toString());
      const data: any = await response.json();

      if (data.status !== 'success' || !data.data?.result?.length) {
        return null;
      }

      // Get the first result's value
      const firstResult = data.data.result[0];
      const value = parseFloat(firstResult.value?.[1] || '0');
      return isNaN(value) ? null : value;
    } catch (error: any) {
      logger.error('[ImpactMetrics] Prometheus instant query error', {
        query: promqlQuery,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get available labels for a specific metric
   */
  async getMetricLabels(metricName: string): Promise<string[]> {
    try {
      // Query series to find available labels
      // Use a short time range to avoid heavy query, or just use instant lookup via series
      const end = Math.floor(Date.now() / 1000);
      const start = end - 3600; // Look back 1 hour

      const url = new URL(`${this.prometheusUrl}/api/v1/series`);
      url.searchParams.set('match[]', metricName);
      url.searchParams.set('start', String(start));
      url.searchParams.set('end', String(end));

      const response = await fetch(url.toString());
      const data: any = await response.json();

      if (data.status === 'success' && Array.isArray(data.data)) {
        const labelKeys = new Set<string>();
        for (const series of data.data) {
          for (const key of Object.keys(series)) {
            if (key !== '__name__') {
              labelKeys.add(key);
            }
          }
        }
        return Array.from(labelKeys).sort();
      }
      return [];
    } catch (error) {
      logger.error('[ImpactMetrics] Failed to fetch metric labels:', error);
      return [];
    }
  }

  /**
   * Get available metric names from the impact registry
   */
  /**
   * Get available metric names from Prometheus
   */
  async getAvailableMetrics(): Promise<Array<{ name: string; help: string; type: string }>> {
    try {
      // 1. Fetch metadata from Prometheus for all metrics
      const url = new URL(`${this.prometheusUrl}/api/v1/metadata`);
      const response = await fetch(url.toString());
      const data: any = await response.json();

      if (data.status === 'success' && data.data) {
        const metrics: Array<{ name: string; help: string; type: string }> = [];
        for (const [name, metadata] of Object.entries(data.data)) {
          const meta = (metadata as any[])[0] || {};
          metrics.push({
            name,
            help: meta.help || '',
            type: meta.type || 'unknown',
          });
        }
        return metrics.sort((a, b) => a.name.localeCompare(b.name));
      }
    } catch (error) {
      logger.warn(
        '[ImpactMetrics] Failed to fetch metrics from Prometheus, falling back to local registry',
        error
      );
    }

    // Fallback: Return local registry metrics
    const metricsList: Array<{ name: string; help: string; type: string }> = [];
    for (const [name, metric] of this.registeredMetrics) {
      metricsList.push({
        name, // Return full name
        help: (metric as any).help || '',
        type: this.getMetricType(metric),
      });
    }
    return metricsList;
  }

  /**
   * Get current metric values snapshot from the registry.
   * Works without Prometheus — reads current values directly from prom-client.
   */
  async getMetricsSnapshot(): Promise<
    Array<{
      name: string;
      help: string;
      type: string;
      values: Array<{ labels: Record<string, string>; value: number }>;
    }>
  > {
    const snapshot: Array<{
      name: string;
      help: string;
      type: string;
      values: Array<{ labels: Record<string, string>; value: number }>;
    }> = [];

    for (const [name, metric] of this.registeredMetrics) {
      const type = this.getMetricType(metric);
      const metricData = await (metric as any).get();
      const values: Array<{ labels: Record<string, string>; value: number }> = [];

      if (metricData && metricData.values) {
        for (const v of metricData.values) {
          // For histograms, skip bucket/sum/count internal entries
          if (type === 'histogram' && v.metricName && v.metricName !== name) {
            continue;
          }
          values.push({
            labels: v.labels || {},
            value: v.value ?? 0,
          });
        }
      }

      snapshot.push({
        name: name.replace(METRIC_PREFIX, ''),
        help: (metric as any).help || '',
        type,
        values,
      });
    }

    return snapshot;
  }

  /**
   * Build PromQL query based on parameters
   */
  private buildPromQL(
    metricName: string,
    aggregationMode?: string,
    labels?: Record<string, string[]>,
    range?: string,
    groupBy?: string[]
  ): string {
    // Build label selector
    let labelSelector = '';
    if (labels && Object.keys(labels).length > 0) {
      const labelParts: string[] = [];
      for (const [key, values] of Object.entries(labels)) {
        if (values.length === 1) {
          labelParts.push(`${key}="${values[0]}"`);
        } else if (values.length > 1) {
          labelParts.push(`${key}=~"${values.join('|')}"`);
        }
      }
      labelSelector = `{${labelParts.join(',')}}`;
    }

    const rangeStr = this.getRangeString(range || 'hour');

    // Build query based on aggregation mode
    // Base query
    let query = '';
    const byClause = groupBy && groupBy.length > 0 ? ` by (${groupBy.join(',')})` : '';

    // Prepend prefix if not present and not a rate/increase function call (simple heuristic)
    // If metricName already has "gatrix_" or looks like a system metric, use it as is.
    // Just use metricName as passed.

    switch (aggregationMode) {
      case 'rps':
        query = `rate(${metricName}${labelSelector}[${rangeStr}])`;
        if (byClause) query = `sum${byClause}(${query})`;
        break;
      case 'avg':
        query = `avg_over_time(${metricName}${labelSelector}[${rangeStr}])`;
        if (byClause) query = `avg${byClause}(${query})`;
        break;
      case 'sum':
        query = `increase(${metricName}${labelSelector}[${rangeStr}])`;
        if (byClause) query = `sum${byClause}(${query})`;
        break;
      case 'p50':
        // For histograms, we need to aggregate by le and groupBy
        // sum by (le, ...groupBy) (rate(...))
        const histBy = groupBy && groupBy.length ? `, ${groupBy.join(',')}` : '';
        query = `histogram_quantile(0.50, sum by (le${histBy}) (rate(${metricName}_bucket${labelSelector}[${rangeStr}])))`;
        break;
      case 'p95':
        const histBy95 = groupBy && groupBy.length ? `, ${groupBy.join(',')}` : '';
        query = `histogram_quantile(0.95, sum by (le${histBy95}) (rate(${metricName}_bucket${labelSelector}[${rangeStr}])))`;
        break;
      case 'p99':
        const histBy99 = groupBy && groupBy.length ? `, ${groupBy.join(',')}` : '';
        query = `histogram_quantile(0.99, sum by (le${histBy99}) (rate(${metricName}_bucket${labelSelector}[${rangeStr}])))`;
        break;
      case 'count':
      default:
        query = `increase(${metricName}${labelSelector}[${rangeStr}])`;
        if (byClause) query = `sum${byClause}(${query})`;
        break;
    }

    return query;
  }

  private getRangeSeconds(range: string): number {
    switch (range) {
      case 'hour':
        return 3600;
      case 'day':
        return 86400;
      case 'week':
        return 604800;
      case 'month':
        return 2592000;
      default:
        return 3600;
    }
  }

  private getStepSeconds(range: string): number {
    switch (range) {
      case 'hour':
        return 15; // 15s step for 1h
      case 'day':
        return 300; // 5min step for 1 day
      case 'week':
        return 1800; // 30min step for 1 week
      case 'month':
        return 7200; // 2h step for 1 month
      default:
        return 60;
    }
  }

  private getRangeString(range: string): string {
    switch (range) {
      case 'hour':
        return '5m'; // Smallest useful aggregation window
      case 'day':
        return '1h';
      case 'week':
        return '6h';
      case 'month':
        return '1d';
      default:
        return '5m';
    }
  }

  private getMetricType(metric: any): string {
    if (!metric) return 'unknown';
    const constructor = metric.constructor?.name?.toLowerCase() || '';
    if (constructor.includes('counter')) return 'counter';
    if (constructor.includes('gauge')) return 'gauge';
    if (constructor.includes('histogram')) return 'histogram';
    return 'unknown';
  }
}

export const impactMetricsService = new ImpactMetricsService();
