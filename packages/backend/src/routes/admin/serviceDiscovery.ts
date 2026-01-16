/**
 * Service Discovery Admin Routes
 * 
 * Admin endpoints for viewing service discovery information
 */

import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import ServiceDiscoveryController from '../../controllers/ServiceDiscoveryController';
import { ServiceDiscoveryConfigController } from '../../controllers/ServiceDiscoveryConfigController';
import { authenticate, requireAdmin } from '../../middleware/auth';
import serviceDiscoveryService from '../../services/serviceDiscoveryService';
import logger from '../../config/logger';

const router = express.Router();

/**
 * Custom authentication middleware for SSE that supports query parameter tokens
 */
const authenticateSSE = (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // Try to get token from Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // If no header token, try query parameter
    if (!token && req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      logger.warn('Authentication failed: No token provided', {
        path: req.path,
        method: req.method,
      });
      return res.status(401).json({
        success: false,
        error: { message: 'Access token is required' },
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    (req as any).user = decoded;
    next();
  } catch (error) {
    logger.warn('Authentication failed: Invalid token', {
      path: req.path,
      method: req.method,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token' },
    });
  }
};

/**
 * SSE endpoint for real-time service updates
 * GET /api/v1/admin/services/sse?token=xxx
 * Note: SSE cannot send custom headers, so token is passed as query parameter
 */
router.get('/sse', authenticateSSE, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    // Check if user is admin
    if (userRole !== 'admin') {
      logger.warn('SSE authorization failed: User is not admin', { userId });
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Set SSE headers (Safari compatibility)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    const clientId = `service-discovery-${Date.now()}-${userId}`;

    // Send initial services
    const services = await serviceDiscoveryService.getServices();
    // Normalize heartbeat status to ready for UI
    const normalizedServices = services.map(s => {
      if (s.status === 'heartbeat') {
        return { ...s, status: 'ready' as const };
      }
      return s;
    });
    res.write(`data: ${JSON.stringify({ type: 'init', data: normalizedServices })}\n\n`);

    // Watch for changes and get unwatch function
    let unwatch: (() => void) | null = null;
    try {
      unwatch = await serviceDiscoveryService.watchServices((event) => {
        try {
          const instance = { ...event.instance };
          // Normalize heartbeat status to ready for UI
          if (instance.status === 'heartbeat') {
            instance.status = 'ready' as any;
          }
          res.write(`data: ${JSON.stringify({ type: event.type, data: instance })}\n\n`);
        } catch (error) {
          logger.error('Failed to send SSE event:', error);
        }
      });
    } catch (error) {
      logger.error('Failed to start watching services:', error);
      if (!res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: 'error', data: { message: 'Failed to watch services' } })}\n\n`);
      }
    }

    logger.info(`SSE connection established for service discovery: ${clientId}`);

    // Handle client disconnect
    req.on('close', () => {
      if (unwatch) {
        unwatch();
      }
      logger.info(`SSE connection closed for service discovery: ${clientId}`);
    });
  } catch (error) {
    logger.error('Error establishing SSE connection:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to establish SSE connection' });
    }
  }
});

// All other routes (non-SSE) require authentication and admin role
router.use(authenticate as any, requireAdmin as any);

/**
 * Clean up all terminated, error, and no-response services
 * POST /api/v1/admin/services/cleanup
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    logger.info('🗑️ Starting server cleanup...');

    // Get inactive services (terminated, error, no-response)
    const inactiveServices = await serviceDiscoveryService.getInactiveServices();
    logger.info(`📊 Total inactive services: ${inactiveServices.length}`);

    // Count by status
    const statusCounts = {
      terminated: inactiveServices.filter(s => s.status === 'terminated').length,
      error: inactiveServices.filter(s => s.status === 'error').length,
      noResponse: inactiveServices.filter(s => s.status === 'no-response').length,
    };
    logger.info(`🎯 Services to delete: ${inactiveServices.length}`, statusCounts);

    if (inactiveServices.length === 0) {
      logger.info('✅ No services to clean up');
      return res.json({
        success: true,
        data: {
          deletedCount: 0,
          totalCount: 0,
        },
        message: 'No services to clean up',
      });
    }

    // Clean up inactive collections (service types are determined internally)
    const result = await serviceDiscoveryService.cleanupInactiveServices();

    res.json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
        totalCount: inactiveServices.length,
      },
      message: `Cleanup completed: ${result.deletedCount} services deleted`,
    });
  } catch (error) {
    logger.error('❌ Error during cleanup:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to cleanup services' },
    });
  }
});

/**
 * Get service statistics
 * GET /api/v1/admin/services/stats
 */
router.get('/stats', ServiceDiscoveryController.getServiceStats);

/**
 * Get service types
 * GET /api/v1/admin/services/types
 */
router.get('/types', ServiceDiscoveryController.getServiceTypes);

/**
 * Get service discovery configuration
 * GET /api/v1/admin/services/config
 */
router.get('/config', ServiceDiscoveryConfigController.getConfig);

/**
 * Update service discovery configuration
 * PUT /api/v1/admin/services/config
 */
router.put('/config', ServiceDiscoveryConfigController.updateConfig);

/**
 * Health check a service instance
 * POST /api/v1/admin/services/:type/:instanceId/health
 * Pings the service's API port (internalApi/externalApi) /health endpoint
 */
router.post('/:type/:instanceId/health', async (req: Request, res: Response) => {
  try {
    const { type, instanceId } = req.params;

    if (!type || !instanceId) {
      return res.status(400).json({
        success: false,
        error: { message: 'type and instanceId are required' },
      });
    }

    // Get the service instance to find its web port and address
    const services = await serviceDiscoveryService.getServices(type);
    const service = services.find(s => s.instanceId === instanceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: { message: 'Service not found' },
      });
    }

    // Check if service has an API port (internalApi, externalApi, or legacy web/http/api)
    const webPort = service.ports?.internalApi || service.ports?.externalApi || service.ports?.web || service.ports?.http || service.ports?.api;
    if (!webPort) {
      return res.status(400).json({
        success: false,
        error: { message: 'Service does not have an internalApi/externalApi/web/http/api port' },
      });
    }

    // Determine which address to use (prefer internal for server-to-server communication)
    const address = service.internalAddress || service.externalAddress;
    const healthUrl = `http://${address}:${webPort}/health`;

    logger.info(`Health checking service: ${type}:${instanceId} at ${healthUrl}`);

    // Make HTTP request to the service's health endpoint
    const axios = (await import('axios')).default;
    const startTime = Date.now();

    try {
      const response = await axios.get(healthUrl, {
        timeout: 5000, // 5 second timeout
      });
      const latency = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          healthy: true,
          status: response.status,
          latency,
          response: response.data,
          url: healthUrl,
        },
      });
    } catch (healthError: any) {
      const latency = Date.now() - startTime;
      const status = healthError.response?.status || 0;
      const message = healthError.code === 'ECONNREFUSED'
        ? 'Connection refused'
        : healthError.code === 'ETIMEDOUT' || healthError.code === 'ECONNABORTED'
          ? 'Connection timeout'
          : healthError.message || 'Unknown error';

      res.json({
        success: true,
        data: {
          healthy: false,
          status,
          latency,
          error: message,
          url: healthUrl,
        },
      });
    }
  } catch (error) {
    logger.error('Error during health check:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to perform health check' },
    });
  }
});

