import { ulid } from "ulid";
import os from "os";
import logger from "../config/logger";

export interface AppInstanceInfo {
  instanceId: string;
  processId: number;
  hostname: string;
  platform: string;
  nodeVersion: string;
  appVersion: string;
  environment: string;
  startedAt: Date;
  uptime: number; // in seconds
}

/**
 * 앱 인스턴스 정보를 관리하는 싱글톤 클래스
 * 백엔드 시작 시 생성되어 시스템 전역에서 사용됩니다.
 */
class AppInstance {
  private static instance: AppInstance;
  private readonly _instanceInfo: AppInstanceInfo;

  private constructor() {
    const packageJson = require("../../package.json");

    this._instanceInfo = {
      instanceId: ulid(),
      processId: process.pid,
      hostname: os.hostname(),
      platform: `${os.platform()}-${os.arch()}`,
      nodeVersion: process.version,
      appVersion: packageJson.version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      startedAt: new Date(),
      uptime: 0,
    };

    logger.info("App instance initialized", {
      instanceId: this._instanceInfo.instanceId,
      processId: this._instanceInfo.processId,
      hostname: this._instanceInfo.hostname,
      platform: this._instanceInfo.platform,
      environment: this._instanceInfo.environment,
    });
  }

  /**
   * 싱글톤 인스턴스 반환
   */
  public static getInstance(): AppInstance {
    if (!AppInstance.instance) {
      AppInstance.instance = new AppInstance();
    }
    return AppInstance.instance;
  }

  /**
   * 인스턴스 ID 반환
   */
  public get instanceId(): string {
    return this._instanceInfo.instanceId;
  }

  /**
   * 전체 인스턴스 정보 반환 (uptime 업데이트)
   */
  public get info(): AppInstanceInfo {
    return {
      ...this._instanceInfo,
      uptime: Math.floor(
        (Date.now() - this._instanceInfo.startedAt.getTime()) / 1000,
      ),
    };
  }

  /**
   * 인스턴스 정보를 로그 형태로 반환
   */
  public getLogInfo(): Record<string, any> {
    const info = this.info;
    return {
      instanceId: info.instanceId,
      processId: info.processId,
      hostname: info.hostname,
      platform: info.platform,
      environment: info.environment,
      uptime: `${info.uptime}s`,
    };
  }

  /**
   * 인스턴스 요약 정보 반환 (짧은 형태)
   */
  public getSummary(): string {
    return `${this._instanceInfo.instanceId.substring(0, 8)}-${this._instanceInfo.processId}`;
  }

  /**
   * 헬스체크용 정보 반환
   */
  public getHealthInfo(): Record<string, any> {
    const info = this.info;
    return {
      instanceId: info.instanceId,
      status: "healthy",
      uptime: info.uptime,
      memory: process.memoryUsage(),
      environment: info.environment,
      nodeVersion: info.nodeVersion,
      appVersion: info.appVersion,
    };
  }
}

// 전역에서 쉽게 접근할 수 있도록 export
export const appInstance = AppInstance.getInstance();

// 편의 함수들
export const getInstanceId = (): string => appInstance.instanceId;
export const getInstanceInfo = (): AppInstanceInfo => appInstance.info;
export const getInstanceSummary = (): string => appInstance.getSummary();

export default AppInstance;
