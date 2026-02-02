import { Model } from "objection";
import { databaseManager } from "../config/database";
import {
  Message as MessageType,
  CreateMessageData,
  UpdateMessageData,
  MessageData,
} from "../types/chat";
import { redisClient } from "../config/redis";

export class Message extends Model {
  static tableName = "chat_messages";

  id!: number;
  channelId!: number;
  userId!: number;
  content!: string;
  contentType!:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "file"
    | "location"
    | "system";
  messageData?: MessageData;
  replyToMessageId?: number;
  threadId?: number;
  isEdited!: boolean;
  isDeleted!: boolean;
  isPinned!: boolean;
  systemMessageType?: string;
  systemMessageData?: any;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt?: Date;

  static get jsonSchema() {
    return {
      type: "object",
      required: ["channelId", "userId", "content"],
      properties: {
        id: { type: "integer" },
        channelId: { type: "integer" },
        userId: { type: "integer" },
        content: { type: "string", minLength: 1, maxLength: 10000 },
        contentType: {
          type: "string",
          enum: [
            "text",
            "image",
            "video",
            "audio",
            "file",
            "location",
            "system",
          ],
        },
        messageData: { type: "object" },
        replyToMessageId: { type: "integer" },
        threadId: { type: "integer" },
        isEdited: { type: "boolean" },
        isDeleted: { type: "boolean" },
        isPinned: { type: "boolean" },
        systemMessageType: { type: "string", maxLength: 50 },
        systemMessageData: { type: "object" },
      },
    };
  }

  static get relationMappings() {
    return {
      attachments: {
        relation: Model.HasManyRelation,
        modelClass: "MessageAttachment",
        join: {
          from: "chat_messages.id",
          to: "chat_message_attachments.messageId",
        },
      },
      reactions: {
        relation: Model.HasManyRelation,
        modelClass: "MessageReaction",
        join: {
          from: "chat_messages.id",
          to: "chat_message_reactions.messageId",
        },
      },
      replyToMessage: {
        relation: Model.BelongsToOneRelation,
        modelClass: "Message",
        join: {
          from: "chat_messages.replyToMessageId",
          to: "chat_messages.id",
        },
      },
    };
  }

  $beforeInsert() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  $beforeUpdate() {
    this.updatedAt = new Date();
  }
}

export class MessageModel {
  private static get knex() {
    return databaseManager.getKnex();
  }

