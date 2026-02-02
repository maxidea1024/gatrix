import { Request, Response } from "express";
import { ClientVersionService } from "../services/ClientVersionService";
import { ClientVersionModel, ClientStatus } from "../models/ClientVersion";
import { GameWorldService } from "../services/GameWorldService";
import { cacheService } from "../services/CacheService";
import { pubSubService } from "../services/PubSubService";
import {
  GAME_WORLDS,
  DEFAULT_CONFIG,
  withEnvironment,
} from "../constants/cacheKeys";
import logger from "../config/logger";
import { asyncHandler } from "../utils/asyncHandler";
import VarsModel from "../models/Vars";
import { IpWhitelistService } from "../services/IpWhitelistService";
import { SDKRequest } from "../middleware/apiTokenAuth";
import { resolvePassiveData } from "../utils/passiveDataUtils";
import { FeatureFlagModel, FeatureSegmentModel } from "../models/FeatureFlag";
import { FeatureFlagEvaluator, FeatureFlag, FeatureSegment, EvaluationContext } from "@gatrix/server-sdk";

export class ClientController {
  /**
   * Extract client IP address from request
   */
  private static getClientIp(req: Request): string {
    let clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      req.socket.remoteAddress ||
      "";

    // Remove "::ffff:" prefix from IPv4-mapped IPv6 addresses
    if (clientIp.startsWith("::ffff:")) {
      clientIp = clientIp.substring(7);
    }

    return clientIp.trim();
  }

