import { UserModel } from '../models/User';
import { GatrixError } from '../middleware/errorHandler';
import { createLogger } from '../config/logger';

const logger = createLogger('UserTagService');

export class UserTagService {
  // Used자 태그 조회
  static async getUserTags(userId: string): Promise<any[]> {
    try {
      return await UserModel.getTags(userId);
    } catch (error) {
      logger.error('Error getting user tags:', error);
      throw new GatrixError('Failed to get user tags', 500);
    }
  }

  // Used자 태그 Settings (Existing 태그 All 교체)
  static async setUserTags(userId: string, tagIds: string[], updatedBy: string): Promise<void> {
    try {
      // Check if user exists
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

  // Used자에게 태그 추가
  static async addUserTag(userId: string, tagId: string, createdBy: string): Promise<void> {
    try {
      // Check if user exists
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

  // Used자에서 태그 제거
  static async removeUserTag(userId: string, tagId: string): Promise<void> {
    try {
      // Check if user exists
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
