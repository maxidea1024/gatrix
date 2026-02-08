import { FastifyPluginAsync } from 'fastify';
import { eventSchema } from '../types';
import { EventProcessor } from '../services/event-processor';
import { authenticateClient, requireWriteAccess } from '../middleware/auth';
import logger from '../utils/logger';

const trackRoutes: FastifyPluginAsync = async (fastify) => {
  const eventProcessor = new EventProcessor();

  // POST /track - 이벤트 추적
  fastify.post(
    '/',
    {
      preHandler: [authenticateClient, requireWriteAccess],
    },
    async (request, reply) => {
      try {
        const body = eventSchema.parse(request.body);
        const { type, payload } = body;

        if (!request.client) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const event = {
          ...payload,
          projectId: request.client.projectId,
          ip:
            (request.headers['x-client-ip'] as string) ||
            (request.headers['x-forwarded-for'] as string) ||
            request.ip,
          userAgent: request.headers['user-agent'] || '',
          createdAt: new Date().toISOString(),
        };

        // 타입별 처리
        switch (type) {
          case 'track':
            await eventProcessor.process(event);
            break;
          case 'identify':
            await eventProcessor.processIdentify(event);
            break;
          case 'increment':
            await eventProcessor.processIncrement(event);
            break;
          case 'decrement':
            await eventProcessor.processDecrement(event);
            break;
          default:
            return reply.code(400).send({ error: 'Invalid event type' });
        }

        return { success: true };
      } catch (error: any) {
        logger.error('Track endpoint error', { error: error.message });

        if (error.name === 'ZodError') {
          return reply.code(400).send({
            error: 'Validation Error',
            details: error.errors,
          });
        }

        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // POST /batch - 배치 이벤트 추적
  fastify.post(
    '/batch',
    {
      preHandler: [authenticateClient, requireWriteAccess],
    },
    async (request, reply) => {
      try {
        const body = request.body as { events: any[] };

        if (!Array.isArray(body.events)) {
          return reply.code(400).send({ error: 'events must be an array' });
        }

        if (body.events.length > 100) {
          return reply.code(400).send({ error: 'Maximum 100 events per batch' });
        }

        if (!request.client) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const promises = body.events.map(async (eventData) => {
          const parsed = eventSchema.parse(eventData);
          const { type, payload } = parsed;

          const event = {
            ...payload,
            projectId: request.client!.projectId,
            ip: (request.headers['x-client-ip'] as string) || request.ip,
            userAgent: request.headers['user-agent'] || '',
            createdAt: new Date().toISOString(),
          };

          switch (type) {
            case 'track':
              return eventProcessor.process(event);
            case 'identify':
              return eventProcessor.processIdentify(event);
            case 'increment':
              return eventProcessor.processIncrement(event);
            case 'decrement':
              return eventProcessor.processDecrement(event);
          }
        });

        await Promise.all(promises);

        return {
          success: true,
          processed: body.events.length,
        };
      } catch (error: any) {
        logger.error('Batch track endpoint error', { error: error.message });

        if (error.name === 'ZodError') {
          return reply.code(400).send({
            error: 'Validation Error',
            details: error.errors,
          });
        }

        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );
};

export default trackRoutes;
