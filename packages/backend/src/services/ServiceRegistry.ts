/**
 * Service Registry for Change Request Execution
 *
 * Maps database table names to their corresponding service methods
 * that handle updates with proper event publishing (pubsub/SSE).
 */
import serviceNoticeService from './ServiceNoticeService';
import { ClientVersionService } from './ClientVersionService';
import StoreProductService from './StoreProductService';
import { SurveyService } from './SurveyService';
import ingamePopupNoticeService from './IngamePopupNoticeService';
import { GameWorldService } from './GameWorldService';
import BannerService from './BannerService';
import { WhitelistService } from './WhitelistService';
import { IpWhitelistService } from './IpWhitelistService';
import { TagService } from './TagService';
import { featureFlagService } from './FeatureFlagService';
import logger from '../config/logger';

export interface ServiceHandler {
  /**
   * Apply a change to the target entity
   * @param id - Entity ID
   * @param data - New data to apply
   * @param environment - Environment name
   * @param userId - User performing the action
   */
  apply: (id: string | number, data: any, environment: string, userId?: number) => Promise<any>;

  /**
   * Create a new entity (optional)
   */
  create?: (data: any, environment: string, userId?: number) => Promise<any>;

  /**
   * Delete an entity (optional)
   */
  delete?: (id: string | number, environment: string, userId?: number) => Promise<void>;
}

/**
 * Registry mapping table names to their service handlers.
 * Each handler wraps the existing service method to ensure
 * proper event publishing via pubsub.
 */
