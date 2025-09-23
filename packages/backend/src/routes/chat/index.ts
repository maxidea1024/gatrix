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

// 모든 채팅 라우트에 인증 필요 (디버깅 로깅 추가)
router.use((req, res, next) => {
  logger.info('🔥 Chat route authentication check:', {
    url: req.url,
    method: req.method,
    hasAuthHeader: !!req.headers.authorization,
    authHeaderPrefix: req.headers.authorization?.substring(0, 20) + '...'
  });
  next();
});

// Chat Server 연결 테스트 엔드포인트 (인증 없이 접근 가능)
router.get('/test-connection', async (req, res) => {
  try {
    const chatServerService = require('../../services/ChatServerService').ChatServerService.getInstance();
    const response = await chatServerService.axiosInstance.get('/health');
    res.json({
      success: true,
      data: {
        chatServerStatus: 'connected',
        chatServerResponse: response.data
      }
    });
  } catch (error: any) {
    logger.error('Chat Server connection test failed:', error.message);
    res.status(500).json({
      success: false,
      error: {
        message: 'Chat Server connection failed',
        details: error.message
      }
    });
  }
});

router.use(authenticate as any);

// Body parsing이 필요한 라우트들에만 적용
const bodyParser = express.json({ limit: '10mb' });

// Chat Server 동기화 엔드포인트 (프록시 전에 처리)
router.post('/sync-user', bodyParser, ChatSyncController.syncCurrentUser as any);
router.post('/sync-user/:userId', requireAdmin, bodyParser, ChatSyncController.syncUser as any);
router.post('/sync-all-users', requireAdmin, bodyParser, ChatSyncController.syncAllUsers as any);
router.get('/health', ChatSyncController.healthCheck);

// Chat WebSocket 토큰 발급 엔드포인트
router.post('/token', bodyParser, ChatSyncController.getChatToken as any);

// 채널 관련 엔드포인트 (프록시 대신 직접 구현)
router.get('/channels/my', ChatChannelController.getMyChannels as any);
router.post('/channels', bodyParser, ChatChannelController.createChannel as any);
router.get('/channels/:channelId', ChatChannelController.getChannel as any);
router.get('/channels/:channelId/messages', ChatChannelController.getChannelMessages as any);

// 사용자 관련 엔드포인트
router.get('/users', ChatChannelController.getUsers as any);

// 직접 라우트 제거 - 프록시로 통일 완료

// 상세한 요청 로깅
router.use((req, res, next) => {
  logger.info(`🔥 Chat API Request: ${req.method} ${req.url}`, {
    headers: {
      authorization: req.headers.authorization ? req.headers.authorization.substring(0, 20) + '...' : 'none',
      'user-agent': req.headers['user-agent']?.substring(0, 50) + '...',
    },
    user: (req as any).user ? {
      id: (req as any).user.id,
      email: (req as any).user.email,
      name: (req as any).user.name
    } : 'none',
    query: req.query,
    params: req.params
  });
  next();
});

// 프록시 설정 (연결 누수 방지)
const proxyOptions = {
  target: CHAT_API_BASE, // http://localhost:3001/api/v1
  changeOrigin: true,
  timeout: 10000, // 타임아웃 단축
  proxyTimeout: 10000,

  // 경로 재작성: /chat/* → /*
  pathRewrite: {
    '^/chat': '', // /chat/invitations/received → /invitations/received
  },

  // 연결 풀 설정 (연결 누수 방지)
  agent: false, // 연결 재사용 비활성화
  keepAlive: false, // Keep-Alive 비활성화

  // 헤더 전달 설정
  onProxyReq: (proxyReq: any, req: express.Request) => {
    // Chat Server API 토큰 추가 (가장 중요!)
    const CHAT_SERVER_API_TOKEN = process.env.CHAT_SERVER_API_TOKEN || 'gatrix-api-180c05eb58db26b863481f5d54e657a218b54da5bfb388e9278a7eb733227aec';
    proxyReq.setHeader('X-API-Token', CHAT_SERVER_API_TOKEN);
    logger.info(`✅ Adding Chat Server API Token: ${CHAT_SERVER_API_TOKEN.substring(0, 20)}...`);

    // 사용자 정보 헤더 추가 (Chat Server에서 사용)
    logger.info(`🔍 Proxy request user check:`, {
      hasUser: !!(req as any).user,
      userId: (req as any).user?.id,
      userEmail: (req as any).user?.email
    });

    if ((req as any).user?.id) {
      proxyReq.setHeader('X-User-ID', (req as any).user.id.toString());
      logger.info(`✅ Adding X-User-ID header: ${(req as any).user.id}`);

      // 사용자 동기화는 백그라운드에서 비동기로 처리 (요청을 블록하지 않음)
      const user = (req as any).user;
      const chatServerService = require('../../services/ChatServerService').ChatServerService.getInstance();
      chatServerService.ensureUserSynced({
        id: user.id,
        username: user.email,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl || undefined,
        status: 'online'
      }).then(() => {
        logger.info(`✅ User ${user.id} ensured synced to Chat Server`);
      }).catch((syncError: any) => {
        logger.warn(`⚠️ Failed to ensure user sync to Chat Server:`, syncError);
      });
    } else {
      logger.warn(`❌ No user ID found in request for proxy`);
    }

    // POST body 수정 (중요!)
    fixRequestBody(proxyReq, req);
  },

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
