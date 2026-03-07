/**
 * Flag Types Routes
 * API endpoints for managing feature flag types
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/error-handler';
import { FeatureFlagTypeModel } from '../../../models/feature-flag-type';

const router = Router();

// List all flag types
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const types = await FeatureFlagTypeModel.findAll(req.projectId);
    res.json({ success: true, data: { types } });
  })
);

// Update a flag type
router.put(
  '/:flagType',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const flagType = await FeatureFlagTypeModel.update(req.params.flagType, req.body);
    res.json({ success: true, data: { flagType } });
  })
);

export default router;
