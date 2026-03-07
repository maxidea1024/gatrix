import { databaseManager } from '../config/database';
import { createLogger } from '../config/logger';

const logger = createLogger('MessageReaction');

export interface MessageReaction {
  id: number;
  messageId: number;
  userId: number;
  emoji: string;

  // 관계형 데이터
  user?: {
    id: number;
    gatrixUserId: number;
    name: string;
    username: string;
    avatarUrl?: string;
  };
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  users: Array<{
    id: number;
    gatrixUserId: number;
    name: string;
    username: string;
    avatarUrl?: string;
  }>;
  hasReacted: boolean; // 현재 사용자가 이 이모지로 리액션했는지
}

export class MessageReactionModel {
  /**
   * 메시지에 리액션 추가
   */
  static async addReaction(
    messageId: number,
    userId: number,
    emoji: string
  ): Promise<MessageReaction> {
    try {
      const db = databaseManager.getKnex();

      // 이미 같은 리액션이 있는지 확인
      const existingReaction = await db('chat_message_reactions')
        .where({ messageId, userId, emoji })
        .first();

      if (existingReaction) {
        throw new Error('User has already reacted with this emoji');
      }

      const [reactionId] = await db('chat_message_reactions').insert({
        messageId,
        userId,
        emoji,
      });

      return await this.findById(reactionId);
    } catch (error) {
      logger.error('Error adding reaction:', error);
      throw error;
    }
  }

  /**
   * 리액션 제거
   */
  static async removeReaction(messageId: number, userId: number, emoji: string): Promise<boolean> {
    try {
      const db = databaseManager.getKnex();

      const deletedCount = await db('chat_message_reactions')
        .where({ messageId, userId, emoji })
        .del();

      return deletedCount > 0;
    } catch (error) {
      logger.error('Error removing reaction:', error);
      throw error;
    }
  }

  /**
   * 리액션 토글 (있으면 제거, 없으면 추가)
   */
  static async toggleReaction(
    messageId: number,
    userId: number,
    emoji: string
  ): Promise<{ action: 'added' | 'removed'; reaction?: MessageReaction }> {
    try {
      const db = databaseManager.getKnex();

      const existingReaction = await db('chat_message_reactions')
        .where({ messageId, userId, emoji })
        .first();

      if (existingReaction) {
        await this.removeReaction(messageId, userId, emoji);
        return { action: 'removed' };
      } else {
        const reaction = await this.addReaction(messageId, userId, emoji);
        return { action: 'added', reaction };
      }
    } catch (error) {
      logger.error('Error toggling reaction:', error);
      throw error;
    }
  }

  /**
   * ID로 리액션 조회
   */
  static async findById(id: number): Promise<MessageReaction> {
    try {
      const db = databaseManager.getKnex();

      const reaction = await db('chat_message_reactions as r')
        .leftJoin('chat_users as u', 'r.userId', 'u.gatrixUserId')
        .select(
          'r.*',
          'u.id as user_id',
          'u.gatrixUserId as user_gatrixUserId',
          'u.name as user_name',
          'u.username as user_username',
          'u.avatarUrl as user_avatarUrl'
        )
        .where('r.id', id)
        .first();

      if (!reaction) {
        throw new Error('Reaction not found');
      }

      return {
        id: reaction.id,
        messageId: reaction.messageId,
        userId: reaction.userId,
        emoji: reaction.emoji,
        user: reaction.user_id
          ? {
              id: reaction.user_id,
              gatrixUserId: reaction.user_gatrixUserId,
              name: reaction.user_name,
              username: reaction.user_username,
              avatarUrl: reaction.user_avatarUrl,
            }
          : undefined,
      };
    } catch (error) {
      logger.error('Error finding reaction by ID:', error);
      throw error;
    }
  }

  /**
   * 메시지의 모든 리액션 조회 (요약 형태)
   */
  static async getReactionSummary(
    messageId: number,
    currentUserId?: number
  ): Promise<ReactionSummary[]> {
    try {
      const db = databaseManager.getKnex();

      const reactions = await db('chat_message_reactions as r')
        .leftJoin('chat_users as u', 'r.userId', 'u.gatrixUserId')
        .select(
          'r.emoji',
          'r.userId',
          'u.id as user_id',
          'u.gatrixUserId as user_gatrixUserId',
          'u.name as user_name',
          'u.username as user_username',
          'u.avatarUrl as user_avatarUrl'
        )
        .where('r.messageId', messageId)
        .orderBy('r.createdAt', 'asc');

      // 이모지별로 그룹화
      const groupedReactions: { [emoji: string]: ReactionSummary } = {};

      reactions.forEach((reaction) => {
        if (!groupedReactions[reaction.emoji]) {
          groupedReactions[reaction.emoji] = {
            emoji: reaction.emoji,
            count: 0,
            users: [],
            hasReacted: false,
          };
        }

        groupedReactions[reaction.emoji].count++;
        groupedReactions[reaction.emoji].users.push({
          id: reaction.user_id,
          gatrixUserId: reaction.user_gatrixUserId,
          name: reaction.user_name,
          username: reaction.user_username,
          avatarUrl: reaction.user_avatarUrl,
        });

        if (currentUserId && reaction.userId === currentUserId) {
          groupedReactions[reaction.emoji].hasReacted = true;
        }
      });

      return Object.values(groupedReactions);
    } catch (error) {
      logger.error('Error getting reaction summary:', error);
      throw error;
    }
  }

  /**
   * 메시지의 모든 리액션 삭제 (메시지 삭제 시 사용)
   */
  static async deleteAllByMessageId(messageId: number): Promise<number> {
    try {
      const db = databaseManager.getKnex();

      return await db('chat_message_reactions').where('messageId', messageId).del();
    } catch (error) {
      logger.error('Error deleting reactions by message ID:', error);
      throw error;
    }
  }
}
