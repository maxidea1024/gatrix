/**
 * Segments Routes
 * API endpoints for managing feature flag segments
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/error-handler';
import { featureFlagService } from '../../../services/feature-flag-service';

const router = Router();

// List segments (segments are now global)
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search } = req.query;

    const segments = await featureFlagService.listSegments(search as string, req.projectId);

    res.json({ success: true, data: { segments } });
  })
);

// Get segment by ID
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const segment = await featureFlagService.getSegment(req.params.id);

    if (!segment) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }

    res.json({ success: true, data: { segment } });
  })
);

// Create a segment (segments are now global)
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    const segment = await featureFlagService.createSegment(req.body, userId!);

    res.status(201).json({ success: true, data: { segment } });
  })
);

// Update a segment
router.put(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    const segment = await featureFlagService.updateSegment(req.params.id, req.body, userId!);

    res.json({ success: true, data: { segment } });
  })
);

// Get segment references
router.get(
  '/:id/references',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { FeatureSegmentModel } = await import('../../../models/FeatureFlag');
    const references = await FeatureSegmentModel.getReferences(req.params.id);
    res.json({ success: true, data: { references } });
  })
);

// Delete a segment
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    await featureFlagService.deleteSegment(req.params.id, userId!);

    res.json({ success: true, message: 'Segment deleted successfully' });
  })
);

export default router;
