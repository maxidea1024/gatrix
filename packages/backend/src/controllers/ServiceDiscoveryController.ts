/**
 * Service Discovery Controller
 *
 * Handles HTTP requests for service discovery monitoring (Admin only)
 *
 * NOTE: Game servers register directly to etcd/Redis, not via HTTP API
 */

import { Request, Response } from 'express';
import serviceDiscoveryService from '../services/serviceDiscoveryService';
import {
  sendInternalError,
  sendSuccessResponse,
  ErrorCodes,
} from '../utils/apiResponse';

class ServiceDiscoveryController {
  /**
   * Get all services or services of a specific type and/or group
   * GET /api/v1/admin/services?type=chat&group=kr-1
   */
  async getServices(req: Request, res: Response) {
    try {
      const { type, group } = req.query;
      const services = await serviceDiscoveryService.getServices(type as string, group as string);

      return sendSuccessResponse(res, services);
    } catch (error) {
      return sendInternalError(res, 'Failed to get services', error, ErrorCodes.SERVICE_DISCOVERY_ERROR);
    }
  }

  /**
   * Get service statistics
   * GET /api/v1/admin/services/stats
   */
  async getServiceStats(req: Request, res: Response) {
    try {
      const stats = await serviceDiscoveryService.getServiceStats();

      return sendSuccessResponse(res, stats);
    } catch (error) {
      return sendInternalError(res, 'Failed to get service stats', error, ErrorCodes.SERVICE_DISCOVERY_ERROR);
    }
  }

  /**
   * Get service types
   * GET /api/v1/admin/services/types
   */
  async getServiceTypes(req: Request, res: Response) {
    try {
      const types = await serviceDiscoveryService.getServiceTypes();

      return sendSuccessResponse(res, types);
    } catch (error) {
      return sendInternalError(res, 'Failed to get service types', error, ErrorCodes.SERVICE_DISCOVERY_ERROR);
    }
  }
}

export default new ServiceDiscoveryController();
