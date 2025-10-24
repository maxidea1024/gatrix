import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { PlanningDataService } from '../services/PlanningDataService';
import { pubSubService } from '../services/PubSubService';
import logger from '../config/logger';

export class PlanningDataController {
  /**
   * Get reward lookup data
   * GET /api/v1/admin/planning-data/reward-lookup
   */
  static getRewardLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await PlanningDataService.getRewardLookup();

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
    const data = await PlanningDataService.getRewardTypeList();

    res.json({
      success: true,
      data,
      message: 'Reward type list retrieved successfully',
    });
  });

  /**
   * Get items for a specific reward type
   * GET /api/v1/admin/planning-data/reward-types/:rewardType/items?lang=kr|en|cn
   */
  static getRewardTypeItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { rewardType } = req.params;
    const { lang } = req.query;

    // Default to Korean if no language specified
    const language = (lang as string) || 'kr';

    const data = await PlanningDataService.getRewardTypeItems(parseInt(rewardType), language as 'kr' | 'en' | 'cn');

    res.json({
      success: true,
      data,
      message: 'Reward type items retrieved successfully',
    });
  });

  /**
   * Rebuild reward lookup data
   * POST /api/v1/admin/planning-data/rebuild
   */
  static rebuildRewardLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    logger.info('Reward lookup rebuild requested', {
      userId: (req as any).userDetails?.id ?? (req as any).user?.id,
    });

    const result = await PlanningDataService.rebuildRewardLookup();

    // Invalidate cache across all servers
    await pubSubService.invalidateByPattern('planning_data*');
    
    logger.info('Planning data cache invalidated across all servers');

    res.json({
      success: true,
      data: result,
      message: 'Reward lookup data rebuilt and cache invalidated successfully',
    });
  });

  /**
   * Get localization data
   * GET /api/v1/admin/planning-data/localization/:language
   */
  static getLocalization = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { language } = req.params;

    if (!['kr', 'us', 'cn'].includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid language. Must be kr, us, or cn',
      });
    }

    const data = await PlanningDataService.getLocalization(language as 'kr' | 'us' | 'cn');

    res.json({
      success: true,
      data,
      message: `Localization data for ${language} retrieved successfully`,
    });
  });

  /**
   * Get UI list data (nations, towns, villages)
   * GET /api/v1/admin/planning-data/ui-list
   */
  static getUIListData = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await PlanningDataService.getUIListData();

    res.json({
      success: true,
      data,
      message: 'UI list data retrieved successfully',
    });
  });

  /**
   * Get items for a specific UI list category
   * GET /api/v1/admin/planning-data/ui-list/:category/items?lang=kr|en|cn
   */
  static getUIListItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { category } = req.params;
    const { lang } = req.query;

    // Default to Korean if no language specified
    const language = (lang as string) || 'kr';

    const data = await PlanningDataService.getUIListItems(category, language as 'kr' | 'en' | 'cn');

    res.json({
      success: true,
      data,
      message: `UI list items for ${category} retrieved successfully`,
    });
  });

  /**
   * Get localization table (loctab)
   * GET /api/v1/admin/planning-data/loctab
   */
  static getLoctab = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await PlanningDataService.getLoctab();

    res.json({
      success: true,
      data,
      message: 'Localization table retrieved successfully',
    });
  });

  /**
   * Get planning data statistics
   * GET /api/v1/admin/planning-data/stats
   */
  static getStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await PlanningDataService.getStats();

    res.json({
      success: true,
      data: stats,
      message: 'Planning data statistics retrieved successfully',
    });
  });

  /**
   * Get HotTimeBuff lookup data
   * GET /api/v1/admin/planning-data/hottimebuff
   */
  static getHotTimeBuffLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await PlanningDataService.getHotTimeBuffLookup();

    res.json({
      success: true,
      data,
      message: 'HotTimeBuff lookup data retrieved successfully',
    });
  });

  /**
   * Build HotTimeBuff lookup data
   * POST /api/v1/admin/planning-data/hottimebuff/build
   */
  static buildHotTimeBuffLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    logger.info('HotTimeBuff lookup build requested', {
      userId: (req as any).userDetails?.id ?? (req as any).user?.id,
    });

    const result = await PlanningDataService.buildHotTimeBuffLookup();

    // Invalidate cache across all servers
    await pubSubService.invalidateByPattern('planning_data*');

    logger.info('HotTimeBuff cache invalidated across all servers');

    res.json({
      success: true,
      data: result,
      message: 'HotTimeBuff lookup data built and cache invalidated successfully',
    });
  });

  /**
   * Get EventPage lookup data
   * GET /api/v1/admin/planning-data/eventpage
   */
  static getEventPageLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await PlanningDataService.getEventPageLookup();
    res.json({ success: true, data, message: 'EventPage lookup data retrieved successfully' });
  });

  /**
   * Build EventPage lookup data
   * POST /api/v1/admin/planning-data/eventpage/build
   */
  static buildEventPageLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    logger.info('EventPage lookup build requested', { userId: (req as any).userDetails?.id ?? (req as any).user?.id });
    const result = await PlanningDataService.buildEventPageLookup();
    await pubSubService.invalidateByPattern('planning_data*');
    res.json({ success: true, data: result, message: 'EventPage lookup data built and cache invalidated successfully' });
  });

  /**
   * Get LiveEvent lookup data
   * GET /api/v1/admin/planning-data/liveevent
   */
  static getLiveEventLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await PlanningDataService.getLiveEventLookup();
    res.json({ success: true, data, message: 'LiveEvent lookup data retrieved successfully' });
  });

  /**
   * Build LiveEvent lookup data
   * POST /api/v1/admin/planning-data/liveevent/build
   */
  static buildLiveEventLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    logger.info('LiveEvent lookup build requested', { userId: (req as any).userDetails?.id ?? (req as any).user?.id });
    const result = await PlanningDataService.buildLiveEventLookup();
    await pubSubService.invalidateByPattern('planning_data*');
    res.json({ success: true, data: result, message: 'LiveEvent lookup data built and cache invalidated successfully' });
  });

  /**
   * Get MateRecruitingGroup lookup data
   * GET /api/v1/admin/planning-data/materecruiting
   */
  static getMateRecruitingGroupLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await PlanningDataService.getMateRecruitingGroupLookup();
    res.json({ success: true, data, message: 'MateRecruitingGroup lookup data retrieved successfully' });
  });

  /**
   * Build MateRecruitingGroup lookup data
   * POST /api/v1/admin/planning-data/materecruiting/build
   */
  static buildMateRecruitingGroupLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    logger.info('MateRecruitingGroup lookup build requested', { userId: (req as any).userDetails?.id ?? (req as any).user?.id });
    const result = await PlanningDataService.buildMateRecruitingGroupLookup();
    await pubSubService.invalidateByPattern('planning_data*');
    res.json({ success: true, data: result, message: 'MateRecruitingGroup lookup data built and cache invalidated successfully' });
  });

  /**
   * Get OceanNpcAreaSpawner lookup data
   * GET /api/v1/admin/planning-data/oceannpcarea
   */
  static getOceanNpcAreaSpawnerLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await PlanningDataService.getOceanNpcAreaSpawnerLookup();
    res.json({ success: true, data, message: 'OceanNpcAreaSpawner lookup data retrieved successfully' });
  });

  /**
   * Build OceanNpcAreaSpawner lookup data
   * POST /api/v1/admin/planning-data/oceannpcarea/build
   */
  static buildOceanNpcAreaSpawnerLookup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    logger.info('OceanNpcAreaSpawner lookup build requested', { userId: (req as any).userDetails?.id ?? (req as any).user?.id });
    const result = await PlanningDataService.buildOceanNpcAreaSpawnerLookup();
    await pubSubService.invalidateByPattern('planning_data*');
    res.json({ success: true, data: result, message: 'OceanNpcAreaSpawner lookup data built and cache invalidated successfully' });
  });
}

