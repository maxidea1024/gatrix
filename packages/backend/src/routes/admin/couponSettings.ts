import express from 'express';
import { CouponSettingsController } from '../../controllers/CouponSettingsController';

const router = express.Router();

// List coupon settings
router.get('/', CouponSettingsController.list);

// Create coupon setting
router.post('/', CouponSettingsController.create);

// Get single
router.get('/:id', CouponSettingsController.getById);

// Update
router.patch('/:id', CouponSettingsController.update);

// Delete (soft)
router.delete('/:id', CouponSettingsController.remove);

// Usage records for a setting
router.get('/:id/usage', CouponSettingsController.usage);

// Issued codes for a setting
router.get('/:id/issued-codes', CouponSettingsController.getIssuedCodes);

// Generation status for async coupon code generation
router.get('/:id/generation-status', CouponSettingsController.getGenerationStatus);

export default router;

