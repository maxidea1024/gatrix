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

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    const clientId = `service-discovery-${Date.now()}-${userId}`;

    // Send initial services
    const services = await serviceDiscoveryService.getServices();
    res.write(`data: ${JSON.stringify({ type: 'init', data: services })}\n\n`);

    // Watch for changes
    await serviceDiscoveryService.watchServices((event) => {
      try {
        res.write(`data: ${JSON.stringify({ type: event.type, data: event.instance })}\n\n`);
      } catch (error) {
        logger.error('Failed to send SSE event:', error);
      }
    });

    logger.info(`SSE connection established for service discovery: ${clientId}`);

    // Handle client disconnect
    req.on('close', () => {
      logger.info(`SSE connection closed for service discovery: ${clientId}`);
    });
  } catch (error) {
    logger.error('Error establishing SSE connection:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to establish SSE connection' });
    }
  }
});

// All other admin routes require authentication and admin role
router.use(authenticate as any, requireAdmin as any);

/**
 * Get all services or services of a specific type
 * GET /api/v1/admin/services?type=chat
 */
router.get('/', ServiceDiscoveryController.getServices);

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

export default router;

