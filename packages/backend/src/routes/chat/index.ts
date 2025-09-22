import express from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { authenticate } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/requireAdmin';
import { ChatSyncController } from '../../controllers/ChatSyncController';
import { ChatChannelController } from '../../controllers/ChatChannelController';
import logger from '../../config/logger';

const router = express.Router();

// 채팅서버 설정
const CHAT_SERVER_URL = process.env.CHAT_SERVER_URL || 'http://localhost:3001';
const CHAT_API_BASE = `${CHAT_SERVER_URL}/api/v1`;

// 모든 채팅 라우트에 인증 필요
router.use(authenticate as any);

// Chat Server 동기화 엔드포인트 (프록시 전에 처리)
router.post('/sync-user', ChatSyncController.syncCurrentUser as any);
router.post('/sync-user/:userId', requireAdmin, ChatSyncController.syncUser as any);
router.post('/sync-all-users', requireAdmin, ChatSyncController.syncAllUsers as any);
router.get('/health', ChatSyncController.healthCheck);

// Chat WebSocket 토큰 발급 엔드포인트
router.post('/token', ChatSyncController.getChatToken as any);

// 채널 관련 엔드포인트 (프록시 대신 직접 구현)
router.get('/channels/my', ChatChannelController.getMyChannels as any);
router.post('/channels', ChatChannelController.createChannel as any);
router.get('/channels/:channelId', ChatChannelController.getChannel as any);
router.get('/channels/:channelId/messages', ChatChannelController.getChannelMessages as any);

// 사용자 관련 엔드포인트
router.get('/users', ChatChannelController.getUsers as any);

// 직접 라우트 제거 - 프록시로 통일 완료

// 간단한 요청 로깅
router.use((req, res, next) => {
  logger.info(`Chat API: ${req.method} ${req.url}`);
  next();
});

// 프록시 설정 (연결 누수 방지)
const proxyOptions = {
  target: CHAT_API_BASE, // http://localhost:3001/api/v1
  changeOrigin: true,
  timeout: 10000, // 타임아웃 단축
  proxyTimeout: 10000,

  // 연결 풀 설정 (연결 누수 방지)
  agent: false, // 연결 재사용 비활성화
  keepAlive: false, // Keep-Alive 비활성화

  // POST body 수정 (중요!)
  onProxyReq: fixRequestBody,

  // 에러 핸들링
  onError: (err: Error, req: express.Request, res: express.Response) => {
    logger.error(`Chat proxy error: ${req.method} ${req.url}`, {
      error: err.message,
      code: (err as any).code
    });
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Chat service unavailable'
      });
    }
  }
};

const chatProxy = createProxyMiddleware(proxyOptions);

// 모든 채팅 요청을 프록시로 전달
router.use('/', chatProxy);

export default router;
