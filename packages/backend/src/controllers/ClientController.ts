import { Request, Response } from 'express';
import { ClientVersionService } from '../services/ClientVersionService';
import { ClientVersionModel, ClientStatus } from '../models/ClientVersion';
import { GameWorldService } from '../services/GameWorldService';
import { cacheService } from '../services/CacheService';
import { pubSubService } from '../services/PubSubService';
import { GAME_WORLDS, DEFAULT_CONFIG, withEnvironment } from '../constants/cacheKeys';
import logger from '../config/logger';
import { asyncHandler } from '../utils/asyncHandler';
import VarsModel from '../models/Vars';
import { IpWhitelistService } from '../services/IpWhitelistService';
import { SDKRequest } from '../middleware/apiTokenAuth';
import { resolvePassiveData } from '../utils/passiveDataUtils';
import { FeatureFlagModel, FeatureSegmentModel, FeatureVariantModel } from '../models/FeatureFlag';
import {
  FeatureFlagEvaluator,
  FeatureFlag,
  FeatureSegment,
  EvaluationContext,
} from '@gatrix/server-sdk';
import db from '../config/knex';

export class ClientController {
  /**
   * Extract client IP address from request
   */
  private static getClientIp(req: Request): string {
    let clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';

    // Remove "::ffff:" prefix from IPv4-mapped IPv6 addresses
    if (clientIp.startsWith('::ffff:')) {
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
  static getClientVersion = asyncHandler(async (req: SDKRequest, res: Response) => {
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
        message: 'platform is a required query parameter',
      });
    }

    // Environment is resolved by clientSDKAuth middleware
    const environment = req.environment || 'development';

    // Validate status parameter if provided
    const validStatuses = Object.values(ClientStatus);
    let statusFilter: ClientStatus | undefined;
    if (status) {
      const upperStatus = status.toUpperCase() as ClientStatus;
      if (!validStatuses.includes(upperStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Valid values are: ${validStatuses.join(', ')}`,
        });
      }
      statusFilter = upperStatus;
    }

    // Determine if we should fetch the latest version
    const isLatestRequest = !version || version.toLowerCase() === 'latest';

    // Create cache key (use 'latest' for latest requests)
    const versionKey = isLatestRequest ? 'latest' : version;
    const statusKey = statusFilter ? `:${statusFilter}` : '';
    const baseCacheKey = `client_version:${platform}:${versionKey}${statusKey}${lang ? `:${lang}` : ''}`;

    // Scoping cache by environment
    const cacheKey = environment ? withEnvironment(environment, baseCacheKey) : baseCacheKey;

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
      record = await ClientVersionService.findLatestByPlatform(platform, statusFilter, environment);
    } else {
      // Get exact version match
      record = await ClientVersionService.findByExact(platform, version, environment);
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        message: isLatestRequest
          ? `No client version found for platform: ${platform} in environment: ${environment}${statusFilter ? ` with status: ${statusFilter}` : ''}`
          : 'Client version not found',
      });
    }

    // Get clientVersionPassiveData from KV settings for the specific environment and resolve by version
    let passiveData = {};
    try {
      const passiveDataStr = await VarsModel.get('$clientVersionPassiveData', environment);
      passiveData = resolvePassiveData(passiveDataStr, record.clientVersion);
    } catch (error) {
      logger.warn(
        `Failed to resolve clientVersionPassiveData for environment ${environment}:`,
        error
      );
    }

    // Parse customPayload
    let customPayload = {};
    try {
      if (record.customPayload) {
        let parsed =
          typeof record.customPayload === 'string'
            ? JSON.parse(record.customPayload)
            : record.customPayload;

        // Handle double-encoded JSON string
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch (e) {
            // ignore
          }
        }

        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          customPayload = parsed;
        }
      }
    } catch (error) {
      logger.warn('Failed to parse customPayload:', error);
    }

    // Merge meta: passiveData first, then customPayload (customPayload overwrites)
    const meta = { ...passiveData, ...customPayload };

    // Get client IP and check whitelist
    const clientIp = this.getClientIp(req);
    let gameServerAddress = record.gameServerAddress;
    let patchAddress = record.patchAddress;

    if (clientIp) {
      const isWhitelisted = await IpWhitelistService.isIpWhitelisted(clientIp, environment);
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
        const maintenanceLocales = await ClientVersionModel.getMaintenanceLocales(record.id);
        if (maintenanceLocales && maintenanceLocales.length > 0) {
          // Try to find message for requested language
          if (lang) {
            const localeMessage = maintenanceLocales.find((m: any) => m.lang === lang);
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
        logger.warn('Failed to get maintenance locales:', error);
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
        record.clientStatus === ClientStatus.MAINTENANCE ? false : Boolean(record.guestModeAllowed),
      externalClickLink: record.externalClickLink,
      meta,
    };

    // Add maintenance message if status is MAINTENANCE
    if (record.clientStatus === ClientStatus.MAINTENANCE) {
      clientData.maintenanceMessage = maintenanceMessage || '';
    }

    // Cache the result for 5 minutes
    await cacheService.set(cacheKey, clientData, 5 * 60 * 1000);

    return res.json({
      success: true,
      data: clientData,
      cached: false,
    });
  });

  /**
   * Get all game worlds
   * GET /api/v1/client/game-worlds
   */
  static getGameWorlds = asyncHandler(async (req: SDKRequest, res: Response) => {
    const environment = req.environment || 'development';
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
    await cacheService.set(cacheKey, clientData, DEFAULT_CONFIG.GAME_WORLDS_PUBLIC_TTL);

    res.json({
      success: true,
      data: clientData,
      cached: false,
    });
  });

  /**
   * Get cache statistics (for monitoring)
   * GET /api/v1/client/cache-stats
   */
  static getCacheStats = asyncHandler(async (req: SDKRequest, res: Response) => {
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
  });

  /**
   * Invalidate game worlds cache (for testing)
   * POST /api/v1/client/invalidate-cache
   */
  static invalidateCache = asyncHandler(async (req: SDKRequest, res: Response) => {
    const environment = req.environment || 'development';
    await GameWorldService.invalidateCache(environment);

    res.json({
      success: true,
      message: 'Game worlds cache invalidated successfully',
    });
  });

  /**
   * Evaluate feature flags (Server-side evaluation)
   * POST /api/v1/client/features/:environment/eval
   * GET /api/v1/client/features/:environment/eval
   */
  static evaluateFlags = asyncHandler(async (req: SDKRequest, res: Response) => {
    // Environment from path parameter (preferred) or header (fallback)
    const environment = req.params.environment || req.environment;
    if (!environment) {
      return res.status(400).json({ success: false, message: 'Environment is required' });
    }

    let context: EvaluationContext = {};

    let flagNames: string[] | undefined;

    // 1. Extract context and keys
    if (req.method === 'POST') {
      context = req.body.context || {};
      flagNames = req.body.flagNames;
    } else {
      // GET: context from parameters (Unleash Proxy style) or header

      // 1. Try X-Gatrix-Feature-Context header (Base64 JSON)
      const contextHeader = req.headers['x-gatrix-feature-context'] as string;
      if (contextHeader) {
        try {
          const jsonStr = Buffer.from(contextHeader, 'base64').toString('utf-8');
          context = JSON.parse(jsonStr);
        } catch (error) {
          logger.warn('Failed to parse x-gatrix-feature-context header', { error });
        }
      }

      // 2. Try 'context' query param (Base64 JSON) - if header didn't populate main fields
      if (Object.keys(context).length === 0 && req.query.context) {
        try {
          const contextStr = req.query.context as string;
          const jsonStr = Buffer.from(contextStr, 'base64').toString('utf-8');
          if (jsonStr.trim().startsWith('{')) {
            context = JSON.parse(jsonStr);
          } else {
            context = JSON.parse(contextStr);
          }
        } catch (e) {
          /* ignore */
        }
      }

      // 3. Fallback: Parse individual query parameters (Unleash Proxy standard)
      // Only set if not already present
      if (!context.userId && req.query.userId) context.userId = req.query.userId as string;
      if (!context.sessionId && req.query.sessionId)
        context.sessionId = req.query.sessionId as string;
      if (!context.ip && req.query.remoteAddress) context.ip = req.query.remoteAddress as string;
      if (!context.appName && req.query.appName) context.appName = req.query.appName as string;

      // Handle properties[key]=value
      // Cast query to any to bypass strict type checking on ParsedQs
      const query = req.query as any;
      if (query.properties) {
        context.properties = {
          ...context.properties,
          ...query.properties,
        };
      }

      const flagNamesParam = req.query.flagNames as string;
      if (flagNamesParam) {
        flagNames = flagNamesParam.split(',');
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
      // We need ALL flags to evaluate, and ALL segments, and ALL variants
      const [flagsData, segmentsList] = await Promise.all([
        FeatureFlagModel.findAll({ environment, limit: 10000 }),
        FeatureSegmentModel.findAll(),
      ]);

      // Load variants and strategies for all flags
      const flagIds = flagsData.flags.map((f: any) => f.id);
      let allVariants: any[] = [];
      let allStrategies: any[] = [];
      if (flagIds.length > 0) {
        [allVariants, allStrategies] = await Promise.all([
          db('g_feature_variants').whereIn('flagId', flagIds).where('environment', environment),
          db('g_feature_strategies')
            .whereIn('flagId', flagIds)
            .where('environment', environment)
            .orderBy('sortOrder', 'asc'),
        ]);
      }

      // Attach variants and strategies to each flag
      const flagsWithData = flagsData.flags.map((f: any) => ({
        ...f,
        variants: allVariants
          .filter((v: any) => v.flagId === f.id)
          .map((v: any) => ({
            variantName: v.variantName,
            weight: v.weight,
            payload: typeof v.payload === 'string' ? JSON.parse(v.payload) : v.payload,
          })),
        strategies: allStrategies
          .filter((s: any) => s.flagId === f.id)
          .map((s: any) => ({
            strategyName: s.strategyName,
            parameters: typeof s.parameters === 'string' ? JSON.parse(s.parameters) : s.parameters,
            constraints:
              typeof s.constraints === 'string' ? JSON.parse(s.constraints) : s.constraints,
            segments: [], // TODO: Load segment links if needed
            isEnabled: Boolean(s.isEnabled),
          })),
      }));

      definitions = {
        flags: flagsWithData,
        segments: segmentsList,
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
          isActive: s.isActive,
        },
      ])
    );

    // 3. Evaluate
    const results: Record<string, any> = {};

    // If specific flags are requested, check for not found ones
    if (flagNames && flagNames.length > 0) {
      const existingFlagNames = flags.map((f: any) => f.flagName);
      for (const requestedName of flagNames) {
        if (!existingFlagNames.includes(requestedName)) {
          results[requestedName] = {
            name: requestedName,
            enabled: false,
            variant: {
              name: 'disabled',
              enabled: false,
            },
            matchReason: 'not_found',
          };
        }
      }
    }

    const evaluableFlags = flagNames
      ? flags.filter((f: any) => flagNames!.includes(f.flagName))
      : flags;

    for (const dbFlag of evaluableFlags) {
      // Map DB flag to SDK FeatureFlag type
      const sdkFlag: FeatureFlag = {
        name: dbFlag.flagName,
        isEnabled: dbFlag.isEnabled,
        impressionDataEnabled: dbFlag.impressionDataEnabled,
        strategies:
          dbFlag.strategies?.map((s: any) => ({
            name: s.strategyName,
            parameters: s.parameters,
            constraints: s.constraints,
            segments: s.segments,
            isEnabled: s.isEnabled,
          })) || [],
        variants:
          dbFlag.variants?.map((v: any) => ({
            name: v.variantName,
            weight: v.weight,
            payload: v.payload,
            payloadType: dbFlag.variantType || v.payloadType,
          })) || [],
      };

      const result = FeatureFlagEvaluator.evaluate(sdkFlag, context, segmentsMap);

      // Build variant object according to Unleash client specification
      let variant: {
        name: string;
        payload?: string;
        enabled: boolean;
      };

      if (result.enabled && result.variant) {
        // Active variant
        variant = {
          name: result.variant.name,
          enabled: true,
        };
        if (result.variant.payload) {
          let payloadValue = result.variant.payload.value ?? result.variant.payload;

          // If variant type is JSON, ensure converting to compact JSON string
          if (dbFlag.variantType === 'json' && typeof payloadValue === 'string') {
            try {
              // Parse and re-stringify to remove whitespaces/newlines
              payloadValue = JSON.stringify(JSON.parse(payloadValue));
            } catch (e) {
              // If not valid JSON, keep as is
            }
          } else if (typeof payloadValue !== 'string') {
            payloadValue = JSON.stringify(payloadValue);
          }

          variant.payload = payloadValue;
        }
      } else {
        // Disabled or no variant - fallback "$none" variant with baselinePayload
        variant = {
          name: 'disabled',
          enabled: false,
        };
        // Add baselinePayload if defined
        if (dbFlag.baselinePayload !== undefined && dbFlag.baselinePayload !== null) {
          let baselineValue = dbFlag.baselinePayload;
          if (typeof baselineValue === 'string') {
            try {
              baselineValue = JSON.parse(baselineValue);
            } catch {
              // Keep as string if not valid JSON
            }
          }
          variant.payload =
            typeof baselineValue === 'string' ? baselineValue : JSON.stringify(baselineValue);
        }
      }

      results[dbFlag.flagName] = {
        name: dbFlag.flagName,
        enabled: result.enabled,
        variant,
        variantType: dbFlag.variantType || 'string',
        version: dbFlag.version || 1,
        ...(dbFlag.impressionDataEnabled && { impressionData: true }),
      };
    }

    res.json({
      success: true,
      data: {
        flags: Object.values(results),
      },
      meta: {
        environment,
        evaluatedAt: new Date().toISOString(),
      },
    });
  });
}
