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
   * GET /api/v1/admin/planning-data/reward-types/:rewardType/items
   */
  static getRewardTypeItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { rewardType } = req.params;
    const data = await PlanningDataService.getRewardTypeItems(parseInt(rewardType));

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
}

