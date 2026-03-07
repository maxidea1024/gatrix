import { databaseManager } from '../config/database';
import { createLogger } from '../config/logger';

const logger = createLogger('UserModel');

export interface ChatUser {
  id: number;
  gatrixUserId: number;
  email: string;
  name: string;
  avatarUrl?: string;
  role: string;
  status: string;
  lastLoginAt?: Date;
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class UserModel {
  /**
   * Gatrix User ID로 Chat User 조회
   */
  static async findByGatrixUserId(gatrixUserId: number): Promise<ChatUser | null> {
    try {
      const db = databaseManager.getDatabase();
      const user = await db('chat_users').where('gatrixUserId', gatrixUserId).first();

      if (!user) {
        logger.warn(`Chat user not found for Gatrix User ID: ${gatrixUserId}`);
        return null;
      }

      return user;
    } catch (error) {
      logger.error('Error finding user by Gatrix User ID:', error);
      return null;
    }
  }

  /**
   * Chat User ID로 조회
   */
  static async findById(id: number): Promise<ChatUser | null> {
    try {
      const db = databaseManager.getDatabase();
      const user = await db('chat_users').where('id', id).first();

      return user || null;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      return null;
    }
  }

  /**
   * 사용자 생성 또는 업데이트 (동기화용)
   */
  static async upsert(userData: Partial<ChatUser>): Promise<ChatUser | null> {
    try {
      const db = databaseManager.getDatabase();

      if (!userData.gatrixUserId) {
        throw new Error('gatrixUserId is required');
      }

      // 기존 사용자 확인
      const existingUser = await this.findByGatrixUserId(userData.gatrixUserId);

      if (existingUser) {
        // 업데이트
        await db('chat_users').where('gatrixUserId', userData.gatrixUserId).update({
          email: userData.email,
          name: userData.name,
          avatarUrl: userData.avatarUrl,
          role: userData.role,
          status: userData.status,
          lastLoginAt: userData.lastLoginAt,
          lastActivityAt: userData.lastActivityAt,
          updatedAt: new Date(),
        });

        return await this.findByGatrixUserId(userData.gatrixUserId);
      } else {
        // 생성
        const [insertId] = await db('chat_users').insert({
          gatrixUserId: userData.gatrixUserId,
          email: userData.email,
          name: userData.name,
          avatarUrl: userData.avatarUrl,
          role: userData.role || 'user',
          status: userData.status || 'active',
          lastLoginAt: userData.lastLoginAt,
          lastActivityAt: userData.lastActivityAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return await this.findById(insertId);
      }
    } catch (error) {
      logger.error('Error upserting user:', error);
      return null;
    }
  }

  /**
   * 마지막 활동 시간 업데이트
   */
  static async updateLastActivity(gatrixUserId: number): Promise<void> {
    try {
      const db = databaseManager.getDatabase();
      await db('chat_users').where('gatrixUserId', gatrixUserId).update({
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      logger.error('Error updating last activity:', error);
    }
  }

  /**
   * 모든 활성 사용자 조회
   */
  static async findActiveUsers(): Promise<ChatUser[]> {
    try {
      const db = databaseManager.getDatabase();
      const users = await db('chat_users').where('status', 'active').orderBy('name');

      return users;
    } catch (error) {
      logger.error('Error finding active users:', error);
      return [];
    }
  }
}
