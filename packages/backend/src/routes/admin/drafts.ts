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
import { registerSegmentDraftHandler } from '../../services/draft-handlers/segment-draft-handler';
registerFeatureFlagDraftHandler();
registerSegmentDraftHandler();

const router = Router();

// List drafts for a target type (with published snapshots for diff)
router.get(
  '/:targetType',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { targetType } = req.params;

    const drafts = await DraftService.listDrafts(targetType);

    // Attach published snapshot and display name for each draft
    const draftsWithPublished = await Promise.all(
      drafts.map(async (draft) => {
        let publishedData = null;
        try {
          publishedData = await DraftService.getPublishedSnapshot(
            targetType,
            draft.targetId
          );
        } catch {
          // New target (create action) — no published state
        }
        let targetDisplayName = await DraftService.getTargetDisplayName(
          targetType,
          draft.targetId
        );
        // Fallback: use name from draft data for create actions
        if (!targetDisplayName && draft.draftData) {
          targetDisplayName =
            draft.draftData.segmentName ||
            draft.draftData.flagName ||
            draft.targetId;
        }
        return { ...draft, publishedData, targetDisplayName };
      })
    );

    res.json({ success: true, data: { drafts: draftsWithPublished } });
  })
);

// Get draft (returns existing draft or creates snapshot from published state)
router.get(
  '/:targetType/:targetId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { targetType, targetId } = req.params;

    const result = await DraftService.getOrCreateSnapshot(targetType, targetId);

    // When a draft exists, also return the published snapshot for diff comparison
    let publishedData: any = null;
    if (result.isExisting) {
      publishedData = await DraftService.getPublishedSnapshot(
        targetType,
        targetId
      );
    }

    res.json({
      success: true,
      data: {
        draftData: result.draftData,
        hasDraft: result.isExisting,
        publishedData,
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

    await DraftService.discardDraft(targetType, targetId, undefined, userId!);

    res.json({ success: true, message: 'Draft discarded successfully' });
  })
);

export default router;
