import { CacheService } from './CacheService';
import { ApiAccessToken } from '../models/ApiAccessToken';
import logger from '../config/logger';
import { queueService } from './QueueService';
import { getInstanceId } from '../utils/AppInstance';

interface TokenUsageStats {
  usageCount: number;
  lastUsedAt: Date;
  instanceId: string; // 여러 Gatrix 인스턴스 구분용
}

interface AggregatedStats {
  totalUsageCount: number;
  latestUsedAt: Date;
  instances: string[];
}

export class ApiTokenUsageService {
  private static instance: ApiTokenUsageService;
  private readonly syncIntervalMs: number;
  private isInitialized = false;

  private constructor() {
    // 환경변수로 설정 가능한 동기화 주기 (기본 1분)
    this.syncIntervalMs = parseInt(process.env.API_TOKEN_SYNC_INTERVAL_MS || '60000');

    logger.info('ApiTokenUsageService initialized', {
      instanceId: getInstanceId(),
      syncIntervalMs: this.syncIntervalMs
    });
  }

  static getInstance(): ApiTokenUsageService {
    if (!ApiTokenUsageService.instance) {
      ApiTokenUsageService.instance = new ApiTokenUsageService();
    }
    return ApiTokenUsageService.instance;
  }

  /**
   * 서비스 초기화 - QueueService에 반복 스케줄 등록
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // QueueService에 토큰 사용량 동기화 작업을 반복 스케줄로 등록
      
      // 토큰 사용량 동기화 큐가 없으면 생성
      if (!queueService.getQueue('token-usage-sync')) {
        await queueService.createQueue('token-usage-sync', this.processTokenUsageSyncJob.bind(this), {
          concurrency: 1, // 동시 실행 방지
          removeOnComplete: 10,
          removeOnFail: 5
        });
      }

      // 반복 스케줄 등록 (1분마다 실행)
      await queueService.addJob('token-usage-sync', 'sync-token-usage', {}, {
        repeat: {
          every: this.syncIntervalMs
        }
      });

      this.isInitialized = true;
      logger.info('ApiTokenUsageService initialized with recurring sync job', {
        intervalMs: this.syncIntervalMs
      });

    } catch (error) {
      logger.error('Failed to initialize ApiTokenUsageService:', error);
      throw error;
    }
  }

  /**
   * 토큰 사용 기록 (캐시에 저장)
   */
  async recordTokenUsage(tokenId: number): Promise<void> {
    try {
      const cacheKey = this.getTokenUsageCacheKey(tokenId);
      const now = new Date();

      // 현재 인스턴스의 사용량 통계 가져오기
      let stats = await CacheService.get<TokenUsageStats>(cacheKey);
      
      if (!stats) {
        stats = {
          usageCount: 0,
          lastUsedAt: now,
          instanceId: getInstanceId()
        };
      }

      // 사용량 증가
      stats.usageCount += 1;
      stats.lastUsedAt = now;
      stats.instanceId = getInstanceId();

      // 캐시에 저장 (TTL: 동기화 주기의 2배)
      const ttlSeconds = Math.ceil(this.syncIntervalMs * 2 / 1000);
      await CacheService.set(cacheKey, stats, ttlSeconds);

      logger.debug('Token usage recorded in cache', {
        tokenId,
        usageCount: stats.usageCount,
        instanceId: getInstanceId()
      });

    } catch (error) {
      logger.error('Failed to record token usage in cache:', error);
      // 캐시 실패 시에도 API 요청은 계속 처리되어야 함
    }
  }

  /**
   * QueueService에서 호출되는 토큰 사용량 동기화 작업 처리
   */
  private async processTokenUsageSyncJob(): Promise<void> {
    try {
      logger.info('Starting token usage synchronization', {
        instanceId: getInstanceId()
      });

      await this.syncTokenUsageToDatabase();

      logger.info('Token usage synchronization completed', {
        instanceId: getInstanceId()
      });

    } catch (error) {
      logger.error('Token usage synchronization failed:', error);
      throw error; // QueueService가 재시도하도록 에러 전파
    }
  }

