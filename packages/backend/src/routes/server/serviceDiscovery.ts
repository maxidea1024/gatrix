/**
 * Service Discovery Server Routes
 *
 * Server SDK endpoints for service discovery
 */

import express from "express";
import { serverSDKAuth } from "../../middleware/apiTokenAuth";
import serviceDiscoveryService from "../../services/serviceDiscoveryService";
import { IpWhitelistModel } from "../../models/IpWhitelist";
import { WhitelistModel } from "../../models/AccountWhitelist";
import logger from "../../config/logger";
import { ulid } from "ulid";
import { pubSubService } from "../../services/PubSubService";
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from "../../constants/cacheKeys";
import { respondWithEtagCache } from "../../utils/serverSdkEtagCache";
import { EnvironmentRequest } from "../../middleware/environmentResolver";

const router = express.Router();

/**
 * Get whitelists (IP and Account)
 * GET /api/v1/server/:env/whitelists
 *
 * Returns enabled whitelists for server-side validation
 * Exported as a separate handler for use in both /services/whitelists and /whitelists paths
 */
export const getWhitelistsHandler = async (
  req: EnvironmentRequest,
  res: any,
) => {
  const environment = req.environment!;
  try {
    await respondWithEtagCache(res, {
      cacheKey: `${SERVER_SDK_ETAG.WHITELISTS}:${environment}`,
      ttlMs: DEFAULT_CONFIG.WHITELIST_TTL,
      requestEtag: req.headers?.["if-none-match"],
      buildPayload: async () => {
        // Get all enabled IP whitelists for this environment
        const ipWhitelistsResult = await IpWhitelistModel.findAll(1, 10000, {
          isEnabled: true,
          environment: environment,
        });
        const now = new Date();

        // Filter by date range
        const activeIpWhitelists = ipWhitelistsResult.ipWhitelists.filter(
          (ip: any) => {
            if (ip.startDate && new Date(ip.startDate) > now) return false;
            if (ip.endDate && new Date(ip.endDate) < now) return false;
            return true;
          },
        );

        // Get all enabled account whitelists for this environment
        const accountWhitelistsResult = await WhitelistModel.findAll(1, 10000, {
          isEnabled: true,
          environment: environment,
        });

        // Filter by date range
        const activeAccountWhitelists =
          accountWhitelistsResult.whitelists.filter((account: any) => {
            if (account.startDate && new Date(account.startDate) > now)
              return false;
            if (account.endDate && new Date(account.endDate) < now)
              return false;
            return true;
          });

        // Format response to match SDK expectations
        const ipWhitelist = activeIpWhitelists.map((ip: any) => ({
          id: ip.id,
          ipAddress: ip.ipAddress,
        }));

        const accountWhitelist = activeAccountWhitelists.map(
          (account: any) => ({
            id: account.id,
            accountId: account.accountId,
          }),
        );

        return {
          success: true,
          data: {
            ipWhitelist,
            accountWhitelist,
          },
        };
      },
    });
  } catch (error: any) {
    logger.error("Failed to get whitelists:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get whitelists",
    });
  }
};

/**
 * Get whitelists route
 * GET /api/v1/server/services/whitelists
 */
router.get("/whitelists", serverSDKAuth, getWhitelistsHandler);

/**
 * Register service instance (full snapshot)
 * POST /api/v1/server/services/register
 *
 * Request body:
 * {
 *   "labels": { "service": "world", "group": "kr", "env": "prod", ... },
 *   "hostname": "server-1",
 *   "internalAddress": "10.0.0.1",
 *   "ports": { "tcp": [8000], "http": [8080] },
 *   "status": "ready",
 *   "stats": { "cpuUsage": 50, "memoryUsage": 1024 },
 *   "meta": { "version": "1.0.0", "startTime": "2025-11-10T00:00:00Z" }
 * }
 *
 * Note: externalAddress is auto-detected from req.ip
 */
