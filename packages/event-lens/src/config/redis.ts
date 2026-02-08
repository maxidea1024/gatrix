import Redis from 'ioredis';
import { config } from './index';
import logger from '../utils/logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });

    redisClient.on('error', (error) => {
      logger.error('❌ Redis connection error', { error });
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis ready');
    });
  }

  return redisClient;
}

export const redis = getRedisClient();

export default redis;
