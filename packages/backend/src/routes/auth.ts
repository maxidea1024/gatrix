import { Router } from 'express';
import passport from '../config/passport';
import { AuthController } from '../controllers/AuthController';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { auditUserLogin, auditUserRegister } from '../middleware/auditLog';

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
  passport.authenticate('github', {
    scope: ['user:email']
  })
);

router.get('/github/callback',
  passport.authenticate('github', {
    failureRedirect: '/api/v1/auth/failure',
    session: false
  }),
  AuthController.oauthSuccess
);

// OAuth callback routes
router.get('/success', AuthController.oauthSuccess);
router.get('/failure', AuthController.oauthFailure);

export default router;
