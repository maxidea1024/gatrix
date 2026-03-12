/**
 * World Maintenance Service
 *
 * Aggregates service-level maintenance, world-level maintenance, and whitelist
 * to provide comprehensive maintenance status checking.
 *
 * Access via: sdk.worldMaintenance.*
 */

import { Logger } from '../utils/logger';
import { ServiceMaintenanceService } from './service-maintenance-service';
import { GameWorldService } from './game-world-service';
import { WhitelistService } from './whitelist-service';
import { MaintenanceInfo, CurrentMaintenanceStatus } from '../types/api';
import type { CacheManager } from '../cache/cache-manager';

export interface WorldMaintenanceServiceConfig {
  worldId?: string;
  resolveEnvironment: (
    environmentId: string | undefined,
    methodName: string
  ) => string;
}

export class WorldMaintenanceService {
  private logger: Logger;
  private serviceMaintenance: ServiceMaintenanceService;
  private gameWorld: GameWorldService;
  private whitelist: WhitelistService;
  private cacheManager: CacheManager | null;
  private config: WorldMaintenanceServiceConfig;

  constructor(
    logger: Logger,
    serviceMaintenance: ServiceMaintenanceService,
    gameWorld: GameWorldService,
    whitelist: WhitelistService,
    cacheManager: CacheManager | null,
    config: WorldMaintenanceServiceConfig
  ) {
    this.logger = logger;
    this.serviceMaintenance = serviceMaintenance;
    this.gameWorld = gameWorld;
    this.whitelist = whitelist;
    this.cacheManager = cacheManager;
    this.config = config;
  }

