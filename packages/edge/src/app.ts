import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config/env';
import { createLogger } from './config/logger';

const logger = createLogger('EdgeApp');
import clientRoutes from './routes/client';
import serverRoutes from './routes/server';
import healthRoutes from './routes/health';
import publicRoutes from './routes/public';
import { sdkManager } from './services/sdk-manager';
import { requestStats } from './services/request-stats';
import { ALLOWED_HEADERS } from './constants/headers';
import { createRateLimiter } from './middleware/rate-limiter';
import { createIpFilter } from './middleware/ip-filter';
import { createETagMiddleware } from './middleware/etag';

// Create Express application
const app: Application = express();

// Disable Express built-in ETag (we use our own ETag middleware)
app.set('etag', false);

// Check if HTTPS is enforced (for HTTP environments, disable HSTS and related headers)
const forceHttps = process.env.EDGE_FORCE_HTTPS !== 'false';

// Security middleware
// Configure helmet with relaxed CSP for static HTML pages that use inline scripts
// NOTE: upgrade-insecure-requests is NOT set here - it's handled per-request below
const cspDirectives: Record<string, string[] | null | undefined> = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for game webview pages
  styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
  imgSrc: ["'self'", 'data:', 'https:', 'http:'],
  fontSrc: ["'self'", 'https:', 'http:', 'data:'],
  connectSrc: ["'self'", '*'], // Allow connecting to any API (important for SDKs)
  // Explicitly disable upgrade-insecure-requests (helmet enables it by default!)
  // It's conditionally re-added per-request below only for actual HTTPS connections
  upgradeInsecureRequests: null,
};

app.use(
  helmet({
    contentSecurityPolicy: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      directives: cspDirectives as any,
    },
    // Disable HTTPS-related headers for HTTP environments
    hsts: forceHttps, // HTTP Strict Transport Security
    crossOriginOpenerPolicy: forceHttps
      ? { policy: 'same-origin' as const }
      : false,
    crossOriginEmbedderPolicy: false, // Disable to allow loading external resources
    originAgentCluster: false, // Disable to avoid origin-keying issues in HTTP
  })
);

// Per-request CSP: add upgrade-insecure-requests ONLY for actual HTTPS requests
// This prevents HTTP WebView (e.g. UE4 game client) from being blocked
app.use((req: Request, res: Response, next: NextFunction) => {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (forceHttps && isHttps) {
    const existingCsp = res.getHeader('content-security-policy');
    if (typeof existingCsp === 'string') {
      res.setHeader(
        'content-security-policy',
        existingCsp + '; upgrade-insecure-requests'
      );
    }
  }
  next();
});

// CORS configuration (origin configurable via EDGE_CORS_ORIGIN)
const corsOriginConfig = config.security.corsOrigin;
app.use(
  cors({
    origin:
      corsOriginConfig === '*'
        ? '*'
        : corsOriginConfig.includes(',')
          ? corsOriginConfig.split(',').map((s) => s.trim())
          : corsOriginConfig,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ALLOWED_HEADERS,
    exposedHeaders: ['ETag'],
  })
);

// Security middleware: IP filter (deny list checked first)
app.use(createIpFilter(config.security.allowIps, config.security.denyIps));

// Security middleware: Rate limiter
app.use(createRateLimiter(config.security.rateLimitRps));

// ETag caching middleware (compute ETag, support If-None-Match for 304)
app.use(createETagMiddleware());

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request statistics and rate-limited logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const bytesReceived = parseInt(req.headers['content-length'] || '0', 10);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const bytesSent = parseInt(
      (res.getHeader('content-length') as string) || '0',
      10
    );

    // Normalize path for stats (remove dynamic segments like IDs)
    const path =
      req.route?.path ||
      req.path.replace(/\/[0-9a-f-]{36}/gi, '/:id').replace(/\/\d+/g, '/:id');

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
      logger.debug(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
      );
    }
  });
  next();
});

// Use SDK HTTP metrics middleware (public scope)
// We use a lazy-initialized middleware to ensure it's created only once after the SDK is ready
let httpMetricsMiddleware:
  | ((req: Request, res: Response, next: NextFunction) => void)
  | null = null;

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
