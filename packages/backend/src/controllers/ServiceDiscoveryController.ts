/**
 * Service Discovery Controller
 *
 * Handles HTTP requests for service discovery monitoring (Admin only)
 *
 * NOTE: Game servers register directly to etcd/Redis, not via HTTP API
 */

import { Request, Response } from 'express';
import serviceDiscoveryService from '../services/serviceDiscoveryService';
import logger from '../config/logger';

class ServiceDiscoveryController {
  /**
   * Get all services or services of a specific type and/or group
   * GET /api/v1/admin/services?type=chat&group=kr-1
   */
  async getServices(req: Request, res: Response) {
    try {
      const { type, group } = req.query;
      const services = await serviceDiscoveryService.getServices(type as string, group as string);

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
  }

  /**
   * Get service statistics
   * GET /api/v1/admin/services/stats
   */
  async getServiceStats(req: Request, res: Response) {
    try {
      const stats = await serviceDiscoveryService.getServiceStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Failed to get service stats:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get service stats',
      });
    }
  }

  /**
   * Get service types
   * GET /api/v1/admin/services/types
   */
  async getServiceTypes(req: Request, res: Response) {
    try {
      const types = await serviceDiscoveryService.getServiceTypes();

      res.json({
        success: true,
        data: types,
      });
    } catch (error: any) {
      logger.error('Failed to get service types:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get service types',
      });
    }
  }
}

export default new ServiceDiscoveryController();

