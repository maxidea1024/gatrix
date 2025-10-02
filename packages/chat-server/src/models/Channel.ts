import { Model } from 'objection';
import { databaseManager } from '../config/database';
import { Channel as ChannelType, CreateChannelData, UpdateChannelData, ChannelSettings } from '../types/chat';

export class Channel extends Model {
  static tableName = 'chat_channels';

  id!: number;
  name!: string;
  description?: string;
  type!: 'public' | 'private' | 'direct';
  maxMembers!: number;
  isArchived!: boolean;
  archiveReason?: string;
  avatarUrl?: string;
  settings?: ChannelSettings;
  ownerId!: number;
  createdBy!: number;
  updatedBy?: number;
  createdAt!: Date;
  updatedAt!: Date;
  archivedAt?: Date;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['name', 'type', 'ownerId', 'createdBy'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string', minLength: 1, maxLength: 255 },
        description: { type: 'string', maxLength: 1000 },
        type: { type: 'string', enum: ['public', 'private', 'direct'] },
        maxMembers: { type: 'integer', minimum: 1, maximum: 10000 },
        isArchived: { type: 'boolean' },
        archiveReason: { type: 'string', maxLength: 500 },
        avatarUrl: { type: 'string', maxLength: 500 },
        settings: { type: 'object' },
        ownerId: { type: 'integer' },
        createdBy: { type: 'integer' },
        updatedBy: { type: 'integer' },
      },
    };
  }

  static get relationMappings() {
    return {
      members: {
        relation: Model.HasManyRelation,
        modelClass: 'ChannelMember',
        join: {
          from: 'chat_channels.id',
          to: 'chat_channel_members.channelId',
        },
      },
      messages: {
        relation: Model.HasManyRelation,
        modelClass: 'Message',
        join: {
          from: 'chat_channels.id',
          to: 'chat_messages.channelId',
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

export class ChannelModel {
  private static get knex() {
    return databaseManager.getKnex();
  }

  // 채널 생성
  static async create(data: CreateChannelData, createdBy: number): Promise<ChannelType> {
    const channelData = {
      name: data.name,
      description: data.description,
      type: data.type,
      maxMembers: data.maxMembers || 1000,
      settings: data.settings || this.getDefaultSettings(),
      ownerId: createdBy,
      createdBy: createdBy,
    };

    const [channelId] = await this.knex('chat_channels').insert(channelData);
    
    // 생성자를 채널 멤버로 추가
    await this.knex('chat_channel_members').insert({
      channelId: channelId,
      userId: createdBy,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
    });

    // 추가 멤버들 초대
    if (data.memberIds && data.memberIds.length > 0) {
      const memberInserts = data.memberIds.map(userId => ({
        channelId: channelId,
        userId: userId,
        role: 'member',
        status: 'active',
        joinedAt: new Date(),
      }));
      await this.knex('chat_channel_members').insert(memberInserts);
    }

    const channel = await this.findById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }
    return channel;
  }

  // 채널 조회 (멤버수 포함)
  static async findById(id: number): Promise<ChannelType | null> {
    const channel = await this.knex('chat_channels as c')
      .select([
        'c.*',
        this.knex.raw('COUNT(cm.userId) as memberCount')
      ])
      .leftJoin('chat_channel_members as cm', function() {
        this.on('c.id', '=', 'cm.channelId')
            .andOnVal('cm.status', '=', 'active');
      })
      .where({ 'c.id': id, 'c.isArchived': false })
      .groupBy('c.id')
      .first();

    return channel || null;
  }

  // 사용자의 채널 목록 조회
  static async findByUserId(userId: number, options: {
    type?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ channels: ChannelType[]; total: number }> {
    let query = this.knex('chat_channels as c')
      .select([
        'c.*',
        'cm.role',
        'cm.unreadCount',
        'cm.lastReadAt',
        'cm.notificationSettings',
        this.knex.raw('COUNT(cm2.userId) as memberCount')
      ])
      .join('chat_channel_members as cm', 'c.id', 'cm.channelId')
      .leftJoin('chat_channel_members as cm2', function() {
        this.on('c.id', '=', 'cm2.channelId')
            .andOnVal('cm2.status', '=', 'active');
      })
      .where({
        'cm.userId': userId,
        'cm.status': 'active',
        'c.isArchived': false,
      })
      .groupBy('c.id', 'cm.role', 'cm.unreadCount', 'cm.lastReadAt', 'cm.notificationSettings');

    if (options.type) {
      query = query.where('c.type', options.type);
    }

    // 총 개수 조회 - 별도 쿼리로 분리
    const totalQuery = this.knex('chat_channels as c')
      .join('chat_channel_members as cm', 'c.id', 'cm.channelId')
      .where({
        'cm.userId': userId,
        'cm.status': 'active',
        'c.isArchived': false,
      })
      .count('* as count')
      .first();

    const totalResult = await totalQuery as any;
    const total = totalResult?.count || 0;

    // 페이지네이션
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.offset(options.offset);
    }

    query = query.orderBy('cm.lastReadAt', 'desc');

    const channels = await query;
    return { channels, total: Number(total) };
  }

  // 채널 업데이트
  static async update(id: number, data: UpdateChannelData, updatedBy: number): Promise<ChannelType | null> {
    const updateData = {
      ...data,
      updatedBy: updatedBy,
      updatedAt: new Date(),
    };

    await this.knex('chat_channels')
      .where({ id })
      .update(updateData);

    return await this.findById(id);
  }

  // 채널 아카이브
  static async archive(id: number, reason: string, archivedBy: number): Promise<boolean> {
    const result = await this.knex('chat_channels')
      .where({ id })
      .update({
        isArchived: true,
        archiveReason: reason,
        archivedAt: new Date(),
        updatedBy: archivedBy,
        updatedAt: new Date(),
      });

    return result > 0;
  }

  // 채널 삭제 (실제로는 아카이브)
  static async delete(id: number, deletedBy: number): Promise<boolean> {
    return await this.archive(id, 'Channel deleted', deletedBy);
  }

  // 채널 검색
  static async search(query: string, userId: number, options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<{ channels: ChannelType[]; total: number }> {
    let searchQuery = this.knex('chat_channels as c')
      .select([
        'c.*',
        'cm.role',
        'cm.unreadCount',
      ])
      .leftJoin('chat_channel_members as cm', function() {
        this.on('c.id', '=', 'cm.channelId')
            .andOn('cm.userId', '=', userId.toString());
      })
      .where('c.isArchived', false)
      .andWhere(function() {
        this.where('c.type', 'public')
            .orWhere('cm.userId', userId);
      })
      .andWhere(function() {
        this.whereRaw('MATCH(c.name, c.description) AGAINST(? IN NATURAL LANGUAGE MODE)', [query])
            .orWhere('c.name', 'like', `%${query}%`)
            .orWhere('c.description', 'like', `%${query}%`);
      });

    // 총 개수 조회 - 별도 쿼리로 분리
    const totalQuery = this.knex('chat_channels as c')
      .leftJoin('chat_channel_members as cm', function() {
        this.on('c.id', '=', 'cm.channelId')
            .andOn('cm.userId', '=', userId.toString());
      })
      .where('c.isArchived', false)
      .andWhere(function() {
        this.where('c.type', 'public')
            .orWhere('cm.userId', userId);
      })
      .andWhere(function() {
        this.whereRaw('MATCH(c.name, c.description) AGAINST(? IN NATURAL LANGUAGE MODE)', [query])
            .orWhere('c.name', 'like', `%${query}%`)
            .orWhere('c.description', 'like', `%${query}%`);
      })
      .count('* as count')
      .first();

    const totalResult = await totalQuery as any;
    const total = totalResult?.count || 0;

    // 페이지네이션
    if (options.limit) {
      searchQuery = searchQuery.limit(options.limit);
    }
    if (options.offset) {
      searchQuery = searchQuery.offset(options.offset);
    }

    searchQuery = searchQuery.orderBy('c.createdAt', 'desc');

    const channels = await searchQuery;
    return { channels, total: Number(total) };
  }

  // 인기 채널 조회
  static async getPopularChannels(limit = 10): Promise<ChannelType[]> {
    return await this.knex('chat_channels as c')
      .select([
        'c.*',
        this.knex.raw('COUNT(cm.userId) as memberCount'),
        this.knex.raw('COUNT(m.id) as messageCount'),
      ])
      .leftJoin('chat_channel_members as cm', function() {
        this.on('c.id', '=', 'cm.channelId')
            .andOnVal('cm.status', '=', 'active');
      })
      .leftJoin('chat_messages as m', 'c.id', 'm.channelId')
      .where({
        'c.type': 'public',
        'c.isArchived': false,
      })
      .andWhere('m.createdAt', '>=', this.knex.raw('DATE_SUB(NOW(), INTERVAL 7 DAY)'))
      .groupBy('c.id')
      .orderBy('memberCount', 'desc')
      .orderBy('messageCount', 'desc')
      .limit(limit);
  }

  // 채널 통계 조회
  static async getStats(channelId: number): Promise<any> {
    const stats = await this.knex('chat_channels as c')
      .select([
        'c.id',
        'c.name',
        this.knex.raw('COUNT(DISTINCT cm.userId) as totalMembers'),
        this.knex.raw('COUNT(DISTINCT CASE WHEN cm.status = "active" THEN cm.userId END) as activeMembers'),
        this.knex.raw('COUNT(DISTINCT m.id) as totalMessages'),
        this.knex.raw('COUNT(DISTINCT CASE WHEN m.createdAt >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN m.id END) as messagesToday'),
        this.knex.raw('COUNT(DISTINCT CASE WHEN m.createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN m.id END) as messagesThisWeek'),
        this.knex.raw('MAX(m.createdAt) as lastMessageAt'),
      ])
      .leftJoin('chat_channel_members as cm', 'c.id', 'cm.channelId')
      .leftJoin('chat_messages as m', 'c.id', 'm.channelId')
      .where('c.id', channelId)
      .groupBy('c.id')
      .first();

    return stats;
  }

  // 채널을 읽음으로 표시
  static async markAsRead(channelId: number, userId: number, messageId?: number): Promise<boolean> {
    try {
      const updateData: any = {
        lastReadAt: new Date(),
        unreadCount: 0,
      };

      // 특정 메시지까지 읽음 처리
      if (messageId) {
        updateData.lastReadMessageId = messageId;
      } else {
        // 최신 메시지까지 읽음 처리 (타임아웃 설정)
        try {
          const latestMessage = await this.knex('chat_messages')
            .where('channelId', channelId)
            .orderBy('id', 'desc')
            .timeout(2000) // 2초로 단축
            .first();

          if (latestMessage) {
            updateData.lastReadMessageId = latestMessage.id;
          }
        } catch (timeoutError) {
          console.warn(`⚠️ Timeout getting latest message for markAsRead channel ${channelId}, proceeding without messageId`);
          // 최신 메시지 조회 실패 시에도 읽음 처리는 계속 진행
        }
      }

      // 더 빠른 업데이트를 위해 타임아웃 단축
      const result = await this.knex('chat_channel_members')
        .where({
          channelId,
          userId,
          status: 'active',
        })
        .timeout(2000) // 2초로 단축
        .update(updateData);

      console.log(`✅ MarkAsRead completed for channel ${channelId}, user ${userId}, affected rows: ${result}`);
      return result > 0;
    } catch (error) {
      console.error(`❌ Error marking channel ${channelId} as read for user ${userId}:`, error);
      return false;
    }
  }

  // 기본 채널 설정
  private static getDefaultSettings(): ChannelSettings {
    return {
      allowFileUploads: true,
      allowReactions: true,
      allowInvites: true,
      slowMode: 0,
      maxMessageLength: 2000,
      autoDeleteMessages: false,
      autoDeleteDays: 30,
      requireApproval: false,
      allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
      maxFileSize: 10485760, // 10MB
    };
  }

  // 배치 작업
  static async batchUpdate(channelIds: number[], data: Partial<UpdateChannelData>): Promise<number> {
    const result = await this.knex('chat_channels')
      .whereIn('id', channelIds)
      .update({
        ...data,
        updatedAt: new Date(),
      });

    return result;
  }

  // 채널 존재 여부 확인
  static async exists(id: number): Promise<boolean> {
    const result = await this.knex('chat_channels')
      .where({ id, isArchived: false })
      .count('id as count')
      .first();

    return Number(result?.count) > 0;
  }

  // 사용자가 채널 멤버인지 확인
  static async isMember(channelId: number, userId: number): Promise<boolean> {
    const result = await this.knex('chat_channel_members')
      .where({
        channelId,
        userId,
        status: 'active',
      })
      .count('id as count')
      .first();

    return Number(result?.count) > 0;
  }

  // 사용자의 채널 권한 조회
  static async getUserRole(channelId: number, userId: number): Promise<string | null> {
    const result = await this.knex('chat_channel_members')
      .select('role')
      .where({
        channelId,
        userId,
        status: 'active',
      })
      .first();

    return result?.role || null;
  }

  // 사용자가 채널에 접근할 수 있는지 확인
  static async hasAccess(channelId: number, userId: number): Promise<boolean> {
    // 채널이 존재하는지 확인
    const channel = await this.knex('chat_channels')
      .select('type', 'isArchived')
      .where('id', channelId)
      .first();

    if (!channel || channel.isArchived) {
      return false;
    }

    // public 채널은 모든 사용자가 접근 가능
    if (channel.type === 'public') {
      return true;
    }

    // private 또는 direct 채널은 멤버만 접근 가능
    const membership = await this.knex('chat_channel_members')
      .select('id')
      .where({
        channelId,
        userId,
        status: 'active',
      })
      .first();

    return !!membership;
  }

  // 채널에 멤버 추가
  static async addMember(channelId: number, userId: number, role: 'owner' | 'admin' | 'member' = 'member'): Promise<void> {
    const knex = databaseManager.getKnex();

    // 이미 멤버인지 확인
    const existingMember = await knex('chat_channel_members')
      .select('id')
      .where({
        channelId: channelId,
        userId: userId,
      })
      .first();

    if (existingMember) {
      // 이미 멤버라면 상태를 active로 업데이트
      await knex('chat_channel_members')
        .where({
          channelId: channelId,
          userId: userId,
        })
        .update({
          status: 'active',
          role,
          updatedAt: new Date(),
        });
    } else {
      // 새 멤버 추가
      await knex('chat_channel_members').insert({
        channelId: channelId,
        userId: userId,
        role,
        status: 'active',
        joinedAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // 채널에서 멤버 제거
  static async removeMember(channelId: number, userId: number): Promise<void> {
    const knex = databaseManager.getKnex();

    await knex('chat_channel_members')
      .where({
        channelId,
        userId,
      })
      .update({
        status: 'left',
        leftAt: new Date(),
        updatedAt: new Date(),
      });
  }

  // 채널 멤버 목록 조회
  static async getMembers(channelId: number): Promise<Array<{
    userId: number;
    role: string;
    status: string;
    joinedAt: Date;
  }>> {
    const knex = databaseManager.getKnex();

    const members = await knex('chat_channel_members')
      .select('userId', 'role', 'status', 'joinedAt')
      .where({
        channelId,
        status: 'active',
      })
      .orderBy('joinedAt', 'asc');

    return members;
  }

  // 사용자의 채널 목록 조회 (멤버 정보 포함)
  static async getUserChannels(userId: number, options: { includeMembers?: boolean } = {}): Promise<{
    channels: Array<Channel & { members?: Array<{ userId: number; role: string; status: string; joinedAt: Date }> }>;
    total: number;
  }> {
    const knex = databaseManager.getKnex();

    // 사용자가 참여한 채널 조회
    const channelsQuery = knex('chat_channels as c')
      .select(
        'c.id',
        'c.name',
        'c.description',
        'c.type',
        'c.maxMembers',
        'c.isArchived',
        'c.archiveReason',
        'c.avatarUrl',
        'c.settings',
        'c.ownerId',
        'c.createdBy',
        'c.updatedBy',
        'c.createdAt',
        'c.updatedAt',
        'c.archivedAt'
      )
      .join('chat_channel_members as cm', 'c.id', 'cm.channelId')
      .where('cm.userId', userId)
      .where('cm.status', 'active')
      .where('c.isArchived', false)
      .orderBy('c.updatedAt', 'desc');

    const channels = await channelsQuery;

    // 멤버 정보가 필요한 경우 추가 조회
    if (options.includeMembers && channels.length > 0) {
      const channelIds = channels.map(c => c.id);
      const members = await knex('chat_channel_members')
        .select('channelId', 'userId', 'role', 'status', 'joinedAt')
        .whereIn('channelId', channelIds)
        .where('status', 'active');

      // 채널별로 멤버 그룹화
      const membersByChannel = members.reduce((acc, member) => {
        if (!acc[member.channelId]) {
          acc[member.channelId] = [];
        }
        acc[member.channelId].push(member);
        return acc;
      }, {} as Record<number, any[]>);

      // 채널에 멤버 정보 추가
      channels.forEach(channel => {
        channel.members = membersByChannel[channel.id] || [];
      });
    }

    return {
      channels,
      total: channels.length
    };
  }
}
