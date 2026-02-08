import { FastifyPluginAsync } from 'fastify';
import { MetricsService } from '../services/metrics';
import { FunnelService } from '../services/funnel';
import { RetentionService } from '../services/retention';
import { authenticateClient, requireReadAccess } from '../middleware/auth';
import logger from '../utils/logger';

const insightsRoutes: FastifyPluginAsync = async (fastify) => {
  const metricsService = new MetricsService();
  const funnelService = new FunnelService();
  const retentionService = new RetentionService();

  // GET /insights/:projectId/metrics - 기본 메트릭
  fastify.get(
    '/:projectId/metrics',
    {
      preHandler: [authenticateClient, requireReadAccess],
    },
    async (request, reply) => {
      try {
        const { projectId } = request.params as { projectId: string };
        const { startDate, endDate } = request.query as {
          startDate: string;
          endDate: string;
        };

        if (!startDate || !endDate) {
          return reply.code(400).send({
            error: 'Missing required query parameters: startDate, endDate',
          });
        }

        const metrics = await metricsService.getMetrics({
          projectId,
          startDate,
          endDate,
        });

        return metrics;
      } catch (error: any) {
        logger.error('Metrics endpoint error', { error: error.message });
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // GET /insights/:projectId/timeseries - 시계열 데이터
  fastify.get(
    '/:projectId/timeseries',
    {
      preHandler: [authenticateClient, requireReadAccess],
    },
    async (request, reply) => {
      try {
        const { projectId } = request.params as { projectId: string };
        const { startDate, endDate, interval } = request.query as {
          startDate: string;
          endDate: string;
          interval?: 'hour' | 'day' | 'week' | 'month';
        };

        if (!startDate || !endDate) {
          return reply.code(400).send({
            error: 'Missing required query parameters: startDate, endDate',
          });
        }

        const data = await metricsService.getTimeSeries({
          projectId,
          startDate,
          endDate,
          interval: interval || 'day',
        });

        return data;
      } catch (error: any) {
        logger.error('Timeseries endpoint error', { error: error.message });
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // GET /insights/:projectId/pages - 상위 페이지
  fastify.get(
    '/:projectId/pages',
    {
      preHandler: [authenticateClient, requireReadAccess],
    },
    async (request, reply) => {
      try {
        const { projectId } = request.params as { projectId: string };
        const { startDate, endDate, limit } = request.query as {
          startDate: string;
          endDate: string;
          limit?: string;
        };

        if (!startDate || !endDate) {
          return reply.code(400).send({
            error: 'Missing required query parameters: startDate, endDate',
          });
        }

        const data = await metricsService.getTopPages({
          projectId,
          startDate,
          endDate,
          limit: limit ? parseInt(limit, 10) : 10,
        });

        return data;
      } catch (error: any) {
        logger.error('Pages endpoint error', { error: error.message });
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // GET /insights/:projectId/live - 실시간 방문자
  fastify.get(
    '/:projectId/live',
    {
      preHandler: [authenticateClient, requireReadAccess],
    },
    async (request, reply) => {
      try {
        const { projectId } = request.params as { projectId: string };
        const count = await metricsService.getLiveVisitors(projectId);
        return { count };
      } catch (error: any) {
        logger.error('Live visitors endpoint error', { error: error.message });
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // GET /insights/:projectId/referrers - 상위 Referrer
  fastify.get(
    '/:projectId/referrers',
    {
      preHandler: [authenticateClient, requireReadAccess],
    },
    async (request, reply) => {
      try {
        const { projectId } = request.params as { projectId: string };
        const { startDate, endDate, limit } = request.query as {
          startDate: string;
          endDate: string;
          limit?: string;
        };

        if (!startDate || !endDate) {
          return reply.code(400).send({
            error: 'Missing required query parameters: startDate, endDate',
          });
        }

        const data = await metricsService.getTopReferrers({
          projectId,
          startDate,
          endDate,
          limit: limit ? parseInt(limit, 10) : 10,
        });

        return data;
      } catch (error: any) {
        logger.error('Referrers endpoint error', { error: error.message });
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // GET /insights/:projectId/devices - 디바이스 통계
  fastify.get(
    '/:projectId/devices',
    {
      preHandler: [authenticateClient, requireReadAccess],
    },
    async (request, reply) => {
      try {
        const { projectId } = request.params as { projectId: string };
        const { startDate, endDate } = request.query as {
          startDate: string;
          endDate: string;
        };

        if (!startDate || !endDate) {
          return reply.code(400).send({
            error: 'Missing required query parameters: startDate, endDate',
          });
        }

        const data = await metricsService.getDeviceStats({
          projectId,
          startDate,
          endDate,
        });

        return data;
      } catch (error: any) {
        logger.error('Devices endpoint error', { error: error.message });
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // GET /insights/:projectId/geo - 지리 통계
  fastify.get(
    '/:projectId/geo',
    {
      preHandler: [authenticateClient, requireReadAccess],
    },
    async (request, reply) => {
      try {
        const { projectId } = request.params as { projectId: string };
        const { startDate, endDate } = request.query as {
          startDate: string;
          endDate: string;
        };

        if (!startDate || !endDate) {
          return reply.code(400).send({
            error: 'Missing required query parameters: startDate, endDate',
          });
        }

        const data = await metricsService.getGeoStats({
          projectId,
          startDate,
          endDate,
        });

        return data;
      } catch (error: any) {
        logger.error('Geo endpoint error', { error: error.message });
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // POST /insights/:projectId/funnel - 퍼널 분석
  fastify.post(
    '/:projectId/funnel',
    {
      preHandler: [authenticateClient, requireReadAccess],
    },
    async (request, reply) => {
      try {
        const { projectId } = request.params as { projectId: string };
        const { steps, startDate, endDate } = request.body as {
          steps: string[];
          startDate: string;
          endDate: string;
        };

        if (!steps || !Array.isArray(steps) || steps.length < 2) {
          return reply.code(400).send({
            error: 'steps must be an array with at least 2 elements',
          });
        }

        if (!startDate || !endDate) {
          return reply.code(400).send({
            error: 'Missing required fields: startDate, endDate',
          });
        }

        const data = await funnelService.analyzeFunnel({
          projectId,
          steps,
          startDate,
          endDate,
        });

        return data;
      } catch (error: any) {
        logger.error('Funnel endpoint error', { error: error.message });
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // GET /insights/:projectId/retention - 리텐션 분석
  fastify.get(
    '/:projectId/retention',
    {
      preHandler: [authenticateClient, requireReadAccess],
    },
    async (request, reply) => {
      try {
        const { projectId } = request.params as { projectId: string };
        const { startDate, endDate, period } = request.query as {
          startDate: string;
          endDate: string;
          period?: 'day' | 'week' | 'month';
        };

        if (!startDate || !endDate) {
          return reply.code(400).send({
            error: 'Missing required query parameters: startDate, endDate',
          });
        }

        const data = await retentionService.analyzeRetention({
          projectId,
          startDate,
          endDate,
          period: period || 'day',
        });

        return data;
      } catch (error: any) {
        logger.error('Retention endpoint error', { error: error.message });
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );
};

export default insightsRoutes;
