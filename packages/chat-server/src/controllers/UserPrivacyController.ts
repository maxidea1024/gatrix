import { Request, Response } from 'express';
import { UserPrivacySettingsModel, UpdatePrivacySettingsData } from '../models/UserPrivacySettings';
import logger from '../config/logger';

export class UserPrivacyController {
  // 현재 사용자의 프라이버시 설정 조회
  static async getMySettings(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const settings = await UserPrivacySettingsModel.findByUserId(userId);

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      logger.error('Failed to get privacy settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get privacy settings',
      });
    }
  }

  // 프라이버시 설정 업데이트
  static async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const updateData: UpdatePrivacySettingsData = req.body;

      // 입력 검증
      const allowedFields = [
        'channelInvitePolicy',
        'directMessagePolicy', 
        'discoverableByEmail',
        'discoverableByName',
        'requireFriendRequest',
      ];

      const filteredData: UpdatePrivacySettingsData = {};
      for (const field of allowedFields) {
        if (updateData[field as keyof UpdatePrivacySettingsData] !== undefined) {
          (filteredData as any)[field] = updateData[field as keyof UpdatePrivacySettingsData];
        }
      }

      // 정책 값 검증
      const validPolicies = ['everyone', 'contacts_only', 'nobody'];
      if (filteredData.channelInvitePolicy && !validPolicies.includes(filteredData.channelInvitePolicy)) {
        res.status(400).json({
          success: false,
          error: 'Invalid channel invite policy',
        });
        return;
      }

      if (filteredData.directMessagePolicy && !validPolicies.includes(filteredData.directMessagePolicy)) {
        res.status(400).json({
          success: false,
          error: 'Invalid direct message policy',
        });
        return;
      }

      const updatedSettings = await UserPrivacySettingsModel.update(userId, filteredData);

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Privacy settings updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update privacy settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update privacy settings',
      });
    }
  }

  // 사용자 차단
  static async blockUser(req: Request, res: Response): Promise<void> {
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

      if (userId === targetUserId) {
        res.status(400).json({
          success: false,
          error: 'Cannot block yourself',
        });
        return;
      }

      await UserPrivacySettingsModel.blockUser(userId, targetUserId);

      res.json({
        success: true,
        message: 'User blocked successfully',
      });
    } catch (error) {
      logger.error('Failed to block user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to block user',
      });
    }
  }

  // 사용자 차단 해제
  static async unblockUser(req: Request, res: Response): Promise<void> {
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

      await UserPrivacySettingsModel.unblockUser(userId, targetUserId);

      res.json({
        success: true,
        message: 'User unblocked successfully',
      });
    } catch (error) {
      logger.error('Failed to unblock user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unblock user',
      });
    }
  }

  // 차단된 사용자 목록 조회
  static async getBlockedUsers(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const settings = await UserPrivacySettingsModel.findByUserId(userId);

      res.json({
        success: true,
        data: {
          blockedUsers: settings.blockedUsers,
        },
      });
    } catch (error) {
      logger.error('Failed to get blocked users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get blocked users',
      });
    }
  }

  // 초대 가능 여부 확인 (내부 API)
  static async checkInvitePermission(req: Request, res: Response): Promise<void> {
    try {
      const { inviterId, inviteeId, inviteType } = req.body;

      if (!inviterId || !inviteeId || !inviteType) {
        res.status(400).json({
          success: false,
          error: 'Inviter ID, invitee ID, and invite type are required',
        });
        return;
      }

      if (!['channel', 'direct'].includes(inviteType)) {
        res.status(400).json({
          success: false,
          error: 'Invalid invite type. Must be "channel" or "direct"',
        });
        return;
      }

      const result = await UserPrivacySettingsModel.canInviteUser(inviterId, inviteeId, inviteType);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to check invite permission:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check invite permission',
      });
    }
  }
}
