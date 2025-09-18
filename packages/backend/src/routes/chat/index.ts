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
  logLevel: 'debug',
  timeout: 30000, // 30초 타임아웃
  proxyTimeout: 30000, // 프록시 타임아웃
  onProxyReq: (proxyReq, req, res) => {
    // 인증 헤더 전달
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }

    // Content-Type 헤더 전달
    if (req.headers['content-type']) {
      proxyReq.setHeader('Content-Type', req.headers['content-type']);
    }

    // POST 요청의 경우 body 데이터 처리
    if (req.method === 'POST' && req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }

    logger.info(`Proxying chat request: ${req.method} ${req.url} -> ${CHAT_API_BASE}${req.url}`, {
      originalUrl: req.url,
      targetUrl: `${CHAT_API_BASE}${req.url}`,
      hasAuth: !!req.headers.authorization,
      contentType: req.headers['content-type'],
      hasBody: !!req.body,
      bodySize: req.body ? JSON.stringify(req.body).length : 0
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    logger.info(`Chat proxy response: ${proxyRes.statusCode}`, {
      method: req.method,
      url: req.url,
      statusCode: proxyRes.statusCode,
      duration: Date.now() - (req as any).startTime
    });
  },
  onError: (err, req, res) => {
    logger.error('Chat proxy error:', {
      error: err.message,
      url: req.url,
      method: req.method,
      code: (err as any).code,
      stack: err.stack
    });

    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        error: 'Chat service unavailable',
        message: 'Unable to connect to chat server',
        details: err.message
      });
    }
  }
});

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