/**
 * Get cache summary from a service instance
 * GET /api/v1/admin/services/:type/:instanceId/cache/summary
 * Proxies request to the service's /internal/cache/summary endpoint
 */
router.get('/:type/:instanceId/cache/summary', async (req: Request, res: Response) => {
  try {
    const { type, instanceId } = req.params;

    if (!type || !instanceId) {
      return res.status(400).json({
        success: false,
        error: { message: 'type and instanceId are required' },
      });
    }

    // Get the service instance to find its web port and address
    const services = await serviceDiscoveryService.getServices(type);
    const service = services.find(s => s.instanceId === instanceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: { message: 'Service not found' },
      });
    }

    // Check if service has an API port
    const webPort = service.ports?.internalApi || service.ports?.externalApi || service.ports?.web || service.ports?.http || service.ports?.api;
    if (!webPort) {
      return res.status(400).json({
        success: false,
        error: { message: 'Service does not have an API port' },
      });
    }

    // Determine which address to use
    const address = service.internalAddress || service.externalAddress;
    const cacheUrl = `http://${address}:${webPort}/internal/cache/summary`;

    logger.info(`Fetching cache summary from: ${type}:${instanceId} at ${cacheUrl}`);

    const axios = (await import('axios')).default;
    const startTime = Date.now();

    try {
      const response = await axios.get(cacheUrl, {
        timeout: 5000,
      });
      const latency = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          ...response.data,
          latency,
          url: cacheUrl,
        },
      });
    } catch (cacheError: any) {
      const latency = Date.now() - startTime;
      const status = cacheError.response?.status || 0;
      const message = cacheError.code === 'ECONNREFUSED'
        ? 'Connection refused'
        : cacheError.code === 'ETIMEDOUT' || cacheError.code === 'ECONNABORTED'
          ? 'Connection timeout'
          : cacheError.message || 'Unknown error';

      res.json({
        success: true,
        data: {
          status: 'error',
          error: message,
          httpStatus: status,
          latency,
          url: cacheUrl,
        },
      });
    }
  } catch (error) {
    logger.error('Error fetching cache summary:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch cache summary' },
    });
  }
});

