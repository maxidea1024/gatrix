import { Request, Response } from 'express';
import crypto from 'crypto';
import { ulid } from 'ulid';
import { ClientVersionService } from '../services/ClientVersionService';
import { ClientVersionModel, ClientStatus } from '../models/ClientVersion';
import { GameWorldService } from '../services/GameWorldService';
import { cacheService } from '../services/CacheService';
import { pubSubService } from '../services/PubSubService';
import { GAME_WORLDS, DEFAULT_CONFIG, withEnvironment } from '../constants/cacheKeys';
import logger from '../config/logger';
import { asyncHandler } from '../utils/asyncHandler';
import VarsModel from '../models/Vars';
import { sendBadRequest, sendSuccessResponse, ErrorCodes } from '../utils/apiResponse';
import { IpWhitelistService } from '../services/IpWhitelistService';
import { SDKRequest } from '../middleware/apiTokenAuth';
import { resolvePassiveData } from '../utils/passiveDataUtils';
import { FeatureFlagModel, FeatureSegmentModel, FeatureVariantModel } from '../models/FeatureFlag';
import {
  FeatureFlagEvaluator,
  FeatureFlag,
  FeatureSegment,
  EvaluationContext,
  VARIANT_SOURCE,
} from '@gatrix/shared';
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
    try {
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
        if (!context.remoteAddress && req.query.remoteAddress)
          context.remoteAddress = req.query.remoteAddress as string;
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
      if (!context.remoteAddress) context.remoteAddress = ClientController.getClientIp(req);
      context.environment = environment;

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
            db('g_feature_strategies as s')
              .leftJoin('g_feature_flag_segments as fs', 's.id', 'fs.strategyId')
              .leftJoin('g_feature_segments as seg', 'fs.segmentId', 'seg.id')
              .select('s.*', db.raw('GROUP_CONCAT(seg.segmentName) as strategySegmentNames'))
              .whereIn('s.flagId', flagIds)
              .where('s.environment', environment)
              .groupBy('s.id')
              .orderBy('s.sortOrder', 'asc'),
          ]);
        }

        // Process variants and strategies with safety
        const flagsWithData = flagsData.flags.map((f: any) => {
          const flagVariants = allVariants
            .filter((v: any) => v.flagId === f.id)
            .map((v: any) => {
              let value = v.value;
              if (typeof value === 'string' && value.trim() !== '') {
                try {
                  value = JSON.parse(value);
                } catch (e) {
                  logger.warn(`Failed to parse variant value for flag ${f.flagName}`, {
                    value,
                  });
                }
              }
              return {
                variantName: v.variantName,
                weight: v.weight,
                value,
              };
            });

          const flagStrategies = allStrategies
            .filter((s: any) => s.flagId === f.id)
            .map((s: any) => {
              let parameters = s.parameters;
              if (typeof parameters === 'string' && parameters.trim() !== '') {
                try {
                  parameters = JSON.parse(parameters);
                } catch (e) {
                  logger.warn(`Failed to parse strategy parameters for flag ${f.flagName}`);
                }
              }

              let constraints = s.constraints;
              if (typeof constraints === 'string' && constraints.trim() !== '') {
                try {
                  constraints = JSON.parse(constraints);
                } catch (e) {
                  logger.warn(`Failed to parse strategy constraints for flag ${f.flagName}`);
                }
              }

              return {
                strategyName: s.strategyName,
                parameters: parameters || {},
                constraints: constraints || [],
                segments: s.strategySegmentNames ? s.strategySegmentNames.split(',') : [],
                isEnabled: Boolean(s.isEnabled),
              };
            });

          return {
            ...f,
            variants: flagVariants,
            strategies: flagStrategies,
          };
        });

        definitions = {
          flags: flagsWithData,
          segments: segmentsList,
        };

        await cacheService.set(definitionsCacheKey, definitions, 5 * 60 * 1000); // 5 minutes cache
      }

      const flags = definitions?.flags || [];
      const segments = definitions?.segments || [];

      // Map segments to SDK type
      const segmentsMap = new Map<string, FeatureSegment>(
        segments.map((s: any) => {
          let constraints = s.constraints;
          if (typeof constraints === 'string' && constraints.trim() !== '') {
            try {
              constraints = JSON.parse(constraints);
            } catch (e) {
              logger.warn(`Failed to parse segment constraints for segment ${s.segmentName}`);
            }
          }
          return [
            s.segmentName,
            {
              name: s.segmentName,
              constraints: constraints || [],
              isActive: Boolean(s.isActive),
            },
          ];
        })
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
        // Resolve enabled/disabled values (Environment > Global)
        const envSettings = dbFlag.environments?.find((e: any) => e.environment === environment);

        const resolvedEnabledValue = envSettings?.enabledValue ?? dbFlag.enabledValue;
        const resolvedDisabledValue = envSettings?.disabledValue ?? dbFlag.disabledValue;

        // Map DB flag to SDK FeatureFlag type for evaluation
        const sdkFlag: FeatureFlag = {
          id: dbFlag.id?.toString() || '',
          name: dbFlag.flagName,
          isEnabled: dbFlag.isEnabled,
          impressionDataEnabled: dbFlag.impressionDataEnabled,
          valueType: dbFlag.valueType || 'string',
          enabledValue: resolvedEnabledValue,
          disabledValue: resolvedDisabledValue,
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
              value: v.value,
              valueType: v.valueType,
            })) || [],
        };

        const result = FeatureFlagEvaluator.evaluate(sdkFlag, context, segmentsMap);

        // Build variant object according to Gatrix client specification
        // Updated to support separate enabled/disabled values
        let variant: {
          name: string;
          value?: any;
          enabled: boolean;
        };

        if (result.enabled && result.variant) {
          // Active variant from strategy/rollout
          variant = {
            name: result.variant.name,
            enabled: true,
          };
          // result.variant from sdk already has the value (we mapped it from db)
          variant.value = (result.variant as any).value;

          // Override variant name for default variants based on value source
          if (
            result.variant.name === VARIANT_SOURCE.FLAG_DEFAULT_ENABLED ||
            result.variant.name === VARIANT_SOURCE.FLAG_DEFAULT_DISABLED
          ) {
            if (envSettings?.enabledValue !== undefined) {
              variant.name = VARIANT_SOURCE.ENV_DEFAULT_ENABLED;
            } else {
              variant.name = VARIANT_SOURCE.FLAG_DEFAULT_ENABLED;
            }
          }
        } else {
          // Determine correct value based on state
          const rawValue = result.enabled ? resolvedEnabledValue : resolvedDisabledValue;
          const valueToReturn =
            rawValue ??
            (dbFlag.valueType === 'boolean'
              ? false
              : dbFlag.valueType === 'number'
                ? 0
                : dbFlag.valueType === 'json'
                  ? {}
                  : '');

          // Determine explicit variant name based on value source
          let variantName: string;
          if (result.enabled) {
            variantName =
              envSettings?.enabledValue !== undefined
                ? VARIANT_SOURCE.ENV_DEFAULT_ENABLED
                : VARIANT_SOURCE.FLAG_DEFAULT_ENABLED;
          } else {
            variantName =
              envSettings?.disabledValue !== undefined
                ? VARIANT_SOURCE.ENV_DEFAULT_DISABLED
                : VARIANT_SOURCE.FLAG_DEFAULT_DISABLED;
          }

          variant = {
            name: variantName,
            enabled: result.enabled,
            value: valueToReturn,
          };
        }

        results[dbFlag.flagName] = {
          id: dbFlag.id,
          name: dbFlag.flagName,
          enabled: result.enabled,
          variant,
          valueType: dbFlag.valueType || 'string', // Rename variantType -> valueType
          version: dbFlag.version || 1,
          ...(dbFlag.impressionDataEnabled && { impressionData: true }),
        };
      }

      const flagsArray = Object.values(results).sort((a, b) =>
        (b.id || '').localeCompare(a.id || '')
      );
      const responseData = {
        success: true,
        data: {
          flags: flagsArray,
        },
        meta: {
          environment,
          evaluatedAt: new Date().toISOString(),
        },
      };

      // Generate ETag from flags data (hash of stringified flags with versions and variants)
      // We include name, version, enabled state, and variant name for consistency with Edge
      const etagSource = flagsArray
        .map((f: any) => {
          const variantPart = f.variant ? `${f.variant.name}:${f.variant.enabled}` : 'no-variant';
          return `${f.name}:${f.version}:${f.enabled}:${variantPart}`;
        })
        .join('|');
      const etag = `"${crypto.createHash('md5').update(etagSource).digest('hex')}"`;

      // Check If-None-Match header
      const requestEtag = req.headers['if-none-match'];
      if (requestEtag === etag) {
        return res.status(304).end();
      }

      res.set('ETag', etag);
      res.json(responseData);
    } catch (error) {
      logger.error('Error in evaluateFlags:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during flag evaluation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Submit SDK metrics
   * POST /api/v1/client/features/:environment/metrics
   */
  static submitMetrics = asyncHandler(async (req: SDKRequest, res: Response) => {
    const environment = req.params.environment || req.environment;
    const { bucket, appName } = req.body;

    if (!bucket || !bucket.flags) {
      return sendBadRequest(res, 'Invalid metrics payload');
    }

    const aggregatedMetrics: any[] = [];

    // Map bucket.flags to AggregatedMetric[]
    for (const [flagName, counts] of Object.entries(bucket.flags as any)) {
      if ((counts as any).yes > 0) {
        aggregatedMetrics.push({
          flagName,
          enabled: true,
          count: (counts as any).yes,
        });
      }
      if ((counts as any).no > 0) {
        aggregatedMetrics.push({
          flagName,
          enabled: false,
          count: (counts as any).no,
        });
      }
      // Handle variants
      if ((counts as any).variants) {
        for (const [variantName, variantCount] of Object.entries((counts as any).variants as any)) {
          if ((variantCount as number) > 0) {
            aggregatedMetrics.push({
              flagName,
              enabled: true,
              variantName,
              count: variantCount,
            });
          }
        }
      }
    }

    // Process using service (which adds to queue)
    const { featureMetricsService } = await import('../services/FeatureMetricsService');
    const sdkVersion = (req.headers['x-sdk-version'] as string) || req.body.sdkVersion;

    await featureMetricsService.processAggregatedMetrics(
      environment!,
      aggregatedMetrics,
      bucket.stop,
      appName || req.body.appName,
      bucket.start,
      sdkVersion
    );

    // Handle missing flags (unknown flag reporting)
    if (bucket.missing && Object.keys(bucket.missing).length > 0) {
      const { unknownFlagService } = await import('../services/UnknownFlagService');
      const sdkVersion = (req.headers['x-sdk-version'] as string) || req.body.sdkVersion;

      for (const [flagName, count] of Object.entries(bucket.missing as any)) {
        await unknownFlagService.reportUnknownFlag({
          flagName,
          environment: environment!,
          appName: appName || req.body.appName,
          sdkVersion,
          count: (count as number) || 1,
        });
      }
    }

    return sendSuccessResponse(res);
  });

  /**
   * Stream feature flag changes (SSE endpoint)
   * GET /api/v1/client/features/:environment/stream
   *
   * Establishes a Server-Sent Events connection for real-time flag invalidation.
   * Sends 'connected', 'flags_changed', and 'heartbeat' events.
   */
  static streamFlags = asyncHandler(async (req: SDKRequest, res: Response) => {
    const environment = req.params.environment || req.environment;
    if (!environment) {
      return res.status(400).json({ success: false, message: 'Environment is required' });
    }

    // Lazy-import to avoid circular dependencies and import-time side effects
    const { flagStreamingService } = await import('../services/FlagStreamingService');

    // Generate unique client ID
    const clientId = `flag-stream-${ulid()}`;

    // Register SSE client (sets headers, sends 'connected' event, handles cleanup)
    await flagStreamingService.addClient(clientId, environment, res);
  });
}