  // 메시지 생성
  static async create(
    data: CreateMessageData,
    userId: number,
  ): Promise<MessageType> {
    const messageData = {
      channelId: data.channelId,
      userId,
      content: data.content,
      contentType: data.contentType || "text",
      messageData: data.messageData ? JSON.stringify(data.messageData) : null,
      replyToMessageId: data.replyToMessageId,
      threadId: data.threadId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log("🔍 MessageModel.create - Input data:", {
      originalData: data,
      userId,
      messageDataToInsert: messageData,
      threadIdValue: data.threadId,
      threadIdType: typeof data.threadId,
    });

    const [messageId] = await this.knex("chat_messages").insert(messageData);

    console.log("🔍 MessageModel.create - Inserted messageId:", messageId);

    const message = await this.findById(messageId);

    console.log("🔍 MessageModel.create - Retrieved message:", {
      messageId: message?.id,
      threadId: message?.threadId,
      threadIdType: typeof message?.threadId,
    });

    if (!message) {
      throw new Error("Message not found");
    }
    return message;
  }

  // 메시지 조회
  static async findById(id: number): Promise<MessageType | null> {
    const result = await this.knex("chat_messages as m")
      .select([
        "m.*",
        "u.name as userName",
        "u.avatarUrl as userAvatarUrl",
        "u.email as userEmail",
      ])
      .leftJoin("chat_users as u", "m.userId", "u.id")
      .where({ "m.id": id, "m.isDeleted": false })
      .first();

    if (!result) return null;

    // 사용자 정보 구성
    const user = result.userName
      ? {
          id: result.userId,
          name: result.userName,
          email: result.userEmail,
          avatar: result.userAvatarUrl,
        }
      : null;

    // 답글 메시지가 있는 경우 조회
    let replyMessage = null;
    let replyUser = null;
    if (result.replyToMessageId) {
      const replyResult = await this.knex("chat_messages as rm")
        .select([
          "rm.*",
          "ru.name as replyUserName",
          "ru.avatarUrl as replyUserAvatarUrl",
          "ru.email as replyUserEmail",
        ])
        .leftJoin("chat_users as ru", "rm.userId", "ru.id")
        .where({ "rm.id": result.replyToMessageId, "rm.isDeleted": false })
        .first();

      if (replyResult) {
        replyMessage = replyResult;
        replyUser = replyResult.replyUserName
          ? {
              id: replyResult.userId,
              name: replyResult.replyUserName,
              email: replyResult.replyUserEmail,
              avatar: replyResult.replyUserAvatarUrl,
            }
          : null;
      }
    }

    // 첨부파일과 반응 조회
    const [attachments, reactions] = await Promise.all([
      this.getMessageAttachments(id),
      this.getMessageReactions(id),
    ]);

    return {
      ...result,
      messageData: result.messageData ? JSON.parse(result.messageData) : null,
      user,
      replyMessage,
      replyUser,
      attachments,
      reactions,
    };
  }

  // 채널의 메시지 목록 조회
  static async findByChannelId(
    channelId: number,
    options: {
      limit?: number;
      offset?: number;
      beforeMessageId?: number;
      afterMessageId?: number;
      includeDeleted?: boolean;
    } = {},
  ): Promise<{ messages: MessageType[]; total: number; hasMore: boolean }> {
    // 1) 기본 필터만 적용한 베이스 쿼리 (집계용)
    let base = this.knex("chat_messages as m").where("m.channelId", channelId);

    if (!options.includeDeleted) {
      base = base.where("m.isDeleted", false);
    }

    if (options.beforeMessageId) {
      base = base.where("m.id", "<", options.beforeMessageId);
    }
    if (options.afterMessageId) {
      base = base.where("m.id", ">", options.afterMessageId);
    }

    // 2) 총 개수 조회 (ONLY_FULL_GROUP_BY 호환)
    const totalRow = await base
      .clone()
      .count<{ count: number }[]>({ count: "*" });
    const total = Number((totalRow as any)[0]?.count || 0);

    // 3) 실제 데이터 조회 쿼리 (SELECT 컬럼/조인 포함)
    let query = base
      .clone()
      .select([
        "m.*",
        "u.name as userName",
        "u.avatarUrl as userAvatarUrl",
        "rm.content as replyContent",
        "ru.name as replyUserName",
        this.knex.raw(
          "(SELECT COUNT(*) FROM chat_messages WHERE threadId = m.id AND isDeleted = false) as threadCount",
        ),
        this.knex.raw(
          "(SELECT MAX(createdAt) FROM chat_messages WHERE threadId = m.id AND isDeleted = false) as lastThreadMessageAt",
        ),
      ])
      .leftJoin("chat_users as u", "m.userId", "u.id")
      .leftJoin("chat_messages as rm", "m.replyToMessageId", "rm.id")
      .leftJoin("chat_users as ru", "rm.userId", "ru.id")
      .orderBy("m.createdAt", "desc");

    const limit = options.limit || 50;
    query = query.limit(limit + 1);

    if (options.offset) {
      query = query.offset(options.offset);
    }

    const results = await query;
    const hasMore = results.length > limit;
    const messages = hasMore ? results.slice(0, -1) : results;

    // 각 메시지의 첨부파일과 반응 조회
    const messageIds = messages.map((m) => m.id);
    const [attachmentsMap, reactionsMap] = await Promise.all([
      this.getMessagesAttachments(messageIds),
      this.getMessagesReactions(messageIds),
    ]);

    const enrichedMessages = messages.map((message) => {
      const reactions = reactionsMap.get(message.id) || [];
      console.log(`🔍 Message ${message.id} reactions:`, {
        messageId: message.id,
        reactionsCount: reactions.length,
        reactions: reactions,
      });

      return {
        ...message,
        messageData: message.messageData
          ? JSON.parse(message.messageData)
          : null,
        attachments: attachmentsMap.get(message.id) || [],
        reactions: reactions,
      };
    });

    return {
      messages: enrichedMessages.reverse(), // 시간순 정렬
      total: Number(total),
      hasMore,
    };
  }

  // 메시지 업데이트
  static async update(
    id: number,
    data: UpdateMessageData,
    userId: number,
  ): Promise<MessageType | null> {
    // 권한 확인
    const message = await this.knex("chat_messages")
      .where({ id, userId, isDeleted: false })
      .first();

    if (!message) {
      throw new Error("Message not found or no permission to edit");
    }

    const updateData = {
      content: data.content || message.content,
      messageData: data.messageData
        ? JSON.stringify(data.messageData)
        : message.messageData,
      isEdited: true,
      updatedAt: new Date(),
    };

    await this.knex("chat_messages").where({ id }).update(updateData);

    return await this.findById(id);
  }

  // 메시지 삭제 (소프트 삭제)
  static async delete(id: number, userId: number): Promise<boolean> {
    // 권한 확인 (메시지 작성자 또는 채널 관리자)
    const message = await this.knex("chat_messages as m")
      .leftJoin("chat_channel_members as cm", function () {
        this.on("m.channelId", "=", "cm.channelId").andOn(
          "cm.userId",
          "=",
          userId.toString(),
        );
      })
      .where("m.id", id)
      .andWhere(function () {
        this.where("m.userId", userId).orWhereIn("cm.role", [
          "owner",
          "admin",
          "moderator",
        ]);
      })
      .first();

    if (!message) {
      throw new Error("Message not found or no permission to delete");
    }

    const result = await this.knex("chat_messages").where({ id }).update({
      isDeleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    });

    return result > 0;
  }

  // 메시지 핀 설정/해제
  static async togglePin(id: number, userId: number): Promise<boolean> {
    // 권한 확인 (채널 관리자만)
    const message = await this.knex("chat_messages as m")
      .join("chat_channel_members as cm", function () {
        this.on("m.channelId", "=", "cm.channelId").andOn(
          "cm.userId",
          "=",
          userId.toString(),
        );
      })
      .where("m.id", id)
      .whereIn("cm.role", ["owner", "admin", "moderator"])
      .first();

    if (!message) {
      throw new Error("Message not found or no permission to pin");
    }

    const result = await this.knex("chat_messages").where({ id }).update({
      isPinned: !message.isPinned,
      updatedAt: new Date(),
    });

    return result > 0;
  }

  // 메시지 검색
  static async search(
    query: string,
    channelId?: number,
    options: {
      userId?: number;
      contentType?: string;
      dateFrom?: Date;
      dateTo?: Date;
      hasAttachments?: boolean;
      isPinned?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ messages: MessageType[]; total: number }> {
    let searchQuery = this.knex("chat_messages as m")
      .select([
        "m.*",
        "u.name as userName",
        "u.avatarUrl as userAvatarUrl",
        this.knex.raw(
          "MATCH(m.content) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance",
          [query],
        ),
      ])
      .leftJoin("users as u", "m.userId", "u.id")
      .where("m.isDeleted", false)
      .andWhere(function () {
        this.whereRaw("MATCH(m.content) AGAINST(? IN NATURAL LANGUAGE MODE)", [
          query,
        ]).orWhere("m.content", "like", `%${query}%`);
      });

    // 필터 적용
    if (channelId) {
      searchQuery = searchQuery.where("m.channelId", channelId);
    }
    if (options.userId) {
      searchQuery = searchQuery.where("m.userId", options.userId);
    }
    if (options.contentType) {
      searchQuery = searchQuery.where("m.contentType", options.contentType);
    }
    if (options.dateFrom) {
      searchQuery = searchQuery.where("m.createdAt", ">=", options.dateFrom);
    }
    if (options.dateTo) {
      searchQuery = searchQuery.where("m.createdAt", "<=", options.dateTo);
    }
    if (options.hasAttachments !== undefined) {
      if (options.hasAttachments) {
        searchQuery = searchQuery.whereExists(function () {
          this.select("*")
            .from("chat_message_attachments")
            .whereRaw("chat_message_attachments.messageId = m.id");
        });
      } else {
        searchQuery = searchQuery.whereNotExists(function () {
          this.select("*")
            .from("chat_message_attachments")
            .whereRaw("chat_message_attachments.messageId = m.id");
        });
      }
    }
    if (options.isPinned !== undefined) {
      searchQuery = searchQuery.where("m.isPinned", options.isPinned);
    }

    // 총 개수 조회
    const totalQuery = searchQuery.clone().count("* as count").first();
    const totalResult = (await totalQuery) as any;
    const total = totalResult?.count || 0;

    // 페이지네이션
    if (options.limit) {
      searchQuery = searchQuery.limit(options.limit);
    }
    if (options.offset) {
      searchQuery = searchQuery.offset(options.offset);
    }

    searchQuery = searchQuery
      .orderBy("relevance", "desc")
      .orderBy("m.createdAt", "desc");

    const messages = await searchQuery;
    return { messages, total: Number(total) };
  }

  // 스레드 메시지 조회
  static async getThreadMessages(
    threadId: number,
    options: {
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ messages: MessageType[]; total: number }> {
    // 총 개수 조회 (별도 쿼리로 분리)
    const totalResult = (await this.knex("chat_messages")
      .where({ threadId: threadId, isDeleted: false })
      .count("* as count")
      .first()) as any;
    const total = totalResult?.count || 0;

    // 메시지 조회 쿼리
    let query = this.knex("chat_messages as m")
      .select(["m.*", "u.name as userName", "u.avatarUrl as userAvatarUrl"])
      .leftJoin("chat_users as u", "m.userId", "u.id")
      .where({ "m.threadId": threadId, "m.isDeleted": false });

    // 페이지네이션
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.offset(options.offset);
    }

    query = query.orderBy("m.createdAt", "asc");

    const results = await query;

    // 각 메시지의 첨부파일과 반응 조회
    const messageIds = results.map((m) => m.id);
    const [attachmentsMap, reactionsMap] = await Promise.all([
      this.getMessagesAttachments(messageIds),
      this.getMessagesReactions(messageIds),
    ]);

    const messages = results.map((message) => {
      const reactions = reactionsMap.get(message.id) || [];

      return {
        ...message,
        messageData: message.messageData
          ? JSON.parse(message.messageData)
          : null,
        user: {
          id: message.userId,
          name: message.userName || `User${message.userId}`,
          avatarUrl: message.userAvatarUrl,
        },
        attachments: attachmentsMap.get(message.id) || [],
        reactions: reactions,
      };
    });

    return { messages, total: Number(total) };
  }

  // 메시지 첨부파일 조회
  private static async getMessageAttachments(
    messageId: number,
  ): Promise<any[]> {
    try {
      return await this.knex("chat_message_attachments")
        .where({ messageId, uploadStatus: "completed" })
        .orderBy("createdAt", "asc");
    } catch (error: any) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === "ER_NO_SUCH_TABLE") {
        console.log(
          "chat_message_attachments table does not exist, returning empty array",
        );
        return [];
      }
      throw error;
    }
  }

