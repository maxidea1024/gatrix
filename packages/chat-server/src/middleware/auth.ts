import { Request, Response, NextFunction } from 'express';
import { authenticateApiToken } from './apiAuth';
import { UserModel } from '../models/User';
import { createLogger } from '../config/logger';
import { HEADERS } from '../constants/headers';

const logger = createLogger('Auth');

// JWT 시스템을 API Token으로 완전 교체
export * from './apiAuth';

// Backend -> Chat Server 특수 토큰 (환경변수에서 가져옴)
const BACKEND_SERVICE_TOKEN =
  process.env.BACKEND_SERVICE_TOKEN ||
  'gatrix-backend-service-token-default-key-change-in-production';

// 간소화된 인증 미들웨어 (User ID 헤더 기반)
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiTokenHeader = req.headers[HEADERS.X_API_TOKEN] as string;
    const userIdHeader = req.headers[HEADERS.X_USER_ID] as string;
    const authHeader = req.headers[HEADERS.AUTHORIZATION] as string;

    logger.info('🔍 Chat Server Authentication Debug:', {
      path: req.path,
      method: req.method,
      hasApiToken: !!apiTokenHeader,
      hasUserId: !!userIdHeader,
      hasAuthHeader: !!authHeader,
      userIdValue: userIdHeader,
      authHeaderPrefix: authHeader ? authHeader.substring(0, 20) + '...' : 'none',
    });

    // 1. Backend 서비스 토큰 확인 (가장 먼저 확인)
    const token = apiTokenHeader || authHeader?.replace('Bearer ', '');
    if (token === BACKEND_SERVICE_TOKEN) {
      logger.info('✅ Backend service token verified - allowing request');
      (req as any).isBackendService = true;
      // Attach user when X-User-ID is provided to avoid downstream 500s
      if (userIdHeader) {
        const gatrixUserId = parseInt(userIdHeader, 10);
        if (isNaN(gatrixUserId)) {
          logger.warn('Invalid User ID header (service token path):', userIdHeader);
          res.status(401).json({
            success: false,
            error: { message: 'Invalid user ID' },
          });
          return;
        }

        const isUserSyncRoute =
          typeof req.path === 'string' &&
          (req.path.includes('sync-user') || req.path.includes('upsert'));
        if (!isUserSyncRoute) {
          const chatUser = await UserModel.findByGatrixUserId(gatrixUserId);
          if (!chatUser) {
            // Not found and not a sync route → ask caller to sync first
            logger.warn(
              `Chat user not found (service token path). Gatrix User ID: ${gatrixUserId}`
            );
            res.status(401).json({
              success: false,
              error: {
                message: 'User not found in chat system. Please sync user first.',
              },
            });
            return;
          }

          // Attach user to request
          req.user = {
            id: chatUser.id,
            email: chatUser.email,
            name: chatUser.name,
            avatarUrl: chatUser.avatarUrl,
          } as any;

          // Update last activity (best-effort)
          await UserModel.updateLastActivity(gatrixUserId);

          logger.info('✅ Backend service token + user attached', {
            chatUserId: chatUser.id,
            gatrixUserId: chatUser.gatrixUserId,
          });
        }
      }
      return next();
    }

    // 2. API Token이 있으면 기존 API Token 인증 사용
    if (apiTokenHeader) {
      logger.info('🔑 Using API Token authentication');
      return authenticateApiToken(req, res, next);
    }

    // Backend에서 전달된 User ID가 있으면 사용자 조회
    if (userIdHeader) {
      const gatrixUserId = parseInt(userIdHeader, 10);

      if (isNaN(gatrixUserId)) {
        logger.warn('Invalid User ID header:', userIdHeader);
        res.status(401).json({
          success: false,
          error: { message: 'Invalid user ID' },
        });
        return;
      }

      // Chat Users 테이블에서 사용자 조회
      const chatUser = await UserModel.findByGatrixUserId(gatrixUserId);

      if (!chatUser) {
        logger.warn(`Chat user not found for Gatrix User ID: ${gatrixUserId}`);
        res.status(401).json({
          success: false,
          error: { message: 'User not found in chat system' },
        });
        return;
      }

      // 요청 객체에 사용자 정보 추가
      req.user = {
        id: chatUser.id, // Chat User ID
        email: chatUser.email,
        name: chatUser.name,
        avatarUrl: chatUser.avatarUrl,
      };

      // 마지막 활동 시간 업데이트
      await UserModel.updateLastActivity(gatrixUserId);

      logger.info('✅ User ID authentication successful:', {
        chatUserId: chatUser.id,
        gatrixUserId: chatUser.gatrixUserId,
        email: chatUser.email,
        name: chatUser.name,
        avatarUrl: chatUser.avatarUrl,
      });

      return next();
    }

    // 인증 정보가 없으면 실패
    logger.warn('No authentication information provided');
    res.status(401).json({
      success: false,
      error: { message: 'Authentication required' },
    });
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Authentication failed' },
    });
  }
};

export { requireAdmin } from './apiAuth';

// 기존 미들웨어들 (임시로 간단한 구현)
export const rateLimiter = (windowMs: number, maxRequests: number) => {
  return (req: any, res: any, next: any) => next(); // 임시로 통과
};

export const validateInput = (schema: any) => {
  return (req: any, res: any, next: any) => next(); // 임시로 통과
};

export const errorHandler = (error: Error, req: any, res: any, next: any) => {
  console.error('Error:', error);
  if (!res.headersSent) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