  /**
   * 캐시된 토큰 사용량을 데이터베이스에 동기화
   */
  private async syncTokenUsageToDatabase(): Promise<void> {
    try {
      // 모든 토큰 사용량 캐시 키 패턴으로 검색
      const pattern = 'token_usage:*';
      const cacheKeys = await CacheService.getKeysByPattern(pattern);

      if (cacheKeys.length === 0) {
        logger.debug('No token usage data to sync');
        return;
      }

      logger.info(`Found ${cacheKeys.length} token usage cache entries to sync`);

      // 토큰별로 집계
      const tokenAggregates = new Map<number, AggregatedStats>();

      for (const cacheKey of cacheKeys) {
        try {
          const stats = await CacheService.get<TokenUsageStats>(cacheKey);
          if (!stats) continue;

          const tokenId = this.extractTokenIdFromCacheKey(cacheKey);
          if (!tokenId) continue;

          const existing = tokenAggregates.get(tokenId);
          if (!existing) {
            tokenAggregates.set(tokenId, {
              totalUsageCount: stats.usageCount,
              latestUsedAt: stats.lastUsedAt,
              instances: [stats.instanceId]
            });
          } else {
            existing.totalUsageCount += stats.usageCount;
            if (stats.lastUsedAt > existing.latestUsedAt) {
              existing.latestUsedAt = stats.lastUsedAt;
            }
            if (!existing.instances.includes(stats.instanceId)) {
              existing.instances.push(stats.instanceId);
            }
          }

        } catch (error) {
          logger.error(`Failed to process cache key ${cacheKey}:`, error);
        }
      }

      // 데이터베이스 업데이트
      for (const [tokenId, aggregate] of tokenAggregates) {
        try {
          await this.updateTokenUsageInDatabase(tokenId, aggregate);
          logger.debug('Token usage updated in database', {
            tokenId,
            totalUsageCount: aggregate.totalUsageCount,
            instances: aggregate.instances
          });
        } catch (error) {
          logger.error(`Failed to update token ${tokenId} usage in database:`, error);
        }
      }

      // 성공적으로 동기화된 캐시 항목들 삭제
      await this.clearSyncedCacheEntries(cacheKeys);

      logger.info(`Successfully synced usage data for ${tokenAggregates.size} tokens`);

    } catch (error) {
      logger.error('Failed to sync token usage to database:', error);
      throw error;
    }
  }

  /**
   * 데이터베이스의 토큰 사용량 업데이트
   */
  private async updateTokenUsageInDatabase(tokenId: number, aggregate: AggregatedStats): Promise<void> {
    try {
      // 현재 DB의 사용량 조회
      const currentToken = await ApiAccessToken.query().findById(tokenId);
      if (!currentToken) {
        logger.warn(`Token ${tokenId} not found in database`);
        return;
      }

      const newUsageCount = (currentToken.usageCount || 0) + aggregate.totalUsageCount;
      const newLastUsedAt = aggregate.latestUsedAt;

      // 사용량 업데이트 (Raw 쿼리로 날짜 형식 문제 해결)
      // MySQL 호환 형식으로 변환 (YYYY-MM-DD HH:mm:ss)
      const formatForMySQL = (date: Date) => {
        return date.toISOString().slice(0, 19).replace('T', ' ');
      };

      await ApiAccessToken.knex().raw(`
        UPDATE g_api_access_tokens
        SET usageCount = ?, lastUsedAt = ?, updatedAt = ?
        WHERE id = ?
      `, [
        newUsageCount,
        formatForMySQL(newLastUsedAt),
        formatForMySQL(new Date()),
        tokenId
      ]);

      logger.debug('Database updated for token', {
        tokenId,
        previousUsageCount: currentToken.usageCount || 0,
        addedUsageCount: aggregate.totalUsageCount,
        newUsageCount,
        lastUsedAt: newLastUsedAt,
        instances: aggregate.instances
      });

      // 토큰 캐시 무효화 (다음 요청 시 최신 데이터 로드)
      await this.invalidateTokenCache(tokenId);

    } catch (error) {
      logger.error(`Failed to update token ${tokenId} in database:`, error);
      throw error;
    }
  }

  /**
   * 동기화 완료된 캐시 항목들 삭제
   */
  private async clearSyncedCacheEntries(cacheKeys: string[]): Promise<void> {
    try {
      for (const cacheKey of cacheKeys) {
        await CacheService.delete(cacheKey);
      }
      logger.debug(`Cleared ${cacheKeys.length} synced cache entries`);
    } catch (error) {
      logger.error('Failed to clear synced cache entries:', error);
    }
  }

  /**
   * 토큰 캐시 무효화
   */
  private async invalidateTokenCache(tokenId: number): Promise<void> {
    try {
      // API 토큰 인증 미들웨어에서 사용하는 캐시 패턴 무효화
      const pattern = 'api_token:*';
      const tokenCacheKeys = await CacheService.getKeysByPattern(pattern);
      
      // 해당 토큰 ID와 관련된 캐시만 삭제 (정확한 매칭은 복잡하므로 모든 토큰 캐시 삭제)
      for (const key of tokenCacheKeys) {
        await CacheService.delete(key);
      }
      
      logger.debug(`Invalidated token cache for token ${tokenId}`);
    } catch (error) {
      logger.error(`Failed to invalidate token cache for token ${tokenId}:`, error);
    }
  }

  /**
   * 토큰 사용량 캐시 키 생성
   */
  private getTokenUsageCacheKey(tokenId: number): string {
    return `token_usage:${tokenId}:${getInstanceId()}`;
  }

  /**
   * 캐시 키에서 토큰 ID 추출
   */
  private extractTokenIdFromCacheKey(cacheKey: string): number | null {
    const match = cacheKey.match(/^token_usage:(\d+):/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * 서비스 종료 시 정리
   */
  async shutdown(): Promise<void> {
    try {
      // 마지막으로 한 번 동기화 실행
      await this.syncTokenUsageToDatabase();
      logger.info('ApiTokenUsageService shutdown completed');
    } catch (error) {
      logger.error('Error during ApiTokenUsageService shutdown:', error);
    }
  }
}

export default ApiTokenUsageService.getInstance();
