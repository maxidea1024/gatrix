import { Response } from 'express';
import { asyncHandler, GatrixError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../middleware/auth';
import { ClientCrash } from '../models/client-crash';
import { CrashEvent } from '../models/crash-event';
import { CrashState } from '../types/crash';
import { getStorageProvider } from '../services/storage';

import { createLogger } from '../config/logger';
const logger = createLogger('CrashesController');

/**
 * Controller for crashes group management (admin)
 */
export class CrashesController {
  /**
   * Get all crash groups with pagination and filters
   * GET /admin/crashes
   */
  static getCrashes = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const {
        page = 1,
        limit = 20,
        search,
        platform,
        environmentId,
        branch,
        channel,
        subchannel,
        isEditor,
        state,
        assignee,
        appVersion,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      // Build filters
      const filters: any = {};
      if (search) filters.search = search as string;
      if (platform) filters.platform = platform as string;
      if (environmentId) filters.environmentId = environmentId as string;
      if (branch) filters.branch = branch as string;
      if (channel) filters.channel = channel as string;
      if (subchannel) filters.subchannel = subchannel as string;
      if (isEditor !== undefined)
        filters.isEditor = isEditor === 'true' || isEditor === '1';
      if (state !== undefined)
        filters.state = parseInt(state as string, 10);
      if (assignee) filters.assignee = assignee as string;
      if (appVersion) filters.appVersion = appVersion as string;
      if (dateFrom) filters.dateFrom = dateFrom as string;
      if (dateTo) filters.dateTo = dateTo as string;

      // Determine sort params
      const validSortColumns = [
        'lastCrashAt',
        'firstCrashAt',
        'crashesCount',
        'maxAppVersion',
        'platform',
        'branch',
        'crashesState',
      ];
      const sortColumn =
        sortBy && validSortColumns.includes(sortBy as string)
          ? (sortBy as string)
          : 'lastCrashAt';
      const sortDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';

      // Build query with filters + sort + pagination
      const query = ClientCrash.query();
      ClientCrash.applyFiltersPublic(query, filters);

      const total = await query.clone().resultSize();
      const crashes = await query
        .orderBy(sortColumn, sortDir)
        .offset((pageNum - 1) * limitNum)
        .limit(limitNum);

      // Resolve environment names
      const crashesWithEnvName =
        await CrashesController.resolveEnvironmentNames(crashes as any[]);

      res.json({
        success: true,
        data: crashesWithEnvName,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      });
    }
  );

  /**
   * Get crash by ID with stack trace
   * GET /admin/crashes/:id
   */
  static getCrashById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      const crash = await ClientCrash.query().findById(id);

      if (!crash) {
        throw new GatrixError('Crash not found', 404);
      }

      // Load stack trace if available
      let stackTrace: string | undefined;
      if (crash.stackFilePath) {
        try {
          const storage = getStorageProvider();
          stackTrace = await storage.downloadAsString(crash.stackFilePath);
        } catch (error) {
          logger.warn('Failed to read stack trace file:', {
            crashId: crash.id,
            stackFilePath: crash.stackFilePath,
            error,
          });
        }
      }

      // Resolve environment name
      const crashesWithEnvName = await CrashesController.resolveEnvironmentNames([crash as any]);
      const crashData = crashesWithEnvName.length > 0 ? crashesWithEnvName[0] : crash;

      res.json({
        success: true,
        data: {
          ...crashData,
          stackTrace,
        },
      });
    }
  );

  /**
   * Get crash events for a specific crash group
   * GET /admin/crashes/:id/events
   */
  static getCrashEvents = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { page = 1, limit = 100 } = req.query;
      const timezone = (req.query.timezone as string) || 'UTC';

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      // Verify crash exists
      const crash = await ClientCrash.query().findById(id);
      if (!crash) {
        throw new GatrixError('Crash not found', 404);
      }

      // Get events with pagination
      const query = CrashEvent.query().where('crashId', id);
      const total = await query.clone().resultSize();

      const events = await query
        .orderBy('createdAt', 'desc')
        .offset((pageNum - 1) * limitNum)
        .limit(limitNum);

      res.json({
        success: true,
        data: events,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      });
    }
  );

  /**
   * Update crash state
   * PATCH /admin/crashes/:id/state
   */
  static updateState = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { state } = req.body;

      if (state === undefined || ![0, 1, 2, 3, 4].includes(state)) {
        throw new GatrixError('Invalid state value', 400);
      }

      const crash = await ClientCrash.query().findById(id);
      if (!crash) {
        throw new GatrixError('Crash not found', 404);
      }

      await crash.updateState(state as CrashState);

      logger.info('Crash state updated', {
        crashId: id,
        oldState: crash.crashesState,
        newState: state,
        updatedBy: (req as any).user?.userId,
      });

      res.json({
        success: true,
        data: { id, crashesState: state },
      });
    }
  );

  /**
   * Update crash assignee
   * PATCH /admin/crashes/:id/assignee
   */
  static updateAssignee = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { assignee } = req.body;

      const crash = await ClientCrash.query().findById(id);
      if (!crash) {
        throw new GatrixError('Crash not found', 404);
      }

      if (assignee === null || assignee === '') {
        // Unassign
        await crash.$query().patch({ assignee: null as any, updatedAt: new Date() });
      } else {
        await crash.updateAssignee(assignee);
      }

      logger.info('Crash assignee updated', {
        crashId: id,
        assignee: assignee || '(unassigned)',
        updatedBy: (req as any).user?.userId,
      });

      res.json({
        success: true,
        data: { id, assignee: assignee || null },
      });
    }
  );

  /**
   * Update crash Jira ticket
   * PATCH /admin/crashes/:id/jira
   */
  static updateJiraTicket = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { jiraTicket } = req.body;

      const crash = await ClientCrash.query().findById(id);
      if (!crash) {
        throw new GatrixError('Crash not found', 404);
      }

      if (jiraTicket === null || jiraTicket === '') {
        await crash
          .$query()
          .patch({ jiraTicket: null as any, updatedAt: new Date() });
      } else {
        await crash.updateJiraTicket(jiraTicket);
      }

      logger.info('Crash Jira ticket updated', {
        crashId: id,
        jiraTicket: jiraTicket || '(removed)',
        updatedBy: (req as any).user?.userId,
      });

      res.json({
        success: true,
        data: { id, jiraTicket: jiraTicket || null },
      });
    }
  );

  /**
   * Get filter options for crashes
   * GET /admin/crashes/filter-options
   */
  static getFilterOptions = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const [
        platformResults,
        environmentResults,
        branchResults,
        channelResults,
        subchannelResults,
        stateResults,
      ] = await Promise.all([
        ClientCrash.query().distinct('platform').whereNotNull('platform'),
        ClientCrash.query()
          .distinct('environmentId')
          .whereNotNull('environmentId'),
        ClientCrash.query().distinct('branch').whereNotNull('branch'),
        ClientCrash.query().distinct('channel').whereNotNull('channel'),
        ClientCrash.query().distinct('subchannel').whereNotNull('subchannel'),
        ClientCrash.query()
          .distinct('crashesState')
          .whereNotNull('crashesState'),
      ]);

      const platforms = platformResults.map((r: any) => r.platform).sort();
      const environmentIds = environmentResults
        .map((r: any) => r.environmentId)
        .sort();
      const branches = branchResults.map((r: any) => r.branch).sort();
      const channels = channelResults.map((r: any) => r.channel).sort();
      const subchannels = subchannelResults
        .map((r: any) => r.subchannel)
        .sort();
      const states = stateResults.map((r: any) => r.crashesState).sort();

      // Resolve environment names from main DB
      let environments: { id: string; name: string }[] = environmentIds.map(
        (id: string) => ({ id, name: id })
      );
      if (environmentIds.length > 0) {
        try {
          const mainDb = (await import('../config/knex')).default;
          const envRows = await mainDb('g_environments')
            .whereIn('id', environmentIds)
            .select('id', 'name', 'displayName');
          const envNameMap: Record<string, string> = {};
          for (const row of envRows) {
            envNameMap[row.id] = row.displayName || row.name || row.id;
          }
          environments = environmentIds.map((id: string) => ({
            id,
            name: envNameMap[id] || id,
          }));
        } catch (error) {
          logger.warn('Failed to resolve environment names for filter:', error);
        }
      }

      res.json({
        success: true,
        data: {
          platforms,
          environments,
          branches,
          channels,
          subchannels,
          states,
        },
      });
    }
  );

  /**
   * Resolve environment names for crash records
   */
  private static async resolveEnvironmentNames(crashes: any[]): Promise<any[]> {
    const envIds = [
      ...new Set(crashes.map((c) => c.environmentId).filter(Boolean)),
    ];
    if (envIds.length === 0) return crashes;

    let envInfoMap: Record<string, { envName: string; projectName: string; organizationName: string }> = {};
    try {
      const mainDb = (await import('../config/knex')).default;
      const envRows = await mainDb('g_environments as e')
        .leftJoin('g_projects as p', 'e.projectId', 'p.id')
        .leftJoin('g_organisations as o', 'p.orgId', 'o.id')
        .whereIn('e.id', envIds)
        .select(
          'e.id',
          'e.name',
          'e.displayName',
          'p.displayName as projectDisplayName',
          'p.projectName',
          'o.displayName as orgDisplayName',
          'o.orgName'
        );
      for (const row of envRows) {
        envInfoMap[row.id] = {
          envName: row.displayName || row.name || row.id,
          projectName: row.projectDisplayName || row.projectName || '-',
          organizationName: row.orgDisplayName || row.orgName || '-',
        };
      }
    } catch (error) {
      logger.error('Failed to resolve environment info:', error);
    }

    return crashes.map((c) => {
      const info = envInfoMap[c.environmentId];
      return {
        ...c,
        environmentName: info?.envName || c.environmentId,
        projectName: info?.projectName || '-',
        organizationName: info?.organizationName || '-',
      };
    });
  }
}
