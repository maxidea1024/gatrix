/**
 * Code References Routes
 * API endpoints for feature flag code references
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/errorHandler';
import { createLogger } from '../../../config/logger';

const logger = createLogger('CodeReferencesRoutes');
const router = Router();

// Get code references summary for all flags
router.get(
  '/summary',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { repository, branch } = req.query;

    try {
      const { FeatureCodeReferenceModel } = await import('../../../models/FeatureCodeReference');

      const summary = await FeatureCodeReferenceModel.getSummary({
        repository: repository as string,
        branch: branch as string,
      });

      const scanInfo = await FeatureCodeReferenceModel.getLatestScanInfo({
        repository: repository as string,
        branch: branch as string,
      });

      res.json({
        success: true,
        data: {
          summary,
          scanInfo,
        },
      });
    } catch (error: any) {
      // Code references are non-critical - return empty on any error
      logger.warn('Code references summary error:', error.message || error.code);
      res.json({
        success: true,
        data: {
          summary: [],
          scanInfo: null,
        },
      });
    }
  })
);

export default router;

/**
 * Per-flag code references sub-router
 * Mounted under /:flagName/code-references in the flags router
 */
export const flagCodeReferencesRouter = Router({ mergeParams: true });

// Get code references for a specific flag
flagCodeReferencesRouter.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { flagName } = req.params;
    const { repository, branch, limit } = req.query;

    try {
      const { FeatureCodeReferenceModel } = await import('../../../models/FeatureCodeReference');

      const references = await FeatureCodeReferenceModel.findByFlagName(flagName, {
        repository: repository as string,
        branch: branch as string,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      const scanInfo = await FeatureCodeReferenceModel.getLatestScanInfo({
        repository: repository as string,
        branch: branch as string,
      });

      res.json({
        success: true,
        data: {
          references,
          scanInfo,
          total: references.length,
        },
      });
    } catch (error: any) {
      // Code references are non-critical - return empty on any error
      logger.warn('Code references error:', error.message || error.code);
      res.json({
        success: true,
        data: {
          references: [],
          scanInfo: null,
          total: 0,
        },
      });
    }
  })
);
