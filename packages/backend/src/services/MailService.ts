import { MailModel, MailType, MailPriority, ContentType, MailData } from '../models/Mail';
import logger from '../config/logger';

export interface SendMailOptions {
  senderId?: number | null;
  senderName?: string | null;
  recipientId: number;
  subject: string;
  content: string;
  contentType?: ContentType;
  mailType?: MailType;
  priority?: MailPriority;
  category?: string | null;
  mailData?: MailData | null;
}

export interface SendSystemMailOptions {
  priority?: MailPriority;
  category?: string;
  mailData?: MailData;
}

export class MailService {
  /**
   * Send a mail
   */
  async sendMail(options: SendMailOptions) {
    try {
      const mail = await MailModel.sendMail(options);
      logger.info(`Mail sent: ${mail.id} to user ${options.recipientId}`);
      return mail;
    } catch (error) {
      logger.error('Failed to send mail:', error);
      throw error;
    }
  }

  /**
   * Send a system mail
   * This is a convenience function that can be called from anywhere in the application
   */
  async sendSystemMail(
    recipientId: number,
    subject: string,
    content: string,
    options: SendSystemMailOptions = {}
  ) {
    try {
      const mail = await MailModel.sendSystemMail(
        recipientId,
        subject,
        content,
        options
      );
      logger.info(`System mail sent: ${mail.id} to user ${recipientId}`);
      return mail;
    } catch (error) {
      logger.error('Failed to send system mail:', error);
      throw error;
    }
  }

  /**
   * Get mails for a user
   */
  async getMailsForUser(
    userId: number,
    filters: {
      isRead?: boolean;
      isStarred?: boolean;
      mailType?: MailType;
      category?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    try {
      return await MailModel.getMailsForUser(userId, filters);
    } catch (error) {
      logger.error('Failed to get mails:', error);
      throw error;
    }
  }

  /**
   * Get sent mails for a user
   */
  async getSentMailsForUser(
    userId: number,
    options: {
      page?: number;
      limit?: number;
    } = {}
  ) {
    try {
      return await MailModel.getSentMailsForUser(userId, options);
    } catch (error) {
      logger.error('Failed to get sent mails:', error);
      throw error;
    }
  }

  /**
   * Get a single mail by ID
   */
  async getMailById(mailId: number, userId: number) {
    try {
      const mail = await MailModel.query()
        .findById(mailId)
        .where('recipientId', userId)
        .where('isDeleted', false);

      return mail;
    } catch (error) {
      logger.error('Failed to get mail:', error);
      throw error;
    }
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: number): Promise<number> {
    try {
      return await MailModel.getUnreadCount(userId);
    } catch (error) {
      logger.error('Failed to get unread count:', error);
      throw error;
    }
  }

  /**
   * Mark mail as read
   */
  async markAsRead(mailId: number, userId: number): Promise<boolean> {
    try {
      const result = await MailModel.markAsRead(mailId, userId);
      if (result) {
        logger.info(`Mail ${mailId} marked as read by user ${userId}`);
      }
      return result;
    } catch (error) {
      logger.error('Failed to mark mail as read:', error);
      throw error;
    }
  }

  /**
   * Mark multiple mails as read
   */
  async markMultipleAsRead(mailIds: number[], userId: number): Promise<number> {
    try {
      const count = await MailModel.markMultipleAsRead(mailIds, userId);
      logger.info(`${count} mails marked as read by user ${userId}`);
      return count;
    } catch (error) {
      logger.error('Failed to mark multiple mails as read:', error);
      throw error;
    }
  }

  /**
   * Mark all unread mails as read (with optional filters)
   */
  async markAllAsRead(userId: number, filters: any = {}): Promise<number> {
    try {
      const count = await MailModel.markAllAsRead(userId, filters);
      logger.info(`${count} mails marked as read by user ${userId} with filters:`, filters);
      return count;
    } catch (error) {
      logger.error('Failed to mark all mails as read:', error);
      throw error;
    }
  }

  /**
   * Toggle starred status
   */
  async toggleStarred(mailId: number, userId: number): Promise<boolean> {
    try {
      const isStarred = await MailModel.toggleStarred(mailId, userId);
      logger.info(`Mail ${mailId} starred status toggled to ${isStarred} by user ${userId}`);
      return isStarred;
    } catch (error) {
      logger.error('Failed to toggle starred status:', error);
      throw error;
    }
  }

  /**
   * Delete mail (soft delete)
   */
  async deleteMail(mailId: number, userId: number): Promise<boolean> {
    try {
      const result = await MailModel.softDelete(mailId, userId);
      if (result) {
        logger.info(`Mail ${mailId} deleted by user ${userId}`);
      }
      return result;
    } catch (error) {
      logger.error('Failed to delete mail:', error);
      throw error;
    }
  }

  /**
   * Delete multiple mails
   */
  async deleteMultiple(mailIds: number[], userId: number): Promise<number> {
    try {
      const count = await MailModel.deleteMultiple(mailIds, userId);
      logger.info(`${count} mails deleted by user ${userId}`);
      return count;
    } catch (error) {
      logger.error('Failed to delete multiple mails:', error);
      throw error;
    }
  }

  /**
   * Delete all mails (with optional filters)
   */
  async deleteAllMails(userId: number, filters: any = {}): Promise<number> {
    try {
      const count = await MailModel.deleteAllMails(userId, filters);
      logger.info(`${count} mails deleted by user ${userId} with filters:`, filters);
      return count;
    } catch (error) {
      logger.error('Failed to delete all mails:', error);
      throw error;
    }
  }

  /**
   * Get mail statistics for a user
   */
  async getMailStats(userId: number) {
    try {
      const [unreadCount, starredCount, totalCount] = await Promise.all([
        MailModel.query()
          .where('recipientId', userId)
          .where('isRead', false)
          .where('isDeleted', false)
          .count('* as count')
          .first()
          .then((r: any) => Number(r?.count || 0)),

        MailModel.query()
          .where('recipientId', userId)
          .where('isStarred', true)
          .where('isDeleted', false)
          .count('* as count')
          .first()
          .then((r: any) => Number(r?.count || 0)),

        MailModel.query()
          .where('recipientId', userId)
          .where('isDeleted', false)
          .count('* as count')
          .first()
          .then((r: any) => Number(r?.count || 0)),
      ]);

      return {
        unreadCount,
        starredCount,
        totalCount,
        readCount: totalCount - unreadCount,
      };
    } catch (error) {
      logger.error('Failed to get mail stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const mailService = new MailService();

// Export helper function for sending system mails from anywhere
export async function sendSystemMail(
  recipientId: number,
  subject: string,
  content: string,
  options: SendSystemMailOptions = {}
): Promise<void> {
  await mailService.sendSystemMail(recipientId, subject, content, options);
}

