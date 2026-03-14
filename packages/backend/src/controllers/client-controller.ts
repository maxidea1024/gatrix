import { Request, Response } from 'express';
import crypto from 'crypto';
import { ulid } from 'ulid';
import { ClientVersionService } from '../services/client-version-service';
import { ClientVersionModel, ClientStatus } from '../models/client-version';
import { GameWorldService } from '../services/game-world-service';
import { cacheService } from '../services/cache-service';
import { pubSubService } from '../services/pub-sub-service';
import {
  GAME_WORLDS,
  DEFAULT_CONFIG,
  withEnvironment,
} from '../constants/cache-keys';
import { asyncHandler } from '../utils/async-handler';
import { VarsService } from '../services/vars-service';
import { sendBadRequest, sendSuccessResponse } from '../utils/api-response';
import { IpWhitelistService } from '../services/ip-whitelist-service';
import { SDKRequest } from '../middleware/api-token-auth';
import { resolvePassiveData } from '../utils/passive-data-utils';
import { FeatureFlagModel, FeatureSegmentModel } from '../models/FeatureFlag';
import {
  FeatureFlagEvaluator,
  FeatureFlag,
  FeatureSegment,
  EvaluationUtils,
} from '@gatrix/evaluator';
import db from '../config/knex';

import { createLogger } from '../config/logger';
const logger = createLogger('ClientController');

