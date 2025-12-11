import express from 'express';
import { body } from 'express-validator';
import ApiTokensController from '../../controllers/ApiTokensController';
import { authenticate, requireRole } from '../../middleware/auth';
import { auditLog } from '../../middleware/auditLog';

const router = express.Router();

// Validation rules
const createTokenValidation = [
  body('tokenName')
    .notEmpty()
    .withMessage('Token name is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Token name must be between 3 and 200 characters'),
  
  body('tokenType')
    .isIn(['client', 'server', 'all'])
    .withMessage('Token type must be client, server, or all'),
  
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
router.post('/',
  createTokenValidation,
  auditLog({
    action: 'api_token_create',
    resourceType: 'api_token',
    getResourceIdFromResponse: (responseBody) => responseBody?.data?.id,
    getNewValues: (req) => ({
      tokenName: req.body?.tokenName,
      tokenType: req.body?.tokenType,
      expiresAt: req.body?.expiresAt,
    }),
  }) as any,
  ApiTokensController.createToken as any
);
router.put('/:id',
  updateTokenValidation,
  auditLog({
    action: 'api_token_update',
    resourceType: 'api_token',
    getResourceId: (req) => req.params?.id,
    getNewValues: (req) => ({
      tokenName: req.body?.tokenName,
      description: req.body?.description,
      expiresAt: req.body?.expiresAt,
    }),
  }) as any,
  ApiTokensController.updateToken as any
);
router.post('/:id/regenerate',
  auditLog({
    action: 'api_token_regenerate',
    resourceType: 'api_token',
    getResourceId: (req) => req.params?.id,
  }) as any,
  ApiTokensController.regenerateToken as any
);
router.delete('/:id',
  auditLog({
    action: 'api_token_delete',
    resourceType: 'api_token',
    getResourceId: (req) => req.params?.id,
  }) as any,
  ApiTokensController.deleteToken as any
);

export default router;
