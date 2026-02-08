import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { errorHandler } from './middleware/error-handler';
import trackRoutes from './routes/track';
import insightsRoutes from './routes/insights';
import logger from './utils/logger';

import { initMetrics } from './services/MetricsService';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Winston 사용
    trustProxy: true,
    bodyLimit: 1048576, // 1MB
  });

  // 에러 핸들러
  app.setErrorHandler(errorHandler);

  // CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Helmet (보안 헤더)
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // Rate Limiting
  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
    redis: await import('./config/redis').then((m) => m.redis),
  });

  // Monitoring metrics (no-op if disabled)
  initMetrics(app);

  // Health Check
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Routes
  await app.register(trackRoutes, { prefix: '/track' });
  await app.register(insightsRoutes, { prefix: '/insights' });

  // Filter routes (동적 필터링 및 키워드 추출)
  const filtersRoutes = await import('./routes/filters');
  await app.register(filtersRoutes.default, { prefix: '/filters' });

  // 404 Handler
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  logger.info('✅ Fastify app created');

  return app;
}

export default createApp;
