import { Request, Response } from 'express';
import { ChannelModel } from '../models/Channel';
import { UserPrivacySettingsModel } from '../models/UserPrivacySettings';
import { redisClient } from '../config/redis';
import { createLogger } from '../config/logger';

const logger = createLogger('DirectMessageController');

export class DirectMessageController {
  // 1:1 대화 시작 또는 기존 대화 조회
  static async createOrGetDirectMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { targetUserId } = req.body;

      if (!targetUserId || typeof targetUserId !== 'number') {
        res.status(400).json({
          success: false,
          error: 'Target user ID is required',
        });
        return;
      }

      // 자기 자신과는 대화할 수 없음
      if (userId === targetUserId) {
        res.status(400).json({
          success: false,
          error: 'Cannot start a conversation with yourself',
        });
        return;
      }

      // 대상 사용자가 존재하는지 확인
      const targetUserData = await redisClient.hgetall(`user:${targetUserId}`);
      const targetUser = targetUserData.id ? {
        id: parseInt(targetUserData.id),
        name: targetUserData.name,
        email: targetUserData.email,
        avatar: targetUserData.avatarUrl
      } : null;
      if (!targetUser) {
        res.status(404).json({
          success: false,
          error: 'Target user not found',
        });
        return;
      }

      // 프라이버시 설정 확인
      const dmPermission = await UserPrivacySettingsModel.canInviteUser(userId, targetUserId, 'direct');
      if (!dmPermission.canInvite) {
        let errorMessage = 'Cannot start a conversation with this user';
        switch (dmPermission.reason) {
          case 'blocked':
            errorMessage = 'You have been blocked by this user';
            break;
          case 'policy_nobody':
            errorMessage = 'This user does not accept direct messages';
            break;
          case 'policy_contacts_only':
            errorMessage = 'This user only accepts direct messages from contacts';
            break;
        }
        
        res.status(403).json({
          success: false,
          error: errorMessage,
        });
        return;
      }

      // 기존 1:1 대화 채널이 있는지 확인
      const existingChannel = await DirectMessageController.findExistingDirectChannel(userId, targetUserId);
      
      if (existingChannel) {
        // 기존 채널이 있으면 반환
        res.json({
          success: true,
          data: existingChannel,
          message: 'Existing direct message channel found',
        });
        return;
      }

      // 새로운 1:1 대화 채널 생성
      const currentUserData = await redisClient.hgetall(`user:${userId}`);
      const currentUser = currentUserData.id ? {
        id: parseInt(currentUserData.id),
        name: currentUserData.name,
        email: currentUserData.email,
        avatar: currentUserData.avatarUrl
      } : null;
      const channelName = `${currentUser?.name || 'User'} & ${targetUser.name}`;
      
      const channel = await ChannelModel.create({
        name: channelName,
        description: 'Direct message conversation',
        type: 'direct',
        maxMembers: 2,
        memberIds: [targetUserId], // 대상 사용자를 멤버로 추가
        settings: {
          allowInvites: false, // DM 채널은 초대 불가
          allowFileUploads: true,
          allowReactions: true,
          slowMode: 0,
          maxMessageLength: 10000,
          autoDeleteMessages: false,
          autoDeleteDays: 0,
          requireApproval: false,
          allowedFileTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
          maxFileSize: 10485760, // 10MB
        },
      }, userId);

      // 대상 사용자에게 새 DM 알림
      const { BroadcastService } = require('../services/BroadcastService');
      const broadcastService = BroadcastService.getInstance();

      await broadcastService.broadcastToUser(targetUserId, 'new_direct_message', {
        channelId: channel.id,
        fromUserId: userId,
        fromUserName: currentUser?.name || 'User',
        timestamp: Date.now(),
      });

