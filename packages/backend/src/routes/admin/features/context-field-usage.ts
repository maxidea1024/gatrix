/**
 * Context Field Usage Routes (Admin)
 * API endpoints for managing discovered context field usage from SDK evaluations
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/error-handler';
import { contextFieldUsageService } from '../../../services/context-field-usage-service';

const router = Router();

// List discovered context fields
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = req.projectId;
    if (!projectId) {
      res.status(400).json({ success: false, error: 'projectId is required' });
      return;
    }

    const { search, environmentId, appName, includeIgnored } = req.query;

    const fields = await contextFieldUsageService.getDiscoveredFields(
      projectId,
      {
        search: search as string | undefined,
        environmentId: environmentId as string | undefined,
        appName: appName as string | undefined,
        includeIgnored: includeIgnored === 'true',
      }
    );

    res.json({ success: true, data: { fields } });
  })
);

// Get distinct app names for filters
router.get(
  '/app-names',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = req.projectId;
    if (!projectId) {
      res.status(400).json({ success: false, error: 'projectId is required' });
      return;
    }

    const appNames = await contextFieldUsageService.getAppNames(projectId);
    res.json({ success: true, data: { appNames } });
  })
);

// Get distinct environment IDs for filters
router.get(
  '/environments',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = req.projectId;
    if (!projectId) {
      res.status(400).json({ success: false, error: 'projectId is required' });
      return;
    }

    const environmentIds =
      await contextFieldUsageService.getEnvironmentIds(projectId);
    res.json({ success: true, data: { environmentIds } });
  })
);

// Update field metadata (description, tags, isIgnored)
router.put(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { description, tags, isIgnored } = req.body;

    await contextFieldUsageService.updateFieldMeta(id, {
      description,
      tags,
      isIgnored,
    });

    res.json({ success: true, message: 'Field metadata updated' });
  })
);

// Delete a discovered field record
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    await contextFieldUsageService.deleteField(id);
    res.json({ success: true, message: 'Field record deleted' });
  })
);

// Promote: infer type for a discovered field
router.get(
  '/:id/infer-type',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    // Get the field record to get fieldName
    const projectId = req.projectId;
    if (!projectId) {
      res.status(400).json({ success: false, error: 'projectId is required' });
      return;
    }

    const fields = await contextFieldUsageService.getDiscoveredFields(
      projectId,
      { includeIgnored: true }
    );
    const field = fields.find((f) => f.id === id);

    if (!field) {
      res.status(404).json({ success: false, error: 'Field not found' });
      return;
    }

    const inferredType = contextFieldUsageService.inferFieldType(
      field.fieldName
    );

    res.json({
      success: true,
      data: {
        fieldName: field.fieldName,
        inferredType,
      },
    });
  })
);

export default router;
