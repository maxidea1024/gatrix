import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authenticate } from '../../middleware/auth';
import logger from '../../config/logger';

const router = express.Router();

// 채팅서버 설정
const CHAT_SERVER_URL = process.env.CHAT_SERVER_URL || 'http://localhost:3001';
const CHAT_API_BASE = `${CHAT_SERVER_URL}/api/v1`;

// 모든 채팅 라우트에 인증 필요
router.use(authenticate as any);

// 디버깅을 위한 미들웨어
router.use((req, res, next) => {
  (req as any).startTime = Date.now();
  logger.info(`Chat route accessed: ${req.method} ${req.url}`, {
    originalUrl: req.originalUrl,
    path: req.path,
    headers: Object.keys(req.headers),
    hasBody: !!req.body,
    bodyContent: req.body
  });
  next();
});

// 채팅서버 프록시 미들웨어 설정
const chatProxy = createProxyMiddleware({
  target: CHAT_API_BASE,
  changeOrigin: true,
  timeout: 30000, // 30초 타임아웃
  proxyTimeout: 30000 // 프록시 타임아웃
} as any);

// 모든 채팅 관련 요청을 채팅서버로 프록시
router.use('/', (req, res, next) => {
  logger.info(`Before proxy: ${req.method} ${req.url}`, {
    body: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
  next();
}, chatProxy);

export default router;
