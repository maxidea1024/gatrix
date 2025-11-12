import type express from 'express';
import config from '../config';

/**
 * MetricsService for Backend (Express)
 * - No side effects on import
 * - Attaches /metrics endpoint to existing Express app
 * - Collects default Node.js metrics and basic HTTP request duration histogram
 */
export const initMetrics = (app: express.Application): void => {
  try {
    if (!config || !config as any) {
      // Config not ready; do nothing
      return;
    }

    const enabled = (config as any).monitoring?.enabled === true || String(process.env.MONITORING_ENABLED).toLowerCase() === 'true';
    if (!enabled) return;

    // Lazy require to avoid import-time side effects
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const promClient = require('prom-client');

    const register = new promClient.Registry();
    register.setDefaultLabels({ service: 'backend' });
    promClient.collectDefaultMetrics({ register });

    const httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'status_code', 'route'],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 1, 3, 5, 10],
    });

    register.registerMetric(httpRequestDuration);
    // Network I/O counters: total bytes in/out
    const requestBytesTotal = new promClient.Counter({
      name: 'http_request_bytes_in_total',
      help: 'Total incoming HTTP request bytes',
      labelNames: ['method', 'status_code', 'route'],
    });
    const responseBytesTotal = new promClient.Counter({
      name: 'http_response_bytes_out_total',
      help: 'Total outgoing HTTP response bytes',
      labelNames: ['method', 'status_code', 'route'],
    });
    register.registerMetric(requestBytesTotal);
    register.registerMetric(responseBytesTotal);

    // Request timing and I/O middleware (labels: method, status_code, route)
    app.use((req, res, next) => {
      const start = process.hrtime.bigint();
      // Capture socket I/O counters at request start to compute deltas safely with keep-alive
      const sock: any = (req as any).socket;
      const ioStart = {
        read: typeof sock?.bytesRead === 'number' ? sock.bytesRead : 0,
        written: typeof sock?.bytesWritten === 'number' ? sock.bytesWritten : 0,
      };
      (res as any)._metrics_io_start = ioStart;
      res.on('finish', () => {
        try {
          const end = process.hrtime.bigint();
          const duration = Number(end - start) / 1e9; // seconds
          const route = (req as any).route?.path || (req as any).originalUrl?.split('?')[0] || 'unknown';
          const labels = [req.method, String(res.statusCode), route] as const;
          httpRequestDuration.labels(...labels).observe(duration);
          // Compute request/response byte deltas with header fallback
          const sockNow: any = (req as any).socket;
          const ioPrev = (res as any)._metrics_io_start as { read: number; written: number } | undefined;
          const endRead = typeof sockNow?.bytesRead === 'number' ? sockNow.bytesRead : 0;
          const endWritten = typeof sockNow?.bytesWritten === 'number' ? sockNow.bytesWritten : 0;
          // Request bytes: prefer Content-Length header, otherwise socket delta
          const reqCL = (req.headers['content-length'] as string | string[] | undefined);
          let reqBytes = 0;
          if (reqCL) {
            const raw = Array.isArray(reqCL) ? reqCL[0] : reqCL;
            const parsed = parseInt(raw, 10);
            if (!Number.isNaN(parsed)) reqBytes = parsed;
          }
          if (reqBytes === 0 && ioPrev) {
            const delta = endRead - ioPrev.read;
            if (Number.isFinite(delta) && delta > 0) reqBytes = delta;
          }
          // Response bytes: prefer Content-Length header, otherwise socket delta
          const resCL: any = res.getHeader('content-length');
          let resBytes = 0;
          if (typeof resCL === 'number') resBytes = resCL;
          else if (typeof resCL === 'string') {
            const parsed = parseInt(resCL, 10);
            if (!Number.isNaN(parsed)) resBytes = parsed;
          }
          if (resBytes === 0 && ioPrev) {
            const delta = endWritten - ioPrev.written;
            if (Number.isFinite(delta) && delta > 0) resBytes = delta;
          }
          requestBytesTotal.labels(...labels).inc(reqBytes);
          responseBytesTotal.labels(...labels).inc(resBytes);
        } catch (_) {
          // swallow metrics errors
        }
      });
      next();
    });

    const metricsPath = (config as any).monitoring?.metricsPath || '/metrics';
    app.get(metricsPath, async (_req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        res.status(500).end(String(error));
      }
    });
  } catch (err) {
    // Do not crash app because of metrics init
    // eslint-disable-next-line no-console
    console.warn('[Metrics] Initialization skipped due to error:', err);
  }
};

export default { initMetrics };

