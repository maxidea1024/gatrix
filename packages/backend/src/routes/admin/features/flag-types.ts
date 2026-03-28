/**
 * Flag Types Routes
 * API endpoints for managing feature flag types
 * Flag types are project-scoped but affect all environments,
 * so CR is required if ANY environment in the project has requiresApproval=true.
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/error-handler';
import { FeatureFlagTypeModel } from '../../../models/feature-flag-type';
import {
  UnifiedChangeGateway,
  ChangeGatewayResult,
} from '../../../services/unified-change-gateway';

const router = Router();

const TARGET_TABLE = 'g_feature_flag_types';

/**
 * Helper: build CR response or direct response
 */
function buildResponse(
  res: Response,
  result: ChangeGatewayResult,
  successData?: any
) {
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

// List all flag types (read-only, no CR needed)
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
        req.params.flagType,
        req.body,
        async (processedData) => {
          return FeatureFlagTypeModel.update(
            req.params.flagType,
            processedData
          );
        },
        { primaryKey: 'flagType' }
      );
      return buildResponse(res, result, { flagType: result.data });
    }

    // No CR needed - direct update
    const flagType = await FeatureFlagTypeModel.update(
      req.params.flagType,
      req.body
    );
    res.json({ success: true, data: { flagType } });
  })
);

export default router;
