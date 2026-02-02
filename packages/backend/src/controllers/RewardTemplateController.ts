import { Response } from "express";
import { asyncHandler, GatrixError } from "../middleware/errorHandler";
import { AuthenticatedRequest } from "../types/auth";
import RewardTemplateService from "../services/RewardTemplateService";
import { TagService } from "../services/TagService";

export class RewardTemplateController {
  /**
   * Get all reward templates
   * GET /api/v1/admin/reward-templates
   */
  static getRewardTemplates = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { page, limit, search, sortBy, sortOrder } = req.query;
      const environment = req.environment;

      if (!environment) {
        throw new GatrixError("Environment is required", 400);
      }

      const result = await RewardTemplateService.getRewardTemplates({
        environment,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: (sortOrder as string)?.toLowerCase() as "asc" | "desc",
      });

      res.json({
        success: true,
        data: result,
        message: "Reward templates retrieved successfully",
      });
    },
  );

  /**
   * Get reward template by ID
   * GET /api/v1/admin/reward-templates/:id
   */
  static getRewardTemplateById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const environment = req.environment;

      if (!id) {
        throw new GatrixError("Reward template ID is required", 400);
      }

      if (!environment) {
        throw new GatrixError("Environment is required", 400);
      }

      const template = await RewardTemplateService.getRewardTemplateById(
        id,
        environment,
      );

      res.json({
        success: true,
        data: { template },
        message: "Reward template retrieved successfully",
      });
    },
  );

  /**
   * Create a new reward template
   * POST /api/v1/admin/reward-templates
   */
  static createRewardTemplate = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const authenticatedUserId = req.user?.userId;
      const environment = req.environment;

      if (!authenticatedUserId) {
        throw new GatrixError("User authentication required", 401);
      }

      if (!environment) {
        throw new GatrixError("Environment is required", 400);
      }

      const { name, description, rewardItems, tagIds } = req.body;

      // Validate template name
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        throw new GatrixError(
          "Template name is required and must be a non-empty string",
          400,
        );
      }

      // Validate reward items array
      if (
        !rewardItems ||
        !Array.isArray(rewardItems) ||
        rewardItems.length === 0
      ) {
        throw new GatrixError("At least one reward item is required", 400);
      }

      // Validate each reward item
      for (let i = 0; i < rewardItems.length; i++) {
        const reward = rewardItems[i];

        if (
          !reward.rewardType ||
          typeof reward.rewardType !== "string" ||
          reward.rewardType.trim().length === 0
        ) {
          throw new GatrixError(
            `Reward item #${i + 1}: rewardType is required and must be a non-empty string`,
            400,
          );
        }

        if (
          !reward.itemId ||
          typeof reward.itemId !== "string" ||
          reward.itemId.trim().length === 0
        ) {
          throw new GatrixError(
            `Reward item #${i + 1}: itemId is required and must be a non-empty string`,
            400,
          );
        }

        if (
          !reward.quantity ||
          typeof reward.quantity !== "number" ||
          reward.quantity < 1
        ) {
          throw new GatrixError(
            `Reward item #${i + 1}: quantity is required and must be a number greater than or equal to 1`,
            400,
          );
        }
      }

      const template = await RewardTemplateService.createRewardTemplate(
        {
          name: name.trim(),
          description: description ? description.trim() : undefined,
          rewardItems,
          createdBy: authenticatedUserId,
        },
        environment,
      );

      // Set tags for the template
      if (Array.isArray(tagIds) && tagIds.length > 0) {
        await TagService.setTagsForEntity(
          "reward_template",
          template.id,
          tagIds.map(Number),
          authenticatedUserId,
        );
      }

      // Load tags for response
      const tags = await TagService.listTagsForEntity(
        "reward_template",
        template.id,
      );

      res.status(201).json({
        success: true,
        data: { template: { ...template, tags } },
        message: "Reward template created successfully",
      });
    },
  );

  /**
   * Update a reward template
   * PUT /api/v1/admin/reward-templates/:id
   */
  static updateRewardTemplate = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const authenticatedUserId = req.user?.userId;
      const environment = req.environment;

      if (!id) {
        throw new GatrixError("Reward template ID is required", 400);
      }

      if (!authenticatedUserId) {
        throw new GatrixError("User authentication required", 401);
      }

      if (!environment) {
        throw new GatrixError("Environment is required", 400);
      }

      const { name, description, rewardItems, tagIds } = req.body;

      // Validate template name if provided
      if (
        name !== undefined &&
        (!name || typeof name !== "string" || name.trim().length === 0)
      ) {
        throw new GatrixError("Template name must be a non-empty string", 400);
      }

      // Validate reward items array if provided
      if (rewardItems !== undefined) {
        if (!Array.isArray(rewardItems) || rewardItems.length === 0) {
          throw new GatrixError("At least one reward item is required", 400);
        }

        // Validate each reward item
        for (let i = 0; i < rewardItems.length; i++) {
          const reward = rewardItems[i];

          if (
            !reward.rewardType ||
            typeof reward.rewardType !== "string" ||
            reward.rewardType.trim().length === 0
          ) {
            throw new GatrixError(
              `Reward item #${i + 1}: rewardType is required and must be a non-empty string`,
              400,
            );
          }

          if (
            !reward.itemId ||
            typeof reward.itemId !== "string" ||
            reward.itemId.trim().length === 0
          ) {
            throw new GatrixError(
              `Reward item #${i + 1}: itemId is required and must be a non-empty string`,
              400,
            );
          }

          if (
            !reward.quantity ||
            typeof reward.quantity !== "number" ||
            reward.quantity < 1
          ) {
            throw new GatrixError(
              `Reward item #${i + 1}: quantity is required and must be a number greater than or equal to 1`,
              400,
            );
          }
        }
      }

      const template = await RewardTemplateService.updateRewardTemplate(
        id,
        {
          name: name ? name.trim() : undefined,
          description: description ? description.trim() : undefined,
          rewardItems,
          updatedBy: authenticatedUserId,
        },
        environment,
      );

      // Set tags for the template
      if (Array.isArray(tagIds)) {
        await TagService.setTagsForEntity(
          "reward_template",
          template.id,
          tagIds.map(Number),
          authenticatedUserId,
        );
      }

      // Load tags for response
      const tags = await TagService.listTagsForEntity(
        "reward_template",
        template.id,
      );

      res.json({
        success: true,
        data: { template: { ...template, tags } },
        message: "Reward template updated successfully",
      });
    },
  );

  /**
   * Check references for a reward template
   * GET /api/v1/admin/reward-templates/:id/references
   */
  static checkReferences = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const environment = req.environment;

      if (!id) {
        throw new GatrixError("Reward template ID is required", 400);
      }

      if (!environment) {
        throw new GatrixError("Environment is required", 400);
      }

      const references = await RewardTemplateService.checkReferences(
        id,
        environment,
      );

      res.json({
        success: true,
        data: references,
        message: "References checked successfully",
      });
    },
  );

  /**
   * Delete a reward template
   * DELETE /api/v1/admin/reward-templates/:id
   */
  static deleteRewardTemplate = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const environment = req.environment;

      if (!id) {
        throw new GatrixError("Reward template ID is required", 400);
      }

      if (!environment) {
        throw new GatrixError("Environment is required", 400);
      }

      await RewardTemplateService.deleteRewardTemplate(id, environment);

      res.json({
        success: true,
        message: "Reward template deleted successfully",
      });
    },
  );
}

export default RewardTemplateController;
