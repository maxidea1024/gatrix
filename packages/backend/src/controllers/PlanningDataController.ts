import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { asyncHandler, GatrixError } from '../middleware/errorHandler';
import { PlanningDataService } from '../services/PlanningDataService';
import { pubSubService } from '../services/PubSubService';
import logger from '../config/logger';

// Helper to get environment from request
function getEnvironment(req: AuthenticatedRequest): string {
  const env = req.environment;
  if (!env) {
    throw new GatrixError('Environment not specified', 400);
  }
  return env;
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
    const environment = getEnvironment(req);
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getRewardLookup(environment, language);

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
    const environment = getEnvironment(req);
    const data = await PlanningDataService.getRewardTypeList(environment);

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
    const environment = getEnvironment(req);
    const { rewardType } = req.params;
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getRewardTypeItems(environment, parseInt(rewardType), language);

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
    const environment = getEnvironment(req);
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getUIListData(environment, language);

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
    const environment = getEnvironment(req);
    const { category } = req.params;
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getUIListItems(environment, category, language);

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
    const environment = getEnvironment(req);
    const stats = await PlanningDataService.getStats(environment);

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
    const environment = getEnvironment(req);
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getHotTimeBuffLookup(environment, language);

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
    const environment = getEnvironment(req);
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getEventPageLookup(environment, language);
    res.json({ success: true, data, message: 'EventPage lookup data retrieved successfully' });
  });

  /**
   * Get LiveEvent lookup data
   * GET /api/v1/admin/planning-data/liveevent?lang=kr|en|zh
   */
  static getLiveEventLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = getEnvironment(req);
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getLiveEventLookup(environment, language);
    res.json({ success: true, data, message: 'LiveEvent lookup data retrieved successfully' });
  });

  /**
   * Get MateRecruitingGroup lookup data
   * GET /api/v1/admin/planning-data/materecruiting?lang=kr|en|zh
   */
  static getMateRecruitingGroupLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = getEnvironment(req);
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getMateRecruitingGroupLookup(environment, language);
    res.json({ success: true, data, message: 'MateRecruitingGroup lookup data retrieved successfully' });
  });

  /**
   * Get OceanNpcAreaSpawner lookup data
   * GET /api/v1/admin/planning-data/oceannpcarea?lang=kr|en|zh
   */
  static getOceanNpcAreaSpawnerLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = getEnvironment(req);
    const language = mapLanguage(req.query.lang as string);

    const data = await PlanningDataService.getOceanNpcAreaSpawnerLookup(environment, language);
    res.json({ success: true, data, message: 'OceanNpcAreaSpawner lookup data retrieved successfully' });
  });

  /**
   * Upload planning data files (drag & drop)
   * POST /api/v1/admin/planning-data/upload
   */
  static uploadPlanningData = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = getEnvironment(req);
    const uploadComment = req.body?.comment || req.query?.comment;

    logger.info('Planning data upload requested', {
      userId: req.user?.userId,
      filesCount: req.files ? Object.keys(req.files).length : 0,
      environment,
    });

    // Determine upload source and uploader info
    const isCliUpload = req.headers['x-application-name'] === 'gatrix-cli';
    const uploaderNameOverride = req.headers['x-uploader-name'] as string | undefined;
    const uploadInfo = {
      uploadedBy: req.user?.userId,
      uploaderName: uploaderNameOverride || req.user?.name || req.user?.email || (req as any).apiToken?.tokenName || 'Unknown',
      uploadSource: (isCliUpload ? 'cli' : 'web') as 'web' | 'cli',
      uploadComment: uploadComment as string | undefined,
    };

    const result = await PlanningDataService.uploadPlanningData(environment, req.files as any, uploadInfo);

    await pubSubService.invalidateByPattern('*planning_data*');

    logger.info('Planning data cache invalidated across all servers', { environment });

    // Notify all clients via SSE about planning data update
    const { SSENotificationService } = await import('../services/sseNotificationService');
    const sseService = SSENotificationService.getInstance();
    sseService.sendNotification({
      type: 'planning_data_updated',
      data: {
        filesUploaded: result.filesUploaded,
        environment,
        timestamp: new Date().toISOString(),
        uploadRecord: result.uploadRecord,
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

  /**
   * Get planning data upload history
   * GET /api/v1/admin/planning-data/history
   */
  static getUploadHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = getEnvironment(req);
    const limit = parseInt(req.query.limit as string) || 20;

    const history = await PlanningDataService.getUploadHistory(environment, limit);

    res.json({
      success: true,
      data: history,
      message: 'Upload history retrieved successfully',
    });
  });

  /**
   * Get latest planning data upload
   * GET /api/v1/admin/planning-data/latest
   */
  static getLatestUpload = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = getEnvironment(req);

    const latestUpload = await PlanningDataService.getLatestUpload(environment);

    res.json({
      success: true,
      data: latestUpload,
      message: latestUpload ? 'Latest upload retrieved successfully' : 'No uploads found',
    });
  });

  /**
   * Reset all upload history
   * DELETE /api/v1/admin/planning-data/history
   */
  static resetUploadHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = getEnvironment(req);

    const deletedCount = await PlanningDataService.resetUploadHistory(environment);

    res.json({
      success: true,
      data: { deletedCount },
      message: 'Upload history reset successfully',
    });
  });

  /**
   * Preview diff before uploading
   * POST /api/v1/admin/planning-data/preview-diff
   */
  static previewDiff = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = getEnvironment(req);

    logger.info('[PlanningData] Preview diff requested', {
      userId: req.user?.userId,
      filesCount: req.files ? Object.keys(req.files).length : 0,
      environment,
    });

    const result = await PlanningDataService.previewDiff(environment, req.files);

    res.json({
      success: true,
      data: result,
      message: result.changedFiles.length > 0
        ? `${result.changedFiles.length} files with changes detected`
        : 'No changes detected',
    });
  });
}
