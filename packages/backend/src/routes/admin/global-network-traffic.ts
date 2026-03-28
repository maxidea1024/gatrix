/**
 * Global Network Traffic Routes
 * Cross-project network traffic endpoints that aggregate data across
 * all environments accessible to the authenticated user.
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error-handler';
import { networkTrafficService } from '../../services/network-traffic-service';
import db from '../../config/knex';

const router = Router();

/**
 * GET /admin/network/environments
 * Returns all environments the user can access, grouped by org/project.
 */
router.get(
  '/environments',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Fetch all environments with project and org info
    const rows = await db('g_environments')
      .select(
        'g_environments.id as environmentId',
        'g_environments.displayName as environmentName',
        'g_environments.environmentType',
        'g_projects.id as projectId',
        'g_projects.displayName as projectName',
        'g_organisations.id as orgId',
        'g_organisations.displayName as orgName'
      )
      .leftJoin('g_projects', 'g_environments.projectId', 'g_projects.id')
      .leftJoin('g_organisations', 'g_projects.orgId', 'g_organisations.id')
      .where('g_environments.isHidden', false)
      .orderBy([
        { column: 'g_organisations.displayName', order: 'asc' },
        { column: 'g_projects.displayName', order: 'asc' },
        { column: 'g_environments.displayOrder', order: 'asc' },
      ]);

    res.json({ success: true, data: { environments: rows } });
  })
);

// Get detailed network traffic data (cross-project)
router.get(
  '/traffic',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const traffic = await networkTrafficService.getDetailedTraffic({
      environments: environments
        ? (environments as string).split(',')
        : undefined,
      appNames: appNames ? (appNames as string).split(',') : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { traffic } });
  })
);

// Get aggregated network traffic data for charts (cross-project)
router.get(
  '/traffic/aggregated',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const traffic = await networkTrafficService.getAggregatedTraffic({
      environments: environments
        ? (environments as string).split(',')
        : undefined,
      appNames: appNames ? (appNames as string).split(',') : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { traffic } });
  })
);

// Get aggregated network traffic data by app for charts (cross-project)
router.get(
  '/traffic/aggregated/by-app',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const traffic = await networkTrafficService.getAggregatedTrafficByApp({
      environments: environments
        ? (environments as string).split(',')
        : undefined,
      appNames: appNames ? (appNames as string).split(',') : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { traffic } });
  })
);

// Get traffic summary (cross-project)
router.get(
  '/summary',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const summary = await networkTrafficService.getTrafficSummary({
      environments: environments
        ? (environments as string).split(',')
        : undefined,
      appNames: appNames ? (appNames as string).split(',') : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { summary } });
  })
);

// Get active applications (cross-project)
router.get(
  '/applications',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const applications = await networkTrafficService.getActiveApplications({
      environments: environments
        ? (environments as string).split(',')
        : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { applications } });
  })
);

// Get flag evaluation summary (cross-project)
router.get(
  '/evaluations',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const evaluations = await networkTrafficService.getFlagEvaluationSummary({
      environments: environments
        ? (environments as string).split(',')
        : undefined,
      appNames: appNames ? (appNames as string).split(',') : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { evaluations } });
  })
);

// Get flag evaluation time series (cross-project)
router.get(
  '/evaluations/timeseries',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const timeseries = await networkTrafficService.getFlagEvaluationTimeSeries({
      environments: environments
        ? (environments as string).split(',')
        : undefined,
      appNames: appNames ? (appNames as string).split(',') : undefined,
      startDate: start,
      endDate: end,
    });

    res.json({ success: true, data: { timeseries } });
  })
);

// Get flag evaluation time series by app (cross-project)
router.get(
  '/evaluations/timeseries/by-app',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const timeseries =
      await networkTrafficService.getFlagEvaluationTimeSeriesByApp({
        environments: environments
          ? (environments as string).split(',')
          : undefined,
        appNames: appNames ? (appNames as string).split(',') : undefined,
        startDate: start,
        endDate: end,
      });

    res.json({ success: true, data: { timeseries } });
  })
);

export default router;
