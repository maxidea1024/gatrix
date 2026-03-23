import { Router, Response } from 'express';
import { metricsAggregator } from '../services/metrics-aggregator';
import { performEvaluation } from '../utils/evaluation-helper';
import {
  ErrorCodes,
  sendBadRequest,
  sendInternalError,
} from '../utils/api-response';
import { createLogger } from '../config/logger';
import { serverAuth, ServerRequest } from '../middleware/server-auth';

const logger = createLogger('ServerRoute');

const router = Router();

/**
 * GET /api/v1/server/features
 * Returns cached feature flags and segments for the token's environment
 */
router.get(
  '/features',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    try {
      const { getSDKOrError } = await import('../utils/evaluation-helper');
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const cacheKey = req.cacheKey!;
      let flags = sdk.featureFlag.getCached(cacheKey);

      // Filter by flagNames query parameter (comma-separated) if provided
      const flagNamesParam = req.query.flagNames as string | undefined;
      if (flagNamesParam) {
        const flagNamesFilter = new Set(
          flagNamesParam
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean)
        );
        flags = flags.filter((f: any) => flagNamesFilter.has(f.name));
      }

      // Resolve projectId for segment scoping
      const projectId = sdk.featureFlag.getProjectIdForEnvironment(cacheKey);

      // When flagNames filter is applied, only include segments referenced by the filtered flags
      let segments: any[];
      if (flagNamesParam) {
        const referencedSegmentNames = new Set<string>();
        for (const flag of flags) {
          for (const strategy of (flag as any).strategies || []) {
            for (const segName of strategy.segments || []) {
              referencedSegmentNames.add(segName);
            }
          }
        }
        const allSegments = sdk.featureFlag.getAllSegments(projectId);
        segments = Array.from(allSegments.values()).filter((s: any) =>
          referencedSegmentNames.has(s.name)
        );
      } else {
        segments = Array.from(
          sdk.featureFlag.getAllSegments(projectId).values()
        );
      }

      // Parse compact option
      const compact = req.query.compact === 'true' || req.query.compact === '1';

      // When compact mode is enabled, strip evaluation data from disabled flags
      const responseFlags = compact
        ? flags.map((f: any) => {
            if (!f.isEnabled) {
              const { strategies, variants, enabledValue, ...rest } = f;
              return { ...rest, compact: true };
            }
            return f;
          })
        : flags;

      const data: { flags: any[]; segments?: any[] } = { flags: responseFlags };
      if (segments.length > 0) {
        data.segments = segments;
      }

      res.json({
        success: true,
        data,
        cached: true,
      });
    } catch (error) {
      sendInternalError(
        res,
        'Failed to serve features from edge',
        error,
        ErrorCodes.RESOURCE_FETCH_FAILED
      );
    }
  }
);

/**
 * GET /api/v1/server/segments
 * Returns cached segments for the token's project
 */
router.get(
  '/segments',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    try {
      const { getSDKOrError } = await import('../utils/evaluation-helper');
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      // Resolve projectId from cacheKey for project-scoped segments
      const cacheKey = req.cacheKey!;
      const projectId = sdk.featureFlag.getProjectIdForEnvironment(cacheKey);
      let segments = Array.from(
        sdk.featureFlag.getAllSegments(projectId).values()
      );

      // Filter by segmentNames query parameter (comma-separated) if provided
      const segmentNamesParam = req.query.segmentNames as string | undefined;
      if (segmentNamesParam) {
        const segmentNamesFilter = new Set(
          segmentNamesParam
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean)
        );
        segments = segments.filter((s: any) => segmentNamesFilter.has(s.name));
      }

      res.json({
        success: true,
        data: { segments },
        cached: true,
      });
    } catch (error) {
      sendInternalError(
        res,
        'Failed to serve segments from edge',
        error,
        ErrorCodes.RESOURCE_FETCH_FAILED
      );
    }
  }
);

/**
 * POST /api/v1/server/features/metrics
 * Buffers and aggregates server metrics
 */
router.post(
  '/features/metrics',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    try {
      const environmentId = req.environmentId!;
      const appName = req.applicationName || 'unknown';
      const sdkVersion = req.headers['x-sdk-version'] as string | undefined;
      const { metrics } = req.body;

      if (!Array.isArray(metrics)) {
        return sendBadRequest(res, 'metrics must be an array');
      }

      metricsAggregator.addServerMetrics(
        environmentId,
        appName,
        metrics,
        sdkVersion
      );
      res.json({ success: true, buffered: true });
    } catch (error) {
      sendInternalError(res, 'Failed to buffer server metrics', error);
    }
  }
);

/**
 * POST /api/v1/server/features/unknown
 * Buffers and aggregates unknown flag reporting
 */
