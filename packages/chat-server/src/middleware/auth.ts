import { Request, Response, NextFunction } from 'express';
import { authenticateApiToken } from './apiAuth';
import { UserModel } from '../models/User';
import { createLogger } from '../config/logger';

const logger = createLogger('Auth');

// JWT 시스템을 API Token으로 완전 교체
export * from './apiAuth';

// 간소화된 인증 미들웨어 (User ID 헤더 기반)
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const apiTokenHeader = req.headers['x-api-token'] as string;
    const userIdHeader = req.headers['x-user-id'] as string;

    // API Token이 있으면 기존 API Token 인증 사용
    if (apiTokenHeader) {
      return authenticateApiToken(req, res, next);
    }

    // Backend에서 전달된 User ID가 있으면 사용자 조회
    if (userIdHeader) {
      const gatrixUserId = parseInt(userIdHeader, 10);

      if (isNaN(gatrixUserId)) {
        logger.warn('Invalid User ID header:', userIdHeader);
        res.status(401).json({
          success: false,
          error: { message: 'Invalid user ID' }
        });
        return;
      }

      // Chat Users 테이블에서 사용자 조회
      const chatUser = await UserModel.findByGatrixUserId(gatrixUserId);

      if (!chatUser) {
        logger.warn(`Chat user not found for Gatrix User ID: ${gatrixUserId}`);
        res.status(401).json({
          success: false,
          error: { message: 'User not found in chat system' }
        });
        return;
      }

      // 요청 객체에 사용자 정보 추가
      req.user = {
        id: chatUser.id, // Chat User ID
        email: chatUser.email,
        name: chatUser.name
      };

      // 마지막 활동 시간 업데이트
      await UserModel.updateLastActivity(gatrixUserId);

      logger.info('✅ User ID authentication successful:', {
        chatUserId: chatUser.id,
        gatrixUserId: chatUser.gatrixUserId,
        email: chatUser.email,
        name: chatUser.name
      });

      return next();
    }

    // 인증 정보가 없으면 실패
    logger.warn('No authentication information provided');
    res.status(401).json({
      success: false,
      error: { message: 'Authentication required' }
    });
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Authentication failed' }
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


