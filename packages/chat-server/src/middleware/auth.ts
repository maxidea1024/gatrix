// JWT 시스템을 API Token으로 완전 교체
export * from './apiAuth';

// 기존 시스템과의 호환성을 위한 별칭
export { authenticateApiToken as authenticate } from './apiAuth';
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


