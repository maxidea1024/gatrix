import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
// import session from 'express-session';
// import ConnectRedis from 'connect-redis';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
// import redisClient from './config/redis';
import passport from './config/passport';
import swaggerSpec from './config/swagger';
// import logger from './config/logger';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { generalLimiter, apiLimiter } from './middleware/rateLimiter';
import { appInstance } from './utils/AppInstance';
// import { initializeJobTypes } from './services/jobs';
// import { CampaignScheduler } from './services/campaignScheduler';

// Import main routes module
import routes from './routes';

// import advancedSettingsRoutes from './routes/advancedSettings';
import { authenticate, requireAdmin } from './middleware/auth';
import { BullBoardConfig } from './config/bullboard';

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
// const RedisStore = (ConnectRedis as any)(session);
// app.use(session({
//   store: new RedisStore({
//     client: redisClient.getClient(),
//     prefix: 'gatrix:session:',
//     ttl: config.session.ttl, // TTL in seconds for Redis
//   }),
//   secret: config.session.secret,
//   resave: false,
//   saveUninitialized: false,
//   rolling: true, // Reset TTL on each request
//   cookie: {
//     secure: config.nodeEnv === 'production',
//     httpOnly: true,
//     maxAge: config.session.maxAge,
//     sameSite: 'lax',
//   },
//   name: 'gatrix-session',
// }) as any);

// Passport middleware
app.use(passport.initialize() as any);
// app.use(passport.session() as any);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    ...appInstance.getHealthInfo()
  });
});

// Swagger API documentation
if (config.nodeEnv !== 'production') {
  const swaggerOptions = {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Gatrix API Documentation',
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

// Routes - New organized structure
app.use('/api/v1', routes);

// Bull Board (Admin only)
const bullBoardAdapter = BullBoardConfig.initialize();
app.use('/admin/queues', bullBoardAdapter.getRouter());
app.use('/api/v1/admin/queues', (authenticate as any), (requireAdmin as any), bullBoardAdapter.getRouter());

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

// Initialize job types
// try {
//   initializeJobTypes();
// } catch (error) {
//   logger.error('Failed to initialize job types:', error);
// }

// Initialize campaign scheduler
// try {
//   const campaignScheduler = CampaignScheduler.getInstance();
//   if (campaignScheduler) {
//     campaignScheduler.start();
//     logger.info('Campaign scheduler initialized successfully');
//   } else {
//     logger.error('Campaign scheduler getInstance returned undefined');
//   }
// } catch (error) {
//   logger.error('Failed to initialize campaign scheduler:', error);
// }

export default app;
