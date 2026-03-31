import express from 'express';
import { body } from 'express-validator';
import ApiTokensController from '../../controllers/api-tokens-controller';
import {
  authenticate,
  requireOrgPermission,
  requireProjectPermission,
  requireEnvPermission,
} from '../../middleware/auth';
import { auditLog } from '../../middleware/audit-log';
import { P } from '@gatrix/shared/permissions';

const router = express.Router();

// Validation rules
const createTokenValidation = [
  body('tokenName')
    .notEmpty()
    .withMessage('Token name is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Token name must be between 3 and 200 characters'),

  body('tokenType')
    .isIn(['client', 'server', 'edge', 'universal_client'])
    .withMessage(
      'Token type must be client, server, edge, or universal_client'
    ),

  body('environmentId')
    .if(body('tokenType').not().equals('universal_client'))
    .notEmpty()
    .withMessage('Environment ID is required'),

  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expires at must be a valid ISO 8601 date'),
];

const updateTokenValidation = [
  body('tokenName')
    .notEmpty()
    .withMessage('Token name is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Token name must be between 3 and 200 characters'),

  body('environmentId')
    .if(body('tokenType').not().equals('universal_client'))
    .optional()
    .notEmpty()
    .withMessage('Environment ID is required'),

  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expires at must be a valid ISO 8601 date'),
];

// Apply authentication and permission requirement to all routes
router.use(authenticate as any);
router.use(
  requireProjectPermission([
    P.SERVICE_ACCOUNTS_READ,
    P.SERVICE_ACCOUNTS_UPDATE,
  ]) as any
);

// Routes
router.get('/', ApiTokensController.getTokens as any);
router.get('/stats', ApiTokensController.getTokenStats as any);
router.post(
  '/',
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
    getDescription: (req) =>
      `API token '${req.body?.tokenName}' (${req.body?.tokenType}) created`,
  }) as any,
  ApiTokensController.createToken as any
);
router.put(
  '/:id',
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
    getDescription: (req) => `API token '${req.body?.tokenName}' updated`,
  }) as any,
  ApiTokensController.updateToken as any
);
router.post(
  '/:id/regenerate',
  auditLog({
    action: 'api_token_regenerate',
    resourceType: 'api_token',
    getResourceId: (req) => req.params?.id,
    getDescription: (req) => `API token #${req.params?.id} regenerated`,
  }) as any,
  ApiTokensController.regenerateToken as any
);
router.delete(
  '/:id',
  auditLog({
    action: 'api_token_delete',
    resourceType: 'api_token',
    getResourceId: (req) => req.params?.id,
    getDescription: (req) => `API token #${req.params?.id} deleted`,
  }) as any,
  ApiTokensController.deleteToken as any
);

export default router;