  // 여러 메시지의 첨부파일 조회
  private static async getMessagesAttachments(
    messageIds: number[],
  ): Promise<Map<number, any[]>> {
    if (messageIds.length === 0) return new Map();

    const attachments = await this.knex("chat_message_attachments")
      .whereIn("messageId", messageIds)
      .where("uploadStatus", "completed")
      .orderBy("createdAt", "asc");

    const attachmentsMap = new Map<number, any[]>();
    for (const attachment of attachments) {
      if (!attachmentsMap.has(attachment.messageId)) {
        attachmentsMap.set(attachment.messageId, []);
      }
      attachmentsMap.get(attachment.messageId)!.push(attachment);
    }

    return attachmentsMap;
  }

  // 메시지 반응 조회
  private static async getMessageReactions(messageId: number): Promise<any[]> {
    const reactions = await this.knex("chat_message_reactions as r")
      .select(["r.*", "u.name as userName", "u.avatarUrl as userAvatarUrl"])
      .leftJoin("chat_users as u", "r.userId", "u.id")
      .where("r.messageId", messageId)
      .orderBy("r.createdAt", "asc");

    // 리액션 데이터를 프론트엔드에서 기대하는 형태로 변환
    return reactions.map((reaction) => ({
      id: reaction.id,
      messageId: reaction.messageId,
      userId: reaction.userId,
      emoji: reaction.emoji,
      createdAt: reaction.createdAt,
      user: {
        id: reaction.userId,
        name: reaction.userName,
        avatarUrl: reaction.userAvatarUrl,
      },
    }));
  }

