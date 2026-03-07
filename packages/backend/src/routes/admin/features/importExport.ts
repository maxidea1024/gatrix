/**
 * Import/Export Routes
 * API endpoints for cloning and importing feature flags
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/errorHandler';
import { featureFlagService } from '../../../services/FeatureFlagService';
import { requireEnvironment, getRequestContext } from './_helpers';

const router = Router();

// ==================== Clone ====================

// Clone a feature flag to a new name
router.post(
  '/clone',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const userId = req.user?.id;
    const { sourceFlagName, newFlagName } = req.body;

    if (!sourceFlagName || !newFlagName) {
      return res.status(400).json({
        success: false,
        error: 'sourceFlagName and newFlagName are required',
      });
    }

    // Get the source flag
    const sourceFlag = await featureFlagService.getFlag(
      environmentId,
      sourceFlagName,
      req.projectId
    );
    if (!sourceFlag) {
      return res.status(404).json({
        success: false,
        error: 'Source flag not found',
      });
    }

    // Check if new flag name already exists
    const existingFlag = await featureFlagService.getFlag(
      environmentId,
      newFlagName,
      req.projectId
    );
    if (existingFlag) {
      return res.status(409).json({
        success: false,
        error: 'A flag with the new name already exists',
      });
    }

    // Create new flag with same settings but different name
    const newFlag = await featureFlagService.createFlag(
      {
        environmentId,
        flagName: newFlagName,
        displayName: sourceFlag.displayName ? `${sourceFlag.displayName} (Copy)` : undefined,
        description: sourceFlag.description,
        flagType: sourceFlag.flagType,
        valueType: sourceFlag.valueType,
        enabledValue: sourceFlag.enabledValue,
        disabledValue: sourceFlag.disabledValue,
        impressionDataEnabled: sourceFlag.impressionDataEnabled,
        tags: sourceFlag.tags,
        strategies: sourceFlag.strategies?.map((s: any) => ({
          strategyName: s.strategyName,
          parameters: s.parameters,
          constraints: s.constraints,
          segments: s.segments,
          sortOrder: s.sortOrder,
          isEnabled: s.isEnabled,
        })),
        variants: sourceFlag.variants?.map((v: any) => ({
          variantName: v.variantName,
          weight: v.weight,
          value: v.value,
          valueType: v.valueType,
          overrides: v.overrides,
        })),
      },
      userId!
    );

    res.status(201).json({ success: true, data: { flag: newFlag } });
  })
);

// ==================== Import ====================

// Import feature flags from JSON
router.post(
  '/import',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = requireEnvironment(req, res);
    if (!environmentId) return;

    const userId = req.user?.id;
    const { segments = [], flags = [] } = req.body;

    const result = {
      segments: {
        created: 0,
        skipped: 0,
        skippedNames: [] as string[],
      },
      flags: {
        created: 0,
        skipped: 0,
        skippedNames: [] as string[],
        errors: [] as string[],
      },
    };

    // 1. Import segments (global, skip if exists)
    for (const segmentData of segments) {
      try {
        // Check if segment exists by name
        const existingSegments = await featureFlagService.listSegments(segmentData.segmentName);
        const existingSegment = existingSegments.find(
          (s: any) => s.segmentName === segmentData.segmentName
        );

        if (existingSegment) {
          result.segments.skipped++;
          result.segments.skippedNames.push(segmentData.segmentName);
          continue;
        }

        // Create segment
        await featureFlagService.createSegment(
          {
            segmentName: segmentData.segmentName,
            description: segmentData.description,
            constraints: segmentData.constraints || [],
          },
          userId!
        );
        result.segments.created++;
      } catch (error: any) {
        if (error.code === 'DUPLICATE_ENTRY') {
          result.segments.skipped++;
          result.segments.skippedNames.push(segmentData.segmentName);
        }
      }
    }

    // 2. Import flags (environment-specific, skip if exists)
    for (const flagData of flags) {
      try {
        // Check if flag exists
        const existingFlag = await featureFlagService.getFlag(
          environmentId,
          flagData.flagName,
          req.projectId
        );

        if (existingFlag) {
          result.flags.skipped++;
          result.flags.skippedNames.push(flagData.flagName);
          continue;
        }

        // Create new flag with strategies and variants
        await featureFlagService.createFlag(
          {
            environmentId,
            flagName: flagData.flagName,
            displayName: flagData.displayName,
            description: flagData.description,
            flagType: flagData.flagType || 'release',
            valueType: flagData.valueType || 'boolean',
            enabledValue: flagData.enabledValue,
            disabledValue: flagData.disabledValue,
            impressionDataEnabled: flagData.impressionDataEnabled || false,
            tags: flagData.tags,
            strategies: flagData.strategies?.map((s: any) => ({
              strategyName: s.strategyName,
              parameters: s.parameters,
              constraints: s.constraints,
              segments: s.segments,
              sortOrder: s.sortOrder,
              isEnabled: s.isEnabled !== false,
            })),
            variants: flagData.variants?.map((v: any) => ({
              variantName: v.variantName,
              weight: v.weight,
              value: v.value,
              valueType: v.valueType || 'json',
              overrides: v.overrides,
            })),
          },
          userId!
        );

        result.flags.created++;
      } catch (error: any) {
        // If duplicate error, count as skipped
        if (error.code === 'DUPLICATE_ENTRY') {
          result.flags.skipped++;
          result.flags.skippedNames.push(flagData.flagName);
        } else {
          result.flags.errors.push(`${flagData.flagName}: ${error.message}`);
        }
      }
    }

    res.json({
      success: true,
      data: {
        summary: {
          segmentsCreated: result.segments.created,
          segmentsSkipped: result.segments.skipped,
          flagsCreated: result.flags.created,
          flagsSkipped: result.flags.skipped,
          errors: result.flags.errors.length,
        },
        details: result,
      },
    });
  })
);

export default router;
