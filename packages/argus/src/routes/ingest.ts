import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../config/redis';
import { dsnAuthHook, DsnAuthResult } from '../middleware/dsn-auth';
import { createLogger } from '../utils/logger';
import { ulid } from 'ulid';
import { ArgusEvent, ArgusBatchPayload } from '../types/events';

const logger = createLogger('ingest');

// Stream key patterns
const STREAM_KEYS: Record<string, string> = {
  error: 'argus:errors',
  transaction: 'argus:txns',
  session: 'argus:sessions',
  feedback: 'argus:feedback',
  metric: 'argus:metrics',
};

export default async function ingestRoutes(app: FastifyInstance) {
  // Single event ingest
  app.post(
    '/:projectId/ingest',
    { preHandler: dsnAuthHook },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = (request as any).argusAuth as DsnAuthResult;
      const event = request.body as ArgusEvent;

      if (!event || !event.type) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Missing event type',
        });
      }

      const eventId = event.event_id || ulid();

      try {
        await enqueueEvent(auth.projectId, { ...event, event_id: eventId });

        return reply.code(202).send({ event_id: eventId });
      } catch (error) {
        logger.error('Failed to enqueue event', {
          projectId: auth.projectId,
          eventType: event.type,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to process event',
        });
      }
    }
  );

  // Batch event ingest
  app.post(
    '/:projectId/ingest/batch',
    { preHandler: dsnAuthHook },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = (request as any).argusAuth as DsnAuthResult;
      const payload = request.body as ArgusBatchPayload;

      if (!payload?.events || !Array.isArray(payload.events)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Missing or invalid events array',
        });
      }

      const eventIds: string[] = [];

      try {
        const pipeline = redis.pipeline();

        for (const event of payload.events) {
          const eventId = event.event_id || ulid();
          eventIds.push(eventId);

          const streamKey = getStreamKey(event.type, auth.projectId);
          if (streamKey) {
            pipeline.xadd(
              streamKey,
              'MAXLEN', '~', '500000',
              '*',
              'data', JSON.stringify({ ...event, event_id: eventId, project_id: String(auth.projectId) }),
            );
          }
        }

        await pipeline.exec();

        logger.debug('Batch ingested', {
          projectId: auth.projectId,
          count: payload.events.length,
        });

        return reply.code(202).send({ event_ids: eventIds });
      } catch (error) {
        logger.error('Failed to enqueue batch', {
          projectId: auth.projectId,
          count: payload.events.length,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to process batch',
        });
      }
    }
  );
}

function getStreamKey(eventType: string, projectId: number): string | null {
  const base = STREAM_KEYS[eventType];
  if (!base) {
    logger.warn('Unknown event type', { eventType });
    return null;
  }
  return `${base}:${projectId}`;
}

async function enqueueEvent(projectId: number, event: ArgusEvent): Promise<void> {
  const streamKey = getStreamKey(event.type, projectId);
  if (!streamKey) {
    throw new Error(`Unsupported event type: ${event.type}`);
  }

  await redis.xadd(
    streamKey,
    'MAXLEN', '~', '500000',
    '*',
    'data', JSON.stringify({ ...event, project_id: String(projectId) }),
  );

  logger.debug('Event enqueued', {
    projectId,
    eventType: event.type,
    eventId: event.event_id,
  });
}
