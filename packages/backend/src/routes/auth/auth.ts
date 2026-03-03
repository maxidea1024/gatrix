import { Router } from 'express';
import passport from '../../config/passport';
import { AuthController } from '../../controllers/AuthController';
import { authenticate } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimiter';
import { auditUserLogin, auditUserRegister } from '../../middleware/auditLog';
import redisClient from '../../config/redis';
// import { WeChatOAuthService } from '../../services/WeChatOAuth';
// import { BaiduOAuthService } from '../../services/BaiduOAuth';
import { UserModel } from '../../models/User';
import { createLogger } from '../../config/logger';

const logger = createLogger('AuthRoutes');

const router = Router();

// Apply auth rate limiting to all auth routes
router.use(authLimiter as any);

/**
 * @openapi
 * tags:
 *   - name: Authentication
 *     description: Endpoints for user authentication and profile management
 * paths:
 *   /auth/login:
 *     post:
 *       summary: 사용자 로그인
 *       description: 이메일과 비밀번호로 로그인합니다. 성공 시 본문에 accessToken을 반환하고, refreshToken은 HttpOnly 쿠키로 설정됩니다.
 *       tags: [Authentication]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginRequest'
 *             examples:
 *               valid:
 *                 summary: 로그인 요청 예시
 *                 value:
 *                   email: user@example.com
 *                   password: "P@ssw0rd!"
 *       responses:
 *         '200':
 *           description: 로그인에 성공합니다. 액세스 토큰이 발급됩니다.
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/AuthResponse'
 *               examples:
 *                 success:
 *                   summary: 성공 응답 예시
 *                   value:
 *                     success: true
 *                     message: login.success
 *                     data:
 *                       accessToken: "eyJhbGciOi..."
 *         '400':
 *           description: 요청 형식이 올바르지 않습니다.
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/ErrorResponse'
 *         '401':
 *           description: 이메일 또는 비밀번호가 올바르지 않습니다.
 *         '429':
 *           description: 너무 많은 요청입니다. 잠시 후 다시 시도해 주세요.
 *   /auth/register:
 *     post:
 *       summary: 사용자 회원가입
 *       description: 이메일과 비밀번호로 신규 사용자를 생성합니다.
 *       tags: [Authentication]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegisterRequest'
 *             examples:
 *               valid:
 *                 summary: 회원가입 요청 예시
 *                 value:
 *                   email: newuser@example.com
 *                   password: "P@ssw0rd!"
 *                   name: "홍길동"
 *       responses:
 *         '201':
 *           description: 회원가입에 성공했습니다.
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/AuthResponse'
 *         '400':
 *           description: 요청 유효성 검사 실패
 *         '409':
 *           description: 이미 존재하는 이메일입니다.
 *   /auth/refresh:
 *     post:
 *       summary: 액세스 토큰 갱신
 *       description: refreshToken 쿠키로부터 새로운 accessToken을 발급합니다.
 *       tags: [Authentication]
 *       security:
 *         - cookieAuth: []
 *       responses:
 *         '200':
 *           description: 토큰 갱신 성공
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/AuthResponse'
 *         '401':
 *           description: 유효하지 않은 리프레시 토큰
 *   /auth/logout:
 *     post:
 *       summary: 로그아웃
 *       description: 리프레시 토큰 쿠키를 제거합니다.
 *       tags: [Authentication]
 *       responses:
 *         '200':
 *           description: 로그아웃 성공
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/SuccessResponse'
 *   /auth/profile:
 *     get:
 *       summary: 내 프로필 조회
 *       description: 현재 로그인한 사용자의 프로필을 조회합니다.
 *       tags: [Authentication]
 *       security:
 *         - bearerAuth: []
 *       responses:
 *         '200':
 *           description: 프로필 정보
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   success:
 *                     type: boolean
 *                   data:
 *                     type: object
 *                     properties:
 *                       user:
 *                         $ref: '#/components/schemas/User'
 *         '401':
 *           description: 인증 필요
 *   /auth/change-password:
 *     post:
 *       summary: 비밀번호 변경
 *       description: 현재 비밀번호 확인 후 새 비밀번호로 변경합니다.
 *       tags: [Authentication]
 *       security:
 *         - bearerAuth: []
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [currentPassword, newPassword]
 *               properties:
 *                 currentPassword:
 *                   type: string
 *                 newPassword:
 *                   type: string
 *             examples:
 *               valid:
 *                 value:
 *                   currentPassword: "OldP@ssw0rd!"
 *                   newPassword: "NewP@ssw0rd!"
 *       responses:
 *         '200':
 *           description: 비밀번호 변경 성공
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/SuccessResponse'
 *         '400':
 *           description: 유효성 검사 실패
 *         '401':
 *           description: 인증 필요
 *   /auth/forgot-password:
 *     post:
 *       summary: 비밀번호 재설정 메일 요청
 *       description: 입력한 이메일로 재설정 링크를 전송합니다.
 *       tags: [Authentication]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [email]
 *               properties:
 *                 email:
 *                   type: string
 *             examples:
 *               sample:
 *                 value:
 *                   email: user@example.com
 *       responses:
 *         '200':
 *           description: 이메일 발송 성공 (존재 여부와 무관하게 동일한 응답)
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/SuccessResponse'
 *   /auth/validate-reset-token/{token}:
 *     get:
 *       summary: 비밀번호 재설정 토큰 검증
 *       tags: [Authentication]
 *       parameters:
 *         - in: path
 *           name: token
 *           schema:
 *             type: string
 *           required: true
 *           description: 비밀번호 재설정 토큰
 *       responses:
 *         '200':
 *           description: 토큰이 유효합니다.
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/SuccessResponse'
 *         '400':
 *           description: 토큰이 유효하지 않거나 만료됨
 *   /auth/reset-password:
 *     post:
 *       summary: 비밀번호 재설정
 *       tags: [Authentication]
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [token, password]
 *               properties:
 *                 token:
 *                   type: string
 *                 password:
 *                   type: string
 *       responses:
 *         '200':
 *           description: 비밀번호가 성공적으로 재설정되었습니다.
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/SuccessResponse'
 */

