import { Response } from 'express';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { CrashEvent } from '../models/CrashEvent';
import { ClientCrash } from '../models/ClientCrash';
import fs from 'fs/promises';
import path from 'path';
import logger from '../config/logger';

/**
 * Controller for crash event management (admin)
 */
export class CrashEventController {
  /**
   * Get all crash events with pagination and filters
   * GET /admin/crash-events
   */
  static getCrashEvents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      page = 1,
      limit = 20,
      search,
      platform,
      environment,
      branch,
      marketType,
      isEditor,
      appVersion,
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    // Build query
    let query = CrashEvent.query();

    // Search filter (accountId, characterId, gameUserId, userName)
    if (search) {
      query = query.where((builder) => {
        builder
          .where('accountId', 'like', `%${search}%`)
          .orWhere('characterId', 'like', `%${search}%`)
          .orWhere('gameUserId', 'like', `%${search}%`)
          .orWhere('userName', 'like', `%${search}%`);
      });
    }

    // Platform filter
    if (platform) {
      query = query.where('platform', platform as string);
    }

    // Environment filter
    if (environment) {
      query = query.where('environment', environment as string);
    }

    // Branch filter
    if (branch) {
      query = query.where('branch', branch as string);
    }

    // Market type filter
    if (marketType) {
      query = query.where('marketType', marketType as string);
    }

    // Is editor filter
    if (isEditor !== undefined) {
      const isEditorBool = isEditor === 'true' || isEditor === '1';
      query = query.where('isEditor', isEditorBool);
    }

    // App version filter
    if (appVersion) {
      query = query.where('appVersion', appVersion as string);
    }

    // Date range filter
    if (dateFrom) {
      query = query.where('createdAt', '>=', new Date(dateFrom as string));
    }
    if (dateTo) {
      query = query.where('createdAt', '<=', new Date(dateTo as string));
    }

    // Get total count
    const total = await query.resultSize();

    // Get paginated results
    const events = await query
      .orderBy('createdAt', 'DESC')
      .limit(limitNum)
      .offset((pageNum - 1) * limitNum);

    res.json({
      success: true,
      data: events,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  });

  /**
   * Get crash event by ID
   * GET /admin/crash-events/:id
   */
  static getCrashEventById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const event = await CrashEvent.query().findById(id);

    if (!event) {
      throw new CustomError('Crash event not found', 404);
    }

    res.json({
      success: true,
      data: event,
    });
  });

  /**
   * Get log file content for a crash event
   * GET /admin/crash-events/:id/log
   */
  static getLogFile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const event = await CrashEvent.query().findById(id);

    if (!event) {
      throw new CustomError('Crash event not found', 404);
    }

    if (!event.logFilePath) {
      throw new CustomError('Log file not available for this crash event', 404);
    }

    try {
      const fullPath = path.join(process.cwd(), 'public', event.logFilePath);
      const logContent = await fs.readFile(fullPath, 'utf8');

      res.json({
        success: true,
        data: {
          logContent,
          logFilePath: event.logFilePath,
        },
      });
    } catch (error) {
      logger.error('Failed to read log file:', { eventId: id, logFilePath: event.logFilePath, error });
      throw new CustomError('Failed to read log file', 500);
    }
  });

  /**
   * Get stack trace for a crash event
   * GET /admin/crash-events/:id/stack-trace
   */
  static getStackTrace = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const event = await CrashEvent.query().findById(id);

    if (!event) {
      throw new CustomError('Crash event not found', 404);
    }

    // Get the crash group to find stack trace file
    const crash = await ClientCrash.query().findById(event.crashId);

    if (!crash) {
      throw new CustomError('Crash group not found', 404);
    }

    if (!crash.stackFilePath) {
      throw new CustomError('Stack trace not available for this crash', 404);
    }

    try {
      const fullPath = path.join(process.cwd(), 'public', crash.stackFilePath);
      const stackTrace = await fs.readFile(fullPath, 'utf8');

      res.json({
        success: true,
        data: {
          stackTrace,
          stackFilePath: crash.stackFilePath,
          firstLine: crash.firstLine,
        },
      });
    } catch (error) {
      logger.error('Failed to read stack trace file:', { crashId: crash.id, stackFilePath: crash.stackFilePath, error });
      throw new CustomError('Failed to read stack trace file', 500);
    }
  });

  /**
   * Get filter options for crash events
   * GET /admin/crash-events/filter-options
   */
  static getFilterOptions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get distinct values for filters
    const [platformResults, environmentResults, branchResults, marketTypeResults, appVersionResults] = await Promise.all([
      CrashEvent.query().distinct('platform').whereNotNull('platform'),
      CrashEvent.query().distinct('environment').whereNotNull('environment'),
      CrashEvent.query().distinct('branch').whereNotNull('branch'),
      CrashEvent.query().distinct('marketType').whereNotNull('marketType'),
      CrashEvent.query().distinct('appVersion').whereNotNull('appVersion'),
    ]);

    const platforms = platformResults.map((r: any) => r.platform).sort();
    const environments = environmentResults.map((r: any) => r.environment).sort();
    const branches = branchResults.map((r: any) => r.branch).sort();
    const marketTypes = marketTypeResults.map((r: any) => r.marketType).sort();
    const appVersions = appVersionResults.map((r: any) => r.appVersion).sort();

    res.json({
      success: true,
      data: {
        platforms,
        environments,
        branches,
        marketTypes,
        appVersions,
      },
    });
  });
}

