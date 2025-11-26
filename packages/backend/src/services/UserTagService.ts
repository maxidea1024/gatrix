import { UserModel } from '../models/User';
import { GatrixError } from '../middleware/errorHandler';
import logger from '../config/logger';

export class UserTagService {
  // 사용자 태그 조회
  static async getUserTags(userId: number): Promise<any[]> {
    try {
      return await UserModel.getTags(userId);
    } catch (error) {
      logger.error('Error getting user tags:', error);
      throw new GatrixError('Failed to get user tags', 500);
    }
  }

  // 사용자 태그 설정 (기존 태그 모두 교체)
  static async setUserTags(userId: number, tagIds: number[], updatedBy: number): Promise<void> {
    try {
      // 사용자 존재 확인
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new GatrixError('User not found', 404);
      }

      await UserModel.setTags(userId, tagIds, updatedBy);
    } catch (error) {
      logger.error('Error setting user tags:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to set user tags', 500);
    }
  }

  // 사용자에게 태그 추가
  static async addUserTag(userId: number, tagId: number, createdBy: number): Promise<void> {
    try {
      // 사용자 존재 확인
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new GatrixError('User not found', 404);
      }

      await UserModel.addTag(userId, tagId, createdBy);
    } catch (error) {
      logger.error('Error adding user tag:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to add user tag', 500);
    }
  }

  // 사용자에서 태그 제거
  static async removeUserTag(userId: number, tagId: number): Promise<void> {
    try {
      // 사용자 존재 확인
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new GatrixError('User not found', 404);
      }

      await UserModel.removeTag(userId, tagId);
    } catch (error) {
      logger.error('Error removing user tag:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to remove user tag', 500);
    }
  }
}
