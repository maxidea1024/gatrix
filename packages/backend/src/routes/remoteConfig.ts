import express from 'express';
import RemoteConfigController from '../controllers/RemoteConfigController';
import { ContextFieldController } from '../controllers/ContextFieldControllerNew';
import { authenticate, requireAdmin } from '../middleware/auth';
import { body, param, query, validationResult } from 'express-validator';
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

// Apply authentication and admin role requirement to all routes
router.use(authenticate as any);
router.use(requireAdmin as any);

// Validation schemas
const createConfigValidation = [
  body('keyName')
    .isString()
    .isLength({ min: 1, max: 255 })
    .matches(/^[a-zA-Z][a-zA-Z0-9_.-]*$/)
    .withMessage('Key name must start with a letter and contain only letters, numbers, dots, hyphens, and underscores'),
  body('valueType')
    .isIn(['string', 'number', 'boolean', 'json', 'yaml'])
    .withMessage('Value type must be one of: string, number, boolean, json, yaml'),
  body('defaultValue')
    .optional()
    .isString(),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 }),
  body('isActive')
    .optional()
    .isBoolean()
];

const updateConfigValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid config ID'),
  body('keyName')
    .optional()
    .isString()
    .isLength({ min: 1, max: 255 })
    .matches(/^[a-zA-Z][a-zA-Z0-9_.-]*$/)
    .withMessage('Key name must start with a letter and contain only letters, numbers, dots, hyphens, and underscores'),
  body('valueType')
    .optional()
    .isIn(['string', 'number', 'boolean', 'json', 'yaml'])
    .withMessage('Value type must be one of: string, number, boolean, json, yaml'),
  body('defaultValue')
    .optional()
    .isString(),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 }),
  body('isActive')
    .optional()
    .isBoolean()
];

const listConfigsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isString()
    .isLength({ max: 255 }),
  query('valueType')
    .optional()
    .isIn(['string', 'number', 'boolean', 'json', 'yaml']),
  query('isActive')
    .optional()
    .custom((value) => {
      // 빈 문자열이나 undefined는 허용
      if (value === '' || value === undefined || value === null) {
        return true;
      }
      // 'true' 또는 'false' 문자열만 허용
      if (value === 'true' || value === 'false') {
        return true;
      }
      throw new Error('isActive must be "true" or "false"');
    }),
  query('sortBy')
    .optional()
    .isIn(['keyName', 'valueType', 'createdAt', 'updatedAt'])
    .withMessage('Sort by must be one of: keyName, valueType, createdAt, updatedAt'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// stageConfigsValidation removed - staging system deprecated

const publishConfigsValidation = [
  body('deploymentName')
    .optional()
    .isString()
    .isLength({ min: 1, max: 255 }),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
];

// Context Fields validation
const createContextFieldValidation = [
  body('key')
    .isString()
    .isLength({ min: 1, max: 255 })
    .matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .withMessage('Key must start with a letter and contain only letters, numbers, and underscores'),
  body('name')
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name is required and must be 1-255 characters'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Description must be a string with maximum 1000 characters'),
  body('type')
    .isIn(['string', 'number', 'boolean', 'array'])
    .withMessage('Type must be one of: string, number, boolean, array'),
  body('defaultValue')
    .optional()
    .isString(),
  body('isRequired')
    .optional()
    .isBoolean()
    .withMessage('isRequired must be a boolean'),
  body('options')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined) {
        return true;
      }
      if (Array.isArray(value)) {
        return true;
      }
      throw new Error('Options must be an array or null');
    })
];

// Routes

/**
 * @route GET /api/v1/remote-config
 * @desc Get all remote configs with pagination and filters
 * @access Admin
 */
router.get('/', listConfigsValidation, validateRequest, RemoteConfigController.list);

/**
 * @route GET /api/v1/remote-config/deployments
 * @desc Get deployment history
 * @access Admin
 */
router.get('/deployments',
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  validateRequest,
  RemoteConfigController.getDeployments
);

/**
 * @route GET /api/v1/remote-config/versions
 * @desc Get version history
 * @access Admin
 */
router.get('/versions',
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  validateRequest,
  RemoteConfigController.getVersionHistory
);

/**
 * @route GET /api/v1/remote-config/context-fields
 * @desc Get all context fields
 * @access Admin
 */
router.get('/context-fields', ContextFieldController.getContextFields);

/**
 * @route POST /api/v1/remote-config/context-fields
 * @desc Create new context field
 * @access Admin
 */
router.post('/context-fields', createContextFieldValidation, validateRequest, ContextFieldController.createContextField);

