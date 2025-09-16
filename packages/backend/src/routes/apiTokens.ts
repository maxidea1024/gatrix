import express from 'express';
import { body } from 'express-validator';
import ApiTokensController from '../controllers/ApiTokensController';
import { authenticate, requireRole } from '../middleware/auth';

const router = express.Router();

// Validation rules
const createTokenValidation = [
  body('tokenName')
    .notEmpty()
    .withMessage('Token name is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Token name must be between 3 and 200 characters'),
  
  body('tokenType')
    .isIn(['client', 'server'])
    .withMessage('Token type must be client or server'),
  
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expires at must be a valid ISO 8601 date')
];

const updateTokenValidation = [
  body('tokenName')
    .notEmpty()
    .withMessage('Token name is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Token name must be between 3 and 200 characters'),

  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expires at must be a valid ISO 8601 date')
];

// Apply authentication and admin role requirement to all routes
router.use(authenticate as any);
router.use(requireRole(['admin']) as any);

// Routes
router.get('/', ApiTokensController.getTokens as any);
router.get('/stats', ApiTokensController.getTokenStats as any);
router.post('/', createTokenValidation, ApiTokensController.createToken as any);
router.put('/:id', updateTokenValidation, ApiTokensController.updateToken as any);
router.post('/:id/regenerate', ApiTokensController.regenerateToken as any);
router.delete('/:id', ApiTokensController.deleteToken as any);

export default router;
