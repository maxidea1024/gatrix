import { Server as SocketIOServer } from 'socket.io';
import { pack, unpack } from 'msgpackr';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import LRUCache from 'lru-cache';
import { config } from '../config';
import { redisManager } from '../config/redis';
import { createLogger } from '../config/logger';

const logger = createLogger('BroadcastService');

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface BroadcastMessage {
  type: 'message' | 'typing' | 'user_status' | 'channel_update';
  channelId?: number;
  userId?: number;
  data: any;
  timestamp: number;
  serverId: string;
}

export class BroadcastService {
  private io: SocketIOServer;
  private serverId: string;
  private messageQueue: Map<number, BroadcastMessage[]> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private messageCache: LRUCache<string, any>;
  private compressionCache: LRUCache<string, Buffer>;

  constructor(io: SocketIOServer, serverId: string) {
    this.io = io;
    this.serverId = serverId;

    // Initialize caches for performance
    this.messageCache = new LRUCache({
      max: 10000,
      ttl: 1000 * 60 * 5, // 5 minutes
    });

    this.compressionCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 10, // 10 minutes
    });

    this.setupRedisSubscriptions();
    this.startBatchProcessor();
  }

  private setupRedisSubscriptions(): void {
    const subClient = redisManager.getSubClient();

    // Subscribe to broadcast channels
    subClient.subscribe(
      'chat:broadcast',
      'chat:channel_broadcast',
      'chat:user_broadcast'
    );

    subClient.on('message', async (channel: string, message: string) => {
      try {
        let broadcastMessage: BroadcastMessage;

        if (config.broadcasting.useMessagePack) {
          const buffer = Buffer.from(message, 'base64');
          const decompressed = config.broadcasting.compression
            ? await gunzipAsync(buffer)
            : buffer;
          broadcastMessage = unpack(decompressed);
        } else {
          // JWT 토큰이나 다른 문자열이 아닌 유효한 JSON인지 확인
          if (!message.startsWith('{') && !message.startsWith('[')) {
            // JSON이 아닌 메시지는 무시
            return;
          }
          broadcastMessage = JSON.parse(message);
        }

        // Don't process messages from this server instance
        if (broadcastMessage.serverId === this.serverId) {
          return;
        }

        await this.handleIncomingBroadcast(channel, broadcastMessage);
      } catch (error) {
        logger.error('Error processing broadcast message:', error);
      }
    });
  }

  private async handleIncomingBroadcast(channel: string, message: BroadcastMessage): Promise<void> {
    switch (channel) {
      case 'chat:broadcast':
        await this.handleGlobalBroadcast(message);
        break;
      case 'chat:channel_broadcast':
        await this.handleChannelBroadcast(message);
        break;
      case 'chat:user_broadcast':
        await this.handleUserBroadcast(message);
        break;
    }
  }

  private async handleGlobalBroadcast(message: BroadcastMessage): Promise<void> {
    // Broadcast to all connected clients on this server
    this.io.emit('global_message', message.data);
  }

  private async handleChannelBroadcast(message: BroadcastMessage): Promise<void> {
    if (!message.channelId) return;

    // Get local users in this channel
    const localUsers = await this.getLocalChannelUsers(message.channelId);

    if (localUsers.length > 0) {
      // Use room-based broadcasting for efficiency
      this.io.to(`channel:${message.channelId}`).emit(message.type, message.data);
    }
  }

  private async handleUserBroadcast(message: BroadcastMessage): Promise<void> {
    if (!message.userId) return;

    // Check if user is connected to this server
    const userSocket = await this.getUserSocket(message.userId);
    if (userSocket) {
      userSocket.emit(message.type, message.data);
    }
  }

  // Optimized broadcasting methods
  public async broadcastToChannel(channelId: number, type: string, data: any): Promise<void> {
    const message: BroadcastMessage = {
      type: type as any,
      channelId,
      data,
      timestamp: Date.now(),
      serverId: this.serverId,
    };

    if (config.broadcasting.batchSize > 1) {
      // Add to batch queue
      this.addToBatch(channelId, message);
    } else {
      // Send immediately
      await this.sendChannelBroadcast(message);
    }
  }

  public async broadcastToUser(userId: number, type: string, data: any): Promise<void> {
    const message: BroadcastMessage = {
      type: type as any,
      userId,
      data,
      timestamp: Date.now(),
      serverId: this.serverId,
    };

    await this.sendUserBroadcast(message);
  }

  public async broadcastGlobal(type: string, data: any): Promise<void> {
    const message: BroadcastMessage = {
      type: type as any,
      data,
      timestamp: Date.now(),
      serverId: this.serverId,
    };

    await this.sendGlobalBroadcast(message);
  }

  private addToBatch(channelId: number, message: BroadcastMessage): void {
    if (!this.messageQueue.has(channelId)) {
      this.messageQueue.set(channelId, []);
    }

    this.messageQueue.get(channelId)!.push(message);

    // Check if batch is full
    if (this.messageQueue.get(channelId)!.length >= config.broadcasting.batchSize) {
      this.processBatch(channelId);
    }
  }

  private startBatchProcessor(): void {
    this.batchTimer = setInterval(() => {
      this.processAllBatches();
    }, config.broadcasting.batchDelay);
  }

  private processAllBatches(): void {
    for (const channelId of this.messageQueue.keys()) {
      this.processBatch(channelId);
    }
  }

  private async processBatch(channelId: number): Promise<void> {
    const messages = this.messageQueue.get(channelId);
    if (!messages || messages.length === 0) return;

    // Clear the batch
    this.messageQueue.set(channelId, []);

    // Send batched messages
    for (const message of messages) {
      await this.sendChannelBroadcast(message);
    }
  }

  private async sendChannelBroadcast(message: BroadcastMessage): Promise<void> {
    const serialized = await this.serializeMessage(message);
    const pubClient = redisManager.getPubClient();
    await pubClient.publish('chat:channel_broadcast', serialized);

    // Also broadcast locally
    await this.handleChannelBroadcast(message);
  }

  private async sendUserBroadcast(message: BroadcastMessage): Promise<void> {
    const serialized = await this.serializeMessage(message);
    const pubClient = redisManager.getPubClient();
    await pubClient.publish('chat:user_broadcast', serialized);

    // Also handle locally
    await this.handleUserBroadcast(message);
  }

  private async sendGlobalBroadcast(message: BroadcastMessage): Promise<void> {
    const serialized = await this.serializeMessage(message);
    const pubClient = redisManager.getPubClient();
    await pubClient.publish('chat:broadcast', serialized);

    // Also handle locally
    await this.handleGlobalBroadcast(message);
  }

  private async serializeMessage(message: BroadcastMessage): Promise<string> {
    const cacheKey = `${message.type}:${message.timestamp}`;

    if (this.compressionCache.has(cacheKey)) {
      return this.compressionCache.get(cacheKey)!.toString('base64');
    }

    let serialized: Buffer;

    if (config.broadcasting.useMessagePack) {
      const packed = pack(message);
      serialized = config.broadcasting.compression
        ? await gzipAsync(packed)
        : packed;
    } else {
      const jsonString = JSON.stringify(message);
      serialized = config.broadcasting.compression
        ? await gzipAsync(Buffer.from(jsonString))
        : Buffer.from(jsonString);
    }

    this.compressionCache.set(cacheKey, serialized);
    return serialized.toString('base64');
  }

  private async getLocalChannelUsers(channelId: number): Promise<number[]> {
    // Get all sockets in the channel room
    const sockets = await this.io.in(`channel:${channelId}`).fetchSockets();
    return sockets.map(socket => (socket as any).userId).filter(Boolean);
  }

  private async getUserSocket(userId: number): Promise<any> {
    const sockets = await this.io.fetchSockets();
    return sockets.find(socket => (socket as any).userId === userId);
  }

  public async cleanup(): Promise<void> {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    // Process remaining batches
    this.processAllBatches();

    // Clear caches
    this.messageCache.clear();
    this.compressionCache.clear();
  }

  // Performance monitoring
  public getStats(): any {
    return {
      queuedMessages: Array.from(this.messageQueue.values()).reduce((sum, arr) => sum + arr.length, 0),
      cacheHitRate: this.messageCache.calculatedSize / (this.messageCache.calculatedSize + this.messageCache.size),
      compressionCacheSize: this.compressionCache.size,
    };
  }
}

// Export class for instantiation
// Note: broadcastService instance will be created in WebSocketService
