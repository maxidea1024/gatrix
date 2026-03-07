/**
 * Server Environment Controller
 * Handles environment listing for SDK
 */

import { Response } from 'express';
import { SDKRequest } from '../middleware/api-token-auth';
import { Environment } from '../models/environment';

import { createLogger } from '../config/logger';
const logger = createLogger('ServerEnvironmentController');

export class ServerEnvironmentController {
  /**
   * Get all environments
   * GET /api/v1/server/environments
   */
  static async getEnvironments(req: SDKRequest, res: Response) {
    try {
      const environments = await Environment.query()
        .orderBy('displayOrder', 'asc')
        .orderBy('id', 'asc');

      const result = environments.map((env) => ({
        environmentId: env.id,
        name: env.id,
        displayName: env.displayName,
        environmentType: env.environmentType,
        color: env.color,
      }));

      logger.info(`Server SDK: Retrieved ${result.length} environments`);

      res.json({
        success: true,
        data: {
          environments: result,
          count: result.length,
        },
      });
    } catch (error) {
      logger.error('Error in ServerEnvironmentController.getEnvironments:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve environments',
        },
      });
    }
  }
}

export default ServerEnvironmentController;
