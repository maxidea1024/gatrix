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
}