// Local authentication routes
router.post('/login', auditUserLogin as any, AuthController.login);
router.post('/register', auditUserRegister as any, AuthController.register);
router.post('/refresh', AuthController.refreshToken);
router.post('/logout', AuthController.logout);

// Password reset routes
router.post('/forgot-password', AuthController.forgotPassword);
router.get('/validate-reset-token/:token', AuthController.validateResetToken);
router.post('/reset-password', AuthController.resetPassword);

// Protected routes (require authentication)
router.get('/profile', authenticate as any, AuthController.getProfile);
router.put('/profile', authenticate as any, AuthController.updateProfile);
router.post('/change-password', authenticate as any, AuthController.changePassword);
router.post('/verify-email', authenticate as any, AuthController.verifyEmail);

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/api/v1/auth/failure',
    session: false,
  }),
  AuthController.oauthSuccess
);

// GitHub OAuth routes
router.get('/github', (req, res, next) => {
  const callbackURL = `${req.protocol}://${req.get('host')}/api/v1/auth/github/callback`;
  logger.info('GitHub OAuth initiated:', {
    callbackURL,
    host: req.get('host'),
    protocol: req.protocol,
  });

  return (passport.authenticate as any)('github', {
    scope: ['user:email'],
    callbackURL,
  })(req, res, next);
});

