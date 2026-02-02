import { databaseManager } from "../config/database";
import { CacheService } from "./CacheService";
import { createLogger } from "../config/logger";

const logger = createLogger("UserService");

export interface UserData {
  id: number;
  username: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role?: string;
  status?: string;
  chatStatus?: "online" | "away" | "busy" | "offline";
  customStatus?: string;
  lastLoginAt?: string;
  lastActivityAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class UserService {
  private static cacheService = CacheService.getInstance();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly CACHE_PREFIX = "user:";
  private static readonly USERS_LIST_KEY = "users:all";

  /**
   * Upsert user (create or update)
   */
  static async upsertUser(userData: UserData): Promise<UserData> {
    try {
      // 공용 날짜 변환 함수 사용
      const convertToMySQLDateTime = (
        dateValue: string | undefined,
      ): string | null => {
        if (!dateValue) return null;
        try {
          return new Date(dateValue)
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");
        } catch {
          return null;
        }
      };

      // 현재 시간을 MySQL DATETIME 형식으로 생성
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");

      // 필드 매핑 및 정리
      const userToSave: any = {
        ...userData,
        gatrixUserId: userData.id, // Gatrix 사용자 ID 저장
        status: userData.status || "active",
        chatStatus: userData.chatStatus || "offline",
        lastActivityAt: convertToMySQLDateTime(userData.lastActivityAt),
        createdAt: convertToMySQLDateTime(userData.createdAt),
        updatedAt: now,
      };

      // 존재하지 않는 필드들 제거
      delete userToSave.lastSeenAt;

      // Database upsert
      const db = databaseManager.getKnex();
      await db("chat_users")
        .insert(userToSave)
        .onConflict("gatrixUserId")
        .merge([
          "gatrixUserId",
          "username",
          "email",
          "name",
          "avatarUrl",
          "role",
          "status",
          "chatStatus",
          "customStatus",
          "lastLoginAt",
          "lastActivityAt",
          "updatedAt",
        ]);

      // Cache the user
      const cacheKey = `${this.CACHE_PREFIX}${userData.id}`;
      await this.cacheService.set(cacheKey, userToSave, this.CACHE_TTL);

      // Update users list cache
      await this.invalidateUsersListCache();

      logger.info(
        `User ${userData.id} (${userData.username}) upserted successfully`,
      );
      return userToSave;
    } catch (error) {
      logger.error("Error upserting user:", error);
      throw error;
    }
  }

  /**
   * Bulk upsert multiple users (for admin sync)
   */
  static async bulkUpsertUsers(usersData: UserData[]): Promise<UserData[]> {
    try {
      logger.info(`Bulk upserting ${usersData.length} users...`);

      const db = databaseManager.getKnex();
      const results: UserData[] = [];

      // Process in batches to avoid overwhelming the database
      const batchSize = 50;
      for (let i = 0; i < usersData.length; i += batchSize) {
        const batch = usersData.slice(i, i + batchSize);

        // Use transaction for each batch
        await db.transaction(async (trx) => {
          for (const userData of batch) {
            const now = new Date().toISOString().slice(0, 19).replace("T", " ");
            const userToSave: UserData = {
              id: userData.id,
              username: userData.username,
              name: userData.name || userData.username,
              email: userData.email || userData.username,
              avatarUrl: userData.avatarUrl || undefined,
              status: userData.status || "active",
              chatStatus: userData.chatStatus || "offline",
              customStatus: userData.customStatus || undefined,
              lastActivityAt: userData.lastActivityAt
                ? new Date(userData.lastActivityAt)
                    .toISOString()
                    .slice(0, 19)
                    .replace("T", " ")
                : now,
              createdAt: userData.createdAt
                ? new Date(userData.createdAt)
                    .toISOString()
                    .slice(0, 19)
                    .replace("T", " ")
                : now,
              updatedAt: now,
            };

            const existingUser = await trx("chat_users")
              .where("id", userData.id)
              .first();

            if (existingUser) {
              await trx("chat_users")
                .where("id", userData.id)
                .update(userToSave);
            } else {
              await trx("chat_users").insert(userToSave);
            }

            results.push(userToSave);
          }
        });
      }

      // Invalidate cache
      await this.invalidateUsersListCache();

      // Clear individual user caches
      for (const userData of usersData) {
        const cacheKey = `${this.CACHE_PREFIX}${userData.id}`;
        await this.cacheService.delete(cacheKey);
      }

      logger.info(`Bulk upserted ${results.length} users successfully`);
      return results;
    } catch (error) {
      logger.error("Error bulk upserting users:", error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: number): Promise<UserData | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${userId}`;

      // Try cache first
      let user = await this.cacheService.get<UserData>(cacheKey);
      if (user) {
        return user;
      }

      // Fallback to database
      const db = databaseManager.getKnex();
      user = await db("chat_users").where("id", userId).first();
      if (user) {
        // Cache the result
        await this.cacheService.set(cacheKey, user, this.CACHE_TTL);
      }

      return user || null;
    } catch (error) {
      logger.error(`Error getting user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get all users
   */
  static async getAllUsers(): Promise<UserData[]> {
    try {
      // Try cache first
      let users = await this.cacheService.get<UserData[]>(this.USERS_LIST_KEY);
      if (users) {
        return users;
      }

      // Fallback to database
      const db = databaseManager.getKnex();
      users = await db("chat_users").select("*").orderBy("username");

      // Cache the result
      await this.cacheService.set(this.USERS_LIST_KEY, users, this.CACHE_TTL);

      return users || [];
    } catch (error) {
      logger.error("Error getting all users:", error);
      return [];
    }
  }

  /**
   * Update user status
   */
  static async updateUserStatus(
    userId: number,
    status?: "online" | "away" | "busy" | "offline",
    customStatus?: string,
  ): Promise<boolean> {
    try {
      const updates: Partial<UserData> = {
        updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      };

      if (status !== undefined) {
        updates.chatStatus = status;
      }

      if (customStatus !== undefined) {
        updates.customStatus = customStatus;
      }

      // Update database
      const db = databaseManager.getKnex();
      const result = await db("chat_users").where("id", userId).update(updates);

      if (result > 0) {
        // Invalidate cache
        const cacheKey = `${this.CACHE_PREFIX}${userId}`;
        await this.cacheService.delete(cacheKey);
        await this.invalidateUsersListCache();

        logger.info(`User ${userId} status updated successfully`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error updating user ${userId} status:`, error);
      return false;
    }
  }

  /**
   * Delete user
   */
  static async deleteUser(userId: number): Promise<boolean> {
    try {
      // Delete from database
      const db = databaseManager.getKnex();
      const result = await db("chat_users").where("id", userId).del();

      if (result > 0) {
        // Remove from cache
        const cacheKey = `${this.CACHE_PREFIX}${userId}`;
        await this.cacheService.delete(cacheKey);
        await this.invalidateUsersListCache();

        logger.info(`User ${userId} deleted successfully`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error deleting user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Invalidate users list cache
   */
  private static async invalidateUsersListCache(): Promise<void> {
    try {
      await this.cacheService.delete(this.USERS_LIST_KEY);
    } catch (error) {
      logger.error("Error invalidating users list cache:", error);
    }
  }

  /**
   * Update user last seen
   */
  static async updateLastSeen(userId: number): Promise<void> {
    try {
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");

      // Update database
      const db = databaseManager.getKnex();
      await db("chat_users").where("id", userId).update({
        lastActivityAt: now,
        updatedAt: now,
      });

      // Invalidate cache
      const cacheKey = `${this.CACHE_PREFIX}${userId}`;
      await this.cacheService.delete(cacheKey);
    } catch (error) {
      logger.error(`Error updating last seen for user ${userId}:`, error);
    }
  }
}
