import Redis, { Cluster } from "ioredis";
import { config } from "./index";
import { createLogger } from "./logger";

const logger = createLogger("RedisManager");

export class RedisManager {
  private static instance: RedisManager;
  private redisClient: Redis | Cluster | null = null;
  private pubClient: Redis | Cluster | null = null;
  private subClient: Redis | Cluster | null = null;

  private constructor() {}

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  public async initialize(): Promise<void> {
    try {
      if (
        config.redis.cluster.enabled &&
        config.redis.cluster.nodes.length > 0
      ) {
        // Redis Cluster mode for high availability
        await this.initializeCluster();
      } else {
        // Single Redis instance
        await this.initializeSingle();
      }

      logger.info("Redis connection established successfully");
    } catch (error) {
      logger.error("Failed to initialize Redis:", error);
      throw error;
    }
  }

  private async initializeCluster(): Promise<void> {
    const clusterOptions = {
      enableOfflineQueue: config.redis.enableOfflineQueue,
      retryDelayOnFailover: config.redis.retryDelayOnFailover,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      lazyConnect: config.redis.lazyConnect,
      redisOptions: {
        password: config.redis.password,
        connectTimeout: config.redis.connectTimeout,
        commandTimeout: config.redis.commandTimeout,
        keepAlive: config.redis.keepAlive,
        family: config.redis.family,
      },
    };

    this.redisClient = new Cluster(config.redis.cluster.nodes, clusterOptions);
    this.pubClient = new Cluster(config.redis.cluster.nodes, clusterOptions);
    this.subClient = new Cluster(config.redis.cluster.nodes, clusterOptions);

    await Promise.all([
      this.redisClient.connect(),
      this.pubClient.connect(),
      this.subClient.connect(),
    ]);
  }

  private async initializeSingle(): Promise<void> {
    const redisOptions = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      enableOfflineQueue: config.redis.enableOfflineQueue,
      retryDelayOnFailover: config.redis.retryDelayOnFailover,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      lazyConnect: config.redis.lazyConnect,
      connectTimeout: config.redis.connectTimeout,
      commandTimeout: config.redis.commandTimeout,
      keepAlive: config.redis.keepAlive,
      family: config.redis.family,
    };

    this.redisClient = new Redis(redisOptions);
    this.pubClient = new Redis(redisOptions);
    this.subClient = new Redis(redisOptions);

    await Promise.all([
      this.redisClient.connect(),
      this.pubClient.connect(),
      this.subClient.connect(),
    ]);
  }

  public getClient(): Redis | Cluster {
    if (!this.redisClient) {
      throw new Error("Redis client not initialized");
    }
    return this.redisClient;
  }

  public getPubClient(): Redis | Cluster {
    if (!this.pubClient) {
      throw new Error("Redis pub client not initialized");
    }
    return this.pubClient;
  }

  public getSubClient(): Redis | Cluster {
    if (!this.subClient) {
      throw new Error("Redis sub client not initialized");
    }
    return this.subClient;
  }

  public async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.redisClient?.disconnect(),
        this.pubClient?.disconnect(),
        this.subClient?.disconnect(),
      ]);
      logger.info("Redis connections closed");
    } catch (error) {
      logger.error("Error closing Redis connections:", error);
    }
  }

  // High-performance operations for chat
  public async setUserOnline(
    userId: number,
    socketId: string,
    serverId: string,
  ): Promise<void> {
    const pipeline = this.redisClient!.pipeline();
    pipeline.hset(`user:${userId}`, {
      socketId,
      serverId,
      lastSeen: Date.now(),
      status: "online",
    });
    pipeline.sadd("online_users", userId);
    pipeline.expire(`user:${userId}`, 3600); // 1 hour TTL
    await pipeline.exec();
  }

  public async setUserOffline(userId: number): Promise<void> {
    const pipeline = this.redisClient!.pipeline();
    pipeline.hset(`user:${userId}`, {
      lastSeen: Date.now(),
      status: "offline",
    });
    pipeline.srem("online_users", userId);
    await pipeline.exec();
  }

  public async getUserSocketInfo(
    userId: number,
  ): Promise<{ socketId?: string; serverId?: string } | null> {
    const userInfo = await this.redisClient!.hmget(
      `user:${userId}`,
      "socketId",
      "serverId",
    );
    if (!userInfo[0] || !userInfo[1]) return null;
    return { socketId: userInfo[0], serverId: userInfo[1] };
  }

  public async getOnlineUsersCount(): Promise<number> {
    return await this.redisClient!.scard("online_users");
  }

  // Channel membership caching for fast lookups
  public async addUserToChannel(
    userId: number,
    channelId: number,
  ): Promise<void> {
    const pipeline = this.redisClient!.pipeline();
    pipeline.sadd(`channel:${channelId}:members`, userId);
    pipeline.sadd(`user:${userId}:channels`, channelId);
    await pipeline.exec();
  }

  public async removeUserFromChannel(
    userId: number,
    channelId: number,
  ): Promise<void> {
    const pipeline = this.redisClient!.pipeline();
    pipeline.srem(`channel:${channelId}:members`, userId);
    pipeline.srem(`user:${userId}:channels`, channelId);
    await pipeline.exec();
  }

  public async getChannelMembers(channelId: number): Promise<number[]> {
    const members = await this.redisClient!.smembers(
      `channel:${channelId}:members`,
    );
    return members.map((id) => parseInt(id, 10));
  }

  // Message caching for recent messages
  public async cacheMessage(channelId: number, message: any): Promise<void> {
    const key = `channel:${channelId}:recent_messages`;
    await this.redisClient!.lpush(key, JSON.stringify(message));
    await this.redisClient!.ltrim(key, 0, 99); // Keep last 100 messages
    await this.redisClient!.expire(key, 3600); // 1 hour TTL
  }

  public async getRecentMessages(
    channelId: number,
    limit = 50,
  ): Promise<any[]> {
    const messages = await this.redisClient!.lrange(
      `channel:${channelId}:recent_messages`,
      0,
      limit - 1,
    );
    return messages.map((msg) => JSON.parse(msg));
  }
}

export const redisManager = RedisManager.getInstance();

// 임시 호환성을 위한 redisClient export (나중에 제거 예정)
export const redisClient = {
  hgetall: async (key: string) => {
    const client = redisManager.getClient();
    return client ? await client.hgetall(key) : {};
  },
};
