import { Request, Response } from 'express';
import { MessageModel } from '../models/Message';
import { ChannelModel } from '../models/Channel';
import { CreateMessageData, UpdateMessageData, SearchQuery } from '../types/chat';
import { metricsService } from '../services/MetricsService';
import logger from '../config/logger';

export class MessageController {
  // 메시지 생성
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const data: CreateMessageData = req.body;

      // 입력 검증
      if (!data.content || !data.channelId) {
        res.status(400).json({
          success: false,
          error: 'Content and channelId are required',
        });
        return;
      }

      // 채널 멤버십 확인
      const isMember = await ChannelModel.isMember(data.channelId, userId);
      if (!isMember) {
        res.status(403).json({
          success: false,
          error: 'Access denied to this channel',
        });
        return;
      }

      const startTime = Date.now();
      const message = await MessageModel.create(data, userId);
      const latency = (Date.now() - startTime) / 1000;

      metricsService.recordMessage(data.channelId.toString(), data.contentType || 'text');
      metricsService.recordMessageLatency('message_create', latency);

      res.status(201).json({
        success: true,
        data: message,
        message: 'Message created successfully',
      });

      logger.info(`Message created: ${message.id} in channel ${data.channelId} by user ${userId}`);
    } catch (error) {
      logger.error('Error creating message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create message',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // 메시지 조회
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const messageId = parseInt(req.params.id);
      const userId = (req as any).user.id;

      if (isNaN(messageId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid message ID',
        });
        return;
      }

      const message = await MessageModel.findById(messageId);
      if (!message) {
        res.status(404).json({
          success: false,
          error: 'Message not found',
        });
        return;
      }

      // 채널 접근 권한 확인
      const isMember = await ChannelModel.isMember(message.channelId, userId);
      if (!isMember) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      res.json({
        success: true,
        data: message,
      });
    } catch (error) {
      logger.error('Error getting message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get message',
      });
    }
  }

  // 채널의 메시지 목록 조회
  static async getByChannelId(req: Request, res: Response): Promise<void> {
    try {
      const channelId = parseInt(req.params.channelId);
      const userId = (req as any).user.id;
      const {
        limit = 50,
        before,
        after,
        includeDeleted = false,
      } = req.query;

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
          error: 'Access denied to this channel',
        });
        return;
      }

      const options = {
        limit: Number(limit),
        beforeMessageId: before ? parseInt(before as string) : undefined,
        afterMessageId: after ? parseInt(after as string) : undefined,
        includeDeleted: includeDeleted === 'true',
      };

      const result = await MessageModel.findByChannelId(channelId, options);

      res.json({
        success: true,
        data: result.messages,
        pagination: {
          total: result.total,
          hasMore: result.hasMore,
          limit: Number(limit),
        },
      });
    } catch (error) {
      logger.error('Error getting channel messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get messages',
      });
    }
  }

  // 메시지 업데이트
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const messageId = parseInt(req.params.id);
      const userId = (req as any).user.id;
      const data: UpdateMessageData = req.body;

      if (isNaN(messageId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid message ID',
        });
        return;
      }

      if (!data.content) {
        res.status(400).json({
          success: false,
          error: 'Content is required',
        });
        return;
      }

      const message = await MessageModel.update(messageId, data, userId);
      if (!message) {
        res.status(404).json({
          success: false,
          error: 'Message not found or no permission to edit',
        });
        return;
      }

      res.json({
        success: true,
        data: message,
        message: 'Message updated successfully',
      });

      logger.info(`Message updated: ${messageId} by user ${userId}`);
    } catch (error) {
      logger.error('Error updating message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update message',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // 메시지 삭제
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const messageId = parseInt(req.params.id);
      const userId = (req as any).user.id;

      if (isNaN(messageId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid message ID',
        });
        return;
      }

      const success = await MessageModel.delete(messageId, userId);
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Message not found or no permission to delete',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Message deleted successfully',
      });

      logger.info(`Message deleted: ${messageId} by user ${userId}`);
    } catch (error) {
      logger.error('Error deleting message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete message',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // 메시지 핀 토글
  static async togglePin(req: Request, res: Response): Promise<void> {
    try {
      const messageId = parseInt(req.params.id);
      const userId = (req as any).user.id;

      if (isNaN(messageId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid message ID',
        });
        return;
      }

      const success = await MessageModel.togglePin(messageId, userId);
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Message not found or no permission to pin',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Message pin status updated successfully',
      });

      logger.info(`Message pin toggled: ${messageId} by user ${userId}`);
    } catch (error) {
      logger.error('Error toggling message pin:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle message pin',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // 메시지 검색
  static async search(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const {
        q: query,
        channelId,
        contentType,
        dateFrom,
        dateTo,
        hasAttachments,
        isPinned,
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

      // 채널 ID가 제공된 경우 접근 권한 확인
      if (channelId) {
        const isMember = await ChannelModel.isMember(parseInt(channelId as string), userId);
        if (!isMember) {
          res.status(403).json({
            success: false,
            error: 'Access denied to this channel',
          });
          return;
        }
      }

      const offset = (Number(page) - 1) * Number(limit);
      const options = {
        userId,
        contentType: contentType as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        hasAttachments: hasAttachments === 'true' ? true : hasAttachments === 'false' ? false : undefined,
        isPinned: isPinned === 'true' ? true : isPinned === 'false' ? false : undefined,
        limit: Number(limit),
        offset,
      };

      const result = await MessageModel.search(
        query,
        channelId ? parseInt(channelId as string) : undefined,
        options
      );

      res.json({
        success: true,
        data: result.messages,
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
      logger.error('Error searching messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search messages',
      });
    }
  }

  // 스레드 메시지 조회
  static async getThreadMessages(req: Request, res: Response): Promise<void> {
    try {
      const threadId = parseInt(req.params.threadId);
      const userId = (req as any).user.id;
      const {
        page = 1,
        limit = 20,
      } = req.query;

      if (isNaN(threadId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid thread ID',
        });
        return;
      }

      // 스레드 원본 메시지 조회하여 채널 확인
      const originalMessage = await MessageModel.findById(threadId);
      if (!originalMessage) {
        res.status(404).json({
          success: false,
          error: 'Thread not found',
        });
        return;
      }

      // 채널 접근 권한 확인
      const isMember = await ChannelModel.isMember(originalMessage.channelId, userId);
      if (!isMember) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const offset = (Number(page) - 1) * Number(limit);
      const options = {
        limit: Number(limit),
        offset,
      };

      const result = await MessageModel.getThreadMessages(threadId, options);

      res.json({
        success: true,
        data: result.messages,
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
      logger.error('Error getting thread messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get thread messages',
      });
    }
  }

  // 배치 메시지 삭제
  static async batchDelete(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { messageIds } = req.body;

      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Message IDs array is required',
        });
        return;
      }

      const deletedCount = await MessageModel.batchDelete(messageIds, userId);

      res.json({
        success: true,
        data: { deletedCount },
        message: `${deletedCount} messages deleted successfully`,
      });

      logger.info(`Batch delete: ${deletedCount} messages by user ${userId}`);
    } catch (error) {
      logger.error('Error batch deleting messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete messages',
      });
    }
  }

  // 특정 채널에 메시지 생성 (채널 ID가 URL 파라미터로 전달됨)
  static async createInChannel(req: Request, res: Response): Promise<void> {
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

      // multipart/form-data 또는 JSON 데이터 처리
      let content: string;
      let contentType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' = 'text';
      let attachments: any[] = [];

      if (req.body.content) {
        // JSON 또는 form-data에서 content 추출
        content = req.body.content;
      } else {
        res.status(400).json({
          success: false,
          error: 'Content is required',
        });
        return;
      }

      // 파일 첨부가 있는 경우 처리
      if ((req as any).files && (req as any).files.length > 0) {
        contentType = 'file';
        attachments = (req as any).files.map((file: any) => ({
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path || file.buffer,
        }));
      }

      const data: CreateMessageData = {
        content,
        contentType,
        channelId,
        replyToMessageId: req.body.replyToId ? parseInt(req.body.replyToId) : undefined,
        messageData: req.body.metadata ? JSON.parse(req.body.metadata) : undefined,
      };

      // 채널 접근 권한 확인
      const hasAccess = await ChannelModel.hasAccess(channelId, userId);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          error: 'Access denied to this channel',
        });
        return;
      }

      const startTime = Date.now();
      // 실제 데이터베이스에 메시지 저장
      const message = await MessageModel.create(data, userId);
      const latency = (Date.now() - startTime) / 1000;

      metricsService.recordMessage(channelId.toString(), data.contentType || 'text');
      metricsService.recordMessageLatency('message_create', latency);

      res.status(201).json({
        success: true,
        data: message,
        message: 'Message created successfully',
      });

      // WebSocket을 통해 실시간으로 메시지 전송
      const io = (req as any).io;
      if (io) {
        io.to(`channel:${channelId}`).emit('message', {
          type: 'message_created',
          data: message,
          channelId,
          userId
        });
      }

      logger.info(`Message created: ${message.id} in channel ${channelId} by user ${userId}`);
    } catch (error) {
      logger.error('Error creating message in channel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create message',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