export class ClientController {
  /**
   * Extract client IP address from request
   */
  private static getClientIp(req: Request): string {
    let clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      '';

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
  static getClientVersion = asyncHandler(
    async (req: SDKRequest, res: Response) => {
      const { platform, version, status, lang, channel, subChannel } =
        req.query as {
          platform?: string;
          version?: string;
          status?: string;
          lang?: string;
          channel?: string;
          subChannel?: string;
        };

      // Validate required query params - platform is always required
      if (!platform) {
        return res.status(400).json({
          success: false,
          message: 'platform is a required query parameter',
        });
      }

      // Environment is resolved by clientSDKAuth middleware
      const environmentId = req.environmentId!;

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
      const channelKey = channel ? `:${channel}` : '';
      const subChannelKey = subChannel ? `:${subChannel}` : '';
      const baseCacheKey = `client_version:${platform}:${versionKey}${statusKey}${channelKey}${subChannelKey}${lang ? `:${lang}` : ''}`;

      // Scoping cache by environment
      const cacheKey = environmentId
        ? withEnvironment(environmentId, baseCacheKey)
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
          environmentId
        );
      } else {
        // Get exact version match
        record = await ClientVersionService.findByExact(
          platform,
          version,
          environmentId
        );
      }

      if (!record) {
        return res.status(404).json({
          success: false,
          message: isLatestRequest
            ? `No client version found for platform: ${platform} in environmentId: ${environmentId}${statusFilter ? ` with status: ${statusFilter}` : ''}`
            : 'Client version not found',
        });
      }

      // Get clientVersionPassiveData from KV settings for the specific environment and resolve by version
      let passiveData = {};
      try {
        const passiveDataStr = await VarsService.get(
          '$clientVersionPassiveData',
          environmentId
        );
        passiveData = resolvePassiveData(passiveDataStr, record.clientVersion);
      } catch (error) {
        logger.warn(
          `Failed to resolve clientVersionPassiveData for environmentId ${environmentId}:`,
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

      // Handle channel/subChannel appUpdateUrl for forced/recommended updates
      if (
        channel &&
        (record.clientStatus === ClientStatus.FORCED_UPDATE ||
          record.clientStatus === ClientStatus.RECOMMENDED_UPDATE)
      ) {
        try {
          const channelsStr = await VarsService.get('$channels', environmentId);
          if (channelsStr) {
            const channels = JSON.parse(channelsStr);
            if (Array.isArray(channels)) {
              const channelData = channels.find(
                (c: any) => c.value === channel
              );
              if (channelData) {
                const targetSubChannel = subChannel;
                if (
                  targetSubChannel &&
                  Array.isArray(channelData.subChannels)
                ) {
                  const subChannelData = channelData.subChannels.find(
                    (sc: any) => sc.value === targetSubChannel
                  );
                  if (subChannelData && subChannelData.appUpdateUrl) {
                    (meta as any).appUpdateUrl = subChannelData.appUpdateUrl;
                  } else {
                    logger.debug(
                      'Backend: subChannelData not found or appUpdateUrl missing',
                      {
                        subChannel,
                        availableSubChannels: channelData.subChannels.map(
                          (sc: any) => sc.value
                        ),
                      }
                    );
                  }
                } else {
                  logger.debug(
                    'Backend: targetSubChannel not provided or subChannels missing',
                    {
                      subChannel,
                      hasSubChannels: !!channelData.subChannels,
                    }
                  );
                }
              } else {
                logger.debug('Backend: channelData not found in $channels', {
                  channel,
                  availableChannels: channels.map((c: any) => c.value),
                });
              }
            } else {
              logger.debug('Backend: $channels KV is not an array', {
                environmentId,
              });
            }
          } else {
            logger.debug('Backend: $channels KV not found', { environmentId });
          }
        } catch (e) {
          logger.warn(
            'Failed to process $channel KV for appUpdateUrl in backend',
            {
              error: e,
              environmentId,
              channel,
              subChannel,
            }
          );
        }
      }

      // Get client IP and check whitelist
      const clientIp = this.getClientIp(req);
      let gameServerAddress = record.gameServerAddress;
      let patchAddress = record.patchAddress;

      if (clientIp) {
        const isWhitelisted = await IpWhitelistService.isIpWhitelisted(
          clientIp,
          environmentId
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
                (m: any) => m.lang === lang
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
          record.clientStatus === ClientStatus.MAINTENANCE
            ? false
            : Boolean(record.guestModeAllowed),
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
    }
  );

  /**
   * Get all game worlds
   * GET /api/v1/client/game-worlds
   */
  static getGameWorlds = asyncHandler(
    async (req: SDKRequest, res: Response) => {
      const environmentId = req.environmentId!;
      const cacheKey = environmentId
        ? withEnvironment(environmentId, GAME_WORLDS.PUBLIC)
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
        environmentId: environmentId,
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
        DEFAULT_CONFIG.GAME_WORLDS_PUBLIC_TTL
      );

      res.json({
        success: true,
        data: clientData,
        cached: false,
      });
    }
  );

  /**
   * Get cache statistics (for monitoring)
   * GET /api/v1/client/cache-stats
   */
  static getCacheStats = asyncHandler(
    async (_req: SDKRequest, res: Response) => {
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
    }
  );

  /**
   * Invalidate game worlds cache (for testing)
   * POST /api/v1/client/invalidate-cache
   */
  static invalidateCache = asyncHandler(
    async (req: SDKRequest, res: Response) => {
      const environmentId = req.environmentId!;
      await GameWorldService.invalidateCache(environmentId);

      res.json({
        success: true,
        message: 'Game worlds cache invalidated successfully',
      });
    }
  );

  /**
   * Evaluate feature flags (Server-side evaluation)
   * POST /api/v1/client/features/:environment/eval
   * GET /api/v1/client/features/:environment/eval
   */
  static evaluateFlags = asyncHandler(
    async (req: SDKRequest, res: Response) => {
      try {
        // Environment from path parameter (preferred) or header (fallback)
        const environmentId = req.params.environmentId || req.environmentId;
        if (!environmentId) {
          return res
            .status(400)
            .json({ success: false, message: 'Environment is required' });
        }

        // 1. Extract context and flag names from request using common utility
        const { context, flagNames } = EvaluationUtils.extractFromRequest(req);

        // 0. Resolve Context Hash
        const contextHash = EvaluationUtils.getContextHash(req, context);

        const flagNamesHash =
          flagNames && flagNames.length > 0
            ? crypto
                .createHash('md5')
                .update(flagNames.sort().join(','))
                .digest('hex')
            : 'all';

        // 2. Fetch all flags and segments (with caching)
        // We cache the *definitions* for a short time (e.g. 60s) to avoid DB spam
        const definitionsCacheKey = `feature_flags:definitions:${environmentId}`;
        let definitions = await cacheService.get<any>(definitionsCacheKey);

        if (!definitions) {
          // Fetch from DB
          // We need ALL flags to evaluate, and ALL segments, and ALL variants
          const [flagsData, segmentsList] = await Promise.all([
            FeatureFlagModel.findAll({ environmentId, limit: 10000 }),
            FeatureSegmentModel.findAll(),
          ]);

          // Load variants and strategies for all flags
          const flagIds = flagsData.flags.map((f: any) => f.id);
          let allVariants: any[] = [];
          let allStrategies: any[] = [];
          if (flagIds.length > 0) {
            [allVariants, allStrategies] = await Promise.all([
              db('g_feature_variants')
                .whereIn('flagId', flagIds)
                .where('environmentId', environmentId),
              db('g_feature_strategies as s')
                .leftJoin(
                  'g_feature_flag_segments as fs',
                  's.id',
                  'fs.strategyId'
                )
                .leftJoin('g_feature_segments as seg', 'fs.segmentId', 'seg.id')
                .select(
                  's.*',
                  db.raw(
                    'GROUP_CONCAT(seg.segmentName) as strategySegmentNames'
                  )
                )
                .whereIn('s.flagId', flagIds)
                .where('s.environmentId', environmentId)
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
                    logger.warn(
                      `Failed to parse variant value for flag ${f.flagName}`,
                      {
                        value,
                      }
                    );
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
                if (
                  typeof parameters === 'string' &&
                  parameters.trim() !== ''
                ) {
                  try {
                    parameters = JSON.parse(parameters);
                  } catch (e) {
                    logger.warn(
                      `Failed to parse strategy parameters for flag ${f.flagName}`
                    );
                  }
                }

                let constraints = s.constraints;
                if (
                  typeof constraints === 'string' &&
                  constraints.trim() !== ''
                ) {
                  try {
                    constraints = JSON.parse(constraints);
                  } catch (e) {
                    logger.warn(
                      `Failed to parse strategy constraints for flag ${f.flagName}`
                    );
                  }
                }

                return {
                  strategyName: s.strategyName,
                  parameters: parameters || {},
                  constraints: constraints || [],
                  segments: s.strategySegmentNames
                    ? s.strategySegmentNames.split(',')
                    : [],
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

          await cacheService.set(
            definitionsCacheKey,
            definitions,
            5 * 60 * 1000
          ); // 5 minutes cache
        }

        // Check evaluation cache
        // We use definitions object properties to build a unique key for this environment's ruleset
        const definitionsHash = crypto
          .createHash('md5')
          .update(JSON.stringify(definitions))
          .digest('hex');
        const evalCacheKey = `feature_flags:eval_cache:${environmentId}:${contextHash}:${flagNamesHash}:${definitionsHash}`;

        const cachedResult = await cacheService.get<any>(evalCacheKey);
        if (cachedResult) {
          // Verify ETag
          const requestEtag = req.headers['if-none-match'];
          if (requestEtag === cachedResult.etag) {
            return res.status(304).end();
          }
          res.set('ETag', cachedResult.etag);
          return res.json(cachedResult.data);
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
                logger.warn(
                  `Failed to parse segment constraints for segment ${s.segmentName}`
                );
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

        // Non-existent flags are simply excluded from the evaluation results
        // Track missing flags when specific flagNames were requested
        const missingFlags: string[] = [];
        if (flagNames && flagNames.length > 0) {
          const existingFlagNames = flags.map((f: any) => f.flagName);
          for (const requestedName of flagNames) {
            if (!existingFlagNames.includes(requestedName)) {
              missingFlags.push(requestedName);
            }
          }
        }

        const evaluableFlags =
          flagNames && flagNames.length > 0
            ? flags.filter((f: any) => flagNames!.includes(f.flagName))
            : flags;

        for (const dbFlag of evaluableFlags) {
          // Resolve enabled/disabled values using explicit override flags
          const envSettings = dbFlag.environments?.find(
            (e: any) => e.environmentId === environmentId
          );
          const resolvedEnabledValue = envSettings?.overrideEnabledValue
            ? envSettings.enabledValue
            : dbFlag.enabledValue;
          const resolvedDisabledValue = envSettings?.overrideDisabledValue
            ? envSettings.disabledValue
            : dbFlag.disabledValue;

          // Map DB flag to SDK FeatureFlag type for evaluation
          const sdkFlag: FeatureFlag = {
            id: dbFlag.id?.toString() || '',
            name: dbFlag.flagName,
            isEnabled: dbFlag.isEnabled,
            impressionDataEnabled: dbFlag.impressionDataEnabled,
            valueType: dbFlag.valueType || 'string',
            enabledValue: resolvedEnabledValue,
            disabledValue: resolvedDisabledValue,
            valueSource:
              envSettings?.overrideEnabledValue ||
              envSettings?.overrideDisabledValue
                ? 'environment'
                : 'flag',
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
              })) || [],
          };

          const result = FeatureFlagEvaluator.evaluate(
            sdkFlag,
            context,
            segmentsMap
          );

          // Build result using common utility
          results[dbFlag.flagName] = EvaluationUtils.formatResult(
            dbFlag.flagName,
            result,
            {
              id: dbFlag.id,
              valueType: dbFlag.valueType,
              version: dbFlag.version,
              impressionDataEnabled: dbFlag.impressionDataEnabled,
              enabledValue: resolvedEnabledValue,
              disabledValue: resolvedDisabledValue,
              valueSource:
                envSettings?.overrideEnabledValue ||
                envSettings?.overrideDisabledValue
                  ? 'environment'
                  : 'flag',
            }
          );
        }

        const flagsArray = Object.values(results).sort((a, b) =>
          (b.id || '').localeCompare(a.id || '')
        );

        // Build meta with optional missing field
        const meta: any = {
          environmentId,
          evaluatedAt: new Date().toISOString(),
        };
        if (missingFlags.length > 0) {
          meta.missing = missingFlags;
        }

        const responseData = {
          success: true,
          data: {
            flags: flagsArray,
          },
          meta,
        };

        // Generate ETag from flags data using common utility
        const etag = EvaluationUtils.generateETag(contextHash, flagsArray);

        // Check If-None-Match header after evaluation (in case cache missed but result is same)
        const requestEtag = req.headers['if-none-match'];
        if (requestEtag === etag) {
          return res.status(304).end();
        }

        res.set('ETag', etag);

        // Cache evaluation result for 30 seconds
        await cacheService.set(
          evalCacheKey,
          { etag, data: responseData },
          30 * 1000
        );

        res.json(responseData);
      } catch (error) {
        logger.error('Error in evaluateFlags:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error during flag evaluation',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * Submit SDK metrics
   * POST /api/v1/client/features/:environment/metrics
   */
  static submitMetrics = asyncHandler(
    async (req: SDKRequest, res: Response) => {
      const environmentId = req.params.environmentId || req.environmentId;
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
          for (const [variantName, variantCount] of Object.entries(
            (counts as any).variants as any
          )) {
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
      const { featureMetricsService } =
        await import('../services/feature-metrics-service');
      const sdkVersion =
        (req.headers['x-sdk-version'] as string) || req.body.sdkVersion;

      await featureMetricsService.processAggregatedMetrics(
        environmentId!,
        aggregatedMetrics,
        bucket.stop,
        appName || req.body.appName,
        bucket.start,
        sdkVersion
      );

      // Handle missing flags (unknown flag reporting)
      if (bucket.missing && Object.keys(bucket.missing).length > 0) {
        const { unknownFlagService } =
          await import('../services/unknown-flag-service');
        const sdkVersion =
          (req.headers['x-sdk-version'] as string) || req.body.sdkVersion;

        for (const [flagName, count] of Object.entries(bucket.missing as any)) {
          await unknownFlagService.reportUnknownFlag({
            flagName,
            environmentId: environmentId!,
            appName: appName || req.body.appName,
            sdkVersion,
            count: (count as number) || 1,
          });
        }
      }

      return sendSuccessResponse(res);
    }
  );

  /**
   * Stream feature flag changes (SSE endpoint)
   * GET /api/v1/client/features/:environment/stream
   *
   * Establishes a Server-Sent Events connection for real-time flag invalidation.
   * Sends 'connected', 'flags_changed', and 'heartbeat' events.
   */
  static streamFlags = asyncHandler(async (req: SDKRequest, res: Response) => {
    const environmentId = req.params.environmentId || req.environmentId;
    if (!environmentId) {
      return res
        .status(400)
        .json({ success: false, message: 'Environment is required' });
    }

    // Lazy-import to avoid circular dependencies and import-time side effects
    const { flagStreamingService } =
      await import('../services/flag-streaming-service');

    // Generate unique client ID
    const clientId = `flag-stream-${ulid()}`;

    // Register SSE client (sets headers, sends 'connected' event, handles cleanup)
    await flagStreamingService.addClient(clientId, environmentId, res);
  });
}
