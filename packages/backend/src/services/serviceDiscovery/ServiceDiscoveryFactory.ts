/**
 * Service Discovery Factory
 *
 * Creates appropriate service discovery provider based on configuration
 */

import config from '../../config';
import logger from '../../config/logger';
import { IServiceDiscoveryProvider } from '../../types/serviceDiscovery';
import { RedisServiceDiscoveryProvider } from './RedisServiceDiscoveryProvider';
import { EtcdServiceDiscoveryProvider } from './EtcdServiceDiscoveryProvider';

export class ServiceDiscoveryFactory {
  private static instance: IServiceDiscoveryProvider | null = null;

  /**
   * Create or get singleton instance of service discovery provider
   */
  static getInstance(): IServiceDiscoveryProvider {
    if (!this.instance) {
      this.instance = this.create();
    }
    return this.instance;
  }

  /**
   * Create a new service discovery provider based on configuration
   */
  static create(): IServiceDiscoveryProvider {
    const mode = process.env.SERVICE_DISCOVERY_MODE || 'redis';
    
    logger.info(`Creating ServiceDiscoveryProvider with mode: ${mode}`);
    
    if (mode === 'etcd') {
      const hosts = process.env.ETCD_HOSTS || 'http://localhost:2379';
      return new EtcdServiceDiscoveryProvider(hosts);
    } else if (mode === 'redis') {
      const host = config.redis.host;
      const port = config.redis.port;
      const password = config.redis.password;
      const db = 0; // Use DB 0 for service discovery
      
      return new RedisServiceDiscoveryProvider(host, port, password, db);
    } else {
      throw new Error(`Unknown service discovery mode: ${mode}. Use 'etcd' or 'redis'`);
    }
  }

  /**
   * Close the singleton instance
   */
  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
    }
  }
}