router.get('/github/callback', async (req, res, next) => {
  logger.info('GitHub callback received:', {
    url: req.url,
    originalUrl: req.originalUrl,
    path: req.path,
    query: req.query,
    headers: {
      host: req.get('host'),
      referer: req.get('referer'),
      userAgent: req.get('user-agent'),
    },
  });

  const callbackURL = `${req.protocol}://${req.get('host')}/api/v1/auth/github/callback`;
  const code = req.query.code as string;

  if (!code) {
    logger.warn('No code in GitHub callback, redirecting to failure');
    return res.redirect('/api/v1/auth/failure');
  }

  // Check if this code has already been used
  const cacheKey = `oauth:github:code:${code}`;
  const alreadyUsed = await redisClient.get(cacheKey);

  if (alreadyUsed) {
    logger.warn('GitHub OAuth: Code already used, redirecting to failure');
    return res.redirect('/api/v1/auth/failure');
  }

  // Mark code as used (expires in 10 minutes)
  await redisClient.set(cacheKey, 'used', 600);

  (passport.authenticate as any)(
    'github',
    {
      failureRedirect: '/api/v1/auth/failure',
      session: false,
      callbackURL,
    },
    (err: any, user: any, info: any) => {
      if (err) {
        logger.error('GitHub OAuth error:', err);
        return res.redirect('/api/v1/auth/failure');
      }
      if (!user) {
        logger.error('GitHub OAuth: No user returned', info);
        return res.redirect('/api/v1/auth/failure');
      }
      logger.info('GitHub OAuth success:', { email: user?.email });
      (req as any).user = user;
      return (AuthController.oauthSuccess as any)(req, res, next);
    }
  )(req, res, next);
});

// QQ OAuth routes
router.get('/qq', (req, res, next) =>
  (passport.authenticate as any)('qq', {
    callbackURL: `${req.protocol}://${req.get('host')}/api/v1/auth/qq/callback`,
  })(req, res, next)
);

router.get('/qq/callback', async (req, res, next) => {
  const callbackURL = `${req.protocol}://${req.get('host')}/api/v1/auth/qq/callback`;
  const code = req.query.code as string;

  if (!code) {
    return res.redirect('/api/v1/auth/failure');
  }

  // Check if this code has already been used
  const cacheKey = `oauth:qq:code:${code}`;
  const alreadyUsed = await redisClient.get(cacheKey);

  if (alreadyUsed) {
    logger.warn('QQ OAuth: Code already used, redirecting to failure');
    return res.redirect('/api/v1/auth/failure');
  }

  // Mark code as used (expires in 10 minutes)
  await redisClient.set(cacheKey, 'used', 600);

  (passport.authenticate as any)(
    'qq',
    {
      failureRedirect: '/api/v1/auth/failure',
      session: false,
      callbackURL,
    },
    (err: any, user: any, info: any) => {
      if (err) {
        logger.error('QQ OAuth error:', err);
        return res.redirect('/api/v1/auth/failure');
      }
      if (!user) {
        logger.error('QQ OAuth: No user returned', info);
        return res.redirect('/api/v1/auth/failure');
      }
      logger.info('QQ OAuth success:', { email: user?.email });
      (req as any).user = user;
      return (AuthController.oauthSuccess as any)(req, res, next);
    }
  )(req, res, next);
});

// WeChat OAuth routes - Direct implementation (temporarily disabled)
// router.get('/wechat', (req, res) => {
//   const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/auth/wechat/callback`;
//   const authUrl = WeChatOAuthService.getAuthUrl(redirectUri);
//   res.redirect(authUrl);
// });

// router.get('/wechat/callback', async (req, res, next) => {
//   try {
//     const code = req.query.code as string;
//     const state = req.query.state as string;

//     if (!code) {
//       return res.redirect('/api/v1/auth/failure');
//     }

//     // Check if this code has already been used
//     const cacheKey = `oauth:wechat:code:${code}`;
//     const alreadyUsed = await redisClient.get(cacheKey);

//     if (alreadyUsed) {
//       console.log('WeChat OAuth: Code already used, redirecting to failure');
//       return res.redirect('/api/v1/auth/failure');
//     }

