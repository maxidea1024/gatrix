import express from 'express';
import { ContextFieldController } from '../controllers/ContextFieldController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { body, validationResult } from 'express-validator';
import { CustomError } from '../middleware/errorHandler';

const router = express.Router();

// Validation middleware
const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg).join(', ');
    throw new CustomError(`Validation failed: ${errorMessages}`, 400);
  }
  next();
};

// Apply authentication to all routes
router.use(authenticate as any);

/**
 * @route GET /api/v1/context-fields
 * @desc Get all available context fields and operators
 * @access Admin
 */
router.get('/', ContextFieldController.getContextFields);

/**
 * @route GET /api/v1/context-fields/:key
 * @desc Get specific context field by key
 * @access Admin
 */
router.get('/:key', ContextFieldController.getContextField);

/**
 * @route GET /api/v1/context-fields/operators/:fieldType
 * @desc Get operators for specific field type
 * @access Admin
 */
router.get('/operators/:fieldType', ContextFieldController.getOperatorsForFieldType);

/**
 * @route POST /api/v1/context-fields/validate
 * @desc Validate target conditions
 * @access Admin
 */
router.post('/validate', [
  body('conditions').isArray().withMessage('Conditions must be an array'),
  validateRequest
], ContextFieldController.validateConditions);

/**
 * @route POST /api/v1/context-fields/test
 * @desc Test conditions against user context
 * @access Admin
 */
router.post('/test', [
  body('conditions').isArray().withMessage('Conditions must be an array'),
  body('userContext').isObject().withMessage('User context must be an object'),
  validateRequest
], ContextFieldController.testConditions);

/**
 * @route GET /api/v1/context-fields/samples/contexts
 * @desc Get sample user contexts for testing
 * @access Admin
 */
router.get('/samples/contexts', ContextFieldController.getSampleContexts);

export default router;
