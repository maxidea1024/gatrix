import { ulid } from 'ulid';
import os from 'os';
import { createLogger } from '../config/logger';

const logger = createLogger('AppInstance');

export interface AppInstanceInfo {
  instanceId: string;
  processId: number;
  hostname: string;
  platform: string;
  nodeVersion: string;
  appVersion: string;
  environmentId: string;
  startedAt: Date;
  uptime: number; // in seconds
}

/**
 * Singleton class that manages app instance information
 * Created at backend startup and used globally across the system.
 */
class AppInstance {
  private static instance: AppInstance;
  private readonly _instanceInfo: AppInstanceInfo;

  private constructor() {
    const packageJson = require('../../package.json');

    this._instanceInfo = {
      instanceId: ulid(),
      processId: process.pid,
      hostname: os.hostname(),
      platform: `${os.platform()}-${os.arch()}`,
      nodeVersion: process.version,
      appVersion: packageJson.version || '1.0.0',
      environmentId: process.env.NODE_ENV || 'development',
      startedAt: new Date(),
      uptime: 0,
    };

    logger.info('App instance initialized', {
      instanceId: this._instanceInfo.instanceId,
      processId: this._instanceInfo.processId,
      hostname: this._instanceInfo.hostname,
      platform: this._instanceInfo.platform,
      environmentId: this._instanceInfo.environmentId,
    });
  }

  /**
   * Return singleton instance
   */
  public static getInstance(): AppInstance {
    if (!AppInstance.instance) {
      AppInstance.instance = new AppInstance();
    }
    return AppInstance.instance;
  }

  /**
   * Return instance ID
   */
  public get instanceId(): string {
    return this._instanceInfo.instanceId;
  }

  /**
   * Return full instance info (with uptime update)
   */
  public get info(): AppInstanceInfo {
    return {
      ...this._instanceInfo,
      uptime: Math.floor(
        (Date.now() - this._instanceInfo.startedAt.getTime()) / 1000
      ),
    };
  }

  /**
   * Return instance info in log format
   */
  public getLogInfo(): Record<string, any> {
    const info = this.info;
    return {
      instanceId: info.instanceId,
      processId: info.processId,
      hostname: info.hostname,
      platform: info.platform,
      environmentId: info.environmentId,
      uptime: `${info.uptime}s`,
    };
  }

  /**
   * Return instance summary info (short form)
   */
  public getSummary(): string {
    return `${this._instanceInfo.instanceId.substring(0, 8)}-${this._instanceInfo.processId}`;
  }

  /**
   * Return info for health check
   */
  public getHealthInfo(): Record<string, any> {
    const info = this.info;
    return {
      instanceId: info.instanceId,
      status: 'healthy',
      uptime: info.uptime,
      memory: process.memoryUsage(),
      environmentId: info.environmentId,
      nodeVersion: info.nodeVersion,
      appVersion: info.appVersion,
    };
  }
}

// Export for easy global access
export const appInstance = AppInstance.getInstance();

// Convenience functions
export const getInstanceId = (): string => appInstance.instanceId;
export const getInstanceInfo = (): AppInstanceInfo => appInstance.info;
export const getInstanceSummary = (): string => appInstance.getSummary();

export default AppInstance;
