import { Response } from 'express';
import { SurveyService } from '../services/SurveyService';
import { asyncHandler } from '../middleware/errorHandler';
import { GatrixError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types/auth';
import { pubSubService } from '../services/PubSubService';
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from '../constants/cacheKeys';
import { respondWithEtagCache } from '../utils/serverSdkEtagCache';
import RewardTemplateService from '../services/RewardTemplateService';
import { EnvironmentRequest } from '../middleware/environmentResolver';
import { UnifiedChangeGateway } from '../services/UnifiedChangeGateway';
import logger from '../config/logger';

interface ServerReward {
  type: number;
  id: number;
  quantity: number;
}

function normalizeParticipationRewards(rawItems: any[] | null | undefined): ServerReward[] | null {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return null;
  }

  return rawItems.map((item: any) => ({
    type: Number(item.rewardType ?? item.type ?? 0),
    id: Number(item.itemId ?? item.id ?? 0),
    quantity: Number(item.quantity ?? 0),
  }));
}

async function buildParticipationRewardsForServerSurvey(
  survey: any,
  environment: string
): Promise<ServerReward[] | null> {
  if (Array.isArray(survey.participationRewards) && survey.participationRewards.length > 0) {
    return normalizeParticipationRewards(survey.participationRewards);
  }

  if (survey.rewardTemplateId) {
    const template = await RewardTemplateService.getRewardTemplateById(
      survey.rewardTemplateId,
      environment
    );
    return normalizeParticipationRewards(template.rewardItems);
  }

  return null;
}

