/**
 * HTTP Metrics Middleware for Express
 * Track request duration, throughput and status codes
 */

import { Request, Response, NextFunction } from 'express';

export type HttpMetricsOptions = {
    registry: any; // prom-client Registry
    prefix?: string; // Optional metric name prefix (default: 'app_')
    scope?: string; // Optional scope label (e.g., 'private', 'public')
    buckets?: number[]; // Custom duration buckets
};

/**
 * Create an HTTP metrics middleware for Express
 * Registers 'http_request_duration_seconds' and 'http_requests_total'
 */
export function createHttpMetricsMiddleware(options: HttpMetricsOptions) {
    const { registry, prefix = 'app_', scope = 'default', buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] } = options;
    const promClient = require('prom-client');

    const name = `${prefix}http_request_duration_seconds`;
    const counterName = `${prefix}http_requests_total`;

    const labelNames = ['method', 'route', 'status', 'scope'];

    // Check existing metrics first to avoid duplicate registration
    let httpRequestDuration = registry.getSingleMetric(name);
    let httpRequestsTotal = registry.getSingleMetric(counterName);

    // Register Histogram for latency (only if not already registered)
    if (!httpRequestDuration) {
        try {
            httpRequestDuration = new promClient.Histogram({
                name,
                help: 'Duration of HTTP requests in seconds',
                labelNames,
                buckets,
                registers: [registry],
            });
        } catch (_err) {
            // If creation failed, it might have been created by another call.
            httpRequestDuration = registry.getSingleMetric(name);
        }
    }

    // Register Counter for throughput (only if not already registered)
    if (!httpRequestsTotal) {
        try {
            httpRequestsTotal = new promClient.Counter({
                name: counterName,
                help: 'Total number of HTTP requests',
                labelNames,
                registers: [registry],
            });
        } catch (_err) {
            httpRequestsTotal = registry.getSingleMetric(counterName);
        }
    }

    // Final safety check: if we still don't have the metrics, create dummy ones
    // This happens only if something is really wrong (e.g. incompatible types in registry)
    if (!httpRequestDuration) httpRequestDuration = { observe: () => { } };
    if (!httpRequestsTotal) httpRequestsTotal = { inc: () => { } };

    return (req: Request, res: Response, next: NextFunction) => {
        const start = process.hrtime();

        res.on('finish', () => {
            const duration = process.hrtime(start);
            const durationSeconds = duration[0] + duration[1] / 1e9;

            const route = req.route ? req.route.path : req.path;
            const labels = {
                method: req.method,
                route: route || 'unknown',
                status: res.statusCode,
                scope,
            };

            try {
                httpRequestDuration.observe(labels, durationSeconds);
                httpRequestsTotal.inc(labels);
            } catch (_err) {
                // Silently catch registration/label errors
            }
        });

        next();
    };
}
