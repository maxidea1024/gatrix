import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, GatrixError } from '../middleware/errorHandler';
import { PlanningDataService } from '../services/PlanningDataService';
import { pubSubService } from '../services/PubSubService';
import logger from '../config/logger';
import { getDefaultEnvironmentId } from '../utils/environmentContext';

// Helper to get environment ID from request
function getEnvironmentId(req: AuthenticatedRequest): string {
  const envId = (req as any).environmentId;
  if (!envId) {
    return getDefaultEnvironmentId();
  }
  return envId;
}

// Helper to map language codes
function mapLanguage(lang: string | undefined): 'kr' | 'en' | 'zh' {
  const languageMap: Record<string, 'kr' | 'en' | 'zh'> = {
    'ko': 'kr',
    'kr': 'kr',
    'en': 'en',
    'zh': 'zh',
    'cn': 'zh',
  };
  return languageMap[(lang as string) || 'kr'] || 'kr';
}

export class PlanningDataController {
  /**
   * Get reward lookup data
   * GET /api/v1/admin/planning-data/reward-lookup?lang=kr|en|zh
   */
  static getRewardLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = getEnvironmentId(req);
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getRewardLookup(environmentId, language);

    res.json({
      success: true,
      data,
      message: 'Reward lookup data retrieved successfully',
    });
  });

  /**
   * Get reward type list
   * GET /api/v1/admin/planning-data/reward-types
   */
  static getRewardTypeList = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = getEnvironmentId(req);
    const data = await PlanningDataService.getRewardTypeList(environmentId);

    res.json({
      success: true,
      data,
      message: 'Reward type list retrieved successfully',
    });
  });

  /**
   * Get items for a specific reward type
   * GET /api/v1/admin/planning-data/reward-types/:rewardType/items?lang=kr|en|zh
   */
  static getRewardTypeItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = getEnvironmentId(req);
    const { rewardType } = req.params;
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getRewardTypeItems(environmentId, parseInt(rewardType), language);

    res.json({
      success: true,
      data,
      message: 'Reward type items retrieved successfully',
    });
  });

  /**
   * Get UI list data (nations, towns, villages)
   * GET /api/v1/admin/planning-data/ui-list?lang=kr|en|zh
   */
  static getUIListData = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = getEnvironmentId(req);
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getUIListData(environmentId, language);

    res.json({
      success: true,
      data,
      message: 'UI list data retrieved successfully',
    });
  });

  /**
   * Get items for a specific UI list category
   * GET /api/v1/admin/planning-data/ui-list/:category/items?lang=kr|en|zh
   */
  static getUIListItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = getEnvironmentId(req);
    const { category } = req.params;
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getUIListItems(environmentId, category, language);

    res.json({
      success: true,
      data,
      message: `UI list items for ${category} retrieved successfully`,
    });
  });

  /**
   * Get planning data statistics
   * GET /api/v1/admin/planning-data/stats
   */
  static getStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = getEnvironmentId(req);
    const stats = await PlanningDataService.getStats(environmentId);

    res.json({
      success: true,
      data: stats,
      message: 'Planning data statistics retrieved successfully',
    });
  });

  /**
   * Get HotTimeBuff lookup data
   * GET /api/v1/admin/planning-data/hottimebuff?lang=kr|en|zh
   */
  static getHotTimeBuffLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = getEnvironmentId(req);
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getHotTimeBuffLookup(environmentId, language);

    res.json({
      success: true,
      data,
      message: 'HotTimeBuff lookup data retrieved successfully',
    });
  });

  /**
   * Get EventPage lookup data
   * GET /api/v1/admin/planning-data/eventpage?lang=kr|en|zh
   */
  static getEventPageLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = getEnvironmentId(req);
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getEventPageLookup(environmentId, language);
    res.json({ success: true, data, message: 'EventPage lookup data retrieved successfully' });
  });

  /**
   * Get LiveEvent lookup data
   * GET /api/v1/admin/planning-data/liveevent?lang=kr|en|zh
   */
  static getLiveEventLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = getEnvironmentId(req);
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getLiveEventLookup(environmentId, language);
    res.json({ success: true, data, message: 'LiveEvent lookup data retrieved successfully' });
  });

  /**
   * Get MateRecruitingGroup lookup data
   * GET /api/v1/admin/planning-data/materecruiting?lang=kr|en|zh
   */
  static getMateRecruitingGroupLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = getEnvironmentId(req);
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getMateRecruitingGroupLookup(environmentId, language);
    res.json({ success: true, data, message: 'MateRecruitingGroup lookup data retrieved successfully' });
  });

  /**
   * Get OceanNpcAreaSpawner lookup data
   * GET /api/v1/admin/planning-data/oceannpcarea?lang=kr|en|zh
   */
  static getOceanNpcAreaSpawnerLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = getEnvironmentId(req);
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getOceanNpcAreaSpawnerLookup(environmentId, language);
    res.json({ success: true, data, message: 'OceanNpcAreaSpawner lookup data retrieved successfully' });
  });

  /**
   * Upload planning data files (drag & drop)
   * POST /api/v1/admin/planning-data/upload
   */
  static uploadPlanningData = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environmentId = getEnvironmentId(req);

    logger.info('Planning data upload requested', {
      userId: (req as any).userDetails?.id ?? (req as any).user?.id,
      filesCount: req.files ? Object.keys(req.files).length : 0,
      environmentId,
    });

    const result = await PlanningDataService.uploadPlanningData(environmentId, req.files as any);

    // Invalidate cache across all servers
    await pubSubService.invalidateByPattern('planning_data*');

    logger.info('Planning data cache invalidated across all servers', { environmentId });

    // Notify all clients via SSE about planning data update
    const { SSENotificationService } = await import('../services/sseNotificationService');
    const sseService = SSENotificationService.getInstance();
    sseService.sendNotification({
      type: 'planning_data_updated',
      data: {
        filesUploaded: result.filesUploaded,
        environmentId,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
      targetChannels: ['admin'],
    });

    res.json({
      success: true,
      data: result,
      message: 'Planning data uploaded and cache invalidated successfully',
    });
  });
}