  // 여러 메시지의 반응 조회
  private static async getMessagesReactions(
    messageIds: number[],
  ): Promise<Map<number, any[]>> {
    if (messageIds.length === 0) return new Map();

    console.log("🔍 Querying reactions for messages:", messageIds);

    const reactions = await this.knex("chat_message_reactions as r")
      .select(["r.*", "u.name as userName", "u.avatarUrl as userAvatarUrl"])
      .leftJoin("chat_users as u", "r.userId", "u.id")
      .whereIn("r.messageId", messageIds);

    console.log("🔍 Raw reactions query result:", {
      messageIds,
      reactionsCount: reactions.length,
      reactions: reactions,
    });

    const reactionsMap = new Map<number, any[]>();
    for (const reaction of reactions) {
      if (!reactionsMap.has(reaction.messageId)) {
        reactionsMap.set(reaction.messageId, []);
      }

      // 리액션 데이터를 프론트엔드에서 기대하는 형태로 변환
      const formattedReaction = {
        id: reaction.id,
        messageId: reaction.messageId,
        userId: reaction.userId,
        emoji: reaction.emoji,
        createdAt: reaction.createdAt,
        user: {
          id: reaction.userId,
          name: reaction.userName,
          avatarUrl: reaction.userAvatarUrl,
        },
      };

      reactionsMap.get(reaction.messageId)!.push(formattedReaction);
    }

    return reactionsMap;
  }

