import { Request, Response } from 'express';
import { ChannelInvitationModel } from '../models/ChannelInvitation';
import { UserPrivacySettingsModel } from '../models/UserPrivacySettings';
import { ChannelModel } from '../models/Channel';
import { UserModel, ChatUser } from '../models/User';
import { redisManager } from '../config/redis';
import { createLogger } from '../config/logger';

const logger = createLogger('InvitationController');

// Helper function to get user info (Redis cache → DB fallback)
async function getUserInfo(userId: number): Promise<{ id: number; name: string; email: string; avatarUrl?: string } | null> {
  try {
    const redisClient = redisManager.getClient();
    const userKey = `user:${userId}`;

    // 1. Try Redis first
    const userDataRaw = await redisClient.get(userKey);
    if (userDataRaw) {
      try {
        const parsedData = JSON.parse(userDataRaw);
        const userData = parsedData.value || parsedData;
        if (userData.id) {
          return {
            id: parseInt(userData.id),
            name: userData.name,
            email: userData.email,
            avatarUrl: userData.avatarUrl
          };
        }
      } catch (error) {
        logger.warn('Failed to parse user data from Redis', { userId, error });
      }
    }

    // 2. Fallback to database if not in Redis
    const dbUser = await UserModel.findById(userId);
    if (dbUser) {
      const userInfo = {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        avatarUrl: dbUser.avatarUrl
      };

      // 3. Cache the result in Redis (1 hour TTL)
      try {
        await redisClient.setex(userKey, 3600, JSON.stringify({ value: userInfo }));
      } catch (error) {
        logger.warn('Failed to cache user data to Redis', { userId, error });
      }

      return userInfo;
    }

    return null;
  } catch (error) {
    logger.error('Error getting user info', { userId, error });
    return null;
  }
}

export class InvitationController {
  // Invite user to channel
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

      // Check channel existence and permissions
      const channel = await ChannelModel.findById(channelIdNum);
      if (!channel) {
        res.status(404).json({
          success: false,
          error: 'Channel not found',
        });
        return;
      }

      // Check if inviter is a member of the channel
      const isInviterMember = await ChannelModel.isMember(channelIdNum, userId);
      if (!isInviterMember) {
        res.status(403).json({
          success: false,
          error: 'You must be a member of the channel to invite others',
        });
        return;
      }

      // Check if invitee is already a member
      const isAlreadyMember = await ChannelModel.isMember(channelIdNum, inviteeId);
      if (isAlreadyMember) {
        res.status(400).json({
          success: false,
          error: 'User is already a member of this channel',
        });
        return;
      }

      // Check if there's already a pending invitation
      const hasPendingInvitation = await ChannelInvitationModel.hasPendingInvitation(channelIdNum, inviteeId);
      if (hasPendingInvitation) {
        res.status(400).json({
          success: false,
          error: 'User already has a pending invitation to this channel',
        });
        return;
      }

      // Check privacy settings
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

      // Create invitation
      const invitation = await ChannelInvitationModel.create({
        channelId: channelIdNum,
        inviterId: userId,
        inviteeId,
        message,
      });

      // Get inviter info (Redis cache → DB fallback)
      const inviterData = await getUserInfo(userId);
      if (!inviterData) {
        logger.error('Inviter not found', { userId });
        res.status(404).json({
          success: false,
          error: 'Internal server error',
        });
        return;
      }

      const inviter = {
        id: inviterData.id,
        name: inviterData.name || 'Unknown User',
        email: inviterData.email,
        avatarUrl: inviterData.avatarUrl
      };

      // Send real-time notification to invitee
      try {
        // Dynamically import BroadcastService to resolve circular import issues
        const BroadcastServiceModule = await import('../services/BroadcastService');
        const BroadcastService = BroadcastServiceModule.default;
        const broadcastService = BroadcastService.getInstance();

        if (broadcastService) {
          await broadcastService.broadcastToUser(inviteeId, 'channel_invitation', {
            invitationId: invitation.id,
            channelId: channelIdNum,
            channelName: channel.name,
            inviterName: inviter.name,
            message: message, // Only pass user-entered message (frontend generates default message)
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt
          });

          logger.info(`Real-time invitation notification sent to user ${inviteeId}`, {
            invitationId: invitation.id,
            channelId: channelIdNum,
            inviterId: userId
          });
        } else {
          logger.warn('BroadcastService not available for real-time notifications');
        }
      } catch (notificationError) {
        logger.error('Failed to send real-time invitation notification', {
          error: notificationError,
          inviteeId,
          channelId: channelIdNum
        });
      }

      logger.info(`Channel invitation sent: user ${userId} invited user ${inviteeId} to channel ${channelIdNum}`);

      // Send notification to Gatrix main server as well
      const { gatrixApiService } = require('../services/GatrixApiService');
      await gatrixApiService.sendNotification({
        userId: inviteeId,
        type: 'channel_invite',
        title: `Channel Invitation`,
        content: `${(req as any).user.name || 'Someone'} invited you to join "${channel.name}"`,
        channelId: channelIdNum,
        metadata: {
          invitationId: invitation.id,
          inviterName: (req as any).user.name || 'Unknown User',
          message
        }
      });

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