router.post("/register", serverSDKAuth, async (req: any, res: any) => {
  try {
    const {
      instanceId: providedInstanceId,
      labels,
      hostname,
      internalAddress,
      ports,
      status,
      stats,
      meta,
    } = req.body;

    // Validate required fields
    if (!labels || !labels.service) {
      return res.status(400).json({
        success: false,
        error: { message: "Missing required field: labels.service" },
      });
    }

    if (!hostname || !internalAddress || !ports) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Missing required fields: hostname, internalAddress, ports",
        },
      });
    }

    // Use provided instance ID or generate a new one
    const instanceId = providedInstanceId || ulid();

    // Auto-detect external address from request IP
    let externalAddress = req.ip || req.connection.remoteAddress || "0.0.0.0";

    // Remove "::ffff:" prefix from IPv4-mapped IPv6 addresses
    if (externalAddress.startsWith("::ffff:")) {
      externalAddress = externalAddress.substring(7);
    }

    // Create service instance (full snapshot)
    const now = new Date().toISOString();
    const instance = {
      instanceId,
      labels,
      hostname,
      externalAddress,
      internalAddress,
      ports,
      status: status || "ready",
      createdAt: now,
      updatedAt: now,
      stats,
      meta,
    };

    // Register to service discovery
    await serviceDiscoveryService.register(instance);

    const serviceType = labels.service;
    logger.info(`Service registered: ${serviceType}:${instanceId}`, {
      labels,
      externalAddress,
    });

    // Publish event for SDK real-time updates
    await pubSubService.publishNotification({
      type: "service.registered",
      data: { instance },
      targetChannels: ["service", "admin"],
    });

    res.json({
      success: true,
      data: { instanceId, hostname, externalAddress },
    });
  } catch (error: any) {
    logger.error("Failed to register service:", error);
    res.status(500).json({
      success: false,
      error: { message: error.message || "Failed to register service" },
    });
  }
});

/**
 * Unregister service instance
 * POST /api/v1/server/services/unregister
 *
 * Request body:
 * {
 *   "instanceId": "01K9NQBSKF4HTHPG2Y4196G982",
 *   "labels": { "service": "world" }
 * }
 */
router.post("/unregister", serverSDKAuth, async (req: any, res: any) => {
  try {
    const { instanceId, labels } = req.body;

    if (!instanceId || !labels || !labels.service) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Missing required fields: instanceId, labels.service",
        },
      });
    }

    const serviceType = labels.service;
    await serviceDiscoveryService.unregister(instanceId, serviceType);

    logger.info(`Service unregistered: ${serviceType}:${instanceId}`);

    // Publish event for SDK real-time updates
    await pubSubService.publishNotification({
      type: "service.terminated",
      data: { instanceId, serviceType },
      targetChannels: ["service", "admin"],
    });

    res.json({
      success: true,
      message: `Service ${serviceType}:${instanceId} unregistered successfully`,
    });
  } catch (error: any) {
    logger.error("Failed to unregister service:", error);
    res.status(500).json({
      success: false,
      error: { message: error.message || "Failed to unregister service" },
    });
  }
});

/**
 * Update service status (partial merge)
 * POST /api/v1/server/services/status
 *
 * Request body:
 * {
 *   "instanceId": "01K9NQBSKF4HTHPG2Y4196G982",
 *   "labels": { "service": "world" },
 *   "status": "ready",  // Optional
 *   "stats": { "cpuUsage": 50, "userCount": 100 },  // Optional, merged with existing
 *   "autoRegisterIfMissing": false  // Optional, default false
 * }
 *
 * Note: meta is not included - it's immutable after registration
 */
