import { Request, Response } from 'express';
import { ChannelModel } from '../models/Channel';
import { CreateChannelData, UpdateChannelData } from '../types/chat';
import { metricsService } from '../services/MetricsService';
import logger from '../config/logger';

export class ChannelController {
  // 채널 생성
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const data: CreateChannelData = req.body;

      // 입력 검증
      if (!data.name || !data.type) {
        res.status(400).json({
          success: false,
          error: 'Name and type are required',
        });
        return;
      }

      const startTime = Date.now();
      const channel = await ChannelModel.create(data, userId);
      const latency = (Date.now() - startTime) / 1000;

      metricsService.recordMessageLatency('channel_create', latency);

      res.status(201).json({
        success: true,
        data: channel,
        message: 'Channel created successfully',
      });

      logger.info(`Channel created: ${channel.id} by user ${userId}`);
    } catch (error) {
      logger.error('Error creating channel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create channel',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // 채널 조회
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const channelId = parseInt(req.params.id);
      const userId = (req as any).user.id;

      if (isNaN(channelId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid channel ID',
        });
        return;
      }

      // 채널 멤버십 확인
      const isMember = await ChannelModel.isMember(channelId, userId);
      if (!isMember) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const channel = await ChannelModel.findById(channelId);
      if (!channel) {
        res.status(404).json({
          success: false,
          error: 'Channel not found',
        });
        return;
      }

      res.json({
        success: true,
        data: channel,
      });
    } catch (error) {
      logger.error('Error getting channel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get channel',
      });
    }
  }

  // 사용자의 채널 목록 조회
  static async getUserChannels(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const {
        type,
        page = 1,
        limit = 20,
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);
      const options = {
        type: type as string,
        limit: Number(limit),
        offset,
      };

      const result = await ChannelModel.findByUserId(userId, options);

      res.json({
        success: true,
        data: result.channels,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: result.total,
          totalPages: Math.ceil(result.total / Number(limit)),
          hasNext: offset + Number(limit) < result.total,
          hasPrev: Number(page) > 1,
        },
      });
    } catch (error) {
      logger.error('Error getting user channels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get channels',
      });
    }
  }

  // 채널 업데이트
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const channelId = parseInt(req.params.id);
      const userId = (req as any).user.id;
      const data: UpdateChannelData = req.body;

      if (isNaN(channelId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid channel ID',
        });
        return;
      }

      // 권한 확인 (채널 소유자 또는 관리자)
      const userRole = await ChannelModel.getUserRole(channelId, userId);
      if (!userRole || !['owner', 'admin'].includes(userRole)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const channel = await ChannelModel.update(channelId, data, userId);
      if (!channel) {
        res.status(404).json({
          success: false,
          error: 'Channel not found',
        });
        return;
      }

      res.json({
        success: true,
        data: channel,
        message: 'Channel updated successfully',
      });

      logger.info(`Channel updated: ${channelId} by user ${userId}`);
    } catch (error) {
      logger.error('Error updating channel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update channel',
      });
    }
  }

  // 채널 삭제 (아카이브)
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const channelId = parseInt(req.params.id);
      const userId = (req as any).user.id;
      const { reason = 'Channel deleted by user' } = req.body;

      if (isNaN(channelId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid channel ID',
        });
        return;
      }

      // 권한 확인 (채널 소유자만)
      const userRole = await ChannelModel.getUserRole(channelId, userId);
      if (userRole !== 'owner') {
        res.status(403).json({
          success: false,
          error: 'Only channel owner can delete the channel',
        });
        return;
      }

      const success = await ChannelModel.archive(channelId, reason, userId);
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Channel not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Channel deleted successfully',
      });

      logger.info(`Channel deleted: ${channelId} by user ${userId}`);
    } catch (error) {
      logger.error('Error deleting channel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete channel',
      });
    }
  }

  // 채널 검색
  static async search(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const {
        q: query,
        page = 1,
        limit = 20,
      } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Search query is required',
        });
        return;
      }

      const offset = (Number(page) - 1) * Number(limit);
      const options = {
        limit: Number(limit),
        offset,
      };

      const result = await ChannelModel.search(query, userId, options);

      res.json({
        success: true,
        data: result.channels,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: result.total,
          totalPages: Math.ceil(result.total / Number(limit)),
          hasNext: offset + Number(limit) < result.total,
          hasPrev: Number(page) > 1,
        },
      });
    } catch (error) {
      logger.error('Error searching channels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search channels',
      });
    }
  }

  // 인기 채널 조회
  static async getPopular(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 10 } = req.query;

      const channels = await ChannelModel.getPopularChannels(Number(limit));

      res.json({
        success: true,
        data: channels,
      });
    } catch (error) {
      logger.error('Error getting popular channels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get popular channels',
      });
    }
  }

  // 채널 통계 조회
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const channelId = parseInt(req.params.id);
      const userId = (req as any).user.id;

      if (isNaN(channelId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid channel ID',
        });
        return;
      }

      // 권한 확인 (채널 멤버)
      const isMember = await ChannelModel.isMember(channelId, userId);
      if (!isMember) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const stats = await ChannelModel.getStats(channelId);
      if (!stats) {
        res.status(404).json({
          success: false,
          error: 'Channel not found',
        });
        return;
      }

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting channel stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get channel stats',
      });
    }
  }

  // 채널 존재 여부 확인
  static async checkExists(req: Request, res: Response): Promise<void> {
    try {
      const channelId = parseInt(req.params.id);

      if (isNaN(channelId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid channel ID',
        });
        return;
      }

      const exists = await ChannelModel.exists(channelId);

      res.json({
        success: true,
        data: { exists },
      });
    } catch (error) {
      logger.error('Error checking channel existence:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check channel existence',
      });
    }
  }

  // 채널의 메시지 조회
  static async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const channelId = parseInt(req.params.id);
      const userId = (req as any).user.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const before = req.query.before ? parseInt(req.query.before as string) : undefined;

      if (isNaN(channelId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid channel ID',
        });
        return;
      }

      // 채널 접근 권한 확인
      const hasAccess = await ChannelModel.hasAccess(channelId, userId);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          error: 'Access denied to this channel',
        });
        return;
      }

      // 메시지 조회 (MessageModel을 사용해야 하지만 임시로 빈 배열 반환)
      const messages: any[] = [];

      res.json({
        success: true,
        data: {
          messages,
          hasMore: false,
          total: 0,
        },
      });
    } catch (error) {
      logger.error('Error getting channel messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get channel messages',
      });
    }
  }

  // 채널을 읽음으로 표시
  static async markAsRead(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const channelId = parseInt(req.params.id);
      const userId = (req as any).user.id;
      const { messageId } = req.body;

      logger.info(`📖 MarkAsRead request received`, {
        channelId,
        userId,
        messageId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      if (isNaN(channelId)) {
        logger.warn(`❌ Invalid channel ID: ${req.params.id}`);
        res.status(400).json({
          success: false,
          error: 'Invalid channel ID',
        });
        return;
      }

      // 채널 멤버십 확인 (타임아웃 설정)
      const userRole = await Promise.race([
        ChannelModel.getUserRole(channelId, userId),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Membership check timeout')), 3000)
        )
      ]) as any;

      if (!userRole) {
        res.status(403).json({
          success: false,
          error: 'You are not a member of this channel',
        });
        return;
      }

      // 읽음 상태 업데이트 (타임아웃 설정)
      const success = await Promise.race([
        ChannelModel.markAsRead(channelId, userId, messageId),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Mark as read timeout')), 4000)
        )
      ]) as boolean;

      if (!success) {
        res.status(500).json({
          success: false,
          error: 'Failed to update read status',
        });
        return;
      }

      const duration = Date.now() - startTime;
      logger.info(`User ${userId} marked channel ${channelId} as read${messageId ? ` up to message ${messageId}` : ''} (${duration}ms)`);

      res.json({
        success: true,
        message: 'Channel marked as read',
        data: {
          channelId,
          userId,
          messageId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Error marking channel as read (${duration}ms):`, error);

      // 타임아웃 에러인 경우 특별 처리
      if (error instanceof Error && error.message.includes('timeout')) {
        res.status(408).json({
          success: false,
          error: 'Request timeout',
          code: 'TIMEOUT'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to mark channel as read',
        });
      }
    }
  }

  // 채널 참여
  static async joinChannel(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const channelId = parseInt(req.params.id);

      if (isNaN(channelId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid channel ID',
        });
        return;
      }

      // 채널 존재 확인
      const channel = await ChannelModel.findById(channelId);
      if (!channel) {
        res.status(404).json({
          success: false,
          error: 'Channel not found',
        });
        return;
      }

      // 이미 참여했는지 확인
      const isMember = await ChannelModel.isMember(channelId, userId);
      if (isMember) {
        res.status(200).json({
          success: true,
          message: 'Already a member of this channel',
        });
        return;
      }

      // 채널에 참여
      await ChannelModel.addMember(channelId, userId, 'member');

      // WebSocket을 통해 채널 참여 알림
      const io = (req as any).io;
      if (io) {
        io.to(`channel:${channelId}`).emit('user_joined', {
          channelId,
          userId,
          timestamp: Date.now(),
        });
      }

      logger.info(`User ${userId} joined channel ${channelId}`);

      res.status(200).json({
        success: true,
        message: 'Successfully joined channel',
      });
    } catch (error) {
      logger.error('Error joining channel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to join channel',
      });
    }
  }

  // 채널 나가기
  static async leaveChannel(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const channelId = parseInt(req.params.id);

      if (isNaN(channelId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid channel ID',
        });
        return;
      }

      // 채널 존재 확인
      const channel = await ChannelModel.findById(channelId);
      if (!channel) {
        res.status(404).json({
          success: false,
          error: 'Channel not found',
        });
        return;
      }

      // 멤버인지 확인
      const isMember = await ChannelModel.isMember(channelId, userId);
      if (!isMember) {
        res.status(400).json({
          success: false,
          error: 'Not a member of this channel',
        });
        return;
      }

      // 채널에서 나가기
      await ChannelModel.removeMember(channelId, userId);

      // WebSocket을 통해 채널 나가기 알림
      const io = (req as any).io;
      if (io) {
        io.to(`channel:${channelId}`).emit('user_left', {
          channelId,
          userId,
          timestamp: Date.now(),
        });
      }

      logger.info(`User ${userId} left channel ${channelId}`);

      res.status(200).json({
        success: true,
        message: 'Successfully left channel',
      });
    } catch (error) {
      logger.error('Error leaving channel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to leave channel',
      });
    }
  }
}
