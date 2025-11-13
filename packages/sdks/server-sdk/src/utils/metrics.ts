/**
 * Lightweight metrics helpers to attach Prometheus metrics to web frameworks.
 * No side effects at import-time. Uses lazy require of prom-client.
 */

export type ExpressMetricsOptions = {
  enabled?: boolean;
  metricsPath?: string;
  histogramBuckets?: number[];
  // Optional custom registry to register metrics into
  // If not provided, a new Registry will be created internally
  registry?: any;
};

export type FastifyMetricsOptions = ExpressMetricsOptions;

/** Attach metrics to an Express app */
export function attachExpressMetrics(app: any, opts: ExpressMetricsOptions = {}): void {
  try {
    const enabledEnv = String(process.env.MONITORING_ENABLED || '').toLowerCase() === 'true';
    if (!opts.enabled && !enabledEnv) return;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const promClient = require('prom-client');
    const register = opts.registry || new promClient.Registry();
    promClient.collectDefaultMetrics({ register });

    const buckets = opts.histogramBuckets || [0.005, 0.01, 0.05, 0.1, 0.3, 1, 3, 5, 10];
    const httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'status_code', 'route'],
      buckets,
    });
    register.registerMetric(httpRequestDuration);

    app.use((req: any, res: any, next: any) => {
      const start = process.hrtime.bigint();
      res.on('finish', () => {
        try {
          const duration = Number(process.hrtime.bigint() - start) / 1e9;
          const route = req?.route?.path || req?.originalUrl?.split('?')[0] || 'unknown';
          httpRequestDuration.labels(req.method, String(res.statusCode), route).observe(duration);
        } catch (_) {}
      });
      next();
    });

    const path = opts.metricsPath || process.env.METRICS_PATH || '/metrics';
    app.get(path, async (_req: any, res: any) => {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[SDK] attachExpressMetrics skipped due to error:', err);
  }
}

/** Attach metrics to a Fastify app */
export function attachFastifyMetrics(app: any, opts: FastifyMetricsOptions = {}): void {
  try {
    const enabledEnv = String(process.env.MONITORING_ENABLED || '').toLowerCase() === 'true';
    if (!opts.enabled && !enabledEnv) return;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const promClient = require('prom-client');
    const register = opts.registry || new promClient.Registry();
    promClient.collectDefaultMetrics({ register });

    const buckets = opts.histogramBuckets || [0.005, 0.01, 0.05, 0.1, 0.3, 1, 3, 5, 10];
    const httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'status_code', 'route'],
      buckets,
    });
    register.registerMetric(httpRequestDuration);

    app.addHook('onRequest', (req: any, _reply: any, done: any) => {
      req._metrics_start = process.hrtime.bigint();
      done();
    });

    app.addHook('onResponse', (req: any, reply: any, done: any) => {
      try {
        const start: bigint | undefined = req._metrics_start;
        if (start) {
          const duration = Number(process.hrtime.bigint() - start) / 1e9;
          const route = req.routerPath || (req.url?.split('?')[0]) || 'unknown';
          httpRequestDuration.labels(req.method, String(reply.statusCode), route).observe(duration);
        }
      } catch (_) {}
      done();
    });

    const path = opts.metricsPath || process.env.METRICS_PATH || '/metrics';
    app.get(path, async (_req: any, reply: any) => {
      const body = await register.metrics();
      reply.header('Content-Type', register.contentType).send(body);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[SDK] attachFastifyMetrics skipped due to error:', err);
  }
}

