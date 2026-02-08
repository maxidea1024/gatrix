import { Request, Response, NextFunction } from 'express';
import { ApiTokenService, ApiToken } from '../services/ApiTokenService';
import { createLogger } from '../config/logger';
import { HEADERS, HEADER_VALUES } from '../constants/headers';
import jwt from 'jsonwebtoken';

const logger = createLogger('ApiAuth');

// Express Request 타입 확장
declare global {
  namespace Express {
    interface Request {
      apiToken?: ApiToken;
      user?: {
        id: number;
        email?: string;
        name?: string;
        avatarUrl?: string;
      };
    }
  }
}

/**
 * API 토큰 인증 미들웨어
 */
export const authenticateApiToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 헤더에서 API 토큰 추출
    const token =
      (req.headers[HEADERS.X_API_TOKEN] as string) ||
      req.headers[HEADERS.AUTHORIZATION]?.replace(HEADER_VALUES.BEARER_PREFIX, '');

    if (!token) {
      res.status(401).json({
        success: false,
        error: { message: 'API token required' },
      });
      return;
    }

    // 토큰 검증
    const apiToken = await ApiTokenService.verifyToken(token);
    if (!apiToken) {
      res.status(401).json({
        success: false,
        error: { message: 'Invalid API token' },
      });
      return;
    }

    // 요청 객체에 토큰 정보 추가
    req.apiToken = apiToken;

    // X-User-ID 헤더에서 사용자 ID 추출
    const userIdHeader = req.headers['x-user-id'] as string;
    if (userIdHeader) {
      const userId = parseInt(userIdHeader);
      if (!isNaN(userId)) {
        req.user = { id: userId };
      }
    }

    next();
  } catch (error) {
    logger.error('API token authentication error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Authentication failed' },
    });
  }
};

/**
 * 특정 권한 확인 미들웨어
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiToken = req.apiToken;

    if (!apiToken) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required' },
      });
      return;
    }

    if (!apiToken.permissions.includes(permission) && !apiToken.permissions.includes('admin')) {
      res.status(403).json({
        success: false,
        error: { message: `Permission '${permission}' required` },
      });
      return;
    }

    next();
  };
};

/**
 * 관리자 권한 확인 미들웨어
 */
export const requireAdmin = requirePermission('admin');

/**
 * 읽기 권한 확인 미들웨어
 */
export const requireRead = requirePermission('read');

/**
 * 쓰기 권한 확인 미들웨어
 */
export const requireWrite = requirePermission('write');
