import express from 'express';
import multer from 'multer';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { authenticate } from '../../middleware/auth';
import { ChatSyncController } from '../../controllers/chat-sync-controller';
import { createLogger } from '../../config/logger';

const logger = createLogger('ChatRoutes');
import { HEADERS } from '../../constants/headers';
import { UserModel } from '../../models/user';

const router = express.Router();

// Body parser for chat routes (since they're registered before main body parser)
router.use(express.json({ limit: '10mb' }));
router.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multer for handling multipart/form-data (file uploads)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});
router.use(upload.any() as any);

// Chat server settings
const CHAT_SERVER_URL = process.env.CHAT_SERVER_URL || 'http://localhost:5100';
const CHAT_API_BASE = `${CHAT_SERVER_URL}/api/v1`;
// Backend -> Chat Server special token (pre-agreed value not fetched from database)
const BACKEND_SERVICE_TOKEN =
  process.env.BACKEND_SERVICE_TOKEN ||
  'gatrix-backend-service-token-default-key-change-in-production';
const DEFAULT_AVATAR_URL =
  'https://cdn-icons-png.flaticon.com/512/847/847969.png';

// All chat routes require authentication (with debug logging)
router.use((req, res, next) => {
  logger.info('🔥 Chat route authentication check:', {
    url: req.url,
    method: req.method,
    hasAuthHeader: !!req.headers.authorization,
    authHeaderPrefix: req.headers.authorization?.substring(0, 20) + '...',
  });
  next();
});

// Chat Server connection test endpoint (accessible without authentication)
router.get('/test-connection', async (req, res) => {
  try {
    const chatServerService =
      require('../../services/chat-server-service').ChatServerService.getInstance();
    const response = await chatServerService.axiosInstance.get('/health');
    res.json({
      success: true,
      data: {
        chatServerStatus: 'connected',
        chatServerResponse: response.data,
      },
    });
  } catch (error: any) {
    logger.error('Chat Server connection test failed:', error.message);
    res.status(500).json({
      success: false,
      error: {
        message: 'Chat Server connection failed',
        details: error.message,
      },
    });
  }
});

router.use(authenticate as any);

// Backend-only endpoints (handled before proxy)
router.get('/health', ChatSyncController.healthCheck);

// All remaining chat requests are handled via proxy
// - /sync-user, /sync-users, /channels/*, /users, /invitations/*, etc.

// Logging middleware for requests to be forwarded to proxy
router.use((req, _res, next) => {
  // Skip already-handled routes
  const directRoutes = ['/health', '/test-connection'];
  const isDirectRoute = directRoutes.some((route) => req.url.startsWith(route));

  if (!isDirectRoute) {
    logger.info(`🔥 Proxying Chat API Request: ${req.method} ${req.url}`, {
      headers: {
        authorization: req.headers.authorization
          ? req.headers.authorization.substring(0, 20) + '...'
          : 'none',
        'user-agent': req.headers['user-agent']?.substring(0, 50) + '...',
      },
      user: (req as any).user
        ? {
            id: (req as any).user.id,
            email: (req as any).user.email,
            name: (req as any).user.name,
          }
        : 'none',
      query: req.query,
      params: req.params,
    });

    // Log to confirm proxy reach status
    logger.info(
      `🚀 About to reach proxy middleware for: ${req.method} ${req.url}`
    );
  }

  next();
});