  // Respond to invitation (accept/decline)
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

      // Find invitation
      const invitation = await ChannelInvitationModel.findById(invitationIdNum);
      if (!invitation) {
        res.status(404).json({
          success: false,
          error: 'Invitation not found',
        });
        return;
      }

      // Check if user is the invitee
      if (invitation.inviteeId !== userId) {
        res.status(403).json({
          success: false,
          error: 'You can only respond to your own invitations',
        });
        return;
      }

      // Check invitation status
      if (invitation.status !== 'pending') {
        res.status(400).json({
          success: false,
          error: 'This invitation has already been responded to',
        });
        return;
      }

      const status = action === 'accept' ? 'accepted' : 'declined';
      const updatedInvitation = await ChannelInvitationModel.respond(invitationIdNum, status);

      // If accepted, add user as channel member
      if (action === 'accept') {
        await ChannelModel.addMember(invitation.channelId, userId, 'member');

        // Notify channel members about new member joining
        const { BroadcastService } = require('../services/BroadcastService');
        const broadcastService = BroadcastService.getInstance();

        await broadcastService.broadcastToChannel(invitation.channelId, 'user_joined_channel', {
          userId,
          channelId: invitation.channelId,
          userName: (req as any).user.name || 'Unknown User',
          timestamp: Date.now(),
        });
      }

      // Notify inviter about response
      const { BroadcastService } = require('../services/BroadcastService');
      const broadcastService = BroadcastService.getInstance();

      await broadcastService.broadcastToUser(invitation.inviterId, 'invitation_response', {
        invitationId: invitation.id,
        channelId: invitation.channelId,
        inviteeId: userId,
        inviteeName: (req as any).user.name || 'Unknown User',
        action,
        timestamp: Date.now(),
      });

      res.json({
        success: true,
        data: updatedInvitation,
        channelId: invitation.channelId, // Used for channel navigation in frontend
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

  // Get my received invitations
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

      // Add channel info and inviter info
      const enrichedInvitations = await Promise.all(
        result.invitations.map(async (invitation) => {
          const [channel, inviter] = await Promise.all([
            ChannelModel.findById(invitation.channelId),
            getUserInfo(invitation.inviterId),
          ]);

          return {
            ...invitation,
            channel: channel ? { id: channel.id, name: channel.name, description: channel.description } : null,
            inviter: inviter ? { id: inviter.id, name: inviter.name, email: inviter.email, avatarUrl: inviter.avatarUrl } : null,
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

  // Get my sent invitations
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

      // Add channel info and invitee info
      const enrichedInvitations = await Promise.all(
        result.invitations.map(async (invitation) => {
          const [channel, invitee] = await Promise.all([
            ChannelModel.findById(invitation.channelId),
            getUserInfo(invitation.inviteeId),
          ]);

          return {
            ...invitation,
            channel: channel ? { id: channel.id, name: channel.name, description: channel.description } : null,
            invitee: invitee ? { id: invitee.id, name: invitee.name, email: invitee.email, avatarUrl: invitee.avatarUrl } : null,
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

  // Get channel's pending invitations
  static async getChannelPendingInvitations(req: Request, res: Response): Promise<void> {
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

      // Check channel existence and permissions
      const channel = await ChannelModel.findById(channelIdNum);
      if (!channel) {
        res.status(404).json({
          success: false,
          error: 'Channel not found',
        });
        return;
      }

      // Check if user is a channel member
      const isMember = await ChannelModel.isMember(channelIdNum, userId);
      if (!isMember) {
        res.status(403).json({
          success: false,
          error: 'You must be a member of the channel to view pending invitations',
        });
        return;
      }

      const result = await ChannelInvitationModel.findByChannelId(
        channelIdNum,
        'pending',
        { limit: 100 } // Maximum 100 items
      );

      // Add invitee info
      const enrichedInvitations = await Promise.all(
        result.invitations.map(async (invitation) => {
          const invitee = await getUserInfo(invitation.inviteeId);
          return {
            ...invitation,
            invitee: invitee ? { id: invitee.id, name: invitee.name, email: invitee.email, avatarUrl: invitee.avatarUrl } : null,
          };
        })
      );

      res.json({
        success: true,
        data: enrichedInvitations,
      });
    } catch (error) {
      logger.error('Failed to get channel pending invitations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get channel pending invitations',
      });
    }
  }

  // Cancel invitation
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

      // Notify invitee about cancellation
      const { BroadcastService } = require('../services/BroadcastService');
      const broadcastService = BroadcastService.getInstance();

      await broadcastService.broadcastToUser(cancelledInvitation.inviteeId, 'invitation_cancelled', {
        invitationId: cancelledInvitation.id,
        channelId: cancelledInvitation.channelId,
        inviterName: (req as any).user.name || 'Unknown User',
        timestamp: Date.now(),
      });

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
