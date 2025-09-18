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
  logger.info(`Chat route accessed: ${req.method} ${req.url}`, {
    originalUrl: req.originalUrl,
    path: req.path,
    headers: Object.keys(req.headers)
  });
  next();
});

// 채팅서버 프록시 미들웨어 설정
const chatProxy = createProxyMiddleware({
  target: CHAT_API_BASE,
  changeOrigin: true,
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    // 인증 헤더 전달
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }

    logger.info(`Proxying chat request: ${req.method} ${req.url} -> ${CHAT_API_BASE}${req.url}`, {
      originalUrl: req.url,
      targetUrl: `${CHAT_API_BASE}${req.url}`,
      hasAuth: !!req.headers.authorization,
      contentType: req.headers['content-type']
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    logger.info(`Chat proxy response: ${proxyRes.statusCode}`, {
      method: req.method,
      url: req.url,
      statusCode: proxyRes.statusCode
    });
  },
  onError: (err, req, res) => {
    logger.error('Chat proxy error:', {
      error: err.message,
      url: req.url,
      method: req.method
    });

    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        error: 'Chat service unavailable',
        message: 'Unable to connect to chat server'
      });
    }
  }
});

// 모든 채팅 관련 요청을 채팅서버로 프록시
router.use('/', chatProxy);

export default router;
