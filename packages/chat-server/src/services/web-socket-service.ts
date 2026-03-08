import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import http from 'http';
import jwt from 'jsonwebtoken';
import express from 'express';
import { config } from '../config';
import { redisManager } from '../config/redis';
import BroadcastService from './broadcast-service';
import { getMetrics } from './metrics-service';
import { CacheService } from './cache-service';
import { UserService } from './user-service';
import { createLogger } from '../config/logger';
import { SocketUser, WebSocketEvent } from '../types/chat';

const logger = createLogger('WebSocketService');

export class WebSocketService {
  private io: SocketIOServer;
  private broadcastService: BroadcastService;
  private connectedUsers: Map<string, SocketUser> = new Map();
  private userSockets: Map<number, Set<string>> = new Map(); // userId -> socketIds
  private serverId: string;
  private app: express.Application;

  constructor(server: http.Server, app: express.Application) {
    this.app = app;
    this.serverId = process.env.SERVER_ID || `chat-server-${process.pid}`;

    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.cors.origin,
        credentials: config.cors.credentials,
      },
      pingTimeout: config.websocket.pingTimeout,
      pingInterval: config.websocket.pingInterval,
      maxHttpBufferSize: config.websocket.maxHttpBufferSize,
      transports: config.websocket.transports as any,
    });

    this.setupRedisAdapter();
    this.setupMiddleware();
    this.setupEventHandlers();

    // BroadcastService singleton 생성
    this.broadcastService = BroadcastService.createInstance(
      this.io,
      this.serverId
    );

    logger.info(
      `WebSocket service initialized with server ID: ${this.serverId}`
    );
  }

  private async setupRedisAdapter(): Promise<void> {
    try {
      const pubClient = redisManager.getPubClient();
      const subClient = redisManager.getSubClient();

      this.io.adapter(createAdapter(pubClient, subClient) as any);
      logger.info('Redis adapter configured for Socket.IO');
    } catch (error) {
      logger.error('Failed to setup Redis adapter:', error);
    }
  }

  private setupMiddleware(): void {
    // Backend JWT 토큰 인증 미들웨어
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Backend JWT 토큰 검증 (간단한 검증)
        const payload = jwt.decode(token) as any;

        if (!payload || !payload.userId) {
          return next(new Error('Invalid token format'));
        }

        // 데이터베이스에서 사용자 정보 확인
        const userData = await UserService.getUserById(payload.userId);

        if (!userData) {
          return next(new Error('User not found in chat server'));
        }

        // 사용자 정보를 소켓에 저장
        (socket as any).userId = userData.id;
        (socket as any).userInfo = {
          id: userData.id,
          username: userData.username,
          name: userData.name,
          email: userData.email,
          avatarUrl: userData.avatarUrl,
        };

        logger.info(
          `🔌 User ${userData.id} (${userData.username}) connected via WebSocket`
        );
        next();
      } catch (error) {
        logger.error('Socket authentication failed:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Rate limiting 미들웨어
    this.io.use(async (socket, next) => {
      const userId = (socket as any).userId;
      const rateLimitKey = `rate_limit:${userId}:${Date.now()}`;

      try {
        const cacheService = CacheService.getInstance();
        const currentStr = await cacheService.get<string>(rateLimitKey);
        const current = currentStr ? parseInt(currentStr) + 1 : 1;

        await cacheService.set(rateLimitKey, current.toString(), 60 * 1000); // 1분 TTL

        if (current > config.rateLimit.maxRequests) {
          return next(new Error('Rate limit exceeded'));
        }

        next();
      } catch (error) {
        logger.error('Rate limiting error:', error);
        next();
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });

    // 서버 통계 업데이트
    setInterval(() => {
      this.updateServerMetrics();
    }, 30000); // 30초마다

    // 연결 정리
    setInterval(() => {
      this.cleanupStaleConnections();
    }, config.memory.connectionCleanupInterval);
  }

  private async handleConnection(socket: Socket): Promise<void> {
    const userId = (socket as any).userId;
    const userInfo = (socket as any).userInfo;

    try {
      // 사용자 연결 정보 저장
      const socketUser: SocketUser = {
        id: Date.now(),
        socketId: socket.id,
        userId,
        channels: new Set(),
        lastActivity: new Date(),
        deviceType: this.getDeviceType(socket.handshake.headers['user-agent']),
        userAgent: socket.handshake.headers['user-agent'],
        ipAddress: socket.handshake.address,
      };

      this.connectedUsers.set(socket.id, socketUser);

      // 사용자별 소켓 매핑
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      // 사용자 온라인 상태 업데이트
      await UserService.updateUserStatus(userId, 'online');

      // 캐시에 소켓 정보 저장
      const cacheService = CacheService.getInstance();
      await cacheService.set(
        `socket:${userId}:${socket.id}`,
        this.serverId,
        24 * 60 * 60 * 1000
      ); // 24시간

      // 사용자를 개인 룸에 추가
      socket.join(`user:${userId}`);

      logger.info(`User ${userId} connected with socket ${socket.id}`);

      // 연결 이벤트 핸들러 설정
      this.setupSocketEventHandlers(socket, socketUser);

      // 연결 성공 응답
      socket.emit('connected', {
        serverId: this.serverId,
        socketId: socket.id,
        timestamp: Date.now(),
      });

      // 메트릭스 업데이트
      const metrics = getMetrics(this.app);
      if (metrics.connectedUsers) {
        metrics.connectedUsers.set(
          { server_id: this.serverId },
          this.connectedUsers.size
        );
      }
    } catch (error) {
      logger.error(`Error handling connection for user ${userId}:`, error);
      socket.disconnect(true);
    }
  }

  private setupSocketEventHandlers(
    socket: Socket,
    socketUser: SocketUser
  ): void {
    // 채널 참여
    socket.on('join_channel', async (data: { channelId: number }) => {
      try {
        await this.handleJoinChannel(socket, socketUser, data.channelId);
      } catch (error) {
        logger.error('Error joining channel:', error);
        socket.emit('error', { message: 'Failed to join channel' });
      }
    });

    // 채널 나가기
    socket.on('leave_channel', async (data: { channelId: number }) => {
      try {
        await this.handleLeaveChannel(socket, socketUser, data.channelId);
      } catch (error) {
        logger.error('Error leaving channel:', error);
        socket.emit('error', { message: 'Failed to leave channel' });
      }
    });

    // 메시지 전송
    socket.on('send_message', async (data: any) => {
      try {
        await this.handleSendMessage(socket, socketUser, data);
      } catch (error) {
        logger.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // 타이핑 시작
    socket.on(
      'start_typing',
      async (data: { channelId: number; threadId?: number }) => {
        try {
          await this.handleStartTyping(
            socket,
            socketUser,
            data.channelId,
            data.threadId
          );
        } catch (error) {
          logger.error('Error starting typing:', error);
        }
      }
    );

    // 타이핑 중지
    socket.on(
      'stop_typing',
      async (data: { channelId: number; threadId?: number }) => {
        try {
          await this.handleStopTyping(
            socket,
            socketUser,
            data.channelId,
            data.threadId
          );
        } catch (error) {
          logger.error('Error stopping typing:', error);
        }
      }
    );

    // 메시지 읽음 처리
    socket.on(
      'mark_read',
      async (data: { channelId: number; messageId: number }) => {
        try {
          await this.handleMarkRead(socket, socketUser, data);
        } catch (error) {
          logger.error('Error marking message as read:', error);
        }
      }
    );

    // 사용자 상태 변경
    socket.on(
      'update_status',
      async (data: { status: string; customStatus?: string }) => {
        try {
          await this.handleUpdateStatus(socket, socketUser, data);
        } catch (error) {
          logger.error('Error updating status:', error);
        }
      }
    );

    // 연결 해제
    socket.on('disconnect', async (reason: string) => {
      try {
        await this.handleDisconnection(socket, socketUser, reason);
      } catch (error) {
        logger.error('Error handling disconnection:', error);
      }
    });

    // 활동 업데이트
    socket.on('activity', () => {
      socketUser.lastActivity = new Date();
    });

    // Socket.IO handles ping/pong automatically, no manual handling needed
  }

  private async handleJoinChannel(
    socket: Socket,
    socketUser: SocketUser,
    channelId: number
  ): Promise<void> {
    // 채널 권한 검사
    const { ChannelModel } = require('../models/channel');

    try {
      const channel = await ChannelModel.findById(channelId);
      if (!channel) {
        socket.emit('error', { message: 'Channel not found' });
        return;
      }

      // 채널 멤버인지 확인
      const isMember = await ChannelModel.isMember(
        channelId,
        socketUser.userId
      );
      if (!isMember && channel.type !== 'public') {
        socket.emit('error', { message: 'Access denied to channel' });
        return;
      }
    } catch (error) {
      logger.error('Error checking channel permissions:', error);
      socket.emit('error', { message: 'Failed to join channel' });
      return;
    }

    socket.join(`channel:${channelId}`);
    socketUser.channels.add(channelId);

    // 캐시에 채널 멤버십 저장
    const cacheService = CacheService.getInstance();
    await cacheService.set(
      `channel_member:${channelId}:${socketUser.userId}`,
      true,
      24 * 60 * 60 * 1000
    ); // 24시간

    // 채널 참여 알림
    await this.broadcastService.broadcastToChannel(channelId, 'user_joined', {
      userId: socketUser.userId,
      channelId,
      timestamp: Date.now(),
    });

    socket.emit('channel_joined', { channelId });
    logger.info(`User ${socketUser.userId} joined channel ${channelId}`);
  }

  private async handleLeaveChannel(
    socket: Socket,
    socketUser: SocketUser,
    channelId: number
  ): Promise<void> {
    socket.leave(`channel:${channelId}`);
    socketUser.channels.delete(channelId);

    // 캐시에서 채널 멤버십 제거
    const cacheService = CacheService.getInstance();
    await cacheService.delete(
      `channel_member:${channelId}:${socketUser.userId}`
    );

    // 채널 나가기 알림
    await this.broadcastService.broadcastToChannel(channelId, 'user_left', {
      userId: socketUser.userId,
      channelId,
      timestamp: Date.now(),
    });

    socket.emit('channel_left', { channelId });
    logger.info(`User ${socketUser.userId} left channel ${channelId}`);
  }

  private async handleSendMessage(
    socket: Socket,
    socketUser: SocketUser,
    data: any
  ): Promise<void> {
    // 메시지 저장 로직
    const { MessageModel } = require('../models/MessageModel');

    try {
      // 데이터베이스에 메시지 저장
      const savedMessage = await MessageModel.create({
        channelId: data.channelId,
        userId: socketUser.userId,
        content: data.content,
        contentType: data.contentType || 'text',
        messageData: data.messageData,
        parentMessageId: data.parentMessageId || null,
        threadId: data.threadId || null,
      });

      // 사용자 정보 가져오기
      const userData = await UserService.getUserById(socketUser.userId);

      const message = {
        id: savedMessage.id,
        channelId: data.channelId,
        userId: socketUser.userId,
        content: data.content,
        contentType: data.contentType || 'text',
        messageData: data.messageData,
        createdAt: savedMessage.createdAt,
        user: {
          id: socketUser.userId,
          name: userData?.name || userData?.username || 'Unknown User',
          username: userData?.username || 'Unknown',
          avatarUrl: userData?.avatarUrl,
        },
      };

      // 채널에 메시지 브로드캐스트
      await this.broadcastService.broadcastToChannel(
        data.channelId,
        'new_message',
        message
      );

      // 메트릭스 기록
      const metrics = getMetrics(this.app);
      if (metrics.messagesPerSecond) {
        metrics.messagesPerSecond.inc({
          server_id: this.serverId,
          channel_id: data.channelId.toString(),
          message_type: data.contentType || 'text',
        });
      }

      socket.emit('message_sent', { messageId: savedMessage.id });
    } catch (error) {
      logger.error('Error saving message:', error);
      socket.emit('error', { message: 'Failed to send message' });
      return;
    }
  }

  private async handleStartTyping(
    socket: Socket,
    socketUser: SocketUser,
    channelId: number,
    threadId?: number
  ): Promise<void> {
    const typingData = {
      userId: socketUser.userId,
      channelId,
      threadId,
      timestamp: Date.now(),
    };

    // 스레드 타이핑인지 일반 채팅 타이핑인지 구분하여 이벤트 전송
    const eventName = threadId ? 'user_typing_thread' : 'user_typing';
    socket.to(`channel:${channelId}`).emit(eventName, typingData);

    // 캐시에 타이핑 상태 저장 (TTL 5초)
    const cacheService = CacheService.getInstance();
    const cacheKey = threadId
      ? `typing:thread:${threadId}:${socketUser.userId}`
      : `typing:${channelId}:${socketUser.userId}`;
    await cacheService.set(cacheKey, Date.now().toString(), 5 * 1000);
  }

  private async handleStopTyping(
    socket: Socket,
    socketUser: SocketUser,
    channelId: number,
    threadId?: number
  ): Promise<void> {
    const typingData = {
      userId: socketUser.userId,
      channelId,
      threadId,
      timestamp: Date.now(),
    };

    // 스레드 타이핑인지 일반 채팅 타이핑인지 구분하여 이벤트 전송
    const eventName = threadId ? 'user_stop_typing_thread' : 'user_stop_typing';
    socket.to(`channel:${channelId}`).emit(eventName, typingData);

    // 캐시에서 타이핑 상태 제거
    const cacheService = CacheService.getInstance();
    const cacheKey = threadId
      ? `typing:thread:${threadId}:${socketUser.userId}`
      : `typing:${channelId}:${socketUser.userId}`;
    await cacheService.delete(cacheKey);
  }

  private async handleMarkRead(
    socket: Socket,
    socketUser: SocketUser,
    data: { channelId: number; messageId: number }
  ): Promise<void> {
    // 데이터베이스에 읽음 상태 업데이트
    try {
      const {
        MessageReadStatusModel,
      } = require('../models/MessageReadStatusModel');

      await MessageReadStatusModel.markAsRead(
        data.messageId,
        socketUser.userId,
        data.channelId
      );
    } catch (error) {
      logger.error('Error updating read status:', error);
    }

    // 채널의 다른 사용자들에게 읽음 상태 알림
    socket.to(`channel:${data.channelId}`).emit('message_read', {
      userId: socketUser.userId,
      channelId: data.channelId,
      messageId: data.messageId,
      timestamp: Date.now(),
    });
  }

  private async handleUpdateStatus(
    socket: Socket,
    socketUser: SocketUser,
    data: { status: string; customStatus?: string }
  ): Promise<void> {
    // 사용자 상태 업데이트
    await UserService.updateUserStatus(
      socketUser.userId,
      data.status as 'online' | 'away' | 'busy' | 'offline',
      data.customStatus
    );

    // 모든 채널에 상태 변경 알림
    for (const channelId of socketUser.channels) {
      socket.to(`channel:${channelId}`).emit('user_status_changed', {
        userId: socketUser.userId,
        status: data.status,
        customStatus: data.customStatus,
        timestamp: Date.now(),
      });
    }
  }

  private async handleDisconnection(
    socket: Socket,
    socketUser: SocketUser,
    reason: string
  ): Promise<void> {
    // 연결된 사용자 목록에서 제거
    this.connectedUsers.delete(socket.id);

    // 사용자별 소켓 매핑에서 제거
    const userSocketSet = this.userSockets.get(socketUser.userId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);
      if (userSocketSet.size === 0) {
        this.userSockets.delete(socketUser.userId);
        // 마지막 연결이 끊어진 경우 오프라인 상태로 변경
        await UserService.updateUserStatus(socketUser.userId, 'offline');
        await UserService.updateLastSeen(socketUser.userId);
      }
    }

    // 모든 채널에서 나가기 알림
    for (const channelId of socketUser.channels) {
      socket.to(`channel:${channelId}`).emit('user_left', {
        userId: socketUser.userId,
        channelId,
        timestamp: Date.now(),
      });
    }

    // 메트릭스 업데이트
    const metrics = getMetrics(this.app);
    if (metrics.connectedUsers) {
      metrics.connectedUsers.set(
        { server_id: this.serverId },
        this.connectedUsers.size
      );
    }

    logger.info(`User ${socketUser.userId} disconnected: ${reason}`);
  }

  private getDeviceType(userAgent?: string): 'web' | 'mobile' | 'desktop' {
    if (!userAgent) return 'web';

    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return 'mobile';
    } else if (/Electron/.test(userAgent)) {
      return 'desktop';
    }
    return 'web';
  }

  private updateServerMetrics(): void {
    const connectedCount = this.connectedUsers.size;
    const channelCounts = new Map<number, number>();

    // 채널별 연결 수 계산
    for (const socketUser of this.connectedUsers.values()) {
      for (const channelId of socketUser.channels) {
        channelCounts.set(channelId, (channelCounts.get(channelId) || 0) + 1);
      }
    }

    const metrics = getMetrics(this.app);
    if (metrics.connectedUsers) {
      metrics.connectedUsers.set({ server_id: this.serverId }, connectedCount);
    }
    if (metrics.activeChannels) {
      metrics.activeChannels.set(
        { server_id: this.serverId },
        channelCounts.size
      );
    }
    if (metrics.websocketConnections) {
      metrics.websocketConnections.set(
        { server_id: this.serverId, transport: 'websocket' },
        connectedCount
      );
    }
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5분

    for (const [socketId, socketUser] of this.connectedUsers.entries()) {
      if (now - socketUser.lastActivity.getTime() > staleThreshold) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
        this.connectedUsers.delete(socketId);
      }
    }
  }

  // 외부에서 사용할 수 있는 메서드들
  public async sendToUser(
    userId: number,
    event: string,
    data: any
  ): Promise<void> {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  public async sendToChannel(
    channelId: number,
    event: string,
    data: any
  ): Promise<void> {
    this.io.to(`channel:${channelId}`).emit(event, data);
  }

  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  public getChannelUsersCount(channelId: number): number {
    let count = 0;
    for (const socketUser of this.connectedUsers.values()) {
      if (socketUser.channels.has(channelId)) {
        count++;
      }
    }
    return count;
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket service...');

    // 모든 연결 종료
    this.io.disconnectSockets(true);

    // BroadcastService singleton 정리
    BroadcastService.clearInstance();

    // 서버 종료
    this.io.close();

    logger.info('WebSocket service shutdown complete');
  }

  public getIO(): any {
    return this.io;
  }

  // BroadcastService 인스턴스 접근을 위한 getter
  public getBroadcastService(): BroadcastService {
    return this.broadcastService;
  }
}