//     // Mark code as used (expires in 10 minutes)
//     await redisClient.set(cacheKey, 'used', 600);

//     // Get user info from WeChat
//     const profile = await WeChatOAuthService.handleOAuthCallback(code);
//     const email = `${profile.openid}@wechat.local`;

//     // Check if user already exists
//     const existingUser = await UserModel.findByEmail(email);

//     let user;
//     if (existingUser) {
//       // User exists, update last login
//       await UserModel.updateLastLogin(existingUser.id);
//       user = existingUser;
//     } else {
//       // Create new user
//       user = await UserModel.create({
//         email,
//         name: profile.nickname || profile.openid,
//         avatarUrl: profile.headimgurl,
//         emailVerified: false,
//         status: 'pending',
//         authType: 'wechat',
//       });

//       logger.info('New user created via WeChat OAuth:', {
//         userId: user.id,
//         email: user.email,
//       });
//     }

//     console.log('WeChat OAuth success:', user.email);
//     (req as any).user = user;
//     return (AuthController.oauthSuccess as any)(req, res, next);
//   } catch (error) {
//     console.error('WeChat OAuth error:', error);
//     return res.redirect('/api/v1/auth/failure');
//   }
// });

// Baidu OAuth routes - Direct implementation (temporarily disabled)
// router.get('/baidu', (req, res) => {
//   const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/auth/baidu/callback`;
//   const authUrl = BaiduOAuthService.getAuthUrl(redirectUri);
//   res.redirect(authUrl);
// });

// router.get('/baidu/callback', async (req, res, next) => {
//   try {
//     const code = req.query.code as string;
//     const state = req.query.state as string;
//     const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/auth/baidu/callback`;

//     if (!code) {
//       return res.redirect('/api/v1/auth/failure');
//     }

//     // Check if this code has already been used
//     const cacheKey = `oauth:baidu:code:${code}`;
//     const alreadyUsed = await redisClient.get(cacheKey);

//     if (alreadyUsed) {
//       console.log('Baidu OAuth: Code already used, redirecting to failure');
//       return res.redirect('/api/v1/auth/failure');
//     }

//     // Mark code as used (expires in 10 minutes)
//     await redisClient.set(cacheKey, 'used', 600);

//     // Get user info from Baidu
//     const profile = await BaiduOAuthService.handleOAuthCallback(code, redirectUri);
//     const email = `${profile.userid}@baidu.local`;

//     // Check if user already exists
//     const existingUser = await UserModel.findByEmail(email);

//     let user;
//     if (existingUser) {
//       // User exists, update last login
//       await UserModel.updateLastLogin(existingUser.id);
//       user = existingUser;
//     } else {
//       // Create new user
//       user = await UserModel.create({
//         email,
//         name: profile.username || profile.userid,
//         avatarUrl: profile.portrait ? `https://himg.bdimg.com/sys/portrait/item/${profile.portrait}` : undefined,
//         emailVerified: false,
//         status: 'pending',
//         authType: 'baidu',
//       });

//       logger.info('New user created via Baidu OAuth:', {
//         userId: user.id,
//         email: user.email,
//       });
//     }

//     console.log('Baidu OAuth success:', user.email);
//     (req as any).user = user;
//     return (AuthController.oauthSuccess as any)(req, res, next);
//   } catch (error) {
//     console.error('Baidu OAuth error:', error);
//     return res.redirect('/api/v1/auth/failure');
//   }
// });

// OAuth callback routes
router.get('/success', AuthController.oauthSuccess);
router.get('/failure', AuthController.oauthFailure);

// Catch-all route for debugging unknown auth routes
router.all('*', (req, res) => {
  logger.warn('Unknown auth route accessed:', {
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    path: req.path,
    query: req.query,
    headers: {
      host: req.get('host'),
      referer: req.get('referer'),
      userAgent: req.get('user-agent'),
    },
  });

  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.originalUrl} not found`,
    },
  });
});

export default router;
