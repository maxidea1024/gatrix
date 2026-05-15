import { Response } from 'express';
import { SurveyTemplateService } from '../services/survey-template-service';
import { asyncHandler, GatrixError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../types/auth';

import { createLogger } from '../config/logger';
const logger = createLogger('SurveyTemplateController');

export class SurveyTemplateController {
  /**
   * List all survey templates
   * GET /api/v1/admin/survey-templates
   */
  static list = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const environmentId = req.environmentId;
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const { page, limit, isPublished, search } = req.query;

      const result = await SurveyTemplateService.getTemplates({
        environmentId,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        isPublished:
          isPublished !== undefined ? isPublished === 'true' : undefined,
        search: search as string,
      });

      res.json({
        success: true,
        data: result,
        message: 'Survey templates retrieved successfully',
      });
    }
  );

  /**
   * Get a single template
   * GET /api/v1/admin/survey-templates/:id
   */
  static getById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const environmentId = req.environmentId;

      if (!id) throw new GatrixError('Template ID is required', 400);
      if (!environmentId)
        throw new GatrixError('Environment not specified', 400);

      const template = await SurveyTemplateService.getTemplateById(
        id,
        environmentId
      );

      res.json({
        success: true,
        data: { template },
        message: 'Survey template retrieved successfully',
      });
    }
  );

  /**
   * Create a new template
   * POST /api/v1/admin/survey-templates
   */
  static create = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const authenticatedUserId =
        (req as any).userDetails?.id ??
        (req as any).user?.id ??
        (req as any).user?.userId;
      const environmentId = req.environmentId;

      if (!authenticatedUserId) {
        throw new GatrixError('User authentication required', 401);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const template = await SurveyTemplateService.createTemplate({
        ...req.body,
        environmentId,
        createdBy: authenticatedUserId,
      });

      res.status(201).json({
        success: true,
        data: { template },
        message: 'Survey template created successfully',
      });
    }
  );

  /**
   * Update a template
   * PUT /api/v1/admin/survey-templates/:id
   */
  static update = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const authenticatedUserId =
        (req as any).userDetails?.id ??
        (req as any).user?.id ??
        (req as any).user?.userId;
      const environmentId = req.environmentId;

      if (!id) throw new GatrixError('Template ID is required', 400);
      if (!environmentId)
        throw new GatrixError('Environment not specified', 400);

      const template = await SurveyTemplateService.updateTemplate(
        id,
        {
          ...req.body,
          updatedBy: authenticatedUserId,
        },
        environmentId
      );

      res.json({
        success: true,
        data: { template },
        message: 'Survey template updated successfully',
      });
    }
  );

  /**
   * Delete a template
   * DELETE /api/v1/admin/survey-templates/:id
   */
  static remove = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const environmentId = req.environmentId;

      if (!id) throw new GatrixError('Template ID is required', 400);
      if (!environmentId)
        throw new GatrixError('Environment not specified', 400);

      await SurveyTemplateService.deleteTemplate(id, environmentId);

      res.json({
        success: true,
        data: null,
        message: 'Survey template deleted successfully',
      });
    }
  );

  /**
   * Duplicate a template
   * POST /api/v1/admin/survey-templates/:id/duplicate
   */
  static duplicate = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const authenticatedUserId =
        (req as any).userDetails?.id ??
        (req as any).user?.id ??
        (req as any).user?.userId;
      const environmentId = req.environmentId;

      if (!id) throw new GatrixError('Template ID is required', 400);
      if (!environmentId)
        throw new GatrixError('Environment not specified', 400);

      const template = await SurveyTemplateService.duplicateTemplate(
        id,
        environmentId,
        authenticatedUserId
      );

      res.status(201).json({
        success: true,
        data: { template },
        message: 'Survey template duplicated successfully',
      });
    }
  );

  /**
   * Toggle published status
   * PATCH /api/v1/admin/survey-templates/:id/toggle-publish
   */
  static togglePublish = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const authenticatedUserId =
        (req as any).userDetails?.id ??
        (req as any).user?.id ??
        (req as any).user?.userId;
      const environmentId = req.environmentId;

      if (!id) throw new GatrixError('Template ID is required', 400);
      if (!environmentId)
        throw new GatrixError('Environment not specified', 400);

      const existing = await SurveyTemplateService.getTemplateById(
        id,
        environmentId
      );

      const template = await SurveyTemplateService.updateTemplate(
        id,
        {
          isPublished: !existing.isPublished,
          updatedBy: authenticatedUserId,
        },
        environmentId
      );

      res.json({
        success: true,
        data: { template },
        message: `Survey template ${template.isPublished ? 'published' : 'unpublished'} successfully`,
      });
    }
  );

  /**
   * Get responses for a survey
   * GET /api/v1/admin/survey-templates/:id/responses
   */
  static getResponses = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params; // surveyId
      const environmentId = req.environmentId;
      const { page, limit } = req.query;

      if (!id) throw new GatrixError('Survey ID is required', 400);
      if (!environmentId)
        throw new GatrixError('Environment not specified', 400);

      const result = await SurveyTemplateService.getResponses({
        environmentId,
        surveyId: id,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({
        success: true,
        data: result,
        message: 'Survey responses retrieved successfully',
      });
    }
  );

  /**
   * Get response statistics for a survey
   * GET /api/v1/admin/survey-templates/:id/stats
   */
  static getResponseStats = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params; // surveyId
      const environmentId = req.environmentId;

      if (!id) throw new GatrixError('Survey ID is required', 400);
      if (!environmentId)
        throw new GatrixError('Environment not specified', 400);

      const stats = await SurveyTemplateService.getResponseStats(
        id,
        environmentId
      );

      res.json({
        success: true,
        data: stats,
        message: 'Survey response statistics retrieved successfully',
      });
    }
  );
}

export default SurveyTemplateController;
