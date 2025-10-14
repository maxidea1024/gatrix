import { Queue, QueueOptions } from 'bullmq';
import { redis } from './redis';
import logger from '../utils/logger';

const connection = redis;

const defaultQueueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600, // 1시간 후 삭제
      count: 1000,
    },
    removeOnFail: {
      age: 86400, // 24시간 후 삭제
    },
  },
};

// 이벤트 처리 큐 (Queue name cannot contain ':' character)
export const eventQueue = new Queue('event-lens-events', defaultQueueOptions);

// 프로필 업데이트 큐
export const profileQueue = new Queue('event-lens-profiles', defaultQueueOptions);

// 세션 집계 큐
export const sessionQueue = new Queue('event-lens-sessions', defaultQueueOptions);

// 집계 큐
export const aggregationQueue = new Queue('event-lens-aggregations', defaultQueueOptions);

// 큐 이벤트 리스너
eventQueue.on('error', (error) => {
  logger.error('Event queue error', { error });
});

profileQueue.on('error', (error) => {
  logger.error('Profile queue error', { error });
});

sessionQueue.on('error', (error) => {
  logger.error('Session queue error', { error });
});

aggregationQueue.on('error', (error) => {
  logger.error('Aggregation queue error', { error });
});

logger.info('✅ BullMQ queues initialized');

export default {
  eventQueue,
  profileQueue,
  sessionQueue,
  aggregationQueue,
};

