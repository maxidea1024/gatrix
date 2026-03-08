/**
 * Network Traffic Routes
 * API endpoints for network traffic monitoring and analytics
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/error-handler';
import { networkTrafficService } from '../../../services/network-traffic-service';

const router = Router();

// Get detailed network traffic data (includes appName)
router.get(
  '/traffic',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environments, appNames, startDate, endDate } = req.query;

    // Default to last 24 hours
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

// Get aggregated network traffic data for charts
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

// Get aggregated network traffic data by app for charts
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

// Get traffic summary
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

// Get active applications
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

// Get flag evaluation summary (from g_feature_metrics)
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

// Get flag evaluation time series (from g_feature_metrics)
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

// Get flag evaluation time series by app (from g_feature_metrics)
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