/**
 * Get cache status from a service instance
 * GET /api/v1/admin/services/:type/:instanceId/cache
 * Proxies request to the service's /internal/cache endpoint
 */
router.get('/:type/:instanceId/cache', async (req: Request, res: Response) => {
  try {
    const { type, instanceId } = req.params;

    if (!type || !instanceId) {
      return res.status(400).json({
        success: false,
        error: { message: 'type and instanceId are required' },
      });
    }

    // Get the service instance to find its web port and address
    const services = await serviceDiscoveryService.getServices(type);
    const service = services.find(s => s.instanceId === instanceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: { message: 'Service not found' },
      });
    }

    // Check if service has an API port
    const webPort = service.ports?.internalApi || service.ports?.externalApi || service.ports?.web || service.ports?.http || service.ports?.api;
    if (!webPort) {
      return res.status(400).json({
        success: false,
        error: { message: 'Service does not have an API port' },
      });
    }

    // Determine which address to use
    const address = service.internalAddress || service.externalAddress;
    const cacheUrl = `http://${address}:${webPort}/internal/cache`;

    logger.info(`Fetching cache status from: ${type}:${instanceId} at ${cacheUrl}`);

    const axios = (await import('axios')).default;
    const startTime = Date.now();

    try {
      const response = await axios.get(cacheUrl, {
        timeout: 5000,
      });
      const latency = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          ...response.data,
          latency,
          url: cacheUrl,
        },
      });
    } catch (cacheError: any) {
      const latency = Date.now() - startTime;
      const status = cacheError.response?.status || 0;
      const message = cacheError.code === 'ECONNREFUSED'
        ? 'Connection refused'
        : cacheError.code === 'ETIMEDOUT' || cacheError.code === 'ECONNABORTED'
          ? 'Connection timeout'
          : cacheError.message || 'Unknown error';

      res.json({
        success: true,
        data: {
          status: 'error',
          error: message,
          httpStatus: status,
          latency,
          url: cacheUrl,
        },
      });
    }
  } catch (error) {
    logger.error('Error fetching cache status:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch cache status' },
    });
  }
});

/**
 * Get request statistics from a service instance
 * GET /api/v1/admin/services/:type/:instanceId/stats/requests
 * Proxies request to the service's /internal/stats/requests endpoint
 */
router.get('/:type/:instanceId/stats/requests', async (req: Request, res: Response) => {
  try {
    const { type, instanceId } = req.params;

    if (!type || !instanceId) {
      return res.status(400).json({
        success: false,
        error: { message: 'type and instanceId are required' },
      });
    }

    const services = await serviceDiscoveryService.getServices(type);
    const service = services.find(s => s.instanceId === instanceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: { message: 'Service not found' },
      });
    }

    const webPort = service.ports?.internalApi || service.ports?.externalApi || service.ports?.web || service.ports?.http || service.ports?.api;
    if (!webPort) {
      return res.status(400).json({
        success: false,
        error: { message: 'Service does not have an API port' },
      });
    }

    const address = service.internalAddress || service.externalAddress;
    const statsUrl = `http://${address}:${webPort}/internal/stats/requests`;

    const axios = (await import('axios')).default;
    const startTime = Date.now();

    try {
      const response = await axios.get(statsUrl, { timeout: 5000 });
      const latency = Date.now() - startTime;

      res.json({
        success: true,
        ...response.data,
        latency,
      });
    } catch (statsError: any) {
      const latency = Date.now() - startTime;
      const message = statsError.code === 'ECONNREFUSED'
        ? 'Connection refused'
        : statsError.code === 'ETIMEDOUT' || statsError.code === 'ECONNABORTED'
          ? 'Connection timeout'
          : statsError.message || 'Unknown error';

      res.json({
        success: false,
        error: message,
        latency,
      });
    }
  } catch (error) {
    logger.error('Error fetching request stats:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch request stats' },
    });
  }
});