router.post(
  '/features/unknown',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    try {
      const environmentId = req.environmentId!;
      const appName = req.applicationName || 'unknown';
      const sdkVersion = req.headers['x-sdk-version'] as string | undefined;
      const { flagName, count = 1 } = req.body;

      if (!flagName) {
        return sendBadRequest(res, 'flagName is required');
      }

      metricsAggregator.addServerUnknownReport(
        environmentId,
        appName,
        flagName,
        count,
        sdkVersion
      );
      res.json({ success: true, buffered: true });
    } catch (error) {
      sendInternalError(
        res,
        'Failed to buffer server unknown flag report',
        error
      );
    }
  }
);

/**
 * POST /api/v1/server/features/eval
 */
router.post(
  '/features/eval',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    await performEvaluation(
      req,
      res,
      {
        environmentId: req.environmentId,
        applicationName: req.applicationName,
        cacheKey: req.cacheKey,
      },
      true
    );
  }
);

/**
 * GET /api/v1/server/features/eval
 */
router.get(
  '/features/eval',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    await performEvaluation(
      req,
      res,
      {
        environmentId: req.environmentId,
        applicationName: req.applicationName,
        cacheKey: req.cacheKey,
      },
      false
    );
  }
);

// ============================================================================
// Game World Routes
// ============================================================================

/**
 * GET /api/v1/server/game-worlds
 * Returns all visible game worlds sorted by displayOrder with tags and maintenance info
 */
router.get(
  '/game-worlds',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    try {
      const { getSDKOrError } = await import('../utils/evaluation-helper');
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const cacheKey = req.cacheKey!;
      const envWorlds = sdk.gameWorld.getCached(cacheKey) as any[];

      // Filter visible worlds only (same as Backend)
      const visibleWorlds = envWorlds.filter(
        (w) => w.isVisible !== false && w.isVisible !== 0
      );

      // Helper function to convert MySQL BOOLEAN (0/1) to boolean
      const toBoolean = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value === 1;
        if (typeof value === 'string')
          return value === '1' || value.toLowerCase() === 'true';
        return false;
      };

      // Helper function to parse JSON field
      const parseJsonField = (payload: any): Record<string, any> | null => {
        if (!payload) return null;
        if (typeof payload === 'string') {
          try {
            return JSON.parse(payload);
          } catch {
            return null;
          }
        }
        if (typeof payload === 'object') return payload;
        return null;
      };

      // Transform data (same format as Backend ServerGameWorldController)
      const worlds = visibleWorlds.map((world: any) => {
        const worldData: any = {
          id: world.id,
          worldId: world.worldId,
          name: world.name,
          isMaintenance: toBoolean(world.isMaintenance),
          displayOrder: world.displayOrder,
          worldServerAddress: world.worldServerAddress || null,
          customPayload: parseJsonField(world.customPayload),
          infraSettings: parseJsonField(world.infraSettings),
          tags: world.tags || [],
          createdAt: world.createdAt,
        };

        // Add maintenance info if in maintenance mode
        if (toBoolean(world.isMaintenance)) {
          if (world.maintenanceStartDate) {
            worldData.maintenanceStartDate = world.maintenanceStartDate;
          }
          if (world.maintenanceEndDate) {
            worldData.maintenanceEndDate = world.maintenanceEndDate;
          }
          if (world.maintenanceMessage) {
            worldData.maintenanceMessage = world.maintenanceMessage;
          }
          if (
            world.maintenanceLocales &&
            world.maintenanceLocales.length > 0
          ) {
            worldData.maintenanceLocales = world.maintenanceLocales.map(
              (locale: any) => ({
                lang: locale.lang,
                message: locale.message,
              })
            );
          }
        }

        return worldData;
      });

      logger.info(
        `Server SDK (Edge): Retrieved ${worlds.length} visible game worlds`
      );

      res.json({
        success: true,
        data: {
          worlds,
        },
      });
    } catch (error) {
      sendInternalError(
        res,
        'Failed to retrieve game worlds',
        error,
        ErrorCodes.RESOURCE_FETCH_FAILED
      );
    }
  }
);

/**
 * GET /api/v1/server/game-worlds/world/:worldId
 * Get specific game world by worldId
 */
