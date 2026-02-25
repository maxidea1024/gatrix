import { GatrixServerSDK } from './GatrixServerSDK';
import { MaintenanceInfo, CurrentMaintenanceStatus } from './types/api';

/**
 * Maintenance-related methods for GatrixServerSDK
 */
export class GatrixMaintenanceHelper {
  constructor(private sdk: GatrixServerSDK) {}

  /**
   * Get current maintenance status for client delivery
   */
  getCurrentMaintenanceStatus(environment?: string): CurrentMaintenanceStatus {
    const env = (this.sdk as any).resolveEnvironment(environment, 'getCurrentMaintenanceStatus');
    const serviceMaintenance = (this.sdk as any).cacheManager?.getServiceMaintenanceService();
    const gameWorld = (this.sdk as any).cacheManager?.getGameWorldService();

    if (serviceMaintenance?.isMaintenanceActive(env)) {
      const status = serviceMaintenance.getCached(env);
      return {
        isMaintenanceActive: true,
        source: 'service',
        detail: {
          startsAt: status?.detail?.startsAt,
          endsAt: status?.detail?.endsAt,
          message: status?.detail?.message,
          localeMessages: status?.detail?.localeMessages,
          forceDisconnect: status?.detail?.kickExistingPlayers,
          gracePeriodMinutes: status?.detail?.kickDelayMinutes,
        },
      };
    }

    const targetWorldId = (this.sdk as any).config.worldId;
    if (targetWorldId && gameWorld?.isWorldMaintenanceActive(targetWorldId, env)) {
      const world = gameWorld.getWorldByWorldId(targetWorldId, env);
      if (world) {
        const localeMessages: { ko?: string; en?: string; zh?: string } = {};
        if (world.maintenanceLocales) {
          for (const locale of world.maintenanceLocales) {
            if (locale.lang === 'ko' || locale.lang === 'en' || locale.lang === 'zh') {
              localeMessages[locale.lang as 'ko' | 'en' | 'zh'] = locale.message;
            }
          }
        }

        return {
          isMaintenanceActive: true,
          source: 'world',
          worldId: targetWorldId,
          detail: {
            startsAt: world.maintenanceStartDate,
            endsAt: world.maintenanceEndDate,
            message: world.maintenanceMessage,
            localeMessages: Object.keys(localeMessages).length > 0 ? localeMessages : undefined,
            forceDisconnect: world.forceDisconnect,
            gracePeriodMinutes: world.gracePeriodMinutes,
          },
        };
      }
    }

    return { isMaintenanceActive: false };
  }

  /**
   * Check if maintenance is active
   */
  isMaintenanceActive(worldId?: string, environment?: string): boolean {
    const env = (this.sdk as any).resolveEnvironment(environment, 'isMaintenanceActive');
    const serviceMaintenance = (this.sdk as any).cacheManager?.getServiceMaintenanceService();
    const gameWorld = (this.sdk as any).cacheManager?.getGameWorldService();

    if (serviceMaintenance?.isMaintenanceActive(env)) return true;

    const targetWorldId = worldId ?? (this.sdk as any).config.worldId;
    if (targetWorldId) {
      return gameWorld?.isWorldMaintenanceActive(targetWorldId, env) ?? false;
    }

    const allWorlds = gameWorld?.getCached(env) || [];
    for (const world of allWorlds) {
      if (world.worldId && gameWorld?.isWorldMaintenanceActive(world.worldId, env)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get comprehensive maintenance information
   */
  getMaintenanceInfo(
    worldId?: string,
    lang: 'ko' | 'en' | 'zh' = 'en',
    environment?: string
  ): MaintenanceInfo {
    const env = (this.sdk as any).resolveEnvironment(environment, 'getMaintenanceInfo');
    const serviceMaintenance = (this.sdk as any).cacheManager?.getServiceMaintenanceService();
    const gameWorld = (this.sdk as any).cacheManager?.getGameWorldService();
    const cacheManager = (this.sdk as any).cacheManager;

    if (serviceMaintenance?.isMaintenanceActive(env)) {
      const status = serviceMaintenance.getCached(env);
      return {
        isMaintenanceActive: true,
        source: 'service',
        message: serviceMaintenance.getMessage(lang, env),
        forceDisconnect: status?.detail?.kickExistingPlayers ?? false,
        gracePeriodMinutes: status?.detail?.kickDelayMinutes ?? 0,
        startsAt: status?.detail?.startsAt ?? null,
        endsAt: status?.detail?.endsAt ?? null,
        actualStartTime: cacheManager?.getServiceMaintenanceActualStartTime() ?? null,
      };
    }

    const targetWorldId = worldId ?? (this.sdk as any).config.worldId;
    if (targetWorldId && gameWorld?.isWorldMaintenanceActive(targetWorldId, env)) {
      const world = gameWorld.getWorldByWorldId(targetWorldId, env);
      return {
        isMaintenanceActive: true,
        source: 'world',
        worldId: targetWorldId,
        message: gameWorld.getWorldMaintenanceMessage(targetWorldId, env, lang),
        forceDisconnect: world?.forceDisconnect ?? false,
        gracePeriodMinutes: world?.gracePeriodMinutes ?? 0,
        startsAt: world?.maintenanceStartDate ?? null,
        endsAt: world?.maintenanceEndDate ?? null,
        actualStartTime: cacheManager?.getWorldMaintenanceActualStartTime(targetWorldId) ?? null,
      };
    }

    return {
      isMaintenanceActive: false,
      source: null,
      message: null,
      forceDisconnect: false,
      gracePeriodMinutes: 0,
      startsAt: null,
      endsAt: null,
      actualStartTime: null,
    };
  }
}