  /**
   * Get client version information
   * GET /api/v1/client/client-version
   *
   * Query params:
   * - platform (required): Platform identifier (e.g., 'android', 'ios', 'windows')
   * - version (optional): Client version string. If omitted or 'latest', returns the latest version for the platform
   * - status (optional): Filter by status (e.g., 'ONLINE', 'MAINTENANCE'). Only applied when fetching latest version.
   * - lang (optional): Language code for localized maintenance messages
   */
  static getClientVersion = asyncHandler(
    async (req: SDKRequest, res: Response) => {
      const { platform, version, status, lang } = req.query as {
        platform?: string;
        version?: string;
        status?: string;
        lang?: string;
      };

      // Validate required query params - platform is always required
      if (!platform) {
        return res.status(400).json({
          success: false,
          message: "platform is a required query parameter",
        });
      }

      // Environment is resolved by clientSDKAuth middleware
      const environment = req.environment || "development";

      // Validate status parameter if provided
      const validStatuses = Object.values(ClientStatus);
      let statusFilter: ClientStatus | undefined;
      if (status) {
        const upperStatus = status.toUpperCase() as ClientStatus;
        if (!validStatuses.includes(upperStatus)) {
          return res.status(400).json({
            success: false,
            message: `Invalid status. Valid values are: ${validStatuses.join(", ")}`,
          });
        }
        statusFilter = upperStatus;
      }

      // Determine if we should fetch the latest version
      const isLatestRequest = !version || version.toLowerCase() === "latest";

      // Create cache key (use 'latest' for latest requests)
      const versionKey = isLatestRequest ? "latest" : version;
      const statusKey = statusFilter ? `:${statusFilter}` : "";
      const baseCacheKey = `client_version:${platform}:${versionKey}${statusKey}${lang ? `:${lang}` : ""}`;

      // Scoping cache by environment
      const cacheKey = environment
        ? withEnvironment(environment, baseCacheKey)
        : baseCacheKey;

      // Try to get from cache first
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        logger.debug(`Cache hit for client version: ${cacheKey}`);
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
        });
      }

      // If not in cache, fetch from database
      logger.debug(`Cache miss for client version: ${cacheKey}`);

      let record;
      if (isLatestRequest) {
        // Get the latest version for the platform (with optional status filter and environment)
        record = await ClientVersionService.findLatestByPlatform(
          platform,
          statusFilter,
          environment,
        );
      } else {
        // Get exact version match
        record = await ClientVersionService.findByExact(
          platform,
          version,
          environment,
        );
      }

      if (!record) {
        return res.status(404).json({
          success: false,
          message: isLatestRequest
            ? `No client version found for platform: ${platform} in environment: ${environment}${statusFilter ? ` with status: ${statusFilter}` : ""}`
            : "Client version not found",
        });
      }

      // Get clientVersionPassiveData from KV settings for the specific environment and resolve by version
      let passiveData = {};
      try {
        const passiveDataStr = await VarsModel.get(
          "$clientVersionPassiveData",
          environment,
        );
        passiveData = resolvePassiveData(passiveDataStr, record.clientVersion);
      } catch (error) {
        logger.warn(
          `Failed to resolve clientVersionPassiveData for environment ${environment}:`,
          error,
        );
      }

      // Parse customPayload
      let customPayload = {};
      try {
        if (record.customPayload) {
          let parsed =
            typeof record.customPayload === "string"
              ? JSON.parse(record.customPayload)
              : record.customPayload;

          // Handle double-encoded JSON string
          if (typeof parsed === "string") {
            try {
              parsed = JSON.parse(parsed);
            } catch (e) {
              // ignore
            }
          }

          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            customPayload = parsed;
          }
        }
      } catch (error) {
        logger.warn("Failed to parse customPayload:", error);
      }

      // Merge meta: passiveData first, then customPayload (customPayload overwrites)
      const meta = { ...passiveData, ...customPayload };

      // Get client IP and check whitelist
      const clientIp = this.getClientIp(req);
      let gameServerAddress = record.gameServerAddress;
      let patchAddress = record.patchAddress;

      if (clientIp) {
        const isWhitelisted = await IpWhitelistService.isIpWhitelisted(
          clientIp,
          environment,
        );
        if (isWhitelisted) {
          // Use whitelist addresses if available
          if (record.gameServerAddressForWhiteList) {
            gameServerAddress = record.gameServerAddressForWhiteList;
          }
          if (record.patchAddressForWhiteList) {
            patchAddress = record.patchAddressForWhiteList;
          }
        }
      }

      // Get maintenance message if status is MAINTENANCE
      let maintenanceMessage: string | undefined = record.maintenanceMessage;
      if (record.clientStatus === ClientStatus.MAINTENANCE && record.id) {
        // Try to get localized maintenance message from database
        try {
          const maintenanceLocales =
            await ClientVersionModel.getMaintenanceLocales(record.id);
          if (maintenanceLocales && maintenanceLocales.length > 0) {
            // Try to find message for requested language
            if (lang) {
              const localeMessage = maintenanceLocales.find(
                (m: any) => m.lang === lang,
              );
              if (localeMessage) {
                maintenanceMessage = localeMessage.message;
              }
            }
            // If no localized message found, use first available message
            if (!maintenanceMessage) {
              maintenanceMessage = maintenanceLocales[0].message;
            }
          }
        } catch (error) {
          logger.warn("Failed to get maintenance locales:", error);
        }
      }

      // Transform data for client consumption (remove sensitive fields)
      const clientData: any = {
        platform: record.platform,
        clientVersion: record.clientVersion,
        status: record.clientStatus,
        gameServerAddress,
        patchAddress,
        guestModeAllowed:
          record.clientStatus === ClientStatus.MAINTENANCE
            ? false
            : Boolean(record.guestModeAllowed),
        externalClickLink: record.externalClickLink,
        meta,
      };

      // Add maintenance message if status is MAINTENANCE
      if (record.clientStatus === ClientStatus.MAINTENANCE) {
        clientData.maintenanceMessage = maintenanceMessage || "";
      }

      // Cache the result for 5 minutes
      await cacheService.set(cacheKey, clientData, 5 * 60 * 1000);

      return res.json({
        success: true,
        data: clientData,
        cached: false,
      });
    },
  );

  /**
   * Get all game worlds
   * GET /api/v1/client/game-worlds
   */
  static getGameWorlds = asyncHandler(
    async (req: SDKRequest, res: Response) => {
      const environment = req.environment || "development";
      const cacheKey = environment
        ? withEnvironment(environment, GAME_WORLDS.PUBLIC)
        : GAME_WORLDS.PUBLIC;

      // Try to get from cache first
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        logger.debug(`Cache hit for game worlds: ${cacheKey}`);
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
        });
      }

      // If not in cache, fetch from database for the specific environment
      logger.debug(`Cache miss for game worlds: ${cacheKey}`);

      // No pagination: fetch all visible, non-maintenance worlds ordered by displayOrder ASC
      const worlds = await GameWorldService.getAllGameWorlds({
        isVisible: true,
        isMaintenance: false,
        environment: environment,
      });

      // Transform data for client consumption (remove sensitive fields)
      const clientData = {
        worlds: worlds.map((world) => ({
          id: world.id,
          worldId: world.worldId,
          name: world.name,
          description: world.description,
          displayOrder: world.displayOrder,
          meta: world.customPayload || {},
          createdAt: world.createdAt,
          updatedAt: world.updatedAt,
        })),
        total: worlds.length,
        timestamp: new Date().toISOString(),
      };

      // Cache the result for 10 minutes (game worlds change less frequently)
      await cacheService.set(
        cacheKey,
        clientData,
        DEFAULT_CONFIG.GAME_WORLDS_PUBLIC_TTL,
      );

      res.json({
        success: true,
        data: clientData,
        cached: false,
      });
    },
  );

  /**
   * Get cache statistics (for monitoring)
   * GET /api/v1/client/cache-stats
   */
  static getCacheStats = asyncHandler(
    async (req: SDKRequest, res: Response) => {
      const cacheStats = cacheService.getStats();
      const queueStats = await pubSubService.getQueueStats();

      res.json({
        success: true,
        data: {
          cache: cacheStats,
          queue: queueStats,
          pubsub: {
            connected: pubSubService.isReady(),
            timestamp: new Date().toISOString(),
          },
        },
      });
    },
  );

  /**
   * Invalidate game worlds cache (for testing)
   * POST /api/v1/client/invalidate-cache
   */
  static invalidateCache = asyncHandler(
    async (req: SDKRequest, res: Response) => {
      const environment = req.environment || "development";
      await GameWorldService.invalidateCache(environment);

      res.json({
        success: true,
        message: "Game worlds cache invalidated successfully",
      });
    },
  );

  /**
   * Evaluate feature flags (Server-side evaluation)
   * POST /api/v1/client/features/evaluate
   * GET /api/v1/client/features/evaluate
   */
  static evaluateFlags = asyncHandler(async (req: SDKRequest, res: Response) => {
    const environment = req.environment;
    if (!environment) {
      return res.status(400).json({ success: false, message: "Environment is required" });
    }

    let context: EvaluationContext = {};

    let flagNames: string[] | undefined;

    // 1. Extract context and keys
    if (req.method === "POST") {
      context = req.body.context || {};
      flagNames = req.body.flagNames;
    } else {
      // GET: context from x-gatrix-feature-context header (Base64 encoded JSON)
      const contextHeader = req.headers["x-gatrix-feature-context"] as string;
      if (contextHeader) {
        try {
          const jsonStr = Buffer.from(contextHeader, "base64").toString("utf-8");
          context = JSON.parse(jsonStr);
        } catch (error) {
          // If parsing fails, use empty context or error? SDK usually handles graceful degradation.
          logger.warn("Failed to parse x-gatrix-feature-context header", { error });
        }
      }

      const flagNamesParam = req.query.flagNames as string;
      if (flagNamesParam) {
        flagNames = flagNamesParam.split(",");
      }
    }

    // Default context values from request if not provided
    if (!context.ip) context.ip = ClientController.getClientIp(req);
    context.environmentName = environment;

    // 2. Fetch all flags and segments (with caching)
    // We cache the *definitions* for a short time (e.g. 60s) to avoid DB spam
    const definitionsCacheKey = `feature_flags:definitions:${environment}`;
    let definitions = await cacheService.get<any>(definitionsCacheKey);

    if (!definitions) {
      // Fetch from DB
      // We need ALL flags to evaluate, and ALL segments
      // Using FeatureFlagModel directly to get raw data
      const [flagsData, segmentsList] = await Promise.all([
        FeatureFlagModel.findAll({ environment, limit: 10000 }),
        FeatureSegmentModel.findAll(),
      ]);

      definitions = {
        flags: flagsData.flags,
        segments: segmentsList
      };

      await cacheService.set(definitionsCacheKey, definitions, 5 * 60 * 1000); // 5 minutes cache
    }

    const { flags, segments } = definitions;

    // Map segments to SDK type
    const segmentsMap = new Map<string, FeatureSegment>(
      segments.map((s: any) => [
        s.segmentName,
        {
          name: s.segmentName,
          constraints: s.constraints,
          isActive: s.isActive
        }
      ])
    );

    // 3. Evaluate
    const results: Record<string, any> = {};
    const evaluableFlags = flagNames
      ? flags.filter((f: any) => flagNames!.includes(f.flagName))
      : flags;

    for (const dbFlag of evaluableFlags) {
      // Map DB flag to SDK FeatureFlag type
      const sdkFlag: FeatureFlag = {
        name: dbFlag.flagName,
        isEnabled: dbFlag.isEnabled,
        impressionDataEnabled: dbFlag.impressionDataEnabled,
        strategies: dbFlag.strategies?.map((s: any) => ({
          name: s.strategyName,
          parameters: s.parameters,
          constraints: s.constraints,
          segments: s.segments,
          isEnabled: s.isEnabled
        })) || [],
        variants: dbFlag.variants?.map((v: any) => ({
          name: v.variantName,
          weight: v.weight,
          payload: v.payload,
          payloadType: dbFlag.variantType || v.payloadType
        })) || []
      };

      const result = FeatureFlagEvaluator.evaluate(sdkFlag, context, segmentsMap);

      let value: any = result.enabled;

      if (result.enabled && result.variant) {
        if (result.variant.payload) {
          value = result.variant.payload.value ?? result.variant.payload;
        }
      }

      results[dbFlag.flagName] = {
        value,
        variant: result.variant?.name,
        variantPayload: result.variant?.payload,
        reason: result.reason,
        enabled: result.enabled
      };

      if (!result.enabled) {
        // Use baselinePayload if defined, otherwise use default based on variantType
        if (dbFlag.baselinePayload !== undefined && dbFlag.baselinePayload !== null) {
          // Parse baselinePayload if it's a string (from JSON column)
          let baselineValue = dbFlag.baselinePayload;
          if (typeof baselineValue === 'string') {
            try {
              baselineValue = JSON.parse(baselineValue);
            } catch {
              // Keep as string if not valid JSON
            }
          }
          results[dbFlag.flagName].value = baselineValue;
        } else {
          const type = dbFlag.variantType || "boolean";
          let defaultVal: any = false;
          if (type === 'string') defaultVal = "";
          else if (type === 'number') defaultVal = 0;
          else if (type === 'json') defaultVal = {};
          results[dbFlag.flagName].value = defaultVal;
        }
      }
    }

    res.json({
      success: true,
      data: results,
      meta: {
        evaluatedAt: new Date().toISOString()
      }
    });

  });
}