router.get(
  '/game-worlds/world/:worldId',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    try {
      const { getSDKOrError } = await import('../utils/evaluation-helper');
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const { worldId } = req.params;
      const cacheKey = req.cacheKey!;

      if (!worldId || typeof worldId !== 'string') {
        return sendBadRequest(res, 'World ID must be a non-empty string');
      }

      const envWorlds = sdk.gameWorld.getCached(cacheKey) as any[];
      const world = envWorlds.find((w: any) => w.worldId === worldId);

      if (!world) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Game world not found: ${worldId}`,
          },
        });
      }

      // Helper function to convert MySQL BOOLEAN (0/1) to boolean
      const toBoolean = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value === 1;
        if (typeof value === 'string')
          return value === '1' || value.toLowerCase() === 'true';
        return false;
      };

      // Helper function to parse JSON field
      const parseJsonField = (payload: any): Record<string, any> | null => {
        if (!payload) return null;
        if (typeof payload === 'string') {
          try {
            return JSON.parse(payload);
          } catch {
            return null;
          }
        }
        if (typeof payload === 'object') return payload;
        return null;
      };

      const worldData: any = {
        id: world.id,
        worldId: world.worldId,
        name: world.name,
        isMaintenance: toBoolean(world.isMaintenance),
        displayOrder: world.displayOrder,
        worldServerAddress: world.worldServerAddress || null,
        customPayload: parseJsonField(world.customPayload),
        infraSettings: parseJsonField(world.infraSettings),
        tags: world.tags || [],
        createdAt: world.createdAt,
      };

      // Add maintenance info if in maintenance mode
      if (toBoolean(world.isMaintenance)) {
        if (world.maintenanceStartDate) {
          worldData.maintenanceStartDate = world.maintenanceStartDate;
        }
        if (world.maintenanceEndDate) {
          worldData.maintenanceEndDate = world.maintenanceEndDate;
        }
        if (world.maintenanceMessage) {
          worldData.maintenanceMessage = world.maintenanceMessage;
        }
        if (
          world.maintenanceLocales &&
          world.maintenanceLocales.length > 0
        ) {
          worldData.maintenanceLocales = world.maintenanceLocales.map(
            (locale: any) => ({
              lang: locale.lang,
              message: locale.message,
            })
          );
        }
      }

      res.json({
        success: true,
        data: worldData,
        meta: {
          timestamp: new Date().toISOString(),
          apiVersion: '1.0.0',
        },
      });
    } catch (error) {
      sendInternalError(
        res,
        'Failed to retrieve game world',
        error,
        ErrorCodes.RESOURCE_FETCH_FAILED
      );
    }
  }
);

/**
 * GET /api/v1/server/game-worlds/:id
 * Get specific game world by ID
 */
router.get(
  '/game-worlds/:id',
  serverAuth,
  async (req: ServerRequest, res: Response) => {
    try {
      const { getSDKOrError } = await import('../utils/evaluation-helper');
      const sdk = getSDKOrError(res);
      if (!sdk) return;

      const { id } = req.params;
      const cacheKey = req.cacheKey!;

      if (!id) {
        return sendBadRequest(res, 'Game world ID is required');
      }

      const envWorlds = sdk.gameWorld.getCached(cacheKey) as any[];
      const world = envWorlds.find((w: any) => w.id === id);

      if (!world) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Game world not found: ${id}`,
          },
        });
      }

      // Helper function to convert MySQL BOOLEAN (0/1) to boolean
      const toBoolean = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value === 1;
        if (typeof value === 'string')
          return value === '1' || value.toLowerCase() === 'true';
        return false;
      };

      // Helper function to parse JSON field
      const parseJsonField = (payload: any): Record<string, any> | null => {
        if (!payload) return null;
        if (typeof payload === 'string') {
          try {
            return JSON.parse(payload);
          } catch {
            return null;
          }
        }
        if (typeof payload === 'object') return payload;
        return null;
      };

      const worldData: any = {
        id: world.id,
        worldId: world.worldId,
        name: world.name,
        isMaintenance: toBoolean(world.isMaintenance),
        displayOrder: world.displayOrder,
        worldServerAddress: world.worldServerAddress || null,
        customPayload: parseJsonField(world.customPayload),
        infraSettings: parseJsonField(world.infraSettings),
        tags: world.tags || [],
        createdAt: world.createdAt,
      };

      // Add maintenance info if in maintenance mode
      if (toBoolean(world.isMaintenance)) {
        if (world.maintenanceStartDate) {
          worldData.maintenanceStartDate = world.maintenanceStartDate;
        }
        if (world.maintenanceEndDate) {
          worldData.maintenanceEndDate = world.maintenanceEndDate;
        }
        if (world.maintenanceMessage) {
          worldData.maintenanceMessage = world.maintenanceMessage;
        }
        if (
          world.maintenanceLocales &&
          world.maintenanceLocales.length > 0
        ) {
          worldData.maintenanceLocales = world.maintenanceLocales.map(
            (locale: any) => ({
              lang: locale.lang,
              message: locale.message,
            })
          );
        }
      }

      res.json({
        success: true,
        data: worldData,
        meta: {
          timestamp: new Date().toISOString(),
          apiVersion: '1.0.0',
        },
      });
    } catch (error) {
      sendInternalError(
        res,
        'Failed to retrieve game world',
        error,
        ErrorCodes.RESOURCE_FETCH_FAILED
      );
    }
  }
);

export default router;