/**
 * @route PUT /api/v1/remote-config/context-fields/:id
 * @desc Update context field
 * @access Admin
 */
router.put('/context-fields/:id', [
  param('id').isInt({ min: 1 }).withMessage('Invalid context field ID'),
  body('name')
    .optional()
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be 1-255 characters'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Description must be a string with maximum 1000 characters'),
  body('defaultValue')
    .optional()
    .isString(),
  body('isRequired')
    .optional()
    .isBoolean()
    .withMessage('isRequired must be a boolean'),
  body('options')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined) {
        return true;
      }
      if (Array.isArray(value)) {
        return true;
      }
      throw new Error('Options must be an array or null');
    })
], validateRequest, ContextFieldController.updateContextField);

/**
 * @route DELETE /api/v1/remote-config/context-fields/:id
 * @desc Delete context field
 * @access Admin
 */
router.delete('/context-fields/:id', [
  param('id').isInt({ min: 1 }).withMessage('Invalid context field ID')
], validateRequest, ContextFieldController.deleteContextField);

// getVersions route removed - using template version system instead

// discardDraftVersions route removed - using template version system instead

/**
 * @route GET /api/v1/remote-config/segments
 * @desc Get all segments (formerly rules)
 * @access Admin
 */
router.get('/segments',
  RemoteConfigController.getSegments
);

// stage route removed - staging system deprecated

/**
 * @route GET /api/v1/remote-config/template
 * @desc Get current template data
 * @access Admin
 */
router.get('/template', RemoteConfigController.getTemplate);

/**
 * @route PUT /api/v1/remote-config/template
 * @desc Update template data directly
 * @access Admin
 */
router.put('/template',
  body('templateData').isObject().withMessage('Template data must be an object'),
  validateRequest,
  RemoteConfigController.updateTemplate
);

/**
 * @route POST /api/v1/remote-config/parameter
 * @desc Add a new parameter
 * @access Admin
 */
router.post('/parameter',
  body('key').isString().notEmpty().withMessage('Key is required'),
  body('type').isIn(['string', 'number', 'boolean', 'json']).withMessage('Invalid type'),
  body('defaultValue').optional(),
  body('description').optional().isString(),
  validateRequest,
  RemoteConfigController.addParameter
);

/**
 * @route PUT /api/v1/remote-config/parameter/:key
 * @desc Update an existing parameter
 * @access Admin
 */
router.put('/parameter/:key',
  param('key').isString().notEmpty().withMessage('Key is required'),
  body('type').optional().isIn(['string', 'number', 'boolean', 'json']).withMessage('Invalid type'),
  body('defaultValue').optional(),
  body('description').optional().isString(),
  validateRequest,
  RemoteConfigController.updateParameter
);

/**
 * @route DELETE /api/v1/remote-config/parameter/:key
 * @desc Delete a parameter
 * @access Admin
 */
router.delete('/parameter/:key',
  param('key').isString().notEmpty().withMessage('Key is required'),
  validateRequest,
  RemoteConfigController.deleteParameter
);

/**
 * @route GET /api/v1/remote-config/:id
 * @desc Get remote config by ID
 * @access Admin
 */
router.get('/:id',
  param('id').isInt({ min: 1 }).withMessage('Invalid config ID'),
  validateRequest,
  RemoteConfigController.getById
);

/**
 * @route POST /api/v1/remote-config
 * @desc Create new remote config
 * @access Admin
 */
router.post('/', createConfigValidation, validateRequest, RemoteConfigController.create);

/**
 * @route PUT /api/v1/remote-config/:id
 * @desc Update remote config
 * @access Admin
 */
router.put('/:id', updateConfigValidation, validateRequest, RemoteConfigController.update);

/**
 * @route DELETE /api/v1/remote-config/:id
 * @desc Delete remote config
 * @access Admin
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }).withMessage('Invalid config ID'),
  validateRequest,
  RemoteConfigController.delete
);

/**
 * @route POST /api/v1/remote-config/publish
 * @desc Publish template as new version
 * @access Admin
 */
router.post('/publish', publishConfigsValidation, validateRequest, RemoteConfigController.publish);

// Rollback validation
const rollbackValidation = [
  body('deploymentId')
    .isInt({ min: 1 })
    .withMessage('Deployment ID must be a positive integer'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Description must be a string with maximum 1000 characters')
];





/**
 * @route POST /api/v1/remote-config/rollback
 * @desc Rollback to a previous deployment
 * @access Admin
 */
router.post('/rollback', rollbackValidation, validateRequest, RemoteConfigController.rollback);



export default router;
