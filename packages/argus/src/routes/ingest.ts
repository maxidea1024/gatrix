import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Queue } from 'groupmq';
import { redis } from '../config/redis';
import { dsnAuthHook, DsnAuthResult } from '../middleware/dsn-auth';
import { createLogger } from '../utils/logger';
import { ulid } from 'ulid';
import { ArgusEvent, ArgusBatchPayload } from '../types/events';
import { updateDsnKeyLastSeen } from '../utils/dsn-seen-tracker';
import { QUEUES, STREAMS, KNOWN_STREAMS } from '../config/redis-keys';

const logger = createLogger('ingest');

// GroupMQ queues for per-project FIFO processing
const errorQueue = new Queue({ redis, namespace: QUEUES.ERROR_PROCESSING });
const txnQueue = new Queue({ redis, namespace: QUEUES.TRANSACTION_PROCESSING });

// Event types that still use Redis Streams (no ordering requirement)
const STREAM_EVENT_TYPES: Record<string, { stream: string; knownSet: string }> =
  {
    session: { stream: STREAMS.SESSIONS, knownSet: KNOWN_STREAMS.SESSIONS },
    feedback: { stream: STREAMS.FEEDBACK, knownSet: KNOWN_STREAMS.FEEDBACK },
    metric: { stream: STREAMS.METRICS, knownSet: KNOWN_STREAMS.METRICS },
    activity: { stream: STREAMS.ACTIVITIES, knownSet: KNOWN_STREAMS.ACTIVITIES },
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
        await enqueueEvent(auth.projectId, {
          ...event,
          event_id: eventId,
          internal_project_id: auth.dsnKey.project_id,
          dsn_key_id: auth.dsnKey.id,
        } as any);
        updateDsnKeyLastSeen(auth.dsnKey.id);

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
        // Separate events by routing path
        const streamEvents: {
          type: string;
          data: string;
          streamKey: string;
          knownSet: string;
        }[] = [];
        const groupmqErrors: { groupId: string; data: string }[] = [];
        const groupmqTxns: { groupId: string; data: string }[] = [];

        for (const event of payload.events) {
          const eventId = event.event_id || ulid();
          eventIds.push(eventId);

          const enriched = {
            ...event,
            event_id: eventId,
            project_id: String(auth.projectId),
            internal_project_id: auth.dsnKey.project_id,
            dsn_key_id: auth.dsnKey.id,
          };
          const serialized = JSON.stringify(enriched);

          if (event.type === 'error') {
            groupmqErrors.push({ groupId: auth.projectId, data: serialized });
          } else if (event.type === 'transaction') {
            groupmqTxns.push({ groupId: auth.projectId, data: serialized });
          } else {
            const streamConfig = STREAM_EVENT_TYPES[event.type];
            if (streamConfig) {
              const streamKey = STREAMS.streamKey(
                streamConfig.stream,
                auth.projectId
              );
              streamEvents.push({
                type: event.type,
                data: serialized,
                streamKey,
                knownSet: streamConfig.knownSet,
              });
            } else {
              logger.warn('Unknown event type in batch, skipping', {
                eventType: event.type,
              });
            }
          }
        }

        // Enqueue GroupMQ events
        const groupmqPromises: Promise<void>[] = [];
        for (const job of groupmqErrors) {
          groupmqPromises.push(errorQueue.add(job).then(() => {}));
        }
        for (const job of groupmqTxns) {
          groupmqPromises.push(txnQueue.add(job).then(() => {}));
        }

        // Enqueue Redis Stream events via pipeline
        if (streamEvents.length > 0) {
          const pipeline = redis.pipeline();
          const knownSetsToUpdate = new Set<string>();

          for (const se of streamEvents) {
            pipeline.xadd(
              se.streamKey,
              'MAXLEN',
              '~',
              '500000',
              '*',
              'data',
              se.data
            );
            knownSetsToUpdate.add(`${se.knownSet}|${se.streamKey}`);
          }

          // Register stream keys in known-streams sets (replaces KEYS command)
          for (const entry of knownSetsToUpdate) {
            const [knownSet, streamKey] = entry.split('|');
            pipeline.sadd(knownSet, streamKey);
          }

          groupmqPromises.push(pipeline.exec().then(() => {}));
        }

        await Promise.all(groupmqPromises);
        updateDsnKeyLastSeen(auth.dsnKey.id);

        logger.debug('Batch ingested', {
          projectId: auth.projectId,
          count: payload.events.length,
          errors: groupmqErrors.length,
          txns: groupmqTxns.length,
          streams: streamEvents.length,
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

/**
 * Route a single event to the appropriate queue/stream.
 *
 * - error/transaction → GroupMQ (per-project FIFO)
 * - session/feedback/metric → Redis Stream (no ordering needed)
 */
async function enqueueEvent(
  projectId: string,
  event: ArgusEvent
): Promise<void> {
  const serialized = JSON.stringify({
    ...event,
    project_id: String(projectId),
    internal_project_id: (event as any).internal_project_id,
    dsn_key_id: (event as any).dsn_key_id || 0,
  });

  if (event.type === 'error') {
    await errorQueue.add({ groupId: projectId, data: serialized });
  } else if (event.type === 'transaction') {
    await txnQueue.add({ groupId: projectId, data: serialized });
  } else {
    const streamConfig = STREAM_EVENT_TYPES[event.type];
    if (!streamConfig) {
      throw new Error(`Unsupported event type: ${event.type}`);
    }

    const streamKey = STREAMS.streamKey(streamConfig.stream, projectId);

    // Register stream key + enqueue atomically via pipeline
    const pipeline = redis.pipeline();
    pipeline.sadd(streamConfig.knownSet, streamKey);
    pipeline.xadd(streamKey, 'MAXLEN', '~', '500000', '*', 'data', serialized);
    await pipeline.exec();
  }

  logger.debug('Event enqueued', {
    projectId,
    eventType: event.type,
    eventId: event.event_id,
  });
}
