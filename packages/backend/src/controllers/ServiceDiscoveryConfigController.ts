import { Request, Response } from 'express';
import VarsModel from '../models/Vars';

/**
 * Service Discovery Configuration Controller
 * Manages service discovery settings
 */
export class ServiceDiscoveryConfigController {
  /**
   * Get service discovery configuration
   */
  static async getConfig(req: Request, res: Response) {
    try {
      const environment = 'development'; // Global settings stored in development environment
      const [mode, etcdHosts, defaultTtl, heartbeatInterval] = await Promise.all([
        VarsModel.get('serviceDiscovery.mode', environment),
        VarsModel.get('serviceDiscovery.etcdHosts', environment),
        VarsModel.get('serviceDiscovery.defaultTtl', environment),
        VarsModel.get('serviceDiscovery.heartbeatInterval', environment),
      ]);

      res.json({
        success: true,
        data: {
          mode: mode || process.env.SERVICE_DISCOVERY_MODE || 'redis',
          etcdHosts: etcdHosts || process.env.ETCD_HOSTS || 'http://localhost:2379',
          defaultTtl: defaultTtl ? parseInt(defaultTtl, 10) : 30,
          heartbeatInterval: heartbeatInterval ? parseInt(heartbeatInterval, 10) : 15,
        },
      });
    } catch (error: any) {
      console.error('Failed to get service discovery config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get service discovery configuration',
      });
    }
  }

  /**
   * Update service discovery configuration
   */
  static async updateConfig(req: Request, res: Response) {
    try {
      const { mode, etcdHosts, defaultTtl, heartbeatInterval } = req.body;
      const environment = 'development'; // Global settings stored in development environment

      // Validate mode
      if (mode && !['redis', 'etcd'].includes(mode)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid mode. Must be "redis" or "etcd"',
        });
      }

      // Validate TTL
      if (defaultTtl !== undefined && (defaultTtl < 10 || defaultTtl > 300)) {
        return res.status(400).json({
          success: false,
          error: 'Default TTL must be between 10 and 300 seconds',
        });
      }

      // Validate heartbeat interval
      if (heartbeatInterval !== undefined && (heartbeatInterval < 5 || heartbeatInterval > 60)) {
        return res.status(400).json({
          success: false,
          error: 'Heartbeat interval must be between 5 and 60 seconds',
        });
      }

      // Save settings
      const userId = (req as any).user?.userId || (req as any).user?.id || 1;
      const updates: Promise<void>[] = [];

      if (mode !== undefined) {
        updates.push(VarsModel.set('serviceDiscovery.mode', mode, userId, environment));
      }

      if (etcdHosts !== undefined) {
        updates.push(VarsModel.set('serviceDiscovery.etcdHosts', etcdHosts, userId, environment));
      }

      if (defaultTtl !== undefined) {
        updates.push(
          VarsModel.set('serviceDiscovery.defaultTtl', defaultTtl.toString(), userId, environment)
        );
      }

      if (heartbeatInterval !== undefined) {
        updates.push(
          VarsModel.set(
            'serviceDiscovery.heartbeatInterval',
            heartbeatInterval.toString(),
            userId,
            environment
          )
        );
      }

      await Promise.all(updates);

      res.json({
        success: true,
        message:
          'Service discovery configuration updated. Restart the server for changes to take effect.',
      });
    } catch (error: any) {
      console.error('Failed to update service discovery config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update service discovery configuration',
      });
    }
  }
}
