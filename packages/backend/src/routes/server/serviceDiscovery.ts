/**
 * Service Discovery Server Routes
 *
 * Server SDK endpoints for service discovery
 */

import express from 'express';
import { serverSDKAuth } from '../../middleware/apiTokenAuth';
import serviceDiscoveryService from '../../services/serviceDiscoveryService';
import logger from '../../config/logger';

const router = express.Router();

/**
 * Get services with filtering
 * GET /api/v1/server/services?type=authd&serviceGroup=production&status=ready&excludeSelf=true
 */
router.get('/', serverSDKAuth, async (req: any, res: any) => {
  try {
    const { type, serviceGroup, status, excludeSelf } = req.query;

    // Get all services or services of a specific type
    let services = await serviceDiscoveryService.getServices(type as string);

    // Filter by service group
    if (serviceGroup) {
      services = services.filter((s: any) => s.serviceGroup === serviceGroup);
    }

    // Filter by status
    if (status) {
      services = services.filter((s: any) => s.status === status);
    }

    // Exclude self (default: true)
    const shouldExcludeSelf = excludeSelf !== 'false';
    if (shouldExcludeSelf && req.headers['x-instance-id']) {
      const instanceId = req.headers['x-instance-id'];
      services = services.filter((s: any) => s.instanceId !== instanceId);
    }

    res.json({
      success: true,
      data: services,
    });
  } catch (error: any) {
    logger.error('Failed to get services:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get services',
    });
  }
});

/**
 * Get a specific service instance
 * GET /api/v1/server/services/:type/:instanceId
 */
router.get('/:type/:instanceId', serverSDKAuth, async (req: any, res: any) => {
  try {
    const { type, instanceId } = req.params;

    const services = await serviceDiscoveryService.getServices(type);
    const service = services.find((s: any) => s.instanceId === instanceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service instance not found',
      });
    }

    res.json({
      success: true,
      data: service,
    });
  } catch (error: any) {
    logger.error('Failed to get service:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get service',
    });
  }
});

export default router;

