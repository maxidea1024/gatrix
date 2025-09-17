import express from 'express';
import { ContextFieldController } from '../../controllers/ContextFieldControllerNew';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { body, validationResult } from 'express-validator';
import { CustomError } from '../../middleware/errorHandler';

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

// Admin-only routes for CRUD operations
router.use(requireAdmin as any);

/**
 * @route POST /api/v1/context-fields
 * @desc Create new context field
 * @access Admin
 */
router.post('/', [
  body('key').isString().isLength({ min: 1, max: 100 }).withMessage('Key must be 1-100 characters'),
  body('name').isString().isLength({ min: 1, max: 200 }).withMessage('Name must be 1-200 characters'),
  body('type').isIn(['string', 'number', 'boolean', 'array']).withMessage('Invalid field type'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('options').optional().isArray().withMessage('Options must be an array'),
  body('defaultValue').optional().isString().withMessage('Default value must be a string'),
  body('isRequired').optional().isBoolean().withMessage('isRequired must be a boolean'),
  body('validation').optional().isObject().withMessage('Validation must be an object'),
  validateRequest
], ContextFieldController.createContextField);

/**
 * @route PUT /api/v1/context-fields/:id
 * @desc Update context field
 * @access Admin
 */
router.put('/:id', [
  body('name').optional().isString().isLength({ min: 1, max: 200 }).withMessage('Name must be 1-200 characters'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('options').optional().isArray().withMessage('Options must be an array'),
  body('defaultValue').optional().isString().withMessage('Default value must be a string'),
  body('isRequired').optional().isBoolean().withMessage('isRequired must be a boolean'),
  body('validation').optional().isObject().withMessage('Validation must be an object'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  validateRequest
], ContextFieldController.updateContextField);

/**
 * @route DELETE /api/v1/context-fields/:id
 * @desc Delete context field
 * @access Admin
 */
router.delete('/:id', ContextFieldController.deleteContextField);

export default router;
