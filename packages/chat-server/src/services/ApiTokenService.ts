import crypto from 'crypto';
import { databaseManager } from '../config/database';
import { CacheService } from './CacheService';
import { createLogger } from '../config/logger';

const logger = createLogger('ApiTokenService');

export interface ApiToken {
  id: string;
  name: string;
  token: string;
  permissions: string[];
  createdAt: string;
  isActive: boolean;
}

export class ApiTokenService {
  private static readonly TOKEN_PREFIX = 'gatrix-api-';
  private static readonly CACHE_PREFIX = 'api_token:';
  private static readonly CACHE_TTL = 3600; // 1시간 (초)

  /**
   * Get cache service instance safely
   */
  private static getCacheService(): CacheService {
    return CacheService.getInstance();
  }

  /**
   * API 토큰 생성
   */
  static async generateToken(name: string, permissions: string[] = ['read', 'write']): Promise<ApiToken> {
    const id = crypto.randomUUID();
    const tokenSuffix = crypto.randomBytes(32).toString('hex');
    const token = `${this.TOKEN_PREFIX}${tokenSuffix}`;

    const apiToken: ApiToken = {
      id,
      name,
      token,
      permissions,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    // 데이터베이스에 저장
    const db = databaseManager.getKnex();
    await db('chat_api_tokens').insert({
      id,
      name,
      token,
      permissions: JSON.stringify(permissions),
      createdAt: new Date(),
      isActive: true,
    });

    // 캐시에 저장
    await this.getCacheService().set(`${this.CACHE_PREFIX}${token}`, apiToken, this.CACHE_TTL);

    logger.info(`API token generated: ${name} (${id})`);
    return apiToken;
  }

  /**
   * API 토큰 검증
   */
  static async verifyToken(token: string): Promise<ApiToken | null> {
    try {
      // 캐시에서 먼저 확인
      let apiToken = await this.getCacheService().get<ApiToken>(`${this.CACHE_PREFIX}${token}`);

      if (!apiToken) {
        // 캐시에 없으면 데이터베이스에서 조회
        const db = databaseManager.getKnex();
        const tokenData = await db('chat_api_tokens')
          .where({ token, isActive: true })
          .first();

        if (!tokenData) {
          return null;
        }

        // permissions 안전 파싱
        let permissions: string[];
        try {
          permissions = JSON.parse(tokenData.permissions);
        } catch (error) {
          // JSON 파싱 실패 시 문자열을 배열로 변환
          if (typeof tokenData.permissions === 'string') {
            permissions = tokenData.permissions.split(',').map((p: string) => p.trim());
          } else {
            permissions = ['read']; // 기본값
          }
        }

        apiToken = {
          id: tokenData.id,
          name: tokenData.name,
          token: tokenData.token,
          permissions: permissions,
          createdAt: tokenData.createdAt.toISOString(),
          isActive: tokenData.isActive,
        };

        // 캐시에 저장
        await this.getCacheService().set(`${this.CACHE_PREFIX}${token}`, apiToken, this.CACHE_TTL);
      }

      return apiToken;
    } catch (error) {
      logger.error('Error verifying API token:', error);
      return null;
    }
  }



  /**
   * API 토큰 폐기
   */
  static async revokeToken(token: string): Promise<boolean> {
    try {
      const db = databaseManager.getKnex();
      const result = await db('chat_api_tokens')
        .where({ token })
        .update({ isActive: false });

      if (result === 0) {
        return false;
      }

      // 캐시에서 삭제
      await this.getCacheService().delete(`${this.CACHE_PREFIX}${token}`);

      logger.info(`API token revoked: ${token}`);
      return true;
    } catch (error) {
      logger.error('Error revoking API token:', error);
      return false;
    }
  }

  /**
   * 모든 API 토큰 목록 조회
   */
  static async listTokens(): Promise<ApiToken[]> {
    try {
      const db = databaseManager.getKnex();
      const tokenData = await db('chat_api_tokens')
        .where({ isActive: true })
        .orderBy('createdAt', 'desc');

      return tokenData.map((data: any) => {
        // permissions 안전 파싱
        let permissions: string[];
        try {
          permissions = JSON.parse(data.permissions);
        } catch (error) {
          // JSON 파싱 실패 시 문자열을 배열로 변환
          if (typeof data.permissions === 'string') {
            permissions = data.permissions.split(',').map((p: string) => p.trim());
          } else {
            permissions = ['read']; // 기본값
          }
        }

        return {
          id: data.id,
          name: data.name,
          token: data.token,
          permissions: permissions,
          createdAt: data.createdAt.toISOString(),
          isActive: data.isActive,
        };
      });
    } catch (error) {
      logger.error('Error listing API tokens:', error);
      return [];
    }
  }

  /**
   * 기본 토큰 생성 (서버 시작 시)
   */
  static async ensureDefaultToken(): Promise<string> {
    const defaultTokenName = 'gatrix-backend-default';
    const tokens = await this.listTokens();
    
    // 기본 토큰이 이미 있는지 확인
    const existingToken = tokens.find(t => t.name === defaultTokenName);
    if (existingToken) {
      return existingToken.token;
    }

    // 기본 토큰 생성
    const defaultToken = await this.generateToken(defaultTokenName, ['read', 'write', 'admin']);
    logger.info(`Default API token created: ${defaultToken.token}`);
    
    return defaultToken.token;
  }
}
