/**
 * Segments Routes
 * API endpoints for managing feature flag segments
 * Segments are project-scoped but affect all environments,
 * so CR is required if ANY environment in the project has requiresApproval=true.
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/error-handler';
import { featureFlagService } from '../../../services/feature-flag-service';
import {
  UnifiedChangeGateway,
  ChangeGatewayResult,
} from '../../../services/unified-change-gateway';

const router = Router();

const TARGET_TABLE = 'g_feature_segments';

/**
 * Helper: build CR response or direct response
 */
function buildResponse(res: Response, result: ChangeGatewayResult, successData?: any) {
  if (result.mode === 'CHANGE_REQUEST') {
    return res.json({
      success: true,
      data: {
        isChangeRequest: true,
        changeRequestId: result.changeRequestId,
      },
    });
  }
  return res.json({ success: true, data: successData || result.data });
}

// List segments (read-only, no CR needed)
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search } = req.query;

    const segments = await featureFlagService.listSegments(
      search as string,
      req.projectId
    );

    res.json({ success: true, data: { segments } });
  })
);

// Get segment by ID (read-only)
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const segment = await featureFlagService.getSegment(req.params.id);

    if (!segment) {
      return res
        .status(404)
        .json({ success: false, error: 'Segment not found' });
    }

    res.json({ success: true, data: { segment } });
  })
);

// Create a segment
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const projectId = req.projectId;

    // Check if any environment in the project requires CR
    const crEnvId = projectId
      ? await UnifiedChangeGateway.getProjectCrEnvironment(projectId)
      : null;

    if (crEnvId) {
      const result = await UnifiedChangeGateway.requestCreation(
        userId!,
        crEnvId,
        TARGET_TABLE,
        { ...req.body, projectId },
        async () => {
          return featureFlagService.createSegment(
            { ...req.body, projectId },
            userId!
          );
        }
      );
      return buildResponse(res, result, { segment: result.data });
    }

    // No CR needed - direct creation
    const segment = await featureFlagService.createSegment(
      { ...req.body, projectId },
      userId!
    );
    res.status(201).json({ success: true, data: { segment } });
  })
);

// Update a segment
router.put(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const projectId = req.projectId;

    // Check if any environment in the project requires CR
    const crEnvId = projectId
      ? await UnifiedChangeGateway.getProjectCrEnvironment(projectId)
      : null;

    if (crEnvId) {
      const result = await UnifiedChangeGateway.processChange(
        userId!,
        crEnvId,
        TARGET_TABLE,
        req.params.id,
        req.body,
        async (processedData) => {
          return featureFlagService.updateSegment(
            req.params.id,
            processedData,
            userId!
          );
        }
      );
      return buildResponse(res, result, { segment: result.data });
    }

    // No CR needed - direct update
    const segment = await featureFlagService.updateSegment(
      req.params.id,
      req.body,
      userId!
    );
    res.json({ success: true, data: { segment } });
  })
);

// Get segment references (read-only)
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
    const projectId = req.projectId;

    // Check if any environment in the project requires CR
    const crEnvId = projectId
      ? await UnifiedChangeGateway.getProjectCrEnvironment(projectId)
      : null;

    if (crEnvId) {
      const result = await UnifiedChangeGateway.requestDeletion(
        userId!,
        crEnvId,
        TARGET_TABLE,
        req.params.id,
        async () => {
          await featureFlagService.deleteSegment(req.params.id, userId!);
        }
      );
      return buildResponse(res, result);
    }

    // No CR needed - direct delete
    await featureFlagService.deleteSegment(req.params.id, userId!);
    res.json({ success: true, message: 'Segment deleted successfully' });
  })
);

export default router;