export const TABLE_SERVICE_REGISTRY: Record<string, ServiceHandler> = {
  // Service Notices
  'g_service_notices': {
    apply: async (id, data, environment) => {
      return await serviceNoticeService.updateServiceNotice(Number(id), data, environment);
    },
    create: async (data, environment) => {
      return await serviceNoticeService.createServiceNotice(data, environment);
    },
    delete: async (id, environment) => {
      await serviceNoticeService.deleteServiceNotice(Number(id), environment);
    }
  },

  // Client Versions
  'g_client_versions': {
    apply: async (id, data, environment, userId) => {
      const result = await ClientVersionService.updateClientVersion(Number(id), data, environment);
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity('client_version', Number(id), data.tagIds, userId);
      }
      return result;
    },
    create: async (data, environment, userId) => {
      // Tags are usually not handled in service.create but passed separately or handled in controller
      // But for CR, we need to handle it here if passed in data
      const result = await ClientVersionService.createClientVersion(data, environment);
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity('client_version', result.id!, data.tagIds, userId);
      }
      return result;
    },
    delete: async (id, environment) => {
      await ClientVersionService.deleteClientVersion(Number(id), environment);
    }
  },

  // Store Products
  'g_store_products': {
    apply: async (id, data, environment, userId) => {
      const result = await StoreProductService.updateStoreProduct(String(id), data, environment);
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity('store_product', String(id), data.tagIds, userId);
      }
      return result;
    },
    create: async (data, environment, userId) => {
      const result = await StoreProductService.createStoreProduct({ ...data, environment });
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity('store_product', result.id, data.tagIds, userId);
      }
      return result;
    },
    delete: async (id, environment) => {
      await StoreProductService.deleteStoreProduct(String(id), environment);
    }
  },

  // Surveys
  'g_surveys': {
    apply: async (id, data, environment) => {
      return await SurveyService.updateSurvey(String(id), data, environment);
    },
    create: async (data, environment) => {
      return await SurveyService.createSurvey({ ...data, environment });
    },
    delete: async (id, environment) => {
      await SurveyService.deleteSurvey(String(id), environment);
    }
  },

  // Ingame Popup Notices
  'g_ingame_popup_notices': {
    apply: async (id, data, environment, userId) => {
      const result = await ingamePopupNoticeService.updateIngamePopupNotice(Number(id), data, userId || 0, environment);
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity('ingame_popup_notice', Number(id), data.tagIds, userId);
      }
      return result;
    },
    create: async (data, environment, userId) => {
      const result = await ingamePopupNoticeService.createIngamePopupNotice(data, userId || 0, environment);
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity('ingame_popup_notice', result.id, data.tagIds, userId);
      }
      return result;
    },
    delete: async (id, environment) => {
      await ingamePopupNoticeService.deleteIngamePopupNotice(Number(id), environment);
    }
  },

  // Game Worlds
  'g_game_worlds': {
    apply: async (id, data, environment, userId) => {
      const result = await GameWorldService.updateGameWorld(Number(id), data, environment);
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity('game_world', Number(id), data.tagIds, userId);
      }
      return result;
    },
    create: async (data, environment, userId) => {
      const result = await GameWorldService.createGameWorld(data, environment);
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity('game_world', result.id, data.tagIds, userId);
      }
      return result;
    },
    delete: async (id, environment) => {
      await GameWorldService.deleteGameWorld(Number(id), environment);
    }
  },

  // Banners
  'g_banners': {
    apply: async (id, data, environment) => {
      return await BannerService.updateBanner(String(id), environment, data);
    },
    create: async (data, environment) => {
      return await BannerService.createBanner({ ...data, environment });
    },
    delete: async (id, environment) => {
      await BannerService.deleteBanner(String(id), environment);
    }
  },

  // Account Whitelist
  'g_account_whitelist': {
    apply: async (id, data, environment) => {
      return await WhitelistService.updateWhitelist(Number(id), environment, data);
    },
    create: async (data, environment) => {
      return await WhitelistService.createWhitelist(environment, data);
    },
    delete: async (id, environment) => {
      await WhitelistService.deleteWhitelist(Number(id), environment);
    }
  },

  // IP Whitelist
  'g_ip_whitelist': {
    apply: async (id, data, environment) => {
      return await IpWhitelistService.updateIpWhitelist(Number(id), environment, data);
    },
    create: async (data, environment) => {
      return await IpWhitelistService.createIpWhitelist(environment, data);
    },
    delete: async (id, environment) => {
      await IpWhitelistService.deleteIpWhitelist(Number(id), environment);
    }
  },

  // Vars (key-value settings, includes Maintenance)
  // Note: g_vars uses `varKey` as identifier, not numeric ID
  // Special handling: Maintenance status changes publish events via MaintenanceController pattern
  'g_vars': {
    apply: async (id, data, environment) => {
      // Import VarsModel dynamically to avoid circular dependency
      const VarsModel = (await import('../models/Vars')).default;
      const { pubSubService } = await import('./PubSubService');
      const { SERVER_SDK_ETAG } = await import('../constants/cacheKeys');

      // id is the varKey for g_vars
      const varKey = String(id);
      await VarsModel.set(varKey, data.value, data.userId || 0, environment);

      // Publish appropriate events based on the key
      if (varKey === 'isMaintenance' || varKey === 'maintenanceDetail') {
        await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.MAINTENANCE}:${environment}`);
        await pubSubService.publishEvent({
          type: 'maintenance.settings.updated',
          data: { id: 'maintenance', environment, timestamp: Date.now() }
        });
        await pubSubService.publishNotification({
          type: 'maintenance_status_change',
          data: { varKey, value: data.value, environment },
          targetChannels: ['admin', 'general']
        });
        logger.info(`[ServiceRegistry] Published maintenance event for ${varKey}`);
      }

      return { varKey, value: data.value };
    }
  },

  // Feature Flags
  'g_feature_flags': {
    apply: async (id, data, environment, userId) => {
      // Get current flag name for service call
      const FeatureFlagModel = (await import('../models/FeatureFlag')).FeatureFlagModel;
      const existingFlag = await FeatureFlagModel.findById(String(id));
      if (!existingFlag) {
        throw new Error(`Feature flag with id ${id} not found`);
      }
      return await featureFlagService.updateFlag(environment, existingFlag.flagName, data, userId || 0);
    },
    create: async (data, environment, userId) => {
      return await featureFlagService.createFlag({ ...data, environment }, userId || 0);
    },
    delete: async (id, environment, userId) => {
      const FeatureFlagModel = (await import('../models/FeatureFlag')).FeatureFlagModel;
      const existingFlag = await FeatureFlagModel.findById(String(id));
      if (existingFlag) {
        await featureFlagService.deleteFlag(environment, existingFlag.flagName, userId || 0);
      }
    }
  },
};

/**
 * Check if a table has a registered service handler
 */
export function hasServiceHandler(tableName: string): boolean {
  return tableName in TABLE_SERVICE_REGISTRY;
}

/**
 * Get the service handler for a table
 */
export function getServiceHandler(tableName: string): ServiceHandler | undefined {
  return TABLE_SERVICE_REGISTRY[tableName];
}

/**
 * Execute a change through the service layer with proper event publishing.
 * Falls back to direct database update if no handler is registered.
 */
export async function executeChangeViaService(
  tableName: string,
  id: string | number,
  data: any,
  environment: string,
  isCreate: boolean = false,
  userId?: number
): Promise<{ usedService: boolean; result?: any }> {
  const handler = getServiceHandler(tableName);

  if (!handler) {
    logger.warn(`[ServiceRegistry] No handler for table ${tableName}, fallback to direct update`);
    return { usedService: false };
  }

  try {
    let result: any;
    if (isCreate && handler.create) {
      result = await handler.create(data, environment, userId);
    } else {
      result = await handler.apply(id, data, environment, userId);
    }
    logger.info(`[ServiceRegistry] Applied change via service for ${tableName}:${id}`);
    return { usedService: true, result };
  } catch (error) {
    logger.error(`[ServiceRegistry] Failed to apply via service for ${tableName}:${id}`, error);
    throw error;
  }
}
