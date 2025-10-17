export type MailType = 'user' | 'system' | 'notification';
export type MailPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ContentType = 'text' | 'html';

export interface MailData {
  [key: string]: any;
}

export interface Mail {
  id: number;
  senderId: number | null;
  senderName: string | null;
  recipientId: number;
  subject: string;
  content: string;
  contentType: ContentType;
  mailType: MailType;
  priority: MailPriority;
  category: string | null;
  isRead: boolean;
  readAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  isStarred: boolean;
  mailData: MailData | null;
  createdAt: string;
  updatedAt: string;
}

export interface MailFilters {
  isRead?: boolean;
  isStarred?: boolean;
  mailType?: MailType;
  category?: string;
  page?: number;
  limit?: number;
}

export interface MailStats {
  unreadCount: number;
  starredCount: number;
  totalCount: number;
  readCount: number;
}

export interface SendMailRequest {
  recipientId: number;
  subject: string;
  content: string;
  contentType?: ContentType;
  priority?: MailPriority;
  category?: string;
  mailData?: MailData;
}

