/**
 * etcd-based Service Discovery Provider
 *
 * Implements service discovery using etcd as the backend store
 * Requires: npm install etcd3
 */

import logger from '../../config/logger';
import {
  IServiceDiscoveryProvider,
  ServiceInstance,
  ServiceStatus,
  WatchCallback,
} from '../../types/serviceDiscovery';

// Dynamic import to make etcd3 optional
let Etcd3: any;

try {
  const etcd3Module = require('etcd3');
  Etcd3 = etcd3Module.Etcd3;
} catch (error) {
  logger.warn('etcd3 module not found. Install with: npm install etcd3');
}

export class EtcdServiceDiscoveryProvider implements IServiceDiscoveryProvider {
  private client: any; // Etcd3 instance
  private leases: Map<string, any> = new Map(); // Map<string, Lease>
  private watchers: any[] = [];

  constructor(hosts: string) {
    if (!Etcd3) {
      throw new Error('etcd3 module is not installed. Install with: npm install etcd3');
    }

    this.client = new Etcd3({ hosts });
    logger.info(`EtcdServiceDiscoveryProvider initialized with hosts: ${hosts}`);
  }

  async register(instance: ServiceInstance, ttlSeconds: number): Promise<void> {
    const key = this.getInstanceKey(instance.type, instance.instanceId);

    try {
      const lease = this.client.lease(ttlSeconds);

      await lease.put(key).value(JSON.stringify(instance));
      this.leases.set(`${instance.type}:${instance.instanceId}`, lease);

      // Auto-heartbeat
      const interval = setInterval(async () => {
        try {
          await lease.keepaliveOnce();
        } catch (error) {
          logger.error(`Heartbeat failed for ${instance.type}:${instance.instanceId}:`, error);
        }
      }, (ttlSeconds / 2) * 1000);

      // Store interval for cleanup
      (lease as any)._heartbeatInterval = interval;

      logger.info(`Service registered: ${instance.type}:${instance.instanceId}`);
    } catch (error) {
      logger.error(`Failed to register service ${instance.type}:${instance.instanceId}:`, error);
      throw error;
    }
  }

  async heartbeat(instanceId: string, type: string): Promise<void> {
    const lease = this.leases.get(`${type}:${instanceId}`);
    
    if (lease) {
      try {
        await lease.keepaliveOnce();
      } catch (error) {
        logger.error(`Heartbeat failed for ${type}:${instanceId}:`, error);
        throw error;
      }
    } else {
      logger.warn(`No lease found for ${type}:${instanceId}`);
    }
  }

  async unregister(instanceId: string, type: string): Promise<void> {
    const key = this.getInstanceKey(type, instanceId);
    const leaseKey = `${type}:${instanceId}`;
    const lease = this.leases.get(leaseKey);
    
    try {
      if (lease) {
        // Clear heartbeat interval
        if ((lease as any)._heartbeatInterval) {
          clearInterval((lease as any)._heartbeatInterval);
        }
        
        // Revoke lease (this will delete the key)
        await lease.revoke();
        this.leases.delete(leaseKey);
      } else {
        // Manually delete if no lease found
        await this.client.delete().key(key);
      }
      
      logger.info(`Service unregistered: ${type}:${instanceId}`);
    } catch (error) {
      logger.error(`Failed to unregister service ${type}:${instanceId}:`, error);
      throw error;
    }
  }

  async updateStatus(
    instanceId: string,
    type: string,
    status: ServiceStatus,
    instanceStats?: any,
    meta?: Record<string, any>
  ): Promise<void> {
    const key = this.getInstanceKey(type, instanceId);
    const lease = this.leases.get(`${type}:${instanceId}`);

    try {
      const value = await this.client.get(key).string();
      if (!value) {
        throw new Error(`Service ${type}:${instanceId} not found`);
      }

      const instance: ServiceInstance = JSON.parse(value);
      instance.status = status;
      instance.updatedAt = new Date().toISOString();
      if (instanceStats !== undefined) {
        instance.instanceStats = instanceStats;
      }
      if (meta !== undefined) {
        instance.meta = meta;
      }

      if (lease) {
        await lease.put(key).value(JSON.stringify(instance));
      } else {
        await this.client.put(key).value(JSON.stringify(instance));
      }

      logger.debug(`Service status updated: ${type}:${instanceId} -> ${status}`);
    } catch (error) {
      logger.error(`Failed to update status for ${type}:${instanceId}:`, error);
      throw error;
    }
  }

  async getServices(type?: string): Promise<ServiceInstance[]> {
    const instances: ServiceInstance[] = [];
    
    try {
      const prefix = type ? this.getTypePrefix(type) : '/services/';
      const keys = await this.client.getAll().prefix(prefix).keys();
      
      for (const key of keys) {
        const value = await this.client.get(key).string();
        if (value) {
          instances.push(JSON.parse(value));
        }
      }
      
      return instances;
    } catch (error) {
      logger.error('Failed to get services:', error);
      throw error;
    }
  }

  async getService(instanceId: string, type: string): Promise<ServiceInstance | null> {
    const key = this.getInstanceKey(type, instanceId);
    
    try {
      const value = await this.client.get(key).string();
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Failed to get service ${type}:${instanceId}:`, error);
      throw error;
    }
  }

  async watch(callback: WatchCallback): Promise<void> {
    try {
      const watcher = await this.client.watch().prefix('/services/').create();
      
      watcher.on('put', (kv: any) => {
        try {
          const instance: ServiceInstance = JSON.parse(kv.value.toString());
          callback({ type: 'put', instance });
        } catch (error) {
          logger.error('Failed to parse put event:', error);
        }
      });
      
      watcher.on('delete', (kv: any) => {
        try {
          // Parse key to extract type and id
          const key = kv.key.toString();
          const parts = key.split('/');
          const type = parts[2];
          const id = parts[3];
          
          callback({
            type: 'delete',
            instance: { id, type } as ServiceInstance,
          });
        } catch (error) {
          logger.error('Failed to parse delete event:', error);
        }
      });
      
      this.watchers.push(watcher);
      logger.info('Started watching service changes');
    } catch (error) {
      logger.error('Failed to start watching:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    // Clear all heartbeat intervals
    this.leases.forEach((lease) => {
      if ((lease as any)._heartbeatInterval) {
        clearInterval((lease as any)._heartbeatInterval);
      }
    });
    
    // Revoke all leases
    for (const [key, lease] of this.leases.entries()) {
      try {
        await lease.revoke();
      } catch (error) {
        logger.error(`Failed to revoke lease ${key}:`, error);
      }
    }
    this.leases.clear();
    
    // Close watchers
    this.watchers.forEach(watcher => {
      try {
        watcher.cancel();
      } catch (error) {
        logger.error('Failed to cancel watcher:', error);
      }
    });
    this.watchers = [];
    
    // Close client
    this.client.close();
    
    logger.info('EtcdServiceDiscoveryProvider closed');
  }

  // Helper methods
  private getInstanceKey(type: string, id: string): string {
    return `/services/${type}/${id}`;
  }

  private getTypePrefix(type: string): string {
    return `/services/${type}/`;
  }
}

