import { gatrixApiService, GatrixUser } from './GatrixApiService';
import { redisManager } from '../config/redis';
import { databaseManager } from '../config/database';
import { createLogger } from '../config/logger';

const logger = createLogger('UserSyncService');

export class UserSyncService {
  private static instance: UserSyncService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {}

  public static getInstance(): UserSyncService {
    if (!UserSyncService.instance) {
      UserSyncService.instance = new UserSyncService();
    }
    return UserSyncService.instance;
  }

  // 사용자 동기화 시작
  public start(): void {
    if (this.isRunning) {
      logger.warn('User sync service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting user sync service');

    // 초기 동기화 실행
    this.performSync().catch(error => {
      logger.error('Initial user sync failed:', error);
    });

    // 주기적 동기화 (5분마다)
    this.syncInterval = setInterval(() => {
      this.performSync().catch(error => {
        logger.error('Periodic user sync failed:', error);
      });
    }, 5 * 60 * 1000);
  }

  // 사용자 동기화 중지
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    logger.info('User sync service stopped');
  }

  // 동기화 실행
  private async performSync(): Promise<void> {
    try {
      logger.info('Starting user synchronization');

      // 마지막 동기화 시간 조회
      const lastSyncAt = await this.getLastSyncTime();
      
      // Gatrix에서 사용자 데이터 가져오기
      const syncData = await gatrixApiService.syncUsers(lastSyncAt);
      
      if (!syncData) {
        logger.warn('No sync data received from Gatrix');
        return;
      }

      if (syncData.users.length === 0) {
        logger.info('No users to sync');
        return;
      }

      // 사용자 데이터 업데이트
      await this.updateUsers(syncData.users);

      // 마지막 동기화 시간 업데이트
      await this.updateLastSyncTime(syncData.lastSyncAt);

      logger.info(`User sync completed: ${syncData.users.length} users synchronized`);
    } catch (error) {
      logger.error('User synchronization failed:', error);
      throw error;
    }
  }

  // 사용자 데이터 업데이트 (Redis 캐시만 사용)
  private async updateUsers(users: GatrixUser[]): Promise<void> {
    const redisClient = redisManager.getClient();

    try {
      // Redis에만 사용자 정보 캐시 (데이터베이스 테이블 없이)
      for (const user of users) {
        await redisClient.hset(`user:${user.id}`, {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl || '',
          role: user.role,
          status: user.status,
          lastLoginAt: user.lastLoginAt ? (typeof user.lastLoginAt === 'string' ? user.lastLoginAt : user.lastLoginAt.toISOString()) : '',
          updatedAt: new Date().toISOString(),
        });

        // 캐시 TTL 설정 (1시간)
        await redisClient.expire(`user:${user.id}`, 3600);
      }

      logger.info(`Updated ${users.length} users in Redis cache`);
    } catch (error) {
      logger.error('Failed to update users:', error);
      throw error;
    }
  }

  // 마지막 동기화 시간 조회
  private async getLastSyncTime(): Promise<Date | undefined> {
    try {
      const redisClient = redisManager.getClient();
      const lastSync = await redisClient.get('user_sync:last_sync_at');
      
      return lastSync ? new Date(lastSync) : undefined;
    } catch (error) {
      logger.error('Failed to get last sync time:', error);
      return undefined;
    }
  }

  // 마지막 동기화 시간 업데이트
  private async updateLastSyncTime(syncTime: Date): Promise<void> {
    try {
      const redisClient = redisManager.getClient();
      await redisClient.set('user_sync:last_sync_at', syncTime.toISOString());
    } catch (error) {
      logger.error('Failed to update last sync time:', error);
    }
  }

  // 특정 사용자 강제 동기화
  public async syncUser(userId: number): Promise<GatrixUser | null> {
    try {
      const user = await gatrixApiService.getUserById(userId);
      
      if (!user) {
        logger.warn(`User ${userId} not found in Gatrix`);
        return null;
      }

      await this.updateUsers([user]);
      return user;
    } catch (error) {
      logger.error(`Failed to sync user ${userId}:`, error);
      return null;
    }
  }

  // 캐시된 사용자 정보 조회
  public async getCachedUser(userId: number): Promise<GatrixUser | null> {
    try {
      const redisClient = redisManager.getClient();
      const userData = await redisClient.hgetall(`user:${userId}`);
      
      if (!userData.id) {
        return null;
      }

      return {
        id: parseInt(userData.id),
        email: userData.email,
        name: userData.name,
        avatarUrl: userData.avatarUrl || undefined,
        role: userData.role,
        status: userData.status,
        lastLoginAt: userData.lastLoginAt ? new Date(userData.lastLoginAt) : undefined,
        createdAt: new Date(userData.createdAt || Date.now()),
        updatedAt: new Date(userData.updatedAt),
      };
    } catch (error) {
      logger.error(`Failed to get cached user ${userId}:`, error);
      return null;
    }
  }

  // 사용자 정보 조회 (캐시 우선, 없으면 동기화)
  public async getUser(userId: number): Promise<GatrixUser | null> {
    try {
      // 캐시에서 먼저 조회
      let user = await this.getCachedUser(userId);
      
      if (user) {
        return user;
      }

      // 캐시에 없으면 Gatrix에서 조회 후 동기화
      user = await this.syncUser(userId);
      return user;
    } catch (error) {
      logger.error(`Failed to get user ${userId}:`, error);
      return null;
    }
  }

  // 여러 사용자 정보 조회
  public async getUsers(userIds: number[]): Promise<Map<number, GatrixUser>> {
    const userMap = new Map<number, GatrixUser>();
    const missingUserIds: number[] = [];

    try {
      // 캐시에서 먼저 조회
      for (const userId of userIds) {
        const user = await this.getCachedUser(userId);
        if (user) {
          userMap.set(userId, user);
        } else {
          missingUserIds.push(userId);
        }
      }

      // 캐시에 없는 사용자들을 Gatrix에서 조회
      if (missingUserIds.length > 0) {
        const users = await gatrixApiService.getUsersByIds(missingUserIds);
        
        if (users.length > 0) {
          await this.updateUsers(users);
          
          for (const user of users) {
            userMap.set(user.id, user);
          }
        }
      }

      return userMap;
    } catch (error) {
      logger.error('Failed to get users:', error);
      return userMap;
    }
  }

  // 사용자 검색
  public async searchUsers(query: string, limit = 20): Promise<GatrixUser[]> {
    try {
      return await gatrixApiService.searchUsers(query, limit);
    } catch (error) {
      logger.error('Failed to search users:', error);
      return [];
    }
  }

  // 동기화 상태 조회
  public getStatus(): {
    isRunning: boolean;
    lastSyncAt?: Date;
  } {
    return {
      isRunning: this.isRunning,
    };
  }

  // 수동 동기화 트리거
  public async triggerSync(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('User sync service is not running');
    }

    await this.performSync();
  }
}

export const userSyncService = UserSyncService.getInstance();
