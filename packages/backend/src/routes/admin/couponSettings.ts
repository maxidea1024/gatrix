import express from 'express';
import { CouponSettingsController } from '../../controllers/CouponSettingsController';

const router = express.Router();

// List coupon settings
router.get('/', CouponSettingsController.list);

// Create coupon setting
router.post('/', CouponSettingsController.create);

// Usage records for all settings (no settingId)
router.get('/usage', CouponSettingsController.usage);

// Get usage records for export (chunked)
router.get('/usage/export-chunked', CouponSettingsController.getUsageForExport);

// Export usage records to CSV
router.get('/usage/export', CouponSettingsController.exportUsage);

// Get single
router.get('/:id', CouponSettingsController.getById);

// Update
router.patch('/:id', CouponSettingsController.update);

// Delete (soft)
router.delete('/:id', CouponSettingsController.remove);

// Usage records for a specific setting
router.get('/:id/usage', CouponSettingsController.usage);

// Issued codes statistics for a setting
router.get('/:id/issued-codes-stats', CouponSettingsController.getIssuedCodesStats);

// Issued codes for export (chunked)
router.get('/:id/issued-codes-export', CouponSettingsController.getIssuedCodesForExport);

// Issued codes for a setting
router.get('/:id/issued-codes', CouponSettingsController.getIssuedCodes);

// Generation status for async coupon code generation
router.get('/:id/generation-status', CouponSettingsController.getGenerationStatus);

// Recalculate cache for all coupon settings (admin maintenance)
router.post('/admin/recalculate-cache-all', CouponSettingsController.recalculateCacheAll);

// Recalculate cache for a specific coupon setting (admin maintenance)
router.post('/:id/recalculate-cache', CouponSettingsController.recalculateCacheForSetting);

export default router;
