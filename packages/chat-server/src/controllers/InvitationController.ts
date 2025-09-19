import { Request, Response } from 'express';
import { ChannelInvitationModel } from '../models/ChannelInvitation';
import { UserPrivacySettingsModel } from '../models/UserPrivacySettings';
import { ChannelModel } from '../models/Channel';
import { userSyncService } from '../services/UserSyncService';
import logger from '../config/logger';

export class InvitationController {
  // 채널에 사용자 초대
  static async inviteUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { channelId } = req.params;
      const { inviteeId, message } = req.body;

      if (!inviteeId || typeof inviteeId !== 'number') {
        res.status(400).json({
          success: false,
          error: 'Invitee ID is required',
        });
        return;
      }

      const channelIdNum = parseInt(channelId);
      if (isNaN(channelIdNum)) {
        res.status(400).json({
          success: false,
          error: 'Invalid channel ID',
        });
        return;
      }

      // 채널 존재 여부 및 권한 확인
      const channel = await ChannelModel.findById(channelIdNum);
      if (!channel) {
        res.status(404).json({
          success: false,
          error: 'Channel not found',
        });
        return;
      }

      // 초대자가 채널 멤버인지 확인
      const isInviterMember = await ChannelModel.isMember(channelIdNum, userId);
      if (!isInviterMember) {
        res.status(403).json({
          success: false,
          error: 'You must be a member of the channel to invite others',
        });
        return;
      }

      // 초대받을 사용자가 이미 멤버인지 확인
      const isAlreadyMember = await ChannelModel.isMember(channelIdNum, inviteeId);
      if (isAlreadyMember) {
        res.status(400).json({
          success: false,
          error: 'User is already a member of this channel',
        });
        return;
      }

      // 이미 대기 중인 초대가 있는지 확인
      const hasPendingInvitation = await ChannelInvitationModel.hasPendingInvitation(channelIdNum, inviteeId);
      if (hasPendingInvitation) {
        res.status(400).json({
          success: false,
          error: 'User already has a pending invitation to this channel',
        });
        return;
      }

      // 프라이버시 설정 확인
      const invitePermission = await UserPrivacySettingsModel.canInviteUser(userId, inviteeId, 'channel');
      if (!invitePermission.canInvite) {
        let errorMessage = 'Cannot invite this user';
        switch (invitePermission.reason) {
          case 'blocked':
            errorMessage = 'You have been blocked by this user';
            break;
          case 'policy_nobody':
            errorMessage = 'This user does not accept channel invitations';
            break;
          case 'policy_contacts_only':
            errorMessage = 'This user only accepts invitations from contacts';
            break;
        }
        
        res.status(403).json({
          success: false,
          error: errorMessage,
        });
        return;
      }

      // 초대 생성
      const invitation = await ChannelInvitationModel.create({
        channelId: channelIdNum,
        inviterId: userId,
        inviteeId,
        message,
      });

      // 초대받은 사용자에게 실시간 알림 전송
      // TODO: Implement broadcast service integration
      // await broadcastService.broadcastToUser(inviteeId, 'channel_invitation', {
      //   invitationId: invitation.id,
      //   channelId: channelIdNum,
      //   channelName: channel.name,
      //   inviterId: userId,
      //   inviterName: (req as any).user.name || 'Unknown User',
      //   message,
      //   timestamp: Date.now(),
      // });

      logger.info(`User ${userId} invited user ${inviteeId} to channel ${channelIdNum}`);

