import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import logger from './config/logger';
import clientRoutes from './routes/client';
import serverRoutes from './routes/server';
import healthRoutes from './routes/health';
import publicRoutes from './routes/public';
import { sdkManager } from './services/sdkManager';
import { requestStats } from './services/requestStats';

// Create Express application
const app: Application = express();

// Disable ETag for API responses to prevent browser caching issues
// SDK cache is the source of truth, so we don't want browsers to use stale cached responses
app.set('etag', false);

// Check if HTTPS is enforced (for HTTP environments, disable HSTS and related headers)
const forceHttps = process.env.EDGE_FORCE_HTTPS !== 'false';

// Security middleware
// Configure helmet with relaxed CSP for static HTML pages that use inline scripts
const cspDirectives: Record<string, string[] | null | undefined> = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for game webview pages
  styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
  imgSrc: ["'self'", 'data:', 'https:', 'http:'],
  fontSrc: ["'self'", 'https:', 'http:', 'data:'],
  connectSrc: ["'self'", '*'], // Allow connecting to any API (important for SDKs)
};

// Only add upgrade-insecure-requests for HTTPS environments
if (forceHttps) {
  cspDirectives.upgradeInsecureRequests = [];
}

app.use(
  helmet({
    contentSecurityPolicy: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      directives: cspDirectives as any,
    },
    // Disable HTTPS-related headers for HTTP environments
    hsts: forceHttps, // HTTP Strict Transport Security
    crossOriginOpenerPolicy: forceHttps ? { policy: 'same-origin' as const } : false,
    crossOriginEmbedderPolicy: false, // Disable to allow loading external resources
    originAgentCluster: false, // Disable to avoid origin-keying issues in HTTP
  })
);

// CORS configuration
app.use(
  cors({
    origin: '*', // Edge server accepts requests from any origin
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'If-None-Match',
      'x-api-token',
      'x-application-name',
      'x-environment',
      'x-sdk-version',
      'x-client-version',
      'x-platform',
      'x-connection-id',
      'x-session-id',
      'x-gatrix-feature-context',
    ],
    exposedHeaders: ['ETag'],
  })
);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request statistics and rate-limited logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const bytesReceived = parseInt(req.headers['content-length'] || '0', 10);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const bytesSent = parseInt((res.getHeader('content-length') as string) || '0', 10);

    // Normalize path for stats (remove dynamic segments like IDs)
    const path =
      req.route?.path || req.path.replace(/\/[0-9a-f-]{36}/gi, '/:id').replace(/\/\d+/g, '/:id');

    // Record stats and check if should log (rate limited)
    const shouldLog = requestStats.record(
      req.method,
      path,
      res.statusCode,
      duration,
      bytesSent,
      bytesReceived
    );

    // Rate-limited logging
    if (shouldLog) {
      logger.debug(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Use SDK HTTP metrics middleware (public scope)
// We use a lazy-initialized middleware to ensure it's created only once after the SDK is ready
let httpMetricsMiddleware: ((req: Request, res: Response, next: NextFunction) => void) | null =
  null;

app.use((req: Request, res: Response, next: NextFunction) => {
  if (!httpMetricsMiddleware) {
    const sdk = sdkManager.getSDK();
    if (sdk) {
      logger.info('Initializing HTTP metrics middleware');
      httpMetricsMiddleware = sdk.createHttpMetricsMiddleware({
        scope: 'public',
      });
    }
  }

  if (httpMetricsMiddleware) {
    return httpMetricsMiddleware(req, res, next);
  }
  next();
});

// Health check routes (no auth required)
app.use('/health', healthRoutes);

// Public API routes (no auth required - for game webview pages)
app.use('/public', publicRoutes);

// Client API routes
app.use('/api/v1/client', clientRoutes);

// Server API routes
app.use('/api/v1/server', serverRoutes);

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
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
