/**
 * etcd-based Service Discovery Provider
 *
 * Implements service discovery using etcd as the backend store
 * Requires: npm install etcd3
 */

import logger from '../../config/logger';
import config from '../../config';
import {
  IServiceDiscoveryProvider,
  ServiceInstance,
  WatchCallback,
  UpdateServiceStatusInput,
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
    const serviceType = instance.labels.service;
    const key = this.getInstanceKey(serviceType, instance.instanceId);

    try {
      const lease = this.client.lease(ttlSeconds);

      await lease.put(key).value(JSON.stringify(instance));
      this.leases.set(`${serviceType}:${instance.instanceId}`, lease);

      // Auto-heartbeat
      const interval = setInterval(async () => {
        try {
          await lease.keepaliveOnce();
        } catch (error) {
          logger.error(`Heartbeat failed for ${serviceType}:${instance.instanceId}:`, error);
        }
      }, (ttlSeconds / 2) * 1000);

      // Store interval for cleanup
      (lease as any)._heartbeatInterval = interval;

      logger.info(`Service registered: ${serviceType}:${instance.instanceId}`, { labels: instance.labels });
    } catch (error) {
      logger.error(`Failed to register service ${serviceType}:${instance.instanceId}:`, error);
      throw error;
    }
  }

  async heartbeat(instanceId: string, serviceType: string): Promise<void> {
    const lease = this.leases.get(`${serviceType}:${instanceId}`);

    if (lease) {
      try {
        await lease.keepaliveOnce();
      } catch (error) {
        logger.error(`Heartbeat failed for ${serviceType}:${instanceId}:`, error);
        throw error;
      }
    } else {
      logger.warn(`No lease found for ${serviceType}:${instanceId}`);
    }
  }

  async unregister(instanceId: string, serviceType: string, forceDelete: boolean = false): Promise<void> {
    const key = this.getInstanceKey(serviceType, instanceId);
    const leaseKey = `${serviceType}:${instanceId}`;
    const lease = this.leases.get(leaseKey);

    try {
      if (forceDelete) {
        // Force delete: immediately remove the key
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

        logger.info(`Service deleted permanently: ${serviceType}:${instanceId}`);
      } else {
        // Graceful unregister: mark as terminated (etcd doesn't support TTL update, so just delete)
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

        logger.info(`Service unregistered: ${serviceType}:${instanceId}`);
      }
    } catch (error) {
      logger.error(`Failed to unregister service ${serviceType}:${instanceId}:`, error);
      throw error;
    }
  }

  async updateStatus(input: UpdateServiceStatusInput, autoRegisterIfMissing = false): Promise<void> {
    const serviceType = input.labels.service;
    const key = this.getInstanceKey(serviceType, input.instanceId);
    const leaseKey = `${serviceType}:${input.instanceId}`;
    let lease = this.leases.get(leaseKey);

    try {
      const value = await this.client.get(key).string();

      if (!value) {
        if (autoRegisterIfMissing) {
          // Auto-register: create new instance
          const newInstance: ServiceInstance = {
            instanceId: input.instanceId,
            labels: input.labels,
            hostname: '',
            externalAddress: '',
            internalAddress: '',
            ports: { tcp: [], udp: [], http: [] },
            status: input.status || 'ready',
            updatedAt: new Date().toISOString(),
            stats: input.stats || {},
          };

          // Create new lease with configured TTL
          const heartbeatTTL = config?.serviceDiscovery?.heartbeatTTL || 30;
          lease = this.client.lease(heartbeatTTL);
          await lease.put(key).value(JSON.stringify(newInstance));
          this.leases.set(leaseKey, lease);

          logger.info(`Service auto-registered: ${serviceType}:${input.instanceId}`);
          return;
        } else {
          throw new Error(`Service ${serviceType}:${input.instanceId} not found`);
        }
      }

      // Partial merge: update only provided fields
      const instance: ServiceInstance = JSON.parse(value);

      if (input.status !== undefined) {
        instance.status = input.status;
      }

      if (input.stats !== undefined) {
        // Merge stats (not replace)
        instance.stats = { ...instance.stats, ...input.stats };
      }

      instance.updatedAt = new Date().toISOString();

      // For terminated/error servers, create a new lease with configured TTL
      if (instance.status === 'terminated' || instance.status === 'error') {
        // Revoke old lease if exists
        if (lease) {
          try {
            if ((lease as any)._heartbeatInterval) {
              clearInterval((lease as any)._heartbeatInterval);
            }
            await lease.revoke();
          } catch (error) {
            logger.warn(`Failed to revoke old lease for ${leaseKey}:`, error);
          }
        }

        // Create new lease with configured TTL
        const terminatedTTL = config?.serviceDiscovery?.terminatedTTL || 300;
        const newLease = this.client.lease(terminatedTTL);
        await newLease.put(key).value(JSON.stringify(instance));
        this.leases.set(leaseKey, newLease);
        lease = newLease;

        logger.debug(`Service status updated: ${serviceType}:${input.instanceId} -> ${instance.status} (TTL: ${terminatedTTL}s)`);
      } else {
        // For other statuses, use existing lease
        if (lease) {
          await lease.put(key).value(JSON.stringify(instance));
        } else {
          await this.client.put(key).value(JSON.stringify(instance));
        }

        logger.debug(`Service status updated: ${serviceType}:${input.instanceId} -> ${instance.status}`);
      }
    } catch (error) {
      logger.error(`Failed to update status for ${serviceType}:${input.instanceId}:`, error);
      throw error;
    }
  }

  async getServices(serviceType?: string, serviceGroup?: string): Promise<ServiceInstance[]> {
    let instances: ServiceInstance[] = [];

    try {
      const prefix = serviceType ? this.getTypePrefix(serviceType) : '/services/';
      const keys = await this.client.getAll().prefix(prefix).keys();

      for (const key of keys) {
        const value = await this.client.get(key).string();
        if (value) {
          instances.push(JSON.parse(value));
        }
      }

      // Filter by serviceGroup if specified
      if (serviceGroup) {
        instances = instances.filter(instance => instance.labels.group === serviceGroup);
      }

      return instances;
    } catch (error) {
      logger.error('Failed to get services:', error);
      throw error;
    }
  }

  async getService(instanceId: string, serviceType: string): Promise<ServiceInstance | null> {
    const key = this.getInstanceKey(serviceType, instanceId);

    try {
      const value = await this.client.get(key).string();
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Failed to get service ${serviceType}:${instanceId}:`, error);
      throw error;
    }
  }

  async watch(callback: WatchCallback): Promise<() => void> {
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
          // Parse key to extract serviceType and id
          const key = kv.key.toString();
          const parts = key.split('/');
          const serviceType = parts[2];
          const id = parts[3];

          // Emit a minimal instance object for delete events to satisfy typing
          callback({
            type: 'delete',
            instance: {
              instanceId: id,
              labels: { service: serviceType },
              hostname: '',
              externalAddress: '',
              internalAddress: '',
              ports: { tcp: [], udp: [], http: [] },
              status: 'terminated',
              updatedAt: new Date().toISOString(),
            } as ServiceInstance,
          });
        } catch (error) {
          logger.error('Failed to parse delete event:', error);
        }
      });

      this.watchers.push(watcher);
      logger.info('Started watching service changes');

      // Return unwatch function
      return async () => {
        await watcher.cancel();
        const index = this.watchers.indexOf(watcher);
        if (index > -1) {
          this.watchers.splice(index, 1);
        }
        logger.info('Watcher cancelled');
      };
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

