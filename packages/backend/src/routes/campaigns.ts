import { Router } from 'express';
import { CampaignController } from '../controllers/CampaignController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { query, param, validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validateRequest = (req: any, res: any, next: any) => {
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
const listCampaignsValidation = [
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
  query('isActive')
    .optional()
    .isBoolean()
];

// Campaign routes
router.get('/', listCampaignsValidation, validateRequest, asyncHandler(CampaignController.list));
const campaignIdValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid campaign ID')
];

const configIdValidation = [
  param('configId').isInt({ min: 1 }).withMessage('Invalid config ID')
];

const variantIdValidation = [
  param('variantId').isInt({ min: 1 }).withMessage('Invalid variant ID')
];

router.post('/', asyncHandler(CampaignController.create));
router.get('/:id', campaignIdValidation, validateRequest, asyncHandler(CampaignController.getById));
router.put('/:id', campaignIdValidation, validateRequest, asyncHandler(CampaignController.update));
router.delete('/:id', campaignIdValidation, validateRequest, asyncHandler(CampaignController.delete));

// Campaign-Config association routes
router.post('/:id/configs', campaignIdValidation, validateRequest, asyncHandler(CampaignController.addConfig));
router.delete('/:id/configs/:configId',
  [...campaignIdValidation, ...configIdValidation],
  validateRequest,
  asyncHandler(CampaignController.removeConfig)
);

// Variant routes (nested under configs)
router.get('/configs/:configId/variants', configIdValidation, validateRequest, asyncHandler(CampaignController.getVariants));
router.post('/configs/:configId/variants', configIdValidation, validateRequest, asyncHandler(CampaignController.createVariant));
router.put('/configs/:configId/variants/:variantId',
  [...configIdValidation, ...variantIdValidation],
  validateRequest,
  asyncHandler(CampaignController.updateVariant)
);
router.delete('/configs/:configId/variants/:variantId',
  [...configIdValidation, ...variantIdValidation],
  validateRequest,
  asyncHandler(CampaignController.deleteVariant)
);

export default router;
