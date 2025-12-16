import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import logger from './config/logger';
import clientRoutes from './routes/client';
import healthRoutes from './routes/health';
import publicRoutes from './routes/public';
import { httpRequestsTotal, httpRequestDuration } from './services/metricsServer';

// Create Express application
const app: Application = express();

// Disable ETag for API responses to prevent browser caching issues
// SDK cache is the source of truth, so we don't want browsers to use stale cached responses
app.set('etag', false);

// Check if HTTPS is enforced (for HTTP environments, disable HSTS and related headers)
const forceHttps = process.env.EDGE_FORCE_HTTPS !== 'false';

// Security middleware
// Configure helmet with relaxed CSP for static HTML pages that use inline scripts
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for game webview pages
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
        imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        fontSrc: ["'self'", 'https:', 'http:', 'data:'],
        connectSrc: ["'self'"],
      },
    },
    // Disable HTTPS-related headers for HTTP environments
    hsts: forceHttps, // HTTP Strict Transport Security
    crossOriginOpenerPolicy: forceHttps ? { policy: 'same-origin' } : false,
    crossOriginEmbedderPolicy: false, // Disable to allow loading external resources
    originAgentCluster: false, // Disable to avoid origin-keying issues in HTTP
  })
);

// CORS configuration
app.use(cors({
  origin: '*', // Edge server accepts requests from any origin
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'x-api-token',
    'x-application-name',
    'x-environment-id',
    'x-client-version',
    'x-platform',
  ],
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging and metrics middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const durationSeconds = duration / 1000;

    // Use originalUrl to get the full path including router mount point
    const normalizedPath = normalizePath(req.originalUrl);

    // Record metrics
    httpRequestsTotal.inc({
      method: req.method,
      path: normalizedPath,
      status: res.statusCode.toString(),
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        path: normalizedPath,
        status: res.statusCode.toString(),
      },
      durationSeconds
    );

    logger.debug(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

/**
 * Normalize path for metrics to avoid high cardinality
 * e.g., /api/v1/client/versions -> /api/v1/client/versions
 */
function normalizePath(url: string): string {
  // Remove query strings
  const basePath = url.split('?')[0];

  // For now, just return the base path
  // Add more normalization rules as needed (e.g., replace IDs with :id)
  return basePath;
}

// Health check routes (no auth required)
app.use('/health', healthRoutes);

// Public API routes (no auth required - for game webview pages)
app.use('/public', publicRoutes);

// Client API routes
app.use('/api/v1/client', clientRoutes);

// Static files for game webview pages (served from public folder)
app.use(express.static(path.join(__dirname, '../public')));

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});

export default app;

