import redisClient from '../config/redis';
import { config } from '../config';
import logger from '../config/logger';

export class SessionManager {
  private static readonly SESSION_PREFIX = 'gatrix:session:';
  private static readonly USER_SESSIONS_PREFIX = 'gatrix:user_sessions:';

  /**
   * Get all active sessions for a user
   */
  static async getUserSessions(userId: number): Promise<string[]> {
    try {
      const client = redisClient.getClient();
      const sessionIds = await client.sMembers(`${this.USER_SESSIONS_PREFIX}${userId}`);
      return sessionIds;
    } catch (error) {
      logger.error('Error getting user sessions:', error);
      return [];
    }
  }

  /**
   * Add session to user's active sessions
   */
  static async addUserSession(userId: number, sessionId: string): Promise<void> {
    try {
      const client = redisClient.getClient();
      const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;

      // Add session to user's session set
      await client.sAdd(userSessionsKey, sessionId);

      // Set TTL for user sessions tracking
      await client.expire(userSessionsKey, config.session.ttl);
    } catch (error) {
      logger.error('Error adding user session:', error);
    }
  }

  /**
   * Remove session from user's active sessions
   */
  static async removeUserSession(userId: number, sessionId: string): Promise<void> {
    try {
      const client = redisClient.getClient();
      const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;

      await client.sRem(userSessionsKey, sessionId);

      // If no more sessions, remove the key
      const remainingSessions = await client.sCard(userSessionsKey);
      if (remainingSessions === 0) {
        await client.del(userSessionsKey);
      }
    } catch (error) {
      logger.error('Error removing user session:', error);
    }
  }

  /**
   * Destroy all sessions for a user (useful for logout all devices)
   */
  static async destroyAllUserSessions(userId: number): Promise<void> {
    try {
      const client = redisClient.getClient();
      const sessionIds = await this.getUserSessions(userId);

      // Delete all session data
      const sessionKeys = sessionIds.map((id) => `${this.SESSION_PREFIX}${id}`);
      if (sessionKeys.length > 0) {
        await client.del(sessionKeys);
      }

      // Remove user sessions tracking
      await client.del(`${this.USER_SESSIONS_PREFIX}${userId}`);

      logger.info(`Destroyed ${sessionIds.length} sessions for user ${userId}`);
    } catch (error) {
      logger.error('Error destroying user sessions:', error);
    }
  }

  /**
   * Get session data
   */
  static async getSession(sessionId: string): Promise<any> {
    try {
      const client = redisClient.getClient();
      const sessionData = await client.get(`${this.SESSION_PREFIX}${sessionId}`);
      return sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
      logger.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Update session TTL
   */
  static async refreshSession(sessionId: string): Promise<void> {
    try {
      const client = redisClient.getClient();
      await client.expire(`${this.SESSION_PREFIX}${sessionId}`, config.session.ttl);
    } catch (error) {
      logger.error('Error refreshing session:', error);
    }
  }

  /**
   * Get active session count for a user
   */
  static async getUserSessionCount(userId: number): Promise<number> {
    try {
      const client = redisClient.getClient();
      return await client.sCard(`${this.USER_SESSIONS_PREFIX}${userId}`);
    } catch (error) {
      logger.error('Error getting user session count:', error);
      return 0;
    }
  }

  /**
   * Clean up expired session tracking
   */
  static async cleanupExpiredSessions(): Promise<void> {
    try {
      const client = redisClient.getClient();

      // Get all user session tracking keys
      const userSessionKeys = await client.keys(`${this.USER_SESSIONS_PREFIX}*`);

      for (const userKey of userSessionKeys) {
        const sessionIds = await client.sMembers(userKey);
        const validSessions: string[] = [];

        // Check which sessions still exist
        for (const sessionId of sessionIds) {
          const exists = await client.exists(`${this.SESSION_PREFIX}${sessionId}`);
          if (exists) {
            validSessions.push(sessionId);
          }
        }

        // Update the user sessions set with only valid sessions
        if (validSessions.length > 0) {
          await client.del(userKey);
          await client.sAdd(userKey, validSessions);
          await client.expire(userKey, config.session.ttl);
        } else {
          await client.del(userKey);
        }
      }

      logger.info('Session cleanup completed');
    } catch (error) {
      logger.error('Error during session cleanup:', error);
    }
  }
}
