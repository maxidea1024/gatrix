import type { FastifyInstance } from 'fastify';
import config from '../config';
import os from 'os';
import { ulid } from 'ulid';

/**
 * MetricsService for Event Lens (Fastify)
 * - No side effects on import
 * - Attaches /metrics endpoint to existing Fastify app
 * - Collects default Node.js metrics and basic HTTP request duration histogram
 */
export const initMetrics = (app: FastifyInstance): void => {
  try {
    const enabled = (config as any).monitoring?.enabled === true || String(process.env.MONITORING_ENABLED).toLowerCase() === 'true';
    if (!enabled) return;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const promClient = require('prom-client');

    const register = new promClient.Registry();

    // Get instance information
    const hostname = `${os.hostname()}:${process.pid}`;
    const instanceId = ulid();

    // Get primary IP address (first non-loopback IPv4)
    const interfaces = os.networkInterfaces();
    let ip = 'unknown';
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (iface) {
        for (const addr of iface) {
          if (addr.family === 'IPv4' && !addr.internal) {
            ip = addr.address;
            break;
          }
        }
        if (ip !== 'unknown') break;
      }
    }

    register.setDefaultLabels({
      service: 'event-lens',
      instanceId,
      hostname,
      ip
    });
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

    app.addHook('onRequest', (req, reply, done) => {
      (req as any)._metrics_start = process.hrtime.bigint();
      // Capture socket I/O counters at request start
      const sock: any = (req as any).raw?.socket;
      (req as any)._metrics_io_start = {
        read: typeof sock?.bytesRead === 'number' ? sock.bytesRead : 0,
        written: typeof sock?.bytesWritten === 'number' ? sock.bytesWritten : 0,
      };

      // Wrap raw ServerResponse write/end to capture actual outbound bytes
      const res: any = reply.raw;
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
      res.write = function (chunk: any, encoding?: any, cb?: any) {
        _metrics_written_acc += countChunk(chunk, encoding);
        return originalWrite(chunk as any, encoding as any, cb);
      } as any;
      res.end = function (chunk?: any, encoding?: any, cb?: any) {
        _metrics_written_acc += countChunk(chunk, encoding);
        return originalEnd(chunk as any, encoding as any, cb);
      } as any;
      (req as any)._metrics_written_getter = () => _metrics_written_acc;

      done();
    });

    app.addHook('onResponse', (req, reply, done) => {
      try {
        const start: bigint | undefined = (req as any)._metrics_start;
        if (start) {
          const duration = Number(process.hrtime.bigint() - start) / 1e9;
          const route = (req.routerPath as any) || (req.url?.split('?')[0]) || 'unknown';
          const labels = [req.method, String(reply.statusCode), route] as const;
          httpRequestDuration.labels(...labels).observe(duration);
          // Compute request/response byte deltas with header fallback
          const sockNow: any = (req as any).raw?.socket;
          const ioPrev = (req as any)._metrics_io_start as { read: number; written: number } | undefined;
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
          const getWritten = (req as any)._metrics_written_getter as undefined | (() => number);
          const measured = typeof getWritten === 'function' ? Number(getWritten()) : 0;
          if (Number.isFinite(measured) && measured > 0) {
            resBytes = measured;
          } else {
            const resCL: any = reply.getHeader('content-length');
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
          requestBytesTotal.labels(...labels).inc(reqBytes);
          responseBytesTotal.labels(...labels).inc(resBytes);
        }
      } catch (_) {
        // ignore metrics errors
      }
      done();
    });

    const metricsPath = (config as any).monitoring?.metricsPath || '/metrics';
    app.get(metricsPath, async (_req, reply) => {
      const body = await register.metrics();
      reply.header('Content-Type', register.contentType).send(body);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[Event-Lens Metrics] Initialization skipped due to error:', err);
  }
};

export default { initMetrics };

