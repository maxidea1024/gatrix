import { Router } from 'express';
import passport from '../config/passport';
import { AuthController } from '../controllers/AuthController';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { auditUserLogin, auditUserRegister } from '../middleware/auditLog';
import redisClient from '../config/redis';
// import { WeChatOAuthService } from '../services/WeChatOAuth';
// import { BaiduOAuthService } from '../services/BaiduOAuth';
import { UserModel } from '../models/User';
import { logger } from '../utils/logger';

const router = Router();

// Apply auth rate limiting to all auth routes
router.use(authLimiter as any);

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
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/api/v1/auth/failure',
    session: false
  }),
  AuthController.oauthSuccess
);

// GitHub OAuth routes
router.get('/github',
  (req, res, next) =>
    (passport.authenticate as any)('github', {
      scope: ['user:email'],
      callbackURL: `${req.protocol}://${req.get('host')}/api/v1/auth/github/callback`,
    })(req, res, next)
);

router.get('/github/callback', async (req, res, next) => {
  const callbackURL = `${req.protocol}://${req.get('host')}/api/v1/auth/github/callback`;
  const code = req.query.code as string;

  if (!code) {
    return res.redirect('/api/v1/auth/failure');
  }

  // Check if this code has already been used
  const cacheKey = `oauth:github:code:${code}`;
  const alreadyUsed = await redisClient.get(cacheKey);

  if (alreadyUsed) {
    console.log('GitHub OAuth: Code already used, redirecting to failure');
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
        console.error('GitHub OAuth error:', err);
        return res.redirect('/api/v1/auth/failure');
      }
      if (!user) {
        console.error('GitHub OAuth: No user returned', info);
        return res.redirect('/api/v1/auth/failure');
      }
      console.log('GitHub OAuth success:', user?.email);
      (req as any).user = user;
      return (AuthController.oauthSuccess as any)(req, res, next);
    }
  )(req, res, next);
});

// QQ OAuth routes
router.get('/qq',
  (req, res, next) =>
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
    console.log('QQ OAuth: Code already used, redirecting to failure');
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
        console.error('QQ OAuth error:', err);
        return res.redirect('/api/v1/auth/failure');
      }
      if (!user) {
        console.error('QQ OAuth: No user returned', info);
        return res.redirect('/api/v1/auth/failure');
      }
      console.log('QQ OAuth success:', user?.email);
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

export default router;
