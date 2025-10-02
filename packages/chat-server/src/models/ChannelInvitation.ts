import { databaseManager } from '../config/database';
import logger from '../config/logger';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export interface ChannelInvitationType {
  id: number;
  channelId: number;
  inviterId: number;
  inviteeId: number;
  status: InvitationStatus;
  message?: string;
  expiresAt?: Date;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInvitationData {
  channelId: number;
  inviterId: number;
  inviteeId: number;
  message?: string;
  expiresAt?: Date;
}

export class ChannelInvitationModel {
  private static get knex() {
    return databaseManager.getKnex();
  }

  // 초대 생성
  static async create(data: CreateInvitationData): Promise<ChannelInvitationType> {
    try {
      // pending 상태의 중복 초대 체크
      const existingPendingInvitation = await this.knex('chat_channel_invitations')
        .where({
          channelId: data.channelId,
          inviteeId: data.inviteeId,
          status: 'pending'
        })
        .first();

      if (existingPendingInvitation) {
        throw new Error('User already has a pending invitation to this channel');
      }

      // 기본 만료 시간: 7일 후
      const defaultExpiresAt = new Date();
      defaultExpiresAt.setDate(defaultExpiresAt.getDate() + 7);

      const invitationData = {
        ...data,
        expiresAt: data.expiresAt || defaultExpiresAt,
        status: 'pending' as InvitationStatus,
      };

      const [invitationId] = await this.knex('chat_channel_invitations').insert(invitationData);

      const invitation = await this.findById(invitationId);
      if (!invitation) {
        throw new Error('Failed to create invitation');
      }

      return invitation;
    } catch (error) {
      logger.error('Failed to create channel invitation:', error);
      throw error;
    }
  }

  // ID로 초대 조회
  static async findById(id: number): Promise<ChannelInvitationType | null> {
    try {
      const invitation = await this.knex('chat_channel_invitations')
        .where('id', id)
        .first();

      return invitation || null;
    } catch (error) {
      logger.error(`Failed to find invitation ${id}:`, error);
      throw error;
    }
  }

  // 사용자의 받은 초대 목록 조회
  static async findByInviteeId(
    inviteeId: number, 
    status?: InvitationStatus,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ invitations: ChannelInvitationType[]; total: number }> {
    try {
      let query = this.knex('chat_channel_invitations')
        .where('inviteeId', inviteeId);

      if (status) {
        query = query.where('status', status);
      }

      // 총 개수 조회
      const totalQuery = query.clone().count('* as count').first();
      const totalResult = await totalQuery as any;
      const total = totalResult?.count || 0;

      // 페이지네이션
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.offset(options.offset);
      }

      // 최신순 정렬
      query = query.orderBy('createdAt', 'desc');

      const invitations = await query;

      return { invitations, total };
    } catch (error) {
      logger.error(`Failed to find invitations for invitee ${inviteeId}:`, error);
      throw error;
    }
  }

  // 사용자가 보낸 초대 목록 조회
  static async findByInviterId(
    inviterId: number,
    status?: InvitationStatus,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ invitations: ChannelInvitationType[]; total: number }> {
    try {
      let query = this.knex('chat_channel_invitations')
        .where('inviterId', inviterId);

      if (status) {
        query = query.where('status', status);
      }

      // 총 개수 조회
      const totalQuery = query.clone().count('* as count').first();
      const totalResult = await totalQuery as any;
      const total = totalResult?.count || 0;

      // 페이지네이션
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.offset(options.offset);
      }

      // 최신순 정렬
      query = query.orderBy('createdAt', 'desc');

      const invitations = await query;

      return { invitations, total };
    } catch (error) {
      logger.error(`Failed to find invitations by inviter ${inviterId}:`, error);
      throw error;
    }
  }

  // 채널의 초대 목록 조회
  static async findByChannelId(
    channelId: number,
    status?: InvitationStatus,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ invitations: ChannelInvitationType[]; total: number }> {
    try {
      let query = this.knex('chat_channel_invitations')
        .where('channelId', channelId);

      if (status) {
        query = query.where('status', status);
      }

      // 총 개수 조회
      const totalQuery = query.clone().count('* as count').first();
      const totalResult = await totalQuery as any;
      const total = totalResult?.count || 0;

      // 페이지네이션
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.offset(options.offset);
      }

      // 최신순 정렬
      query = query.orderBy('createdAt', 'desc');

      const invitations = await query;

      return { invitations, total };
    } catch (error) {
      logger.error(`Failed to find invitations for channel ${channelId}:`, error);
      throw error;
    }
  }

  // 초대 응답 (수락/거절)
  static async respond(id: number, status: 'accepted' | 'declined'): Promise<ChannelInvitationType> {
    try {
      const invitation = await this.findById(id);
      if (!invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Invitation is not pending');
      }

      // 만료 확인
      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        await this.knex('chat_channel_invitations')
          .where('id', id)
          .update({ status: 'expired', updatedAt: new Date() });
        throw new Error('Invitation has expired');
      }

      await this.knex('chat_channel_invitations')
        .where('id', id)
        .update({
          status,
          respondedAt: new Date(),
          updatedAt: new Date(),
        });

      const updatedInvitation = await this.findById(id);
      if (!updatedInvitation) {
        throw new Error('Failed to update invitation');
      }

      return updatedInvitation;
    } catch (error) {
      logger.error(`Failed to respond to invitation ${id}:`, error);
      throw error;
    }
  }

  // 초대 취소
  static async cancel(id: number, cancelledBy: number): Promise<ChannelInvitationType> {
    try {
      const invitation = await this.findById(id);
      if (!invitation) {
        throw new Error('Invitation not found');
      }

      // 초대한 사람만 취소 가능
      if (invitation.inviterId !== cancelledBy) {
        throw new Error('Only the inviter can cancel the invitation');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Only pending invitations can be cancelled');
      }

      await this.knex('chat_channel_invitations')
        .where('id', id)
        .update({
          status: 'cancelled',
          updatedAt: new Date(),
        });

      const updatedInvitation = await this.findById(id);
      if (!updatedInvitation) {
        throw new Error('Failed to cancel invitation');
      }

      return updatedInvitation;
    } catch (error) {
      logger.error(`Failed to cancel invitation ${id}:`, error);
      throw error;
    }
  }

  // 만료된 초대 정리
  static async cleanupExpiredInvitations(): Promise<number> {
    try {
      const result = await this.knex('chat_channel_invitations')
        .where('status', 'pending')
        .where('expiresAt', '<', new Date())
        .update({
          status: 'expired',
          updatedAt: new Date(),
        });

      logger.info(`Cleaned up ${result} expired invitations`);
      return result;
    } catch (error) {
      logger.error('Failed to cleanup expired invitations:', error);
      throw error;
    }
  }

  // 중복 초대 확인
  static async hasPendingInvitation(channelId: number, inviteeId: number): Promise<boolean> {
    try {
      const result = await this.knex('chat_channel_invitations')
        .where({
          channelId,
          inviteeId,
          status: 'pending',
        })
        .count('* as count')
        .first();

      return Number(result?.count) > 0;
    } catch (error) {
      logger.error(`Failed to check pending invitation for channel ${channelId}, user ${inviteeId}:`, error);
      return false;
    }
  }
}
