import { Model } from "objection";

export interface MailData {
  [key: string]: any;
}

export type MailType = "user" | "system" | "notification";
export type MailPriority = "low" | "normal" | "high" | "urgent";
export type ContentType = "text" | "html";

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
  readAt: Date | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  isStarred: boolean;
  mailData: MailData | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MailModel extends Model {
  id!: number;
  senderId!: number | null;
  senderName!: string | null;
  recipientId!: number;
  subject!: string;
  content!: string;
  contentType!: ContentType;
  mailType!: MailType;
  priority!: MailPriority;
  category!: string | null;
  isRead!: boolean;
  readAt!: Date | null;
  isDeleted!: boolean;
  deletedAt!: Date | null;
  isStarred!: boolean;
  mailData!: MailData | null;
  createdAt!: Date;
  updatedAt!: Date;

  static get tableName() {
    return "g_mails";
  }

  static get jsonSchema() {
    return {
      type: "object",
      required: ["recipientId", "subject", "content"],
      properties: {
        id: { type: "integer" },
        senderId: { type: ["integer", "null"] },
        senderName: { type: ["string", "null"], maxLength: 255 },
        recipientId: { type: "integer" },
        subject: { type: "string", maxLength: 500 },
        content: { type: "string" },
        contentType: { type: "string", enum: ["text", "html"] },
        mailType: { type: "string", enum: ["user", "system", "notification"] },
        priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
        category: { type: ["string", "null"], maxLength: 100 },
        isRead: { type: "boolean" },
        readAt: { type: ["string", "null"], format: "date-time" },
        isDeleted: { type: "boolean" },
        deletedAt: { type: ["string", "null"], format: "date-time" },
        isStarred: { type: "boolean" },
        mailData: { type: ["object", "null"] },
      },
    };
  }

  // Get unread count for a user
  static async getUnreadCount(userId: number): Promise<number> {
    const result = await this.query()
      .where("recipientId", userId)
      .where("isRead", false)
      .where("isDeleted", false)
      .count("* as count")
      .first();

    return result ? Number((result as any).count) : 0;
  }

  // Get sent mails for a user
  static async getSentMailsForUser(
    userId: number,
    options: {
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ data: Mail[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const query = this.query()
      .where("senderId", userId)
      .where("isDeleted", false)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset);

    const countQuery = this.query()
      .where("senderId", userId)
      .where("isDeleted", false)
      .count("* as count")
      .first();

    const [data, countResult] = await Promise.all([query, countQuery]);

    return {
      data: data as Mail[],
      total: countResult ? Number((countResult as any).count) : 0,
    };
  }

  // Get mails for a user with filters
  static async getMailsForUser(
    userId: number,
    options: {
      isRead?: boolean;
      isStarred?: boolean;
      mailType?: MailType;
      category?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { page = 1, limit = 20, ...filters } = options;
    const offset = (page - 1) * limit;

    let query = this.query()
      .where("recipientId", userId)
      .where("isDeleted", false);

    // Apply filters
    if (filters.isRead !== undefined) {
      query = query.where("isRead", filters.isRead);
    }
    if (filters.isStarred !== undefined) {
      query = query.where("isStarred", filters.isStarred);
    }
    if (filters.mailType) {
      query = query.where("mailType", filters.mailType);
    }
    if (filters.category) {
      query = query.where("category", filters.category);
    }

    // Get total count
    const countQuery = query.clone().count("* as count").first();

    // Get paginated results
    const results = await query
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset);

    const countResult = await countQuery;
    const total = countResult ? Number((countResult as any).count) : 0;

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Mark mail as read
  static async markAsRead(mailId: number, userId: number): Promise<boolean> {
    const now = new Date();
    const result = await this.query()
      .patch({
        isRead: true,
        readAt: now.toISOString().slice(0, 19).replace("T", " "),
      } as any)
      .where("id", mailId)
      .where("recipientId", userId)
      .where("isDeleted", false);

    return result > 0;
  }

  // Mark multiple mails as read
  static async markMultipleAsRead(
    mailIds: number[],
    userId: number,
  ): Promise<number> {
    const now = new Date();
    const result = await this.query()
      .patch({
        isRead: true,
        readAt: now.toISOString().slice(0, 19).replace("T", " "),
      } as any)
      .whereIn("id", mailIds)
      .where("recipientId", userId)
      .where("isDeleted", false);

    return result;
  }

  // Mark all unread mails as read (with optional filters)
  static async markAllAsRead(
    userId: number,
    filters: any = {},
  ): Promise<number> {
    const now = new Date();
    const query = this.query()
      .patch({
        isRead: true,
        readAt: now.toISOString().slice(0, 19).replace("T", " "),
      } as any)
      .where("recipientId", userId)
      .where("isDeleted", false)
      .where("isRead", false); // Only mark unread mails

    // Apply optional filters
    if (filters.isStarred !== undefined) {
      query.where("isStarred", filters.isStarred);
    }

    const result = await query;
    return result;
  }

  // Toggle starred status
  static async toggleStarred(mailId: number, userId: number): Promise<boolean> {
    const mail = await this.query()
      .findById(mailId)
      .where("recipientId", userId)
      .where("isDeleted", false);

    if (!mail) {
      return false;
    }

    await this.query()
      .patch({ isStarred: !mail.isStarred })
      .where("id", mailId);

    return !mail.isStarred;
  }

  // Soft delete mail
  static async softDelete(mailId: number, userId: number): Promise<boolean> {
    const now = new Date();
    const result = await this.query()
      .patch({
        isDeleted: true,
        deletedAt: now.toISOString().slice(0, 19).replace("T", " "),
      } as any)
      .where("id", mailId)
      .where("recipientId", userId);

    return result > 0;
  }

  // Delete multiple mails
  static async deleteMultiple(
    mailIds: number[],
    userId: number,
  ): Promise<number> {
    const now = new Date();
    const result = await this.query()
      .patch({
        isDeleted: true,
        deletedAt: now.toISOString().slice(0, 19).replace("T", " "),
      } as any)
      .whereIn("id", mailIds)
      .where("recipientId", userId);

    return result;
  }

  // Delete all mails (with optional filters)
  static async deleteAllMails(
    userId: number,
    filters: any = {},
  ): Promise<number> {
    const now = new Date();
    const query = this.query()
      .patch({
        isDeleted: true,
        deletedAt: now.toISOString().slice(0, 19).replace("T", " "),
      } as any)
      .where("recipientId", userId)
      .where("isDeleted", false);

    // Apply optional filters
    if (filters.isRead !== undefined) {
      query.where("isRead", filters.isRead);
    }
    if (filters.isStarred !== undefined) {
      query.where("isStarred", filters.isStarred);
    }

    const result = await query;
    return result;
  }

  // Send mail (create new mail)
  static async sendMail(mailData: {
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
  }): Promise<MailModel> {
    const mail = await this.query().insert({
      senderId: mailData.senderId || null,
      senderName: mailData.senderName || null,
      recipientId: mailData.recipientId,
      subject: mailData.subject,
      content: mailData.content,
      contentType: mailData.contentType || "text",
      mailType: mailData.mailType || "user",
      priority: mailData.priority || "normal",
      category: mailData.category || null,
      mailData: mailData.mailData || null,
      isRead: false,
      isDeleted: false,
      isStarred: false,
    });

    return mail;
  }

  // Send system mail (helper function)
  static async sendSystemMail(
    recipientId: number,
    subject: string,
    content: string,
    options: {
      priority?: MailPriority;
      category?: string;
      mailData?: MailData;
    } = {},
  ): Promise<MailModel> {
    return this.sendMail({
      senderId: null,
      senderName: "System",
      recipientId,
      subject,
      content,
      mailType: "system",
      priority: options.priority || "normal",
      category: options.category || null,
      mailData: options.mailData || null,
    });
  }
}