      res.status(201).json({
        success: true,
        data: invitation,
        message: 'Invitation sent successfully',
      });
    } catch (error) {
      logger.error('Failed to invite user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send invitation',
      });
    }
  }

  // 초대 응답 (수락/거절)
  static async respondToInvitation(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { invitationId } = req.params;
      const { action } = req.body; // 'accept' or 'decline'

      if (!['accept', 'decline'].includes(action)) {
        res.status(400).json({
          success: false,
          error: 'Action must be "accept" or "decline"',
        });
        return;
      }

      const invitationIdNum = parseInt(invitationId);
      if (isNaN(invitationIdNum)) {
        res.status(400).json({
          success: false,
          error: 'Invalid invitation ID',
        });
        return;
      }

      // 초대 조회
      const invitation = await ChannelInvitationModel.findById(invitationIdNum);
      if (!invitation) {
        res.status(404).json({
          success: false,
          error: 'Invitation not found',
        });
        return;
      }

      // 초대받은 사용자인지 확인
      if (invitation.inviteeId !== userId) {
        res.status(403).json({
          success: false,
          error: 'You can only respond to your own invitations',
        });
        return;
      }

      // 초대 상태 확인
      if (invitation.status !== 'pending') {
        res.status(400).json({
          success: false,
          error: 'This invitation has already been responded to',
        });
        return;
      }

      const status = action === 'accept' ? 'accepted' : 'declined';
      const updatedInvitation = await ChannelInvitationModel.respond(invitationIdNum, status);

      // 수락한 경우 채널에 멤버로 추가
      if (action === 'accept') {
        await ChannelModel.addMember(invitation.channelId, userId, 'member');
        
        // 채널 멤버들에게 새 멤버 참여 알림
        // TODO: Implement broadcast service integration
        // await broadcastService.broadcastToChannel(invitation.channelId, 'user_joined_channel', {
        //   userId,
        //   channelId: invitation.channelId,
        //   timestamp: Date.now(),
        // });
      }

      // 초대한 사용자에게 응답 알림
      // TODO: Implement broadcast service integration
      // await broadcastService.broadcastToUser(invitation.inviterId, 'invitation_response', {
      //   invitationId: invitation.id,
      //   channelId: invitation.channelId,
      //   inviteeId: userId,
      //   action,
      //   timestamp: Date.now(),
      // });

      res.json({
        success: true,
        data: updatedInvitation,
        message: `Invitation ${action}ed successfully`,
      });
    } catch (error) {
      logger.error('Failed to respond to invitation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to respond to invitation',
      });
    }
  }

  // 내가 받은 초대 목록 조회
  static async getMyInvitations(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { status, page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 20, 50);
      const offset = (pageNum - 1) * limitNum;

      const result = await ChannelInvitationModel.findByInviteeId(
        userId,
        status as any,
        { limit: limitNum, offset }
      );

      // 채널 정보와 초대한 사용자 정보 추가
      const enrichedInvitations = await Promise.all(
        result.invitations.map(async (invitation) => {
          const [channel, inviter] = await Promise.all([
            ChannelModel.findById(invitation.channelId),
            userSyncService.getUser(invitation.inviterId),
          ]);

          return {
            ...invitation,
            channel: channel ? { id: channel.id, name: channel.name, description: channel.description } : null,
            inviter: inviter ? { id: inviter.id, name: inviter.name, email: inviter.email } : null,
          };
        })
      );

      res.json({
        success: true,
        data: enrichedInvitations,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: result.total,
          totalPages: Math.ceil(result.total / limitNum),
          hasNext: offset + limitNum < result.total,
          hasPrev: pageNum > 1,
        },
      });
    } catch (error) {
      logger.error('Failed to get invitations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get invitations',
      });
    }
  }

  // 내가 보낸 초대 목록 조회
  static async getMySentInvitations(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { status, page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 20, 50);
      const offset = (pageNum - 1) * limitNum;

      const result = await ChannelInvitationModel.findByInviterId(
        userId,
        status as any,
        { limit: limitNum, offset }
      );

      // 채널 정보와 초대받은 사용자 정보 추가
      const enrichedInvitations = await Promise.all(
        result.invitations.map(async (invitation) => {
          const [channel, invitee] = await Promise.all([
            ChannelModel.findById(invitation.channelId),
            userSyncService.getUser(invitation.inviteeId),
          ]);

          return {
            ...invitation,
            channel: channel ? { id: channel.id, name: channel.name, description: channel.description } : null,
            invitee: invitee ? { id: invitee.id, name: invitee.name, email: invitee.email } : null,
          };
        })
      );

      res.json({
        success: true,
        data: enrichedInvitations,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: result.total,
          totalPages: Math.ceil(result.total / limitNum),
          hasNext: offset + limitNum < result.total,
          hasPrev: pageNum > 1,
        },
      });
    } catch (error) {
      logger.error('Failed to get sent invitations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get sent invitations',
      });
    }
  }

  // 초대 취소
  static async cancelInvitation(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { invitationId } = req.params;

      const invitationIdNum = parseInt(invitationId);
      if (isNaN(invitationIdNum)) {
        res.status(400).json({
          success: false,
          error: 'Invalid invitation ID',
        });
        return;
      }

      const cancelledInvitation = await ChannelInvitationModel.cancel(invitationIdNum, userId);

      // 초대받은 사용자에게 취소 알림
      // TODO: Implement broadcast service integration
      // await broadcastService.broadcastToUser(cancelledInvitation.inviteeId, 'invitation_cancelled', {
      //   invitationId: cancelledInvitation.id,
      //   channelId: cancelledInvitation.channelId,
      //   timestamp: Date.now(),
      // });

      res.json({
        success: true,
        data: cancelledInvitation,
        message: 'Invitation cancelled successfully',
      });
    } catch (error) {
      logger.error('Failed to cancel invitation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel invitation',
      });
    }
  }
}