export class SurveyController {
  /**
   * Get all surveys
   * GET /api/v1/admin/surveys
   */
  static getSurveys = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, isActive, search } = req.query;
    const environment = req.environment;

    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const result = await SurveyService.getSurveys({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search: search as string,
      environment,
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
    const environment = req.environment;

    if (!id) {
      throw new GatrixError('Survey ID is required', 400);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const survey = await SurveyService.getSurveyById(id, environment);

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
    const environment = req.environment;

    if (!platformSurveyId) {
      throw new GatrixError('Platform survey ID is required', 400);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const survey = await SurveyService.getSurveyByPlatformId(platformSurveyId, environment);

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
    const authenticatedUserId =
      (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    const environment = req.environment;

    if (!authenticatedUserId) {
      throw new GatrixError('User authentication required', 401);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const surveyData = {
      ...req.body,
      createdBy: authenticatedUserId,
      environment,
    };

    const result = await UnifiedChangeGateway.requestCreation(
      authenticatedUserId,
      environment,
      'g_surveys',
      { ...req.body },
      async () => {
        const survey = await SurveyService.createSurvey(surveyData);

        // Publish event for SDK real-time updates
        await pubSubService.publishNotification({
          type: 'survey.created',
          data: { survey },
          targetChannels: ['survey', 'admin'],
        });

        await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.SURVEYS}:${environment}`);
        return survey;
      }
    );

    res.status(result.mode === 'CHANGE_REQUEST' ? 202 : 201).json({
      success: true,
      data:
        result.mode === 'CHANGE_REQUEST'
          ? { changeRequestId: result.changeRequestId }
          : { survey: result.data },
      message:
        result.mode === 'CHANGE_REQUEST'
          ? 'Survey creation requested'
          : 'Survey created successfully',
    });
  });

  /**
   * Update a survey
   * PUT /api/v1/admin/surveys/:id
   */
  static updateSurvey = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const authenticatedUserId =
      (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    const environment = req.environment;

    if (!id) {
      throw new GatrixError('Survey ID is required', 400);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const updateData = {
      ...req.body,
      updatedBy: authenticatedUserId,
    };

    const result = await UnifiedChangeGateway.processChange(
      authenticatedUserId,
      environment,
      'g_surveys',
      id,
      { ...req.body },
      async (processedData: any) => {
        const survey = await SurveyService.updateSurvey(
          id,
          { ...processedData, updatedBy: authenticatedUserId },
          environment
        );

        // Publish event for SDK real-time updates
        await pubSubService.publishNotification({
          type: 'survey.updated',
          data: { survey },
          targetChannels: ['survey', 'admin'],
        });

        await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.SURVEYS}:${environment}`);

        return { survey };
      }
    );

    if (result.mode === 'DIRECT') {
      res.json({
        success: true,
        data: result.data,
        message: 'Survey updated successfully',
      });
    } else {
      res.status(202).json({
        success: true,
        data: { changeRequestId: result.changeRequestId },
        message: 'Survey update requested',
      });
    }
  });

  /**
   * Delete a survey
   * DELETE /api/v1/admin/surveys/:id
   */
  static deleteSurvey = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const environment = req.environment;
    const authenticatedUserId =
      (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    if (!authenticatedUserId) throw new GatrixError('User authentication required', 401);

    if (!id) throw new GatrixError('Survey ID is required', 400);
    if (!environment) throw new GatrixError('Environment is required', 400);

    const result = await UnifiedChangeGateway.requestDeletion(
      authenticatedUserId,
      environment,
      'g_surveys',
      id,
      async () => {
        await SurveyService.deleteSurvey(id, environment);

        // Publish event for SDK real-time updates
        await pubSubService.publishNotification({
          type: 'survey.deleted',
          data: { surveyId: id },
          targetChannels: ['survey', 'admin'],
        });

        await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.SURVEYS}:${environment}`);
      }
    );

    res.status(result.mode === 'CHANGE_REQUEST' ? 202 : 200).json({
      success: true,
      data: result.mode === 'CHANGE_REQUEST' ? { changeRequestId: result.changeRequestId } : null,
      message:
        result.mode === 'CHANGE_REQUEST'
          ? 'Survey deletion requested'
          : 'Survey deleted successfully',
    });
  });

  /**
   * Toggle survey active status
   * PATCH /api/v1/admin/surveys/:id/toggle-active
   */
  static toggleActive = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const authenticatedUserId =
      (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    const environment = req.environment;

    if (!id) {
      throw new GatrixError('Survey ID is required', 400);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const result = await UnifiedChangeGateway.processChange(
      authenticatedUserId,
      environment,
      'g_surveys',
      id,
      async (currentSurvey: any) => {
        return { isActive: !currentSurvey.isActive };
      },
      async (processedData: any) => {
        const survey = await SurveyService.updateSurvey(
          id,
          {
            isActive: (processedData as any).isActive,
            updatedBy: authenticatedUserId,
          },
          environment
        );

        await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.SURVEYS}:${environment}`);
        return { survey };
      }
    );

    if (result.mode === 'DIRECT') {
      res.json({
        success: true,
        data: result.data,
        message: `Survey status toggled successfully`,
      });
    } else {
      res.status(202).json({
        success: true,
        data: { changeRequestId: result.changeRequestId },
        message: 'Survey status change requested',
      });
    }
  });

  /**
   * Get survey configuration
   * GET /api/v1/admin/surveys/config
   */
  static getSurveyConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = req.environment;
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }
    const config = await SurveyService.getSurveyConfig(environment);

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
    const environment = req.environment;
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }
    const config = await SurveyService.updateSurveyConfig(req.body, environment);

    await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.SURVEY_SETTINGS}:${environment}`);
    await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.SURVEYS}:${environment}`);

    res.json({
      success: true,
      data: { config },
      message: 'Survey configuration updated successfully',
    });
  });

  /**
   * Get survey settings for Server SDK
   * GET /api/v1/server/:env/surveys/settings
   * Returns only the survey configuration settings
   */
  static getServerSurveySettings = asyncHandler(async (req: EnvironmentRequest, res: Response) => {
    const environment = req.environment!;
    await respondWithEtagCache(res, {
      cacheKey: `${SERVER_SDK_ETAG.SURVEY_SETTINGS}:${environment}`,
      ttlMs: DEFAULT_CONFIG.SURVEY_SETTINGS_TTL,
      requestEtag: req.headers['if-none-match'],
      buildPayload: async () => {
        const config = await SurveyService.getSurveyConfig(environment);

        const settings = {
          defaultSurveyUrl: config.baseSurveyUrl,
          completionUrl: config.baseJoinedUrl,
          linkCaption: config.linkCaption,
          verificationKey: config.joinedSecretKey,
        };

        return {
          success: true,
          data: { settings },
        };
      },
    });
  });

  /**
   * Get active surveys for Server SDK
   * GET /api/v1/server/:env/surveys
   * Returns surveys with common settings
   */
  static getServerSurveys = asyncHandler(async (req: EnvironmentRequest, res: Response) => {
    const environment = req.environment!;
    await respondWithEtagCache(res, {
      cacheKey: `${SERVER_SDK_ETAG.SURVEYS}:${environment}`,
      ttlMs: DEFAULT_CONFIG.SURVEYS_TTL,
      requestEtag: req.headers['if-none-match'],
      buildPayload: async () => {
        const result = await SurveyService.getSurveys({
          page: 1,
          limit: 1000,
          isActive: true,
          environment,
        });

        // Get survey configuration
        const config = await SurveyService.getSurveyConfig(environment);

        // Filter out fields not needed by SDK and resolve participation rewards
        const filteredSurveys = await Promise.all(
          result.surveys.map(async (survey: any) => {
            const participationRewards = await buildParticipationRewardsForServerSurvey(
              survey,
              environment
            );

            return {
              id: survey.id,
              platformSurveyId: survey.platformSurveyId,
              surveyTitle: survey.surveyTitle,
              surveyContent: survey.surveyContent,
              triggerConditions: survey.triggerConditions,
              participationRewards,
              rewardMailTitle: survey.rewardMailTitle,
              rewardMailContent: survey.rewardMailContent,
              targetPlatforms: survey.targetPlatforms,
              targetPlatformsInverted: survey.targetPlatformsInverted,
              targetChannels: survey.targetChannels,
              targetChannelsInverted: survey.targetChannelsInverted,
              targetSubchannels: survey.targetSubchannels,
              targetSubchannelsInverted: survey.targetSubchannelsInverted,
              targetWorlds: survey.targetWorlds,
              targetWorldsInverted: survey.targetWorldsInverted,
            };
          })
        );

        return {
          success: true,
          data: {
            surveys: filteredSurveys,
            settings: {
              defaultSurveyUrl: config.baseSurveyUrl,
              completionUrl: config.baseJoinedUrl,
              linkCaption: config.linkCaption,
              verificationKey: config.joinedSecretKey,
            },
          },
        };
      },
    });
  });

  /**
   * Get survey by ID for Server SDK
   * GET /api/v1/server/:env/surveys/:id
   * Returns survey formatted for Server SDK
   */
  static getServerSurveyById = asyncHandler(async (req: EnvironmentRequest, res: Response) => {
    const { id } = req.params;
    const environment = req.environment!;

    if (!id) {
      throw new GatrixError('Survey ID is required', 400);
    }

    const survey: any = await SurveyService.getSurveyById(id, environment);

    // Get survey configuration
    const config = await SurveyService.getSurveyConfig(environment);

    // Resolve participation rewards
    const participationRewards = await buildParticipationRewardsForServerSurvey(
      survey,
      environment
    );

    // Format survey for Server SDK response (same format as getServerSurveys)
    const formattedSurvey = {
      id: survey.id,
      platformSurveyId: survey.platformSurveyId,
      surveyTitle: survey.surveyTitle,
      surveyContent: survey.surveyContent,
      triggerConditions: survey.triggerConditions,
      participationRewards,
      rewardMailTitle: survey.rewardMailTitle,
      rewardMailContent: survey.rewardMailContent,
      targetPlatforms: survey.targetPlatforms,
      targetPlatformsInverted: survey.targetPlatformsInverted,
      targetChannels: survey.targetChannels,
      targetChannelsInverted: survey.targetChannelsInverted,
      targetSubchannels: survey.targetSubchannels,
      targetSubchannelsInverted: survey.targetSubchannelsInverted,
      targetWorlds: survey.targetWorlds,
      targetWorldsInverted: survey.targetWorldsInverted,
    };

    res.json({
      success: true,
      data: {
        survey: formattedSurvey,
        settings: {
          defaultSurveyUrl: config.baseSurveyUrl,
          completionUrl: config.baseJoinedUrl,
          linkCaption: config.linkCaption,
          verificationKey: config.joinedSecretKey,
        },
      },
    });
  });
}

export default SurveyController;