/**
 * Reset request statistics on a service instance
 * POST /api/v1/admin/services/:type/:instanceId/stats/requests/reset
 */
router.post('/:type/:instanceId/stats/requests/reset', async (req: Request, res: Response) => {
  try {
    const { type, instanceId } = req.params;

    if (!type || !instanceId) {
      return res.status(400).json({
        success: false,
        error: { message: 'type and instanceId are required' },
      });
    }

    const services = await serviceDiscoveryService.getServices(type);
    const service = services.find(s => s.instanceId === instanceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: { message: 'Service not found' },
      });
    }

    const webPort = service.ports?.internalApi || service.ports?.externalApi || service.ports?.web || service.ports?.http || service.ports?.api;
    if (!webPort) {
      return res.status(400).json({
        success: false,
        error: { message: 'Service does not have an API port' },
      });
    }

    const address = service.internalAddress || service.externalAddress;
    const resetUrl = `http://${address}:${webPort}/internal/stats/requests/reset`;

    const axios = (await import('axios')).default;
    const response = await axios.post(resetUrl, {}, { timeout: 5000 });

    res.json(response.data);
  } catch (error: any) {
    logger.error('Error resetting request stats:', error);
    const message = error.code === 'ECONNREFUSED'
      ? 'Connection refused'
      : error.message || 'Failed to reset request stats';
    res.status(500).json({
      success: false,
      error: { message },
    });
  }
});

/**
 * Set request log rate limit on a service instance
 * POST /api/v1/admin/services/:type/:instanceId/stats/rate-limit
 */
router.post('/:type/:instanceId/stats/rate-limit', async (req: Request, res: Response) => {
  try {
    const { type, instanceId } = req.params;
    const { limit } = req.body;

    if (!type || !instanceId) {
      return res.status(400).json({
        success: false,
        error: { message: 'type and instanceId are required' },
      });
    }

    if (typeof limit !== 'number' || limit < 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'limit must be a non-negative number' },
      });
    }

    const services = await serviceDiscoveryService.getServices(type);
    const service = services.find(s => s.instanceId === instanceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: { message: 'Service not found' },
      });
    }

    const webPort = service.ports?.internalApi || service.ports?.externalApi || service.ports?.web || service.ports?.http || service.ports?.api;
    if (!webPort) {
      return res.status(400).json({
        success: false,
        error: { message: 'Service does not have an API port' },
      });
    }

    const address = service.internalAddress || service.externalAddress;
    const rateLimitUrl = `http://${address}:${webPort}/internal/stats/rate-limit`;

    const axios = (await import('axios')).default;
    const response = await axios.post(rateLimitUrl, { limit }, { timeout: 5000 });

    res.json(response.data);
  } catch (error: any) {
    logger.error('Error setting rate limit:', error);
    const message = error.code === 'ECONNREFUSED'
      ? 'Connection refused'
      : error.message || 'Failed to set rate limit';
    res.status(500).json({
      success: false,
      error: { message },
    });
  }
});

/**
 * Delete a service instance
 * DELETE /api/v1/admin/services/:type/:instanceId
 */
router.delete('/:type/:instanceId', async (req: Request, res: Response) => {
  try {
    const { type, instanceId } = req.params;

    if (!type || !instanceId) {
      return res.status(400).json({
        success: false,
        error: { message: 'type and instanceId are required' },
      });
    }

    // Unregister the service from storage (force delete = true)
    await serviceDiscoveryService.unregister(instanceId, type, true);

    logger.info(`Service deleted: ${type}:${instanceId}`);

    res.json({
      success: true,
      message: `Service ${type}:${instanceId} deleted successfully`,
    });
  } catch (error) {
    logger.error('Error deleting service:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to delete service' },
    });
  }
});

/**
 * Get all services or services of a specific type
 * GET /api/v1/admin/services?type=chat
 * NOTE: This must be last to avoid matching dynamic routes
 */
router.get('/', ServiceDiscoveryController.getServices);

export default router;

