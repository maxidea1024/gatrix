import { Request, Response } from 'express';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { ClientCrash } from '../models/ClientCrash';
import { CrashInstance } from '../models/CrashInstance';
import { CrashFilters, CrashState, Platform, Branch, MarketType, ServerGroup } from '../types/crash';
import logger from '../config/logger';

export class CrashController {
  /**
   * Get crashes with filtering and pagination
   * GET /admin/crashes
   */
  static getCrashes = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

    const filters: CrashFilters = {
      search: req.query.search as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      serverGroup: req.query.serverGroup as ServerGroup,
      marketType: req.query.marketType as MarketType,
      deviceType: req.query.deviceType ? parseInt(req.query.deviceType as string) as Platform : undefined,
      branch: req.query.branch ? parseInt(req.query.branch as string) as Branch : undefined,
      majorVer: req.query.majorVer ? parseInt(req.query.majorVer as string) : undefined,
      minorVer: req.query.minorVer ? parseInt(req.query.minorVer as string) : undefined,
      buildNum: req.query.buildNum ? parseInt(req.query.buildNum as string) : undefined,
      patchNum: req.query.patchNum ? parseInt(req.query.patchNum as string) : undefined,
      state: req.query.state !== undefined ? parseInt(req.query.state as string) as CrashState : undefined
    };

    try {
      const result = await ClientCrash.findAll(page, limit, filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error fetching crashes:', error);
      throw new CustomError('Failed to fetch crashes', 500);
    }
  });

  /**
   * Get crash details with instances
   * GET /admin/crashes/:id
   */
  static getCrashDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const crashId = parseInt(req.params.id);

    if (isNaN(crashId)) {
      throw new CustomError('Invalid crash ID', 400);
    }

    try {
      const crash = await ClientCrash.findByIdWithInstances(crashId);

      if (!crash) {
        throw new CustomError('Crash not found', 404);
      }

      res.json({
        success: true,
        data: crash
      });
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error fetching crash detail:', error);
      throw new CustomError('Failed to fetch crash detail', 500);
    }
  });

  /**
   * Get crash instances with pagination
   * GET /admin/crashes/:id/instances
   */
  static getCrashInstances = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const crashId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

    if (isNaN(crashId)) {
      throw new CustomError('Invalid crash ID', 400);
    }

    try {
      const result = await CrashInstance.findByCrashId(crashId, page, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error fetching crash instances:', error);
      throw new CustomError('Failed to fetch crash instances', 500);
    }
  });

  /**
   * Update crash state
   * PATCH /admin/crashes/:id/state
   */
  static updateCrashState = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const crashId = parseInt(req.params.id);
    const { state } = req.body;

    if (isNaN(crashId)) {
      throw new CustomError('Invalid crash ID', 400);
    }

    if (state === undefined || ![CrashState.OPEN, CrashState.CLOSED, CrashState.DELETED].includes(state)) {
      throw new CustomError('Invalid state value', 400);
    }

    try {
      const crash = await ClientCrash.query().findById(crashId);

      if (!crash) {
        throw new CustomError('Crash not found', 404);
      }

      await crash.updateState(state);

      res.json({
        success: true,
        message: 'Crash state updated successfully'
      });
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error updating crash state:', error);
      throw new CustomError('Failed to update crash state', 500);
    }
  });

  /**
   * Get crash statistics
   * GET /admin/crashes/:id/stats
   */
  static getCrashStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const crashId = parseInt(req.params.id);

    if (isNaN(crashId)) {
      throw new CustomError('Invalid crash ID', 400);
    }

    try {
      const [versionStats, platformStats, userStats, latestInstances] = await Promise.all([
        CrashInstance.getVersionStats(crashId),
        CrashInstance.getPlatformStats(crashId),
        CrashInstance.getUserStats(crashId),
        CrashInstance.getLatestInstances(crashId, 10)
      ]);

      res.json({
        success: true,
        data: {
          versionStats,
          platformStats,
          userStats,
          latestInstances
        }
      });
    } catch (error) {
      logger.error('Error fetching crash statistics:', error);
      throw new CustomError('Failed to fetch crash statistics', 500);
    }
  });

  /**
   * Get crash summary statistics
   * GET /admin/crashes/summary
   */
  static getCrashSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const [
        totalCrashes,
        openCrashes,
        closedCrashes,
        recentCrashes
      ] = await Promise.all([
        ClientCrash.query().count('id as count').first(),
        ClientCrash.query().where('state', CrashState.OPEN).count('id as count').first(),
        ClientCrash.query().where('state', CrashState.CLOSED).count('id as count').first(),
        ClientCrash.query()
          .where('last_occurred_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
          .count('id as count')
          .first()
      ]);

      res.json({
        success: true,
        data: {
          total: (totalCrashes as any)?.count || 0,
          open: (openCrashes as any)?.count || 0,
          closed: (closedCrashes as any)?.count || 0,
          recent: (recentCrashes as any)?.count || 0
        }
      });
    } catch (error) {
      logger.error('Error fetching crash summary:', error);
      throw new CustomError('Failed to fetch crash summary', 500);
    }
  });

  /**
   * Get filter options for dropdowns
   * GET /admin/crashes/filter-options
   */
  static getFilterOptions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get available branches, platforms, and versions from existing data
      const [branches, platforms, versions] = await Promise.all([
        ClientCrash.query().distinct('branch').orderBy('branch'),
        CrashInstance.query().distinct('platform').orderBy('platform'),
        CrashInstance.query()
          .select('majorVer', 'minorVer', 'buildNum', 'patchNum')
          .groupBy('majorVer', 'minorVer', 'buildNum', 'patchNum')
          .orderBy(['majorVer', 'minorVer', 'buildNum', 'patchNum'])
          .limit(50) // Limit to prevent too many options
      ]);

      res.json({
        success: true,
        data: {
          branches: branches.map(b => b.branch),
          platforms: platforms.map(p => p.platform),
          versions: versions.map(v => ({
            label: v.version,
            value: v.version
          })),
          serverGroups: Object.values(ServerGroup),
          marketTypes: Object.values(MarketType),
          states: [
            { value: CrashState.OPEN, label: 'Open' },
            { value: CrashState.CLOSED, label: 'Closed' },
            { value: CrashState.DELETED, label: 'Deleted' }
          ]
        }
      });
    } catch (error) {
      logger.error('Error fetching filter options:', error);
      throw new CustomError('Failed to fetch filter options', 500);
    }
  });
}
