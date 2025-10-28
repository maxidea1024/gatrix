import { Response } from 'express';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import RewardTemplateService from '../services/RewardTemplateService';

export class RewardTemplateController {
  /**
   * Get all reward templates
   * GET /api/v1/admin/reward-templates
   */
  static getRewardTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, search } = req.query;

    const result = await RewardTemplateService.getRewardTemplates({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
    });

    res.json({
      success: true,
      data: result,
      message: 'Reward templates retrieved successfully',
    });
  });

  /**
   * Get reward template by ID
   * GET /api/v1/admin/reward-templates/:id
   */
  static getRewardTemplateById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new CustomError('Reward template ID is required', 400);
    }

    const template = await RewardTemplateService.getRewardTemplateById(id);

    res.json({
      success: true,
      data: { template },
      message: 'Reward template retrieved successfully',
    });
  });

  /**
   * Create a new reward template
   * POST /api/v1/admin/reward-templates
   */
  static createRewardTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const authenticatedUserId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;

    if (!authenticatedUserId) {
      throw new CustomError('User authentication required', 401);
    }

    const { name, description, rewardItems, tags } = req.body;

    // Validate template name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new CustomError('Template name is required and must be a non-empty string', 400);
    }

    // Validate reward items array
    if (!rewardItems || !Array.isArray(rewardItems) || rewardItems.length === 0) {
      throw new CustomError('At least one reward item is required', 400);
    }

    // Validate each reward item
    for (let i = 0; i < rewardItems.length; i++) {
      const reward = rewardItems[i];

      if (!reward.rewardType || typeof reward.rewardType !== 'string' || reward.rewardType.trim().length === 0) {
        throw new CustomError(`Reward item #${i + 1}: rewardType is required and must be a non-empty string`, 400);
      }

      if (!reward.itemId || typeof reward.itemId !== 'string' || reward.itemId.trim().length === 0) {
        throw new CustomError(`Reward item #${i + 1}: itemId is required and must be a non-empty string`, 400);
      }

      if (!reward.quantity || typeof reward.quantity !== 'number' || reward.quantity < 1) {
        throw new CustomError(`Reward item #${i + 1}: quantity is required and must be a number greater than or equal to 1`, 400);
      }
    }

    const template = await RewardTemplateService.createRewardTemplate({
      name: name.trim(),
      description: description ? description.trim() : undefined,
      rewardItems,
      tags,
      createdBy: authenticatedUserId,
    });

    res.status(201).json({
      success: true,
      data: { template },
      message: 'Reward template created successfully',
    });
  });

  /**
   * Update a reward template
   * PUT /api/v1/admin/reward-templates/:id
   */
  static updateRewardTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const authenticatedUserId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;

    if (!id) {
      throw new CustomError('Reward template ID is required', 400);
    }

    if (!authenticatedUserId) {
      throw new CustomError('User authentication required', 401);
    }

    const { name, description, rewardItems, tags } = req.body;

    // Validate template name if provided
    if (name !== undefined && (!name || typeof name !== 'string' || name.trim().length === 0)) {
      throw new CustomError('Template name must be a non-empty string', 400);
    }

    // Validate reward items array if provided
    if (rewardItems !== undefined) {
      if (!Array.isArray(rewardItems) || rewardItems.length === 0) {
        throw new CustomError('At least one reward item is required', 400);
      }

      // Validate each reward item
      for (let i = 0; i < rewardItems.length; i++) {
        const reward = rewardItems[i];

        if (!reward.rewardType || typeof reward.rewardType !== 'string' || reward.rewardType.trim().length === 0) {
          throw new CustomError(`Reward item #${i + 1}: rewardType is required and must be a non-empty string`, 400);
        }

        if (!reward.itemId || typeof reward.itemId !== 'string' || reward.itemId.trim().length === 0) {
          throw new CustomError(`Reward item #${i + 1}: itemId is required and must be a non-empty string`, 400);
        }

        if (!reward.quantity || typeof reward.quantity !== 'number' || reward.quantity < 1) {
          throw new CustomError(`Reward item #${i + 1}: quantity is required and must be a number greater than or equal to 1`, 400);
        }
      }
    }

    const template = await RewardTemplateService.updateRewardTemplate(id, {
      name: name ? name.trim() : undefined,
      description: description ? description.trim() : undefined,
      rewardItems,
      tags,
      updatedBy: authenticatedUserId,
    });

    res.json({
      success: true,
      data: { template },
      message: 'Reward template updated successfully',
    });
  });

  /**
   * Check references for a reward template
   * GET /api/v1/admin/reward-templates/:id/references
   */
  static checkReferences = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new CustomError('Reward template ID is required', 400);
    }

    const references = await RewardTemplateService.checkReferences(id);

    res.json({
      success: true,
      data: references,
      message: 'References checked successfully',
    });
  });

  /**
   * Delete a reward template
   * DELETE /api/v1/admin/reward-templates/:id
   */
  static deleteRewardTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new CustomError('Reward template ID is required', 400);
    }

    await RewardTemplateService.deleteRewardTemplate(id);

    res.json({
      success: true,
      message: 'Reward template deleted successfully',
    });
  });
}

export default RewardTemplateController;

