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

    // Register Histogram for latency
    const httpRequestDuration = new promClient.Histogram({
        name,
        help: 'Duration of HTTP requests in seconds',
        labelNames,
        buckets,
        registers: [registry],
    });

    // Register Counter for throughput
    const httpRequestsTotal = new promClient.Counter({
        name: counterName,
        help: 'Total number of HTTP requests',
        labelNames,
        registers: [registry],
    });

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