      res.status(201).json({
        success: true,
        data: channel,
        message: 'Direct message channel created successfully',
      });
    } catch (error) {
      logger.error('Failed to create or get direct message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create or get direct message',
      });
    }
  }

  // 사용자의 모든 1:1 대화 목록 조회
  static async getDirectMessageChannels(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 20, 50);

      // 사용자가 참여한 direct 타입 채널들 조회
      const channels = await ChannelModel.getUserChannels(userId, {
        includeMembers: true,
      });

      // 각 DM 채널의 상대방 정보 추가
      const enrichedChannels = await Promise.all(
        channels.channels.map(async (channel: any) => {
          // DM 채널에서 상대방 찾기
          const otherMember = channel.members?.find((member: any) => member.userId !== userId);
          let otherUser = null;
          
          if (otherMember) {
            const otherUserData = await redisClient.hgetall(`user:${otherMember.userId}`);
            otherUser = otherUserData.id ? {
              id: parseInt(otherUserData.id),
              name: otherUserData.name,
              email: otherUserData.email,
              avatarUrl: otherUserData.avatarUrl
            } : null;
          }

          return {
            ...channel,
            otherUser: otherUser ? {
              id: otherUser.id,
              name: otherUser.name,
              email: otherUser.email,
              avatarUrl: otherUser.avatarUrl,
            } : null,
          };
        })
      );

      res.json({
        success: true,
        data: enrichedChannels,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: channels.total,
          totalPages: Math.ceil(channels.total / limitNum),
          hasNext: (pageNum - 1) * limitNum + limitNum < channels.total,
          hasPrev: pageNum > 1,
        },
      });
    } catch (error) {
      logger.error('Failed to get direct message channels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get direct message channels',
      });
    }
  }

  // 1:1 대화 채널 아카이브 (삭제 대신)
  static async archiveDirectMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { channelId } = req.params;

      const channelIdNum = parseInt(channelId);
      if (isNaN(channelIdNum)) {
        res.status(400).json({
          success: false,
          error: 'Invalid channel ID',
        });
        return;
      }

      // 채널 조회 및 권한 확인
      const channel = await ChannelModel.findById(channelIdNum);
      if (!channel) {
        res.status(404).json({
          success: false,
          error: 'Channel not found',
        });
        return;
      }

      if (channel.type !== 'direct') {
        res.status(400).json({
          success: false,
          error: 'This endpoint is only for direct message channels',
        });
        return;
      }

      // 사용자가 채널 멤버인지 확인
      const isMember = await ChannelModel.isMember(channelIdNum, userId);
      if (!isMember) {
        res.status(403).json({
          success: false,
          error: 'You are not a member of this channel',
        });
        return;
      }

      // 채널에서 나가기 (DM에서는 아카이브와 동일)
      await ChannelModel.removeMember(channelIdNum, userId);

      res.json({
        success: true,
        message: 'Direct message channel archived successfully',
      });
    } catch (error) {
      logger.error('Failed to archive direct message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to archive direct message',
      });
    }
  }

  // 기존 1:1 대화 채널 찾기 (내부 메서드)
  private static async findExistingDirectChannel(userId1: number, userId2: number): Promise<any> {
    try {
      // 두 사용자가 모두 참여한 direct 타입 채널 찾기
      const knex = ChannelModel['knex'];
      
      const channel = await knex('chat_channels as c')
        .select('c.*')
        .join('chat_channel_members as m1', 'c.id', 'm1.channelId')
        .join('chat_channel_members as m2', 'c.id', 'm2.channelId')
        .where('c.type', 'direct')
        .where('c.isArchived', false)
        .where('m1.userId', userId1)
        .where('m1.status', 'active')
        .where('m2.userId', userId2)
        .where('m2.status', 'active')
        .first();

      return channel || null;
    } catch (error) {
      logger.error('Failed to find existing direct channel:', error);
      return null;
    }
  }

  // 1:1 대화 상대방 온라인 상태 확인
  static async getDirectMessageStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { channelId } = req.params;

      const channelIdNum = parseInt(channelId);
      if (isNaN(channelIdNum)) {
        res.status(400).json({
          success: false,
          error: 'Invalid channel ID',
        });
        return;
      }

      // 채널 조회 및 권한 확인
      const channel = await ChannelModel.findById(channelIdNum);
      if (!channel || channel.type !== 'direct') {
        res.status(404).json({
          success: false,
          error: 'Direct message channel not found',
        });
        return;
      }

      const isMember = await ChannelModel.isMember(channelIdNum, userId);
      if (!isMember) {
        res.status(403).json({
          success: false,
          error: 'You are not a member of this channel',
        });
        return;
      }

      // 상대방 찾기
      const members = await ChannelModel.getMembers(channelIdNum);
      const otherMember = members.find(member => member.userId !== userId);
      
      if (!otherMember) {
        res.status(404).json({
          success: false,
          error: 'Other user not found',
        });
        return;
      }

      // 실제 온라인 상태 확인 로직 구현
      const { redisManager } = require('../config/redis');
      const redisClient = redisManager.getClient();

      let isOnline = false;
      let lastSeen = null;

      try {
        // Redis에서 사용자 상태 확인
        const userStatus = await redisClient.hgetall(`user:${otherMember.userId}`);
        if (userStatus && userStatus.status) {
          isOnline = userStatus.status === 'online';
          lastSeen = userStatus.lastSeen ? new Date(parseInt(userStatus.lastSeen)) : null;
        }
      } catch (error) {
        logger.warn('Failed to get user status from Redis:', error);
      }

      res.json({
        success: true,
        data: {
          otherUserId: otherMember.userId,
          isOnline,
          lastSeen,
        },
      });
    } catch (error) {
      logger.error('Failed to get direct message status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get direct message status',
      });
    }
  }
}
