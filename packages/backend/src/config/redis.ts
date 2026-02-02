import { createClient, RedisClientType } from "redis";
import { config } from "./index";
import logger from "./logger";

export class RedisClient {
  private static instance: RedisClient;
  private client: RedisClientType;

  private constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password || undefined,
    });

    this.client.on("error", (err) => {
      logger.error("Redis Client Error:", err);
    });

    this.client.on("connect", () => {
      logger.info("Redis client connected");
    });

    this.client.on("ready", () => {
      logger.info("Redis client ready");
    });

    this.client.on("end", () => {
      logger.info("Redis client disconnected");
    });
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info("Redis connection established");
    } catch (error) {
      logger.error("Failed to connect to Redis:", error);
      throw error;
    }
  }

  public getClient(): RedisClientType {
    return this.client;
  }

  public async set(
    key: string,
    value: string,
    expireInSeconds?: number,
  ): Promise<void> {
    try {
      if (expireInSeconds) {
        await this.client.setEx(key, expireInSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error("Redis SET error:", error);
      throw error;
    }
  }

  public async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error("Redis GET error:", error);
      throw error;
    }
  }

  public async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error("Redis DEL error:", error);
      throw error;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error("Redis EXISTS error:", error);
      throw error;
    }
  }

  /**
   * Acquire a distributed lock using Redis SETNX
   * @param lockKey - The key for the lock
   * @param ttlSeconds - Time-to-live for the lock in seconds
   * @returns true if lock was acquired, false otherwise
   */
  public async acquireLock(
    lockKey: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    try {
      const result = await this.client.set(lockKey, Date.now().toString(), {
        NX: true, // Only set if key doesn't exist
        EX: ttlSeconds, // Set expiration time
      });
      return result === "OK";
    } catch (error) {
      logger.error("Redis acquireLock error:", error);
      return false;
    }
  }

  /**
   * Release a distributed lock
   * @param lockKey - The key for the lock
   */
  public async releaseLock(lockKey: string): Promise<void> {
    try {
      await this.client.del(lockKey);
    } catch (error) {
      logger.error("Redis releaseLock error:", error);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      logger.info("Redis client disconnected");
    } catch (error) {
      logger.error("Error disconnecting Redis:", error);
    }
  }
}

export default RedisClient.getInstance();
