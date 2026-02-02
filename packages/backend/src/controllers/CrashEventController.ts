import { Response } from "express";
import { asyncHandler, GatrixError } from "../middleware/errorHandler";
import { AuthenticatedRequest } from "../middleware/auth";
import { CrashEvent } from "../models/CrashEvent";
import { ClientCrash } from "../models/ClientCrash";
import fs from "fs/promises";
import path from "path";
import logger from "../config/logger";

/**
 * Controller for crash event management (admin)
 */
export class CrashEventController {
  /**
   * Get all crash events with pagination and filters
   * GET /admin/crash-events
   */
  static getCrashEvents = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const {
        page = 1,
        limit = 20,
        search,
        platform,
        platformOperator,
        environment,
        environmentOperator,
        branch,
        branchOperator,
        marketType,
        marketTypeOperator,
        isEditor,
        appVersion,
        appVersionOperator,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      // Build query
      let query = CrashEvent.query();

      // Search filter (accountId, characterId, gameUserId, userName)
      if (search) {
        query = query.where((builder) => {
          builder
            .where("accountId", "like", `%${search}%`)
            .orWhere("characterId", "like", `%${search}%`)
            .orWhere("gameUserId", "like", `%${search}%`)
            .orWhere("userName", "like", `%${search}%`);
        });
      }

      // Platform filter - support multiple values
      if (platform) {
        const platforms = (platform as string).split(",").map((p) => p.trim());
        if (platforms.length > 0) {
          query = query.whereIn("platform", platforms);
        }
      }

      // Environment filter - support multiple values
      if (environment) {
        const environments = (environment as string)
          .split(",")
          .map((e) => e.trim());
        if (environments.length > 0) {
          query = query.whereIn("environment", environments);
        }
      }

      // Branch filter - support multiple values
      if (branch) {
        const branches = (branch as string).split(",").map((b) => b.trim());
        if (branches.length > 0) {
          query = query.whereIn("branch", branches);
        }
      }

      // Market type filter - support multiple values
      if (marketType) {
        const marketTypes = (marketType as string)
          .split(",")
          .map((m) => m.trim());
        if (marketTypes.length > 0) {
          query = query.whereIn("marketType", marketTypes);
        }
      }

      // Is editor filter
      if (isEditor !== undefined) {
        const isEditorBool = isEditor === "true" || isEditor === "1";
        query = query.where("isEditor", isEditorBool);
      }

      // App version filter - support multiple values
      if (appVersion) {
        const appVersions = (appVersion as string)
          .split(",")
          .map((v) => v.trim());
        if (appVersions.length > 0) {
          query = query.whereIn("appVersion", appVersions);
        }
      }

      // Date range filter
      if (dateFrom) {
        query = query.where("createdAt", ">=", new Date(dateFrom as string));
      }
      if (dateTo) {
        query = query.where("createdAt", "<=", new Date(dateTo as string));
      }

      // Get total count
      const total = await query.resultSize();

      // Apply sorting
      const validSortColumns = [
        "createdAt",
        "platform",
        "environment",
        "branch",
        "appVersion",
        "resVersion",
        "accountId",
        "characterId",
        "gameUserId",
        "userName",
      ];
      const sortColumn = validSortColumns.includes(sortBy as string)
        ? (sortBy as string)
        : "createdAt";
      const sortDirection = sortOrder === "ASC" ? "ASC" : "DESC";

      // Get paginated results
      const events = await query
        .orderBy(sortColumn, sortDirection)
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
    },
  );

  /**
   * Get crash event by ID
   * GET /admin/crash-events/:id
   */
  static getCrashEventById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      const event = await CrashEvent.query().findById(id);

      if (!event) {
        throw new GatrixError("Crash event not found", 404);
      }

      res.json({
        success: true,
        data: event,
      });
    },
  );

  /**
   * Convert ISO8601 UTC timestamps in log lines to local timezone
   * Converts "[2025-10-15T11:51:05.401Z] " to "[2025-10-15 20:51:05.401] " (for Asia/Seoul timezone)
   */
  private static convertLogTimestamps(
    logContent: string,
    timezone: string = "UTC",
  ): string {
    // Match lines starting with "[ISO8601 timestamp] "
    const timestampRegex =
      /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]\s/gm;

    return logContent.replace(timestampRegex, (match, isoTimestamp) => {
      try {
        const date = new Date(isoTimestamp);

        // Format to local timezone
        const localTime = date
          .toLocaleString("sv-SE", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
            hour12: false,
          })
          .replace(" ", " ");

        return `[${localTime}] `;
      } catch (error) {
        // If conversion fails, return original
        return match;
      }
    });
  }

  /**
   * Get log file content for a crash event
   * GET /admin/crash-events/:id/log
   */
  static getLogFile = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const timezone = (req.query.timezone as string) || "UTC";

      const event = await CrashEvent.query().findById(id);

      if (!event) {
        throw new GatrixError("Crash event not found", 404);
      }

      if (!event.logFilePath) {
        throw new GatrixError(
          "Log file not available for this crash event",
          404,
        );
      }

      try {
        const fullPath = path.join(process.cwd(), "public", event.logFilePath);
        let logContent = await fs.readFile(fullPath, "utf8");

        // Convert timestamps to local timezone
        logContent = this.convertLogTimestamps(logContent, timezone);

        res.json({
          success: true,
          data: {
            logContent,
            logFilePath: event.logFilePath,
          },
        });
      } catch (error) {
        logger.error("Failed to read log file:", {
          eventId: id,
          logFilePath: event.logFilePath,
          error,
        });
        throw new GatrixError("Failed to read log file", 500);
      }
    },
  );

  /**
   * Get stack trace for a crash event
   * GET /admin/crash-events/:id/stack-trace
   */
  static getStackTrace = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      const event = await CrashEvent.query().findById(id);

      if (!event) {
        throw new GatrixError("Crash event not found", 404);
      }

      // Get the crash group to find stack trace file
      const crash = await ClientCrash.query().findById(event.crashId);

      if (!crash) {
        throw new GatrixError("Crash group not found", 404);
      }

      if (!crash.stackFilePath) {
        throw new GatrixError("Stack trace not available for this crash", 404);
      }

      try {
        const fullPath = path.join(
          process.cwd(),
          "public",
          crash.stackFilePath,
        );
        const stackTrace = await fs.readFile(fullPath, "utf8");

        res.json({
          success: true,
          data: {
            stackTrace,
            stackFilePath: crash.stackFilePath,
            firstLine: crash.firstLine,
          },
        });
      } catch (error) {
        logger.error("Failed to read stack trace file:", {
          crashId: crash.id,
          stackFilePath: crash.stackFilePath,
          error,
        });
        throw new GatrixError("Failed to read stack trace file", 500);
      }
    },
  );

  /**
   * Get filter options for crash events
   * GET /admin/crash-events/filter-options
   */
  static getFilterOptions = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      // Get distinct values for filters
      const [
        platformResults,
        environmentResults,
        branchResults,
        marketTypeResults,
        appVersionResults,
      ] = await Promise.all([
        CrashEvent.query().distinct("platform").whereNotNull("platform"),
        CrashEvent.query().distinct("environment").whereNotNull("environment"),
        CrashEvent.query().distinct("branch").whereNotNull("branch"),
        CrashEvent.query().distinct("marketType").whereNotNull("marketType"),
        CrashEvent.query().distinct("appVersion").whereNotNull("appVersion"),
      ]);

      const platforms = platformResults.map((r: any) => r.platform).sort();
      const environments = environmentResults
        .map((r: any) => r.environment)
        .sort();
      const branches = branchResults.map((r: any) => r.branch).sort();
      const marketTypes = marketTypeResults
        .map((r: any) => r.marketType)
        .sort();
      const appVersions = appVersionResults
        .map((r: any) => r.appVersion)
        .sort();

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
    },
  );
}
