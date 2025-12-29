import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import logger from './config/logger';
import clientRoutes from './routes/client';
import healthRoutes from './routes/health';
import publicRoutes from './routes/public';
import { sdkManager } from './services/sdkManager';

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
  connectSrc: ["'self'"],
};

// Only add upgrade-insecure-requests for HTTPS environments
if (forceHttps) {
  cspDirectives.upgradeInsecureRequests = [];
}

app.use(
  helmet({
    contentSecurityPolicy: {
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
    logger.debug(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Use SDK HTTP metrics middleware (public scope)
// We use a lazy-initialized middleware to ensure it's created only once after the SDK is ready
let httpMetricsMiddleware: ((req: Request, res: Response, next: NextFunction) => void) | null = null;

app.use((req: Request, res: Response, next: NextFunction) => {
  if (!httpMetricsMiddleware) {
    const sdk = sdkManager.getSDK();
    if (sdk) {
      logger.info('Initializing HTTP metrics middleware');
      httpMetricsMiddleware = sdk.createHttpMetricsMiddleware({ scope: 'public' });
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
