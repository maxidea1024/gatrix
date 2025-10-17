import express from 'express';
import multer from 'multer';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { authenticate } from '../../middleware/auth';
import { ChatSyncController } from '../../controllers/ChatSyncController';
import logger from '../../config/logger';
import { HEADERS } from '../../constants/headers';
import { UserModel } from '../../models/User';

const router = express.Router();

// Body parser for chat routes (since they're registered before main body parser)
router.use(express.json({ limit: '10mb' }));
router.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multer for handling multipart/form-data (file uploads)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
router.use(upload.any() as any);

// 채팅서버 설정
const CHAT_SERVER_URL = process.env.CHAT_SERVER_URL || 'http://localhost:3001';
const CHAT_API_BASE = `${CHAT_SERVER_URL}/api/v1`;
const CHAT_SERVER_API_TOKEN = 'gatrix-api-015893d49d112919b7ec84addab31fdd182c4f2de3c4d880e1db12467c89cf3c';
const DEFAULT_AVATAR_URL = 'https://cdn-icons-png.flaticon.com/512/847/847969.png';

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

// 백엔드 전용 엔드포인트 (프록시 전에 처리)
router.get('/health', ChatSyncController.healthCheck);

// 나머지 모든 채팅 요청은 프록시로 처리
// - /sync-user, /sync-users, /channels/*, /users, /invitations/* 등

// 프록시로 전달할 요청들을 위한 로깅 미들웨어
router.use((req, _res, next) => {
  // 이미 처리된 라우트들은 스킵
  const directRoutes = ['/health', '/test-connection'];
  const isDirectRoute = directRoutes.some(route => req.url.startsWith(route));

  if (!isDirectRoute) {
    logger.info(`🔥 Proxying Chat API Request: ${req.method} ${req.url}`, {
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

    // 프록시 도달 여부 확인을 위한 로그
    logger.info(`🚀 About to reach proxy middleware for: ${req.method} ${req.url}`);
  }

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
    logger.info(`🚀 PROXY MIDDLEWARE REACHED! ${req.method} ${req.url}`);

    // Chat Server API 토큰 추가 (가장 중요!)
    const CHAT_SERVER_API_TOKEN = process.env.CHAT_SERVER_API_TOKEN || 'gatrix-api-180c05eb58db26b863481f5d54e657a218b54da5bfb388e9278a7eb733227aec';
    proxyReq.setHeader(HEADERS.X_API_TOKEN, CHAT_SERVER_API_TOKEN);
    logger.info(`✅ Adding Chat Server API Token: ${CHAT_SERVER_API_TOKEN.substring(0, 20)}...`);

    // 사용자 정보 헤더 추가 (Chat Server에서 사용)
    logger.info(`🔍 Proxy request user check:`, {
      hasUser: !!(req as any).user,
      userId: (req as any).user?.id,
      userEmail: (req as any).user?.email
    });

    if ((req as any).user?.id) {
      proxyReq.setHeader(HEADERS.X_USER_ID, (req as any).user.id.toString());
      logger.info(`✅ Adding X-User-ID header: ${(req as any).user.id}`);

      // 사용자 동기화는 백그라운드에서 비동기로 처리 (요청을 블록하지 않음)
      const user = (req as any).user;

      // 🔍 사용자 정보 디버깅
      logger.info('🔍 User data for sync:', {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        hasAvatarUrl: !!user.avatarUrl,
        avatarUrlType: typeof user.avatarUrl
      });

      const chatServerService = require('../../services/ChatServerService').ChatServerService.getInstance();
      chatServerService.ensureUserSynced({
        id: user.id,
        username: user.email,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl || DEFAULT_AVATAR_URL,
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
    logger.error(`🚨 Chat proxy error: ${req.method} ${req.url}`, {
      error: err.message,
      code: (err as any).code,
      stack: err.stack
    });
    console.error('🚨 Detailed proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Chat service unavailable',
        details: err.message
      });
    }
  }
};

// 임시 테스트: 간단한 프록시 미들웨어
router.use('/', async (req, res, next) => {
  try {
    console.log('🔥 SIMPLE PROXY MIDDLEWARE REACHED:', req.method, req.url);
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));

    // 채팅서버로 직접 요청
    const axios = require('axios');

    // URL 매핑: /sync-user -> /users/sync-user
    let targetPath = req.url;
    if (targetPath === '/sync-user') {
      targetPath = '/users/sync-user';
    }

    const targetUrl = `${CHAT_API_BASE}${targetPath}`;

    console.log('🚀 Forwarding to:', targetUrl);

    // 사용자 동기화 요청인 경우 사용자 정보 추가
    let requestData = req.body;
    if (targetPath === '/users/sync-user' && req.user) {
      const user = req.user as any;

      // DB에서 최신 사용자 정보 조회 (avatarUrl 포함)
      let avatarUrl = user.avatarUrl || DEFAULT_AVATAR_URL;
      try {
        const dbUser = await UserModel.findById(user.id);
        if (dbUser && dbUser.avatarUrl) {
          avatarUrl = dbUser.avatarUrl;
        }
      } catch (error) {
        console.error('Failed to fetch user avatar from DB:', error);
      }

      requestData = {
        id: user.id,
        username: user.email,
        name: user.name || user.email,
        email: user.email,
        avatarUrl: avatarUrl
      };
      console.log('📝 Adding user data for sync:', requestData);
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'X-API-Token': CHAT_SERVER_API_TOKEN,
        'X-User-ID': (req.user as any)?.id?.toString() || '3',
        'Content-Type': 'application/json'
      },
      data: requestData
    });

    console.log('✅ Chat server response:', response.status);
    res.json(response.data);
  } catch (error: any) {
    console.error('❌ Simple proxy error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
