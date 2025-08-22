import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import ConnectRedis from 'connect-redis';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import redisClient from './config/redis';
import passport from './config/passport';
import swaggerSpec from './config/swagger';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { generalLimiter, apiLimiter, authLimiter } from './middleware/rateLimiter';
import { responseCache, cacheConfigs } from './middleware/responseCache';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import adminRoutes from './routes/admin';
import uploadRoutes from './routes/upload';
import gameWorldRoutes from './routes/gameWorlds';
import whitelistRoutes from './routes/whitelist';
import clientVersionRoutes from './routes/clientVersionRoutes';
import auditLogRoutes from './routes/auditLogs';
// import advancedSettingsRoutes from './routes/advancedSettings';

const app = express();

// Disable "Powered by Express" header
app.disable('x-powered-by');

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
}));

// Compression middleware
app.use(compression() as any);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing middleware
app.use(cookieParser() as any);

// Request logging
app.use(requestLogger);

// Rate limiting
app.use(generalLimiter as any);
app.use('/api', apiLimiter as any);

// Session configuration with Redis store
const RedisStore = (ConnectRedis as any)(session);
app.use(session({
  store: new RedisStore({
    client: redisClient.getClient(),
    prefix: 'gate:session:',
    ttl: config.session.ttl, // TTL in seconds for Redis
  }),
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset TTL on each request
  cookie: {
    secure: config.nodeEnv === 'production',
    httpOnly: true,
    maxAge: config.session.maxAge,
    sameSite: 'lax',
  },
  name: 'gate-session',
}) as any);

// Passport middleware
app.use(passport.initialize() as any);
app.use(passport.session() as any);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Swagger API documentation
if (config.nodeEnv !== 'production') {
  const swaggerOptions = {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Gate API Documentation',
  };

  app.use('/api-docs', swaggerUi.serve as any, swaggerUi.setup(swaggerSpec, swaggerOptions) as any);

  // Swagger JSON endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

// API routes with rate limiting and caching
app.use('/api/v1', apiLimiter as any, (req, res, next) => {
  res.header('X-API-Version', '1.0.0');
  next();
});

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/v1/auth', authLimiter as any, authRoutes);
app.use('/api/v1/users', responseCache(cacheConfigs.userSpecific), userRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/game-worlds', gameWorldRoutes);
app.use('/api/v1/whitelist', whitelistRoutes);
app.use('/api/v1/client-versions', clientVersionRoutes);
app.use('/api/v1/audit-logs', auditLogRoutes);
// app.use('/api/v1/advanced-settings', advancedSettingsRoutes);

// Temporary route for testing
app.get('/api/v1/test', (req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
