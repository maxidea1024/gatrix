/**
 * Context Fields Routes
 * API endpoints for managing feature flag context fields
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/error-handler';
import { featureFlagService } from '../../../services/feature-flag-service';

const router = Router();

// List context fields
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search } = req.query;
    const fields = await featureFlagService.listContextFields(
      search as string | undefined,
      req.projectId
    );

    res.json({ success: true, data: { contextFields: fields } });
  })
);

// Create a context field
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    const field = await featureFlagService.createContextField(req.body, userId!);

    res.status(201).json({ success: true, data: { field } });
  })
);

// Update a context field
router.put(
  '/:fieldName',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    const field = await featureFlagService.updateContextField(
      req.params.fieldName,
      req.body,
      userId!
    );

    res.json({ success: true, data: { field } });
  })
);

// Get context field references
router.get(
  '/:fieldName/references',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { FeatureContextFieldModel } = await import('../../../models/FeatureFlag');
    const references = await FeatureContextFieldModel.getReferences(req.params.fieldName);
    res.json({ success: true, data: { references } });
  })
);

// Delete a context field
router.delete(
  '/:fieldName',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;

    await featureFlagService.deleteContextField(req.params.fieldName, userId!);

    res.json({ success: true, message: 'Context field deleted successfully' });
  })
);

export default router;