  // 메시지 통계
  static async getChannelMessageStats(channelId: number): Promise<any> {
    return await this.knex("chat_messages")
      .select([
        this.knex.raw("COUNT(*) as totalMessages"),
        this.knex.raw("COUNT(DISTINCT userId) as uniqueUsers"),
        this.knex.raw(
          "COUNT(CASE WHEN createdAt >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as messagesToday",
        ),
        this.knex.raw(
          "COUNT(CASE WHEN createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as messagesThisWeek",
        ),
        this.knex.raw(
          'COUNT(CASE WHEN contentType != "text" THEN 1 END) as mediaMessages',
        ),
        this.knex.raw("MAX(createdAt) as lastMessageAt"),
      ])
      .where({ channelId, isDeleted: false })
      .first();
  }

  // 배치 삭제
  static async batchDelete(
    messageIds: number[],
    userId: number,
  ): Promise<number> {
    // 권한 확인은 각 메시지별로 수행해야 함
    const result = await this.knex("chat_messages")
      .whereIn("id", messageIds)
      .where("userId", userId) // 본인 메시지만 삭제 가능
      .update({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      });

    return result;
  }

  // 스레드 정보 조회
  static async getThreadInfo(
    threadId: number,
  ): Promise<{ threadCount: number; lastThreadMessageAt: Date | null }> {
    // 스레드 메시지 수 계산
    const threadCount = await this.knex("chat_messages")
      .where("threadId", threadId)
      .count("id as count")
      .first();

    // 마지막 스레드 메시지 시간 조회
    const lastThreadMessage = await this.knex("chat_messages")
      .where("threadId", threadId)
      .orderBy("createdAt", "desc")
      .first();

    return {
      threadCount: threadCount ? Number(threadCount.count) : 0,
      lastThreadMessageAt: lastThreadMessage
        ? lastThreadMessage.createdAt
        : null,
    };
  }
}
