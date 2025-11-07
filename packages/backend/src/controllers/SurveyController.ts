import { Response } from 'express';
import { SurveyService } from '../services/SurveyService';
import { asyncHandler } from '../middleware/errorHandler';
import { CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types/auth';

export class SurveyController {
  /**
   * Get all surveys
   * GET /api/v1/admin/surveys
   */
  static getSurveys = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, isActive, search } = req.query;

    const result = await SurveyService.getSurveys({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search: search as string,
    });

    res.json({
      success: true,
      data: result,
      message: 'Surveys retrieved successfully',
    });
  });

  /**
   * Get survey by ID
   * GET /api/v1/admin/surveys/:id
   */
  static getSurveyById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new CustomError('Survey ID is required', 400);
    }

    const survey = await SurveyService.getSurveyById(id);

    res.json({
      success: true,
      data: { survey },
      message: 'Survey retrieved successfully',
    });
  });

  /**
   * Get survey by platform survey ID
   * GET /api/v1/admin/surveys/platform/:platformSurveyId
   */
  static getSurveyByPlatformId = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { platformSurveyId } = req.params;

    if (!platformSurveyId) {
      throw new CustomError('Platform survey ID is required', 400);
    }

    const survey = await SurveyService.getSurveyByPlatformId(platformSurveyId);

    res.json({
      success: true,
      data: { survey },
      message: 'Survey retrieved successfully',
    });
  });

  /**
   * Create a new survey
   * POST /api/v1/admin/surveys
   */
  static createSurvey = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const authenticatedUserId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    
    if (!authenticatedUserId) {
      throw new CustomError('User authentication required', 401);
    }

    const surveyData = {
      ...req.body,
      createdBy: authenticatedUserId,
    };

    const survey = await SurveyService.createSurvey(surveyData);

    res.status(201).json({
      success: true,
      data: { survey },
      message: 'Survey created successfully',
    });
  });

  /**
   * Update a survey
   * PUT /api/v1/admin/surveys/:id
   */
  static updateSurvey = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const authenticatedUserId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;

    if (!id) {
      throw new CustomError('Survey ID is required', 400);
    }

    const updateData = {
      ...req.body,
      updatedBy: authenticatedUserId,
    };

    const survey = await SurveyService.updateSurvey(id, updateData);

    res.json({
      success: true,
      data: { survey },
      message: 'Survey updated successfully',
    });
  });

  /**
   * Delete a survey
   * DELETE /api/v1/admin/surveys/:id
   */
  static deleteSurvey = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new CustomError('Survey ID is required', 400);
    }

    await SurveyService.deleteSurvey(id);

    res.json({
      success: true,
      message: 'Survey deleted successfully',
    });
  });

  /**
   * Toggle survey active status
   * PATCH /api/v1/admin/surveys/:id/toggle-active
   */
  static toggleActive = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const authenticatedUserId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;

    if (!id) {
      throw new CustomError('Survey ID is required', 400);
    }

    const currentSurvey = await SurveyService.getSurveyById(id);
    const survey = await SurveyService.updateSurvey(id, {
      isActive: !currentSurvey.isActive,
      updatedBy: authenticatedUserId,
    });

    res.json({
      success: true,
      data: { survey },
      message: `Survey ${survey.isActive ? 'activated' : 'deactivated'} successfully`,
    });
  });

  /**
   * Get survey configuration
   * GET /api/v1/admin/surveys/config
   */
  static getSurveyConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const config = await SurveyService.getSurveyConfig();

    res.json({
      success: true,
      data: { config },
      message: 'Survey configuration retrieved successfully',
    });
  });

  /**
   * Update survey configuration
   * PUT /api/v1/admin/surveys/config
   */
  static updateSurveyConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const config = await SurveyService.updateSurveyConfig(req.body);

    res.json({
      success: true,
      data: { config },
      message: 'Survey configuration updated successfully',
    });
  });

  /**
   * Get active surveys for Server SDK
   * GET /api/v1/server/surveys
   * Returns only active surveys
   */
  static getServerSurveys = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await SurveyService.getSurveys({
      page: 1,
      limit: 1000,
      isActive: true,
    });

    res.json({
      success: true,
      data: result.surveys,
    });
  });
}

