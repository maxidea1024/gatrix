import { databaseManager } from "../config/database";
import { createLogger } from "../config/logger";

const logger = createLogger("UserPrivacySettings");

export type InvitePolicy = "everyone" | "contacts_only" | "nobody";

export interface UserPrivacySettingsType {
  userId: number;
  channelInvitePolicy: InvitePolicy;
  directMessagePolicy: InvitePolicy;
  discoverableByEmail: boolean;
  discoverableByName: boolean;
  requireFriendRequest: boolean;
  blockedUsers: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePrivacySettingsData {
  channelInvitePolicy?: InvitePolicy;
  directMessagePolicy?: InvitePolicy;
  discoverableByEmail?: boolean;
  discoverableByName?: boolean;
  requireFriendRequest?: boolean;
  blockedUsers?: number[];
}

export interface UpdatePrivacySettingsData {
  channelInvitePolicy?: InvitePolicy;
  directMessagePolicy?: InvitePolicy;
  discoverableByEmail?: boolean;
  discoverableByName?: boolean;
  requireFriendRequest?: boolean;
  blockedUsers?: number[];
}

export class UserPrivacySettingsModel {
  private static get knex() {
    return databaseManager.getKnex();
  }

  // 기본 설정값
  private static getDefaultSettings(): Omit<
    UserPrivacySettingsType,
    "userId" | "createdAt" | "updatedAt"
  > {
    return {
      channelInvitePolicy: "everyone",
      directMessagePolicy: "everyone",
      discoverableByEmail: true,
      discoverableByName: true,
      requireFriendRequest: false,
      blockedUsers: [],
    };
  }

  // 사용자 프라이버시 설정 조회 (없으면 기본값 반환)
  static async findByUserId(userId: number): Promise<UserPrivacySettingsType> {
    try {
      const settings = await this.knex("chat_user_privacy_settings")
        .where("userId", userId)
        .first();

      if (settings) {
        let blockedUsers = [];
        try {
          blockedUsers = JSON.parse(settings.blockedUsers || "[]");
        } catch (parseError) {
          logger.warn(
            `Invalid JSON in blockedUsers for user ${userId}, using empty array`,
          );
          blockedUsers = [];
        }

        return {
          ...settings,
          blockedUsers,
        };
      }

      // 설정이 없으면 기본값으로 생성
      return await this.createDefault(userId);
    } catch (error) {
      logger.error(
        `Failed to find privacy settings for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  // 기본 설정으로 생성
  static async createDefault(userId: number): Promise<UserPrivacySettingsType> {
    try {
      const defaultSettings = this.getDefaultSettings();
      const settingsData = {
        userId,
        ...defaultSettings,
        blockedUsers: JSON.stringify(defaultSettings.blockedUsers),
      };

      await this.knex("chat_user_privacy_settings").insert(settingsData);

      return {
        ...defaultSettings,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      logger.error(
        `Failed to create default privacy settings for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  // 프라이버시 설정 업데이트
  static async update(
    userId: number,
    data: UpdatePrivacySettingsData,
  ): Promise<UserPrivacySettingsType> {
    try {
      const updateData: any = {
        ...data,
        updatedAt: new Date(),
      };

      // blockedUsers가 있으면 JSON 문자열로 변환
      if (data.blockedUsers !== undefined) {
        updateData.blockedUsers = JSON.stringify(data.blockedUsers);
      }

      await this.knex("chat_user_privacy_settings")
        .where("userId", userId)
        .update(updateData);

      return await this.findByUserId(userId);
    } catch (error) {
      logger.error(
        `Failed to update privacy settings for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  // 사용자 차단
  static async blockUser(userId: number, targetUserId: number): Promise<void> {
    try {
      const settings = await this.findByUserId(userId);
      const blockedUsers = settings.blockedUsers || [];

      if (!blockedUsers.includes(targetUserId)) {
        blockedUsers.push(targetUserId);
        await this.update(userId, { blockedUsers });
      }
    } catch (error) {
      logger.error(
        `Failed to block user ${targetUserId} for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  // 사용자 차단 해제
  static async unblockUser(
    userId: number,
    targetUserId: number,
  ): Promise<void> {
    try {
      const settings = await this.findByUserId(userId);
      const blockedUsers = settings.blockedUsers || [];
      const filteredUsers = blockedUsers.filter((id) => id !== targetUserId);

      await this.update(userId, { blockedUsers: filteredUsers });
    } catch (error) {
      logger.error(
        `Failed to unblock user ${targetUserId} for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  // 차단 여부 확인
  static async isBlocked(
    userId: number,
    targetUserId: number,
  ): Promise<boolean> {
    try {
      const settings = await this.findByUserId(userId);
      return settings.blockedUsers.includes(targetUserId);
    } catch (error) {
      logger.error(
        `Failed to check if user ${targetUserId} is blocked by user ${userId}:`,
        error,
      );
      return false;
    }
  }

  // 초대 가능 여부 검증
  static async canInviteUser(
    inviterId: number,
    inviteeId: number,
    inviteType: "channel" | "direct",
  ): Promise<{ canInvite: boolean; reason?: string }> {
    try {
      // 자기 자신은 초대할 수 없음
      if (inviterId === inviteeId) {
        return { canInvite: false, reason: "self_invite" };
      }

      const inviteeSettings = await this.findByUserId(inviteeId);

      // 1. 차단 여부 확인
      if (inviteeSettings.blockedUsers.includes(inviterId)) {
        return { canInvite: false, reason: "blocked" };
      }

      // 2. 정책 확인
      const policy =
        inviteType === "direct"
          ? inviteeSettings.directMessagePolicy
          : inviteeSettings.channelInvitePolicy;

      switch (policy) {
        case "nobody":
          return { canInvite: false, reason: "policy_nobody" };

        case "contacts_only":
          // TODO: 연락처 시스템 구현 후 확인
          // const areContacts = await this.areUsersContacts(inviterId, inviteeId);
          // return { canInvite: areContacts, reason: areContacts ? undefined : 'policy_contacts_only' };
          return { canInvite: false, reason: "policy_contacts_only" };

        case "everyone":
        default:
          return { canInvite: true };
      }
    } catch (error) {
      logger.error(
        `Failed to check invite permission for ${inviterId} -> ${inviteeId}:`,
        error,
      );
      return { canInvite: false, reason: "error" };
    }
  }

  // 검색 가능 여부 확인
  static async isDiscoverable(
    userId: number,
    searchType: "email" | "name",
  ): Promise<boolean> {
    try {
      const settings = await this.findByUserId(userId);
      return searchType === "email"
        ? settings.discoverableByEmail
        : settings.discoverableByName;
    } catch (error) {
      logger.error(
        `Failed to check discoverability for user ${userId}:`,
        error,
      );
      return true; // 기본값은 검색 가능
    }
  }
}
