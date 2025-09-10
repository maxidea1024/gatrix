import { Router } from 'express';
import passport from '../config/passport';
import { AuthController } from '../controllers/AuthController';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { auditUserLogin, auditUserRegister } from '../middleware/auditLog';
import redisClient from '../config/redis';

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

// OAuth callback routes
router.get('/success', AuthController.oauthSuccess);
router.get('/failure', AuthController.oauthFailure);

export default router;
