import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { config } from '../config';
import { gatrixApiService } from '../services/GatrixApiService';
import { userSyncService } from '../services/UserSyncService';
import { createLogger } from '../config/logger';

const logger = createLogger('AuthMiddleware');

export interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
    avatarUrl?: string;
  };
}

// JWT 토큰 검증 미들웨어
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication token required',
      });
      return;
    }

    // JWT 토큰 검증
    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (jwtError) {
      // 로컬 JWT 검증 실패 시 Gatrix 메인 서버에서 검증
      try {
        const verificationResult = await gatrixApiService.verifyToken(token);

        if (verificationResult.success && verificationResult.user) {
          decoded = verificationResult.user;
        } else {
          throw new Error(verificationResult.error || 'Token verification failed');
        }
      } catch (verifyError) {
        logger.error('Token verification failed:', verifyError);
        res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
        });
        return;
      }
    }

    // 사용자 정보 추출
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Invalid token payload',
      });
      return;
    }

    // 사용자 정보 동기화 및 요청 객체에 추가
    try {
      const user = await userSyncService.getUser(userId);

      (req as AuthenticatedRequest).user = {
        id: userId,
        email: user?.email || decoded.email,
        name: user?.name || decoded.name,
        role: user?.role || decoded.role || 'user',
        avatarUrl: user?.avatarUrl || decoded.avatarUrl,
      };
    } catch (syncError) {
      logger.warn('User sync failed, using token data:', syncError);

      (req as AuthenticatedRequest).user = {
        id: userId,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role || 'user',
        avatarUrl: decoded.avatarUrl,
      };
    }

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

// 관리자 권한 확인 미들웨어
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as AuthenticatedRequest).user;
  
  if (!user || !['admin', 'super_admin'].includes(user.role)) {
    res.status(403).json({
      success: false,
      error: 'Admin privileges required',
    });
    return;
  }

  next();
};

// 채널 소유자 권한 확인 미들웨어
export const requireChannelOwner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const channelId = parseInt(req.params.channelId || req.params.id);

    if (!user || isNaN(channelId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request',
      });
      return;
    }

    // TODO: 채널 소유자 확인 로직 구현
    // const isOwner = await ChannelModel.isOwner(channelId, user.id);
    // if (!isOwner) {
    //   res.status(403).json({
    //     success: false,
    //     error: 'Channel owner privileges required',
    //   });
    //   return;
    // }

    next();
  } catch (error) {
    logger.error('Channel owner check error:', error);
    res.status(500).json({
      success: false,
      error: 'Authorization check failed',
    });
  }
};

// Rate limiting 미들웨어
export const rateLimiter = (windowMs: number, maxRequests: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    const key = user ? `user:${user.id}` : `ip:${req.ip}`;
    const now = Date.now();

    const userRequests = requests.get(key);
    
    if (!userRequests || now > userRequests.resetTime) {
      requests.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      next();
      return;
    }

    if (userRequests.count >= maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil((userRequests.resetTime - now) / 1000),
      });
      return;
    }

    userRequests.count++;
    next();
  };
};



// 에러 핸들링 미들웨어
export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  logger.error('API Error:', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    userId: (req as AuthenticatedRequest).user?.id,
  });

  if (res.headersSent) {
    return next(error);
  }

  // 개발 환경에서는 상세 에러 정보 제공
  const isDevelopment = config.nodeEnv === 'development';

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: isDevelopment ? error.message : 'Something went wrong',
    ...(isDevelopment && { stack: error.stack }),
  });
};

// 입력 검증 미들웨어
export const validateInput = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map((detail: any) => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
      return;
    }

    next();
  };
};

// CORS 미들웨어
export const corsHandler = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.headers.origin;
  
  if (config.cors.origin.includes(origin || '')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
};
