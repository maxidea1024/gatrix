/**
 * Impact Metrics API
 *
 * High-level API for defining and recording impact metrics.
 * Application code uses this to track counters, gauges, and histograms
 * that can be used for release flow safeguard evaluation.
 */

import { Logger } from '../utils/logger';
import type {
    ImpactMetricRegistry,
    MetricLabels,
} from './metric-types';

export interface ImpactMetricsStaticContext {
    appName: string;
    environment: string;
    service?: string;
}

export class MetricsAPI {
    constructor(
        private metricRegistry: ImpactMetricRegistry,
        private staticContext: ImpactMetricsStaticContext,
        private logger: Logger,
    ) { }

    // Define a counter metric
    defineCounter(name: string, help: string): void {
        if (!name || !help) {
            this.logger.warn(`[ImpactMetrics] Counter name or help cannot be empty: ${name}, ${help}`);
            return;
        }
        this.metricRegistry.counter({ name, help, labelNames: ['appName', 'environment', 'service'] });
    }

    // Define a gauge metric
    defineGauge(name: string, help: string): void {
        if (!name || !help) {
            this.logger.warn(`[ImpactMetrics] Gauge name or help cannot be empty: ${name}, ${help}`);
            return;
        }
        this.metricRegistry.gauge({ name, help, labelNames: ['appName', 'environment', 'service'] });
    }

    // Define a histogram metric
    defineHistogram(name: string, help: string, buckets?: number[]): void {
        if (!name || !help) {
            this.logger.warn(`[ImpactMetrics] Histogram name or help cannot be empty: ${name}, ${help}`);
            return;
        }
        this.metricRegistry.histogram({
            name,
            help,
            labelNames: ['appName', 'environment', 'service'],
            buckets: buckets || [10, 25, 50, 100, 200, 500, 1000, 2000, 5000],
        });
    }

    // Increment a counter
    incrementCounter(name: string, value?: number, extraLabels?: MetricLabels): void {
        const counter = this.metricRegistry.getCounter(name);
        if (!counter) {
            this.logger.warn(`[ImpactMetrics] Counter ${name} not defined, will not increment.`);
            return;
        }
        counter.inc(value, { ...this.staticContext, ...extraLabels });
    }

    // Update a gauge value
    updateGauge(name: string, value: number, extraLabels?: MetricLabels): void {
        const gauge = this.metricRegistry.getGauge(name);
        if (!gauge) {
            this.logger.warn(`[ImpactMetrics] Gauge ${name} not defined, will not update.`);
            return;
        }
        gauge.set(value, { ...this.staticContext, ...extraLabels });
    }

    // Observe a histogram value
    observeHistogram(name: string, value: number, extraLabels?: MetricLabels): void {
        const histogram = this.metricRegistry.getHistogram(name);
        if (!histogram) {
            this.logger.warn(`[ImpactMetrics] Histogram ${name} not defined, will not observe.`);
            return;
        }
        histogram.observe(value, { ...this.staticContext, ...extraLabels });
    }
}
