import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { createLogger } from './utils/logger';
import ingestRoutes from './routes/ingest';
import issuesRoutes from './routes/issues';
import projectsRoutes from './routes/projects';
import overviewRoutes from './routes/overview';
import performanceRoutes from './routes/performance';
import sessionsRoutes from './routes/sessions';
import feedbackRoutes from './routes/feedback';
import releasesRoutes from './routes/releases';
import alertsRoutes from './routes/alerts';
import logsRoutes from './routes/logs';

const logger = createLogger('app');

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: 2097152, // 2MB — batch payloads can be larger
  });

  // Error handler
  app.setErrorHandler((error, _request, reply) => {
    logger.error('Unhandled request error', {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
    });
    reply.code(error.statusCode || 500).send({
      error: error.name || 'InternalServerError',
      message:
        config.nodeEnv === 'production'
          ? 'Internal Server Error'
          : error.message,
    });
  });

  // CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
    redis: await import('./config/redis').then((m) => m.redis),
  });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'argus-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // Routes
  await app.register(ingestRoutes, { prefix: '/argus/api' });
  await app.register(issuesRoutes, { prefix: '/argus/api' });
  await app.register(projectsRoutes, { prefix: '/argus/api' });
  await app.register(overviewRoutes, { prefix: '/argus/api' });
  await app.register(performanceRoutes, { prefix: '/argus/api' });
  await app.register(sessionsRoutes, { prefix: '/argus/api' });
  await app.register(feedbackRoutes, { prefix: '/argus/api' });
  await app.register(releasesRoutes, { prefix: '/argus/api' });
  await app.register(alertsRoutes, { prefix: '/argus/api' });
  await app.register(logsRoutes, { prefix: '/argus/api' });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  logger.info('Fastify app created');

  return app;
}

export default createApp;