router.post("/status", serverSDKAuth, async (req: any, res: any) => {
  try {
    const {
      instanceId,
      labels,
      status,
      stats,
      hostname,
      internalAddress,
      ports,
      meta,
    } = req.body;
    const autoRegisterIfMissing = req.body.autoRegisterIfMissing || false;

    if (!instanceId || !labels || !labels.service) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Missing required fields: instanceId, labels.service",
        },
      });
    }

    // Validate auto-register fields if autoRegisterIfMissing is true
    if (autoRegisterIfMissing && (!hostname || !internalAddress || !ports)) {
      return res.status(400).json({
        success: false,
        error: {
          message:
            "Auto-register requires hostname, internalAddress, and ports fields",
        },
      });
    }

    const input: any = {
      instanceId,
      labels,
      status,
      stats,
    };

    // Add auto-register fields if provided
    if (autoRegisterIfMissing) {
      input.hostname = hostname;
      input.internalAddress = internalAddress;
      input.ports = ports;
      input.meta = meta;
    }

    await serviceDiscoveryService.updateStatus(input, autoRegisterIfMissing);

    const serviceType = labels.service;
    logger.info(`Service status updated: ${serviceType}:${instanceId}`, {
      status,
      stats,
    });

    // Publish event for SDK real-time updates
    await pubSubService.publishNotification({
      type: "service.updated",
      data: { instanceId, serviceType, status, stats },
      targetChannels: ["service", "admin"],
    });

    res.json({
      success: true,
      message: `Service ${serviceType}:${instanceId} status updated successfully`,
    });
  } catch (error: any) {
    logger.error("Failed to update service status:", error);
    res.status(500).json({
      success: false,
      error: { message: error.message || "Failed to update service status" },
    });
  }
});

/**
 * Get services with filtering
 * GET /api/v1/server/services?serviceType=world&group=kr&environment=prod&status=ready&excludeSelf=true
 *
 * Query parameters:
 * - serviceType: Filter by labels.service (e.g., 'world', 'auth', 'lobby')
 * - group: Filter by labels.group (e.g., 'kr', 'us', 'production')
 * - environment: Filter by labels.environment (e.g., 'development', 'production')
 * - status: Filter by status (e.g., 'ready', 'terminated')
 * - excludeSelf: Exclude self instance (default: true)
 * - Any label key: Filter by label value (e.g., region=ap-northeast-2)
 */
router.get("/", serverSDKAuth, async (req: any, res: any) => {
  try {
    const {
      serviceType,
      group,
      environment,
      status,
      excludeSelf,
      ...otherLabels
    } = req.query;

    // Get all services or services of a specific type and/or group
    let services = await serviceDiscoveryService.getServices(
      serviceType as string,
      group as string,
    );

    // Filter by environment
    if (environment) {
      services = services.filter(
        (s: any) => s.labels.environment === environment,
      );
    }

    // Filter by other labels (e.g., region=ap-northeast-2)
    for (const [key, value] of Object.entries(otherLabels)) {
      if (value) {
        services = services.filter((s: any) => s.labels[key] === value);
      }
    }

    // Filter by status
    if (status) {
      services = services.filter((s: any) => s.status === status);
    }

    // Exclude self (default: true)
    const shouldExcludeSelf = excludeSelf !== "false";
    if (shouldExcludeSelf && req.headers["x-instance-id"]) {
      const instanceId = req.headers["x-instance-id"];
      services = services.filter((s: any) => s.instanceId !== instanceId);
    }

    res.json({
      success: true,
      data: services,
    });
  } catch (error: any) {
    logger.error("Failed to get services:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get services",
    });
  }
});

/**
 * Get a specific service instance
 * GET /api/v1/server/services/:serviceType/:instanceId
 */
router.get(
  "/:serviceType/:instanceId",
  serverSDKAuth,
  async (req: any, res: any) => {
    try {
      const { serviceType, instanceId } = req.params;

      const services = await serviceDiscoveryService.getServices(serviceType);
      const service = services.find((s: any) => s.instanceId === instanceId);

      if (!service) {
        return res.status(404).json({
          success: false,
          error: "Service instance not found",
        });
      }

      res.json({
        success: true,
        data: service,
      });
    } catch (error: any) {
      logger.error("Failed to get service:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get service",
      });
    }
  },
);

export default router;
