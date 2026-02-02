/**
 * HTTP Metrics Middleware for Express
 * Track request duration, throughput and status codes
 */

import { Request, Response, NextFunction } from "express";

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
  const {
    registry,
    prefix = "game_",
    scope = "default",
    buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  } = options;
  const promClient = require("prom-client");

  const name = `${prefix}request_duration_seconds`;
  const counterName = `${prefix}requests_total`;

  const labelNames = ["method", "handler", "status", "scope"];

  // Helper function to safely get or create a metric
  const getOrCreateHistogram = (
    mName: string,
    mHelp: string,
    mLabelNames: string[],
    mBuckets: number[],
  ) => {
    try {
      const existing = registry.getSingleMetric(mName);
      if (existing) return existing;
      return new promClient.Histogram({
        name: mName,
        help: mHelp,
        labelNames: mLabelNames,
        buckets: mBuckets,
        registers: [registry],
      });
    } catch (_err) {
      // If it failed, it might already exist but getSingleMetric failed for some reason
      return registry.getSingleMetric(mName);
    }
  };

  const getOrCreateCounter = (
    mName: string,
    mHelp: string,
    mLabelNames: string[],
  ) => {
    try {
      const existing = registry.getSingleMetric(mName);
      if (existing) return existing;
      return new promClient.Counter({
        name: mName,
        help: mHelp,
        labelNames: mLabelNames,
        registers: [registry],
      });
    } catch (_err) {
      return registry.getSingleMetric(mName);
    }
  };

  // Register Histogram for latency
  const httpRequestDuration = getOrCreateHistogram(
    name,
    "Duration of HTTP requests in seconds",
    labelNames,
    buckets,
  );

  // Register Counter for throughput
  const httpRequestsTotal = getOrCreateCounter(
    counterName,
    "Total number of HTTP requests",
    labelNames,
  );

  // Final safety check: if we still don't have the metrics, create dummy ones
  const safeDuration = httpRequestDuration || {
    observe: () => {},
    labels: () => ({ observe: () => {} }),
  };
  const safeCounter = httpRequestsTotal || {
    inc: () => {},
    labels: () => ({ inc: () => {} }),
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime();

    res.on("finish", () => {
      try {
        const duration = process.hrtime(start);
        const durationSeconds = duration[0] + duration[1] / 1e9;

        // Priority: req.route.path (Express route) > req.path (literal path)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const route = req.route
          ? (req.route.path as string)
          : req.path || "/unknown";

        const labels = {
          method: String(req.method || "GET"),
          handler: String(route),
          status: String(res.statusCode || 0),
          scope: String(scope),
        };

        // Use proper label ordering for counter/histogram
        // In v14+, labels can be passed as an object to .observe() or .inc()
        // or as positional arguments to .labels()
        if (
          typeof (safeDuration as any).observe === "function" &&
          typeof (safeDuration as any).labels !== "function"
        ) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          (safeDuration as any).observe(labels, durationSeconds);
        } else if (typeof (safeDuration as any).labels === "function") {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          (safeDuration as any)
            .labels(labels.method, labels.handler, labels.status, labels.scope)
            .observe(durationSeconds);
        }

        if (
          typeof (safeCounter as any).inc === "function" &&
          typeof (safeCounter as any).labels !== "function"
        ) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          (safeCounter as any).inc(labels);
        } else if (typeof (safeCounter as any).labels === "function") {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          (safeCounter as any)
            .labels(labels.method, labels.handler, labels.status, labels.scope)
            .inc();
        }
      } catch (_err) {
        // Ignore errors inside the finishing event to prevent request failures
      }
    });

    next();
  };
}
