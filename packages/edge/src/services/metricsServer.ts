import express, { Application, Request, Response } from 'express';
import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { config } from '../config/env';
import logger from '../config/logger';

// Create a separate registry for Edge metrics
const register = new Registry();

// Collect default Node.js metrics
collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestsTotal = new Counter({
  name: 'edge_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'edge_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const cacheHitsTotal = new Counter({
  name: 'edge_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
  registers: [register],
});

export const cacheMissesTotal = new Counter({
  name: 'edge_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
  registers: [register],
});

export const cacheSize = new Gauge({
  name: 'edge_cache_size',
  help: 'Current cache size',
  labelNames: ['cache_type'],
  registers: [register],
});

export const sdkInitialized = new Gauge({
  name: 'edge_sdk_initialized',
  help: 'Whether the SDK is initialized (1) or not (0)',
  registers: [register],
});

/**
 * Create and start the metrics server on a separate port
 * This server is for internal use only and should NOT be exposed externally
 */
export function startMetricsServer(): void {
  const app: Application = express();

  // Metrics endpoint
  app.get('/metrics', async (req: Request, res: Response) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      logger.error('Error generating metrics:', error);
      res.status(500).end();
    }
  });

  // Health check for metrics server
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Start server on internal metrics port
  // In Docker, bind to 0.0.0.0 to allow internal network access
  // but the port is NOT exposed to the host for security
  const bindAddress = process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0';
  app.listen(config.metricsPort, bindAddress, () => {
    logger.info(`Metrics server listening on ${bindAddress}:${config.metricsPort}`);
    if (bindAddress === '0.0.0.0') {
      logger.warn('⚠️  Metrics server is accessible within Docker network only (port not exposed externally)');
    } else {
      logger.warn('⚠️  Metrics server is bound to localhost only for security');
    }
  });
}

export { register };

