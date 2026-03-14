/**
 * Generic Draft API Routes
 *
 * Provides CRUD endpoints for managing drafts across all content types.
 * Content-specific logic is delegated to registered DraftHandlers via DraftService.
 *
 * NOTE: Draft is at the RESOURCE level (e.g., per flag, not per environment).
 * Environment information is embedded inside the draft data JSON.
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error-handler';
import { DraftService } from '../../services/draft-service';

// Register all draft handlers
import { registerFeatureFlagDraftHandler } from '../../services/draft-handlers/feature-flag-draft-handler';
registerFeatureFlagDraftHandler();

const router = Router();

// List drafts for a target type
router.get(
  '/:targetType',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { targetType } = req.params;

    const drafts = await DraftService.listDrafts(targetType);

    res.json({ success: true, data: { drafts } });
  })
);

// Get draft (returns existing draft or creates snapshot from published state)
router.get(
  '/:targetType/:targetId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { targetType, targetId } = req.params;

    const result = await DraftService.getOrCreateSnapshot(
      targetType,
      targetId
    );

    res.json({
      success: true,
      data: {
        draftData: result.draftData,
        hasDraft: result.isExisting,
      },
    });
  })
);

// Save (create or update) draft
router.put(
  '/:targetType/:targetId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { targetType, targetId } = req.params;
    const userId = req.user?.id;

    const result = await DraftService.saveDraft(
      targetType,
      targetId,
      undefined,
      req.body,
      userId!
    );

    res.json({ success: true, data: { draft: result } });
  })
);

// Publish draft
router.post(
  '/:targetType/:targetId/publish',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { targetType, targetId } = req.params;
    const userId = req.user?.id;

    const result = await DraftService.publishDraft(
      targetType,
      targetId,
      undefined,
      userId!
    );

    res.json({ success: true, data: result });
  })
);

// Discard draft
router.post(
  '/:targetType/:targetId/discard',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { targetType, targetId } = req.params;
    const userId = req.user?.id;

    await DraftService.discardDraft(
      targetType,
      targetId,
      undefined,
      userId!
    );

    res.json({ success: true, message: 'Draft discarded successfully' });
  })
);

export default router;
