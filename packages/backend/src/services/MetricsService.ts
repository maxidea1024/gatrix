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

      // Wrap write/end to measure actual outbound bytes written (post-compression)
      const originalWrite = (res.write as any).bind(res);
      const originalEnd = (res.end as any).bind(res);
      let _metrics_written_acc = 0;
      const countChunk = (chunk: any, encoding?: any): number => {
        try {
          if (!chunk) return 0;
          if (Buffer.isBuffer(chunk)) return chunk.length;
          if (typeof chunk === 'string') return Buffer.byteLength(chunk, encoding || 'utf8');
        } catch (_) {
          // ignore
        }
        return 0;
      };
      (res as any).write = function (chunk: any, encoding?: any, cb?: any) {
        _metrics_written_acc += countChunk(chunk, encoding);
        return originalWrite(chunk as any, encoding as any, cb);
      } as any;
      (res as any).end = function (chunk?: any, encoding?: any, cb?: any) {
        _metrics_written_acc += countChunk(chunk, encoding);
        return originalEnd(chunk as any, encoding as any, cb);
      } as any;

      let _metrics_bytes_recorded = false; // guard to avoid double counting when using compression/keep-alive


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
          // Response bytes: prefer measured written bytes, then Content-Length, otherwise socket delta
          let resBytes = 0;
          if (_metrics_written_acc > 0) {
            resBytes = _metrics_written_acc;
          } else {
            const resCL: any = res.getHeader('content-length');
            if (typeof resCL === 'number') resBytes = resCL;
            else if (typeof resCL === 'string') {
              const parsed = parseInt(resCL, 10);
              if (!Number.isNaN(parsed)) resBytes = parsed;
            }
            if (resBytes === 0 && ioPrev) {
              const delta = endWritten - ioPrev.written;
              if (Number.isFinite(delta) && delta > 0) resBytes = delta;
            }
          }
          // Always inc to ensure series is created even when bytes are 0; only set recorded flag if > 0
          requestBytesTotal.labels(...labels).inc(Math.max(0, reqBytes));
          if (reqBytes > 0) { _metrics_bytes_recorded = true; }
          responseBytesTotal.labels(...labels).inc(Math.max(0, resBytes));
          if (resBytes > 0) { _metrics_bytes_recorded = true; }
        } catch (_) {
          // swallow metrics errors
        }
      });

      // Fallback: when using compression + keep-alive, socket.bytesWritten may update after 'finish'
      res.on('close', () => {
        try {
          if (_metrics_bytes_recorded) return;
          const sockNow: any = (req as any).socket;
          const ioPrev = (res as any)._metrics_io_start as { read: number; written: number } | undefined;
          const route = (req as any).route?.path || (req as any).originalUrl?.split('?')[0] || 'unknown';
          const labels = [req.method, String(res.statusCode), route] as const;
          if (ioPrev) {
            const endRead = typeof sockNow?.bytesRead === 'number' ? sockNow.bytesRead : 0;
            const endWritten = typeof sockNow?.bytesWritten === 'number' ? sockNow.bytesWritten : 0;
            const dReq = endRead - ioPrev.read;
            const dRes = endWritten - ioPrev.written;
            if (Number.isFinite(dReq) && dReq > 0) { requestBytesTotal.labels(...labels).inc(dReq); _metrics_bytes_recorded = true; }
            if (Number.isFinite(dRes) && dRes > 0) { responseBytesTotal.labels(...labels).inc(dRes); _metrics_bytes_recorded = true; }
          }
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

