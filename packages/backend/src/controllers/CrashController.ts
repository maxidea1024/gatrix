import { Response } from 'express';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { ClientCrash } from '../models/ClientCrash';
import { CrashEvent } from '../models/CrashEvent';
import { CrashFilters, CrashState } from '../types/crash';
import logger from '../config/logger';
import fs from 'fs/promises';
import path from 'path';

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
      platform: req.query.platform as string,
      environment: req.query.environment as string,
      branch: req.query.branch as string,
      marketType: req.query.marketType as string,
      isEditor: req.query.isEditor !== undefined ? req.query.isEditor === 'true' : undefined,
      state: req.query.state !== undefined ? parseInt(req.query.state as string) as CrashState : undefined,
      assignee: req.query.assignee as string,
      appVersion: req.query.appVersion as string
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
   * Get crash details with events
   * GET /admin/crashes/:id
   */
  static getCrashDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const crashId = req.params.id;

    if (!crashId) {
      throw new CustomError('Invalid crash ID', 400);
    }

    try {
      const crash = await ClientCrash.findByIdWithEvents(crashId);

      if (!crash) {
        throw new CustomError('Crash not found', 404);
      }

      // Load stack trace if available
      let stackTrace: string | undefined;
      if (crash.stackFilePath) {
        try {
          const fullPath = path.join(process.cwd(), 'public', crash.stackFilePath);
          stackTrace = await fs.readFile(fullPath, 'utf8');
        } catch (error) {
          logger.warn('Failed to load stack trace file', { crashId, stackFilePath: crash.stackFilePath, error });
        }
      }

      res.json({
        success: true,
        data: {
          ...crash,
          stackTrace
        }
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
   * Get crash events with pagination
   * GET /admin/crashes/:id/events
   */
  static getCrashEvents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const crashId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    if (!crashId) {
      throw new CustomError('Invalid crash ID', 400);
    }

    try {
      const events = await CrashEvent.getByCrashId(crashId, limit);

      res.json({
        success: true,
        data: events
      });
    } catch (error) {
      logger.error('Error fetching crash events:', error);
      throw new CustomError('Failed to fetch crash events', 500);
    }
  });

  /**
   * Update crash state
   * PATCH /admin/crashes/:id/state
   */
  static updateCrashState = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const crashId = req.params.id;
    const { state } = req.body;

    if (!crashId) {
      throw new CustomError('Invalid crash ID', 400);
    }

    if (state === undefined || ![CrashState.OPEN, CrashState.CLOSED, CrashState.DELETED, CrashState.RESOLVED, CrashState.REPEATED].includes(state)) {
      throw new CustomError('Invalid state value', 400);
    }

    try {
      const crash = await ClientCrash.query().findById(crashId);

      if (!crash) {
        throw new CustomError('Crash not found', 404);
      }

      await crash.updateState(state);

      logger.info('Crash state updated', { crashId, state, userId: (req.user as any)?.id });

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
   * Update crash assignee
   * PATCH /admin/crashes/:id/assignee
   */
  static updateCrashAssignee = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const crashId = req.params.id;
    const { assignee } = req.body;

    if (!crashId) {
      throw new CustomError('Invalid crash ID', 400);
    }

    if (!assignee || typeof assignee !== 'string') {
      throw new CustomError('Invalid assignee value', 400);
    }

    try {
      const crash = await ClientCrash.query().findById(crashId);

      if (!crash) {
        throw new CustomError('Crash not found', 404);
      }

      await crash.updateAssignee(assignee);

      logger.info('Crash assignee updated', { crashId, assignee, userId: (req.user as any)?.id });

      res.json({
        success: true,
        message: 'Crash assignee updated successfully'
      });
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error updating crash assignee:', error);
      throw new CustomError('Failed to update crash assignee', 500);
    }
  });

  /**
   * Update crash Jira ticket
   * PATCH /admin/crashes/:id/jira
   */
  static updateCrashJiraTicket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const crashId = req.params.id;
    const { jiraTicket } = req.body;

    if (!crashId) {
      throw new CustomError('Invalid crash ID', 400);
    }

    if (!jiraTicket || typeof jiraTicket !== 'string') {
      throw new CustomError('Invalid Jira ticket value', 400);
    }

    try {
      const crash = await ClientCrash.query().findById(crashId);

      if (!crash) {
        throw new CustomError('Crash not found', 404);
      }

      await crash.updateJiraTicket(jiraTicket);

      logger.info('Crash Jira ticket updated', { crashId, jiraTicket, userId: (req.user as any)?.id });

      res.json({
        success: true,
        message: 'Crash Jira ticket updated successfully'
      });
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error updating crash Jira ticket:', error);
      throw new CustomError('Failed to update crash Jira ticket', 500);
    }
  });

  /**
   * Get crash statistics
   * GET /admin/crashes/:id/stats
   */
  static getCrashStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const crashId = req.params.id;

    if (!crashId) {
      throw new CustomError('Invalid crash ID', 400);
    }

    try {
      const [versionStats, platformStats, environmentStats, userStats, latestEvents] = await Promise.all([
        CrashEvent.getVersionStats(crashId),
        CrashEvent.getPlatformStats(crashId),
        CrashEvent.getEnvironmentStats(crashId),
        CrashEvent.getUserStats(crashId),
        CrashEvent.getLatestEvents(crashId, 10)
      ]);

      res.json({
        success: true,
        data: {
          versionStats,
          platformStats,
          environmentStats,
          userStats,
          latestEvents
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
      const summary = await ClientCrash.getSummary();

      res.json({
        success: true,
        data: summary
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
      // Get available branches, platforms, environments from existing data
      const [branches, platforms, environments, marketTypes, appVersions] = await Promise.all([
        ClientCrash.query().distinct('branch').orderBy('branch'),
        ClientCrash.query().distinct('platform').orderBy('platform'),
        ClientCrash.query().distinct('environment').orderBy('environment'),
        ClientCrash.query().distinct('marketType').whereNotNull('marketType').orderBy('marketType'),
        ClientCrash.query().distinct('maxAppVersion').whereNotNull('maxAppVersion').orderBy('maxAppVersion').limit(50)
      ]);

      res.json({
        success: true,
        data: {
          branches: branches.map(b => b.branch),
          platforms: platforms.map(p => p.platform),
          environments: environments.map(e => e.environment),
          marketTypes: marketTypes.map(m => m.marketType),
          appVersions: appVersions.map(v => v.maxAppVersion),
          states: [
            { value: CrashState.OPEN, label: 'Open' },
            { value: CrashState.CLOSED, label: 'Closed' },
            { value: CrashState.DELETED, label: 'Deleted' },
            { value: CrashState.RESOLVED, label: 'Resolved' },
            { value: CrashState.REPEATED, label: 'Repeated' }
          ]
        }
      });
    } catch (error) {
      logger.error('Error fetching filter options:', error);
      throw new CustomError('Failed to fetch filter options', 500);
    }
  });
}
