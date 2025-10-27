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

export default router;