  /**
   * Check if the service is in maintenance (global or world-level)
   * Checks in order: global service maintenance → world-level maintenance
   *
   * Behavior:
   * - If worldId is provided: checks global service + that specific world
   * - If config.worldId is set: checks global service + that specific world
   * - If neither is set: checks global service + ALL worlds (returns true if any world is in maintenance)
   *
   * @param worldId Optional world ID to check (uses config.worldId if not provided)
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   * @returns true if either global service or world(s) is in maintenance
   */
  isActive(worldId?: string, environmentId?: string): boolean {
    const env = this.config.resolveEnvironment(environmentId, 'isActive');

    // First check global service maintenance
    if (this.serviceMaintenance.isMaintenanceActive(env)) {
      return true;
    }

    // Determine target world ID
    const targetWorldId = worldId ?? this.config.worldId;

    // If specific worldId is specified, check only that world
    if (targetWorldId) {
      return this.gameWorld.isWorldMaintenanceActive(targetWorldId, env);
    }

    // If no worldId specified, check ALL worlds (world-wide service mode)
    const allWorlds = this.gameWorld.getCached(env);
    for (const world of allWorlds) {
      if (
        world.worldId &&
        this.gameWorld.isWorldMaintenanceActive(world.worldId, env)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get comprehensive maintenance information
   * Returns detailed info about maintenance status including source, message, and options
   *
   * Behavior:
   * - If worldId is provided: returns info for global service or that specific world
   * - If config.worldId is set: returns info for global service or that specific world
   * - If neither is set: returns info for global service or the first world in maintenance
   *
   * @param worldId Optional world ID to check (uses config.worldId if not provided)
   * @param lang Language for maintenance message
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  getInfo(
    worldId?: string,
    lang: 'ko' | 'en' | 'zh' = 'en',
    environmentId?: string
  ): MaintenanceInfo {
    const env = this.config.resolveEnvironment(environmentId, 'getInfo');
    const targetWorldId = worldId ?? this.config.worldId;

    // Check global service maintenance first
    if (this.serviceMaintenance.isMaintenanceActive(env)) {
      const status = this.serviceMaintenance.getCached(env);
      const actualStartTime =
        this.cacheManager?.getServiceMaintenanceActualStartTime() ?? null;
      return {
        isMaintenanceActive: true,
        source: 'service',
        message: this.serviceMaintenance.getMessage(lang, env),
        forceDisconnect: status?.detail?.kickExistingPlayers ?? false,
        gracePeriodMinutes: status?.detail?.kickDelayMinutes ?? 0,
        startsAt: status?.detail?.startsAt ?? null,
        endsAt: status?.detail?.endsAt ?? null,
        actualStartTime,
      };
    }

    // If specific worldId is specified, check that world
    if (
      targetWorldId &&
      this.gameWorld.isWorldMaintenanceActive(targetWorldId, env)
    ) {
      const world = this.gameWorld.getWorldByWorldId(targetWorldId, env);
      const actualStartTime =
        this.cacheManager?.getWorldMaintenanceActualStartTime(targetWorldId) ??
        null;
      return {
        isMaintenanceActive: true,
        source: 'world',
        worldId: targetWorldId,
        message: this.gameWorld.getWorldMaintenanceMessage(
          targetWorldId,
          lang,
          env
        ),
        forceDisconnect: world?.forceDisconnect ?? false,
        gracePeriodMinutes: world?.gracePeriodMinutes ?? 0,
        startsAt: world?.maintenanceStartDate ?? null,
        endsAt: world?.maintenanceEndDate ?? null,
        actualStartTime,
      };
    }

    // If no worldId specified, check ALL worlds and return first one in maintenance
    if (!targetWorldId) {
      const allWorlds = this.gameWorld.getCached(env);
      for (const world of allWorlds) {
        if (
          world.worldId &&
          this.gameWorld.isWorldMaintenanceActive(world.worldId, env)
        ) {
          const actualStartTime =
            this.cacheManager?.getWorldMaintenanceActualStartTime(
              world.worldId
            ) ?? null;
          return {
            isMaintenanceActive: true,
            source: 'world',
            worldId: world.worldId,
            message: this.gameWorld.getWorldMaintenanceMessage(
              world.worldId,
              lang,
              env
            ),
            forceDisconnect: world.forceDisconnect ?? false,
            gracePeriodMinutes: world.gracePeriodMinutes ?? 0,
            startsAt: world.maintenanceStartDate ?? null,
            endsAt: world.maintenanceEndDate ?? null,
            actualStartTime,
          };
        }
      }
    }

    // Not in maintenance
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

  /**
   * Get current maintenance status for client delivery
   * Returns the ACTUAL maintenance status after checking time ranges
   *
   * Behavior:
   * - Global service maintenance is always checked first
   * - If worldId is configured in SDK, only that world is checked
   * - Time-based maintenance (startsAt/endsAt) is calculated to determine actual status
   *
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   * @returns CurrentMaintenanceStatus with isMaintenanceActive, source, and detail
   */
  getCurrentStatus(environmentId?: string): CurrentMaintenanceStatus {
    const env = this.config.resolveEnvironment(
      environmentId,
      'getCurrentStatus'
    );

    // Check global service maintenance first (uses time calculation internally)
    if (this.serviceMaintenance.isMaintenanceActive(env)) {
      const status = this.serviceMaintenance.getCached(env);
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

    // Check world-level maintenance
    const targetWorldId = this.config.worldId;

    if (
      targetWorldId &&
      this.gameWorld.isWorldMaintenanceActive(targetWorldId, env)
    ) {
      const world = this.gameWorld.getWorldByWorldId(targetWorldId, env);
      if (world) {
        // Convert maintenanceLocales array to localeMessages object
        const localeMessages: { ko?: string; en?: string; zh?: string } = {};
        if (world.maintenanceLocales) {
          for (const locale of world.maintenanceLocales) {
            if (
              locale.lang === 'ko' ||
              locale.lang === 'en' ||
              locale.lang === 'zh'
            ) {
              localeMessages[locale.lang] = locale.message;
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
            localeMessages:
              Object.keys(localeMessages).length > 0
                ? localeMessages
                : undefined,
            forceDisconnect: world.forceDisconnect,
            gracePeriodMinutes: world.gracePeriodMinutes,
          },
        };
      }
    }

    // Not in maintenance
    return {
      isMaintenanceActive: false,
    };
  }

  /**
   * Get maintenance status for a client, considering whitelist exemptions.
   * This method checks both IP and account whitelists to determine if the client
   * should be exempt from maintenance mode.
   *
   * Usage:
   * 1. Before auth (IP check only): getStatusForClient({ clientIp })
   * 2. After auth (IP + account check): getStatusForClient({ clientIp, accountId })
   *
   * When whitelisted:
   * - isMaintenanceActive = false (client can connect)
   * - isWhitelisted = true (indicates exemption reason)
   *
   * @param options.clientIp Client IP address (for IP whitelist check)
   * @param options.accountId Account ID (for account whitelist check, typically after auth)
   * @param options.environmentId environment ID. Optional in single-env mode, required in multi-env mode.
   * @returns CurrentMaintenanceStatus with isWhitelisted field
   */
  getStatusForClient(options: {
    clientIp?: string;
    accountId?: string;
    environmentId?: string;
  }): CurrentMaintenanceStatus {
    const { clientIp, accountId, environmentId } = options;
    const env = this.config.resolveEnvironment(
      environmentId,
      'getStatusForClient'
    );

    // First get the raw maintenance status
    const status = this.getCurrentStatus(env);

    // If not in maintenance, return as-is
    if (!status.isMaintenanceActive) {
      return status;
    }

    // Check IP whitelist
    if (clientIp) {
      const isIpWhitelisted = this.whitelist.isIpWhitelisted(clientIp, env);
      if (isIpWhitelisted) {
        return {
          isMaintenanceActive: false,
          isWhitelisted: true,
        };
      }
    }

    // Check account whitelist
    if (accountId) {
      const isAccountWhitelisted = this.whitelist.isAccountWhitelisted(
        accountId,
        env
      );
      if (isAccountWhitelisted) {
        return {
          isMaintenanceActive: false,
          isWhitelisted: true,
        };
      }
    }

    // Not whitelisted, return original maintenance status
    return {
      ...status,
      isWhitelisted: false,
    };
  }
}