// Proxy settings (prevent connection leak)
const proxyOptions = {
  target: CHAT_API_BASE, // http://localhost:3001/api/v1
  changeOrigin: true,
  timeout: 10000, // Shortened timeout
  proxyTimeout: 10000,

  // Path rewrite: /chat/* → /*
  pathRewrite: {
    '^/chat': '', // /chat/invitations/received → /invitations/received
  },

  // Connection pool settings (prevent connection leak)
  agent: false, // Disable connection reuse
  keepAlive: false, // Disable Keep-Alive

  // Header forwarding settings
  onProxyReq: (proxyReq: any, req: express.Request) => {
    logger.info(`🚀 PROXY MIDDLEWARE REACHED! ${req.method} ${req.url}`);

    // Add Backend -> Chat Server special token (most important!)
    proxyReq.setHeader(HEADERS.X_API_TOKEN, BACKEND_SERVICE_TOKEN);
    logger.info(
      `✅ Adding Backend Service Token: ${BACKEND_SERVICE_TOKEN.substring(0, 20)}...`
    );

    // Add user info headers (used by Chat Server)
    logger.info(`🔍 Proxy request user check:`, {
      hasUser: !!(req as any).user,
      userId: (req as any).user?.id,
      userEmail: (req as any).user?.email,
    });

    if ((req as any).user?.id) {
      proxyReq.setHeader(HEADERS.X_USER_ID, (req as any).user.id.toString());
      logger.info(`✅ Adding X-User-ID header: ${(req as any).user.id}`);

      // User sync is handled asynchronously in background (non-blocking request)
      const user = (req as any).user;

      // 🔍 User info debugging
      logger.info('🔍 User data for sync:', {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        hasAvatarUrl: !!user.avatarUrl,
        avatarUrlType: typeof user.avatarUrl,
      });

      const chatServerService =
        require('../../services/chat-server-service').ChatServerService.getInstance();
      chatServerService
        .ensureUserSynced({
          id: user.id,
          username: user.email,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl || DEFAULT_AVATAR_URL,
          status: 'online',
        })
        .then(() => {
          logger.info(`✅ User ${user.id} ensured synced to Chat Server`);
        })
        .catch((syncError: any) => {
          logger.warn(
            `⚠️ Failed to ensure user sync to Chat Server:`,
            syncError
          );
        });
    } else {
      logger.warn(`❌ No user ID found in request for proxy`);
    }

    // Fix POST body (important!)
    fixRequestBody(proxyReq, req);
  },

  // Error handling
  onError: (err: Error, req: express.Request, res: express.Response) => {
    logger.error(`🚨 Chat proxy error: ${req.method} ${req.url}`, {
      error: err.message,
      code: (err as any).code,
      stack: err.stack,
    });
    logger.error('Detailed proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Chat service unavailable',
        details: err.message,
      });
    }
  },
};

// Temporary test: Simple proxy middleware
router.use('/', async (req, res, next) => {
  try {
    logger.info('Simple proxy middleware reached:', {
      method: req.method,
      url: req.url,
    });
    logger.debug('Request body:', req.body);

    // Direct request to chat server
    const axios = require('axios');

    // URL mapping: /sync-user -> /users/upsert (aligned with Chat Server Controller)
    let targetPath = req.url;
    if (targetPath === '/sync-user') {
      targetPath = '/users/upsert';
    }

    const targetUrl = `${CHAT_API_BASE}${targetPath}`;

    logger.info('Forwarding to:', { targetUrl });

    // Add user info if this is a user sync request
    let requestData = req.body;
    if (
      (targetPath === '/users/upsert' || targetPath === '/users/sync-user') &&
      req.user
    ) {
      const user = req.user as any;

      // Fetch latest user info from DB (including avatarUrl)
      let avatarUrl = user.avatarUrl || DEFAULT_AVATAR_URL;
      try {
        const dbUser = await UserModel.findById(user.id);
        if (dbUser && dbUser.avatarUrl) {
          avatarUrl = dbUser.avatarUrl;
        }
      } catch (error) {
        logger.error('Failed to fetch user avatar from DB:', error);
      }

      requestData = {
        id: user.id,
        username: user.email,
        name: user.name || user.email,
        email: user.email,
        avatarUrl: avatarUrl,
      };
      logger.debug('Adding user data for sync:', requestData);
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'X-API-Token': BACKEND_SERVICE_TOKEN,
        'X-User-ID': (req.user as any)?.id?.toString() || '3',
        'Content-Type': 'application/json',
      },
      data: requestData,
    });

    logger.info('Chat server response:', { status: response.status });
    res.json(response.data);
  } catch (error: any) {
    logger.error('Simple proxy error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
