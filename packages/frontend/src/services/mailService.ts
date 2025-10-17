import { apiService } from './api';
import { Mail, MailFilters, MailStats, SendMailRequest } from '../types/mail';

export interface MailListResponse {
  success: boolean;
  data: Mail[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MailResponse {
  success: boolean;
  data: Mail;
  message?: string;
}

export interface UnreadCountResponse {
  success: boolean;
  count: number;
}

export interface MailStatsResponse {
  success: boolean;
  data: MailStats;
}

export class MailService {
  /**
   * Get mails for the current user
   */
  async getMails(filters: MailFilters = {}): Promise<MailListResponse> {
    const params: any = {};

    if (filters.isRead !== undefined) {
      params.isRead = filters.isRead;
    }
    if (filters.isStarred !== undefined) {
      params.isStarred = filters.isStarred;
    }
    if (filters.mailType) {
      params.mailType = filters.mailType;
    }
    if (filters.category) {
      params.category = filters.category;
    }
    if (filters.page) {
      params.page = filters.page;
    }
    if (filters.limit) {
      params.limit = filters.limit;
    }

    return apiService.get('/mails', { params });
  }

  /**
   * Get sent mails for the current user
   */
  async getSentMails(page: number = 1, limit: number = 20): Promise<MailListResponse> {
    const params = { page, limit };
    return apiService.get('/mails/sent', { params });
  }

  /**
   * Get a single mail by ID
   */
  async getMailById(mailId: number): Promise<MailResponse> {
    return apiService.get(`/mails/${mailId}`);
  }

  /**
   * Get unread mail count
   */
  async getUnreadCount(): Promise<number> {
    const response: UnreadCountResponse = await apiService.get('/mails/unread-count');
    return response.count;
  }

  /**
   * Get mail statistics
   */
  async getMailStats(): Promise<MailStats> {
    const response: MailStatsResponse = await apiService.get('/mails/stats');
    return response.data;
  }

  /**
   * Send a new mail
   */
  async sendMail(mailData: SendMailRequest): Promise<MailResponse> {
    return apiService.post('/mails', mailData);
  }

  /**
   * Mark a mail as read
   */
  async markAsRead(mailId: number): Promise<void> {
    await apiService.patch(`/mails/${mailId}/read`);
  }

  /**
   * Mark multiple mails as read
   */
  async markMultipleAsRead(mailIds: number[]): Promise<void> {
    await apiService.patch('/mails/read-multiple', { mailIds });
  }

  /**
   * Mark all unread mails as read (with optional filter)
   */
  async markAllAsRead(filter?: 'all' | 'unread' | 'starred'): Promise<void> {
    const params: any = {};
    if (filter && filter !== 'all') {
      if (filter === 'unread') {
        params.isRead = false;
      } else if (filter === 'starred') {
        params.isStarred = true;
      }
    }
    await apiService.patch('/mails/read-all', params);
  }

  /**
   * Toggle starred status
   */
  async toggleStarred(mailId: number): Promise<boolean> {
    const response: any = await apiService.patch(`/mails/${mailId}/star`);
    return response.isStarred;
  }

  /**
   * Delete a mail
   */
  async deleteMail(mailId: number): Promise<void> {
    await apiService.delete(`/mails/${mailId}`);
  }

  /**
   * Delete multiple mails
   */
  async deleteMultiple(mailIds: number[]): Promise<void> {
    await apiService.delete('/mails', { data: { mailIds } });
  }

  /**
   * Delete all mails (with optional filter)
   */
  async deleteAllMails(filter?: 'all' | 'unread' | 'starred'): Promise<void> {
    const params: any = {};
    if (filter && filter !== 'all') {
      if (filter === 'unread') {
        params.isRead = false;
      } else if (filter === 'starred') {
        params.isStarred = true;
      }
    }
    await apiService.delete('/mails/delete-all', { params });
  }
}

// Export singleton instance
export const mailService = new MailService();
export default mailService;

