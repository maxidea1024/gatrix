/**
 * Service Registry for Change Request Execution
 *
 * Maps database table names to their corresponding service methods
 * that handle updates with proper event publishing (pubsub/SSE).
 */
import serviceNoticeService from './service-notice-service';
import { ClientVersionService } from './client-version-service';
import StoreProductService from './store-product-service';
import { SurveyService } from './survey-service';
import ingamePopupNoticeService from './ingame-popup-notice-service';
import { GameWorldService } from './game-world-service';
import BannerService from './banner-service';
import { WhitelistService } from './whitelist-service';
import { IpWhitelistService } from './ip-whitelist-service';
import { TagService } from './tag-service';
import { featureFlagService } from './feature-flag-service';
import { createLogger } from '../config/logger';

const logger = createLogger('ServiceRegistry');

export interface ServiceHandler {
  /**
   * Apply a change to the target entity
   * @param id - Entity ID
   * @param data - New data to apply
   * @param environment - Environment name
   * @param userId - User performing the action
   */
  apply: (
    id: string,
    data: any,
    environmentId: string,
    userId?: string
  ) => Promise<unknown>;

  /**
   * Create a new entity (optional)
   */
  create?: (
    data: any,
    environmentId: string,
    userId?: string
  ) => Promise<unknown>;

  /**
   * Delete an entity (optional)
   */
  delete?: (
    id: string,
    environmentId: string,
    userId?: string
  ) => Promise<void>;
}

/**
 * Registry mapping table names to their service handlers.
 * Each handler wraps the existing service method to ensure
 * proper event publishing via pubsub.
 */
export const TABLE_SERVICE_REGISTRY: Record<string, ServiceHandler> = {
  // Service Notices
  g_service_notices: {
    apply: async (id, data, environmentId) => {
      return await serviceNoticeService.updateServiceNotice(
        id,
        data,
        environmentId
      );
    },
    create: async (data, environmentId) => {
      return await serviceNoticeService.createServiceNotice(
        data,
        environmentId
      );
    },
    delete: async (id, environmentId) => {
      await serviceNoticeService.deleteServiceNotice(id, environmentId);
    },
  },

  // Client Versions
  g_client_versions: {
    apply: async (id, data, environmentId, userId) => {
      const result = await ClientVersionService.updateClientVersion(
        id,
        data,
        environmentId
      );
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity(
          'client_version',
          id,
          data.tagIds,
          userId
        );
      }
      return result;
    },
    create: async (data, environmentId, userId) => {
      // Tags are usually not handled in service.create but passed separately or handled in controller
      // But for CR, we need to handle it here if passed in data
      const result = await ClientVersionService.createClientVersion(
        data,
        environmentId
      );
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity(
          'client_version',
          result.id!,
          data.tagIds,
          userId
        );
      }
      return result;
    },
    delete: async (id, environmentId) => {
      await ClientVersionService.deleteClientVersion(id, environmentId);
    },
  },

  // Store Products
  g_store_products: {
    apply: async (id, data, environmentId, userId) => {
      const result = await StoreProductService.updateStoreProduct(
        id,
        data,
        environmentId
      );
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity(
          'store_product',
          id,
          data.tagIds,
          userId
        );
      }
      return result;
    },
    create: async (data, environmentId, userId) => {
      const result = await StoreProductService.createStoreProduct({
        ...data,
        environmentId,
      });
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity(
          'store_product',
          result.id,
          data.tagIds,
          userId
        );
      }
      return result;
    },
    delete: async (id, environmentId) => {
      await StoreProductService.deleteStoreProduct(id, environmentId);
    },
  },

  // Surveys
  g_surveys: {
    apply: async (id, data, environmentId) => {
      return await SurveyService.updateSurvey(id, data, environmentId);
    },
    create: async (data, environmentId) => {
      return await SurveyService.createSurvey({ ...data, environmentId });
    },
    delete: async (id, environmentId) => {
      await SurveyService.deleteSurvey(id, environmentId);
    },
  },

  // Ingame Popup Notices
  g_ingame_popup_notices: {
    apply: async (id, data, environmentId, userId) => {
      const result = await ingamePopupNoticeService.updateIngamePopupNotice(
        id,
        data,
        userId || '',
        environmentId
      );
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity(
          'ingame_popup_notice',
          id,
          data.tagIds,
          userId
        );
      }
      return result;
    },
    create: async (data, environmentId, userId) => {
      const result = await ingamePopupNoticeService.createIngamePopupNotice(
        data,
        userId || '',
        environmentId
      );
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity(
          'ingame_popup_notice',
          result.id,
          data.tagIds,
          userId
        );
      }
      return result;
    },
    delete: async (id, environmentId) => {
      await ingamePopupNoticeService.deleteIngamePopupNotice(id, environmentId);
    },
  },

  // Game Worlds
  g_game_worlds: {
    apply: async (id, data, environmentId, userId) => {
      const result = await GameWorldService.updateGameWorld(
        id,
        data,
        environmentId
      );
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity(
          'game_world',
          id,
          data.tagIds,
          userId
        );
      }
      return result;
    },
    create: async (data, environmentId, userId) => {
      const result = await GameWorldService.createGameWorld(
        data,
        environmentId
      );
      if (data.tagIds && Array.isArray(data.tagIds)) {
        await TagService.setTagsForEntity(
          'game_world',
          result.id,
          data.tagIds,
          userId
        );
      }
      return result;
    },
    delete: async (id, environmentId) => {
      await GameWorldService.deleteGameWorld(id, environmentId);
    },
  },

  // Banners
  g_banners: {
    apply: async (id, data, environmentId) => {
      return await BannerService.updateBanner(id, environmentId, data);
    },
    create: async (data, environmentId) => {
      return await BannerService.createBanner({ ...data, environmentId });
    },
    delete: async (id, environmentId) => {
      await BannerService.deleteBanner(id, environmentId);
    },
  },

  // Account Whitelist
  g_account_whitelist: {
    apply: async (id, data, environmentId) => {
      return await WhitelistService.updateWhitelist(id, environmentId, data);
    },
    create: async (data, environmentId) => {
      return await WhitelistService.createWhitelist(environmentId, data);
    },
    delete: async (id, environmentId) => {
      await WhitelistService.deleteWhitelist(id, environmentId);
    },
  },

  // IP Whitelist
  g_ip_whitelist: {
    apply: async (id, data, environmentId) => {
      return await IpWhitelistService.updateIpWhitelist(
        id,
        environmentId,
        data
      );
    },
    create: async (data, environmentId) => {
      return await IpWhitelistService.createIpWhitelist(environmentId, data);
    },
    delete: async (id, environmentId) => {
      await IpWhitelistService.deleteIpWhitelist(id, environmentId);
    },
  },

  // Vars (key-value settings, includes Maintenance)
  // Note: g_vars uses `varKey` as identifier, not numeric ID
  // Special handling: Maintenance status changes publish events via MaintenanceController pattern
  g_vars: {
    apply: async (id, data, environmentId) => {
      // Import VarsModel dynamically to avoid circular dependency
      const VarsModel = (await import('../models/vars')).default;
      const { pubSubService } = await import('./pub-sub-service');
      const { SERVER_SDK_ETAG } = await import('../constants/cache-keys');

      // id is the varKey for g_vars
      const varKey = id;
      await VarsModel.set(varKey, data.value, data.userId || '', environmentId);

      // Publish appropriate events based on the key
      if (varKey === 'isMaintenance' || varKey === 'maintenanceDetail') {
        await pubSubService.invalidateKey(
          `${SERVER_SDK_ETAG.MAINTENANCE}:${environmentId}`
        );
        await pubSubService.publishEvent(
          {
            type: 'maintenance.settings.updated',
            data: { id: 'maintenance', environmentId },
          },
          { environmentId }
        );
        await pubSubService.publishNotification({
          type: 'maintenance_status_change',
          data: { varKey, value: data.value, environmentId },
          targetChannels: ['admin', 'general'],
        });
        logger.info(`Published maintenance event for ${varKey}`);
      }

      return { varKey, value: data.value };
    },
  },

  // Feature Flags
  g_feature_flags: {
    apply: async (id, data, environmentId, userId) => {
      // Get current flag name for service call
      const FeatureFlagModel = (await import('../models/FeatureFlag'))
        .FeatureFlagModel;
      const existingFlag = await FeatureFlagModel.findById(id);
      if (!existingFlag) {
        throw new Error(`Feature flag with id ${id} not found`);
      }
      return await featureFlagService.updateFlag(
        environmentId,
        existingFlag.flagName,
        data,
        userId || ''
      );
    },
    create: async (data, environmentId, userId) => {
      return await featureFlagService.createFlag(
        { ...data, environmentId },
        userId || ''
      );
    },
    delete: async (id, environmentId, userId) => {
      const FeatureFlagModel = (await import('../models/FeatureFlag'))
        .FeatureFlagModel;
      const existingFlag = await FeatureFlagModel.findById(id);
      if (existingFlag) {
        await featureFlagService.deleteFlag(
          environmentId,
          existingFlag.flagName,
          userId || ''
        );
      }
    },
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
export function getServiceHandler(
  tableName: string
): ServiceHandler | undefined {
  return TABLE_SERVICE_REGISTRY[tableName];
}

/**
 * Execute a change through the service layer with proper event publishing.
 * Falls back to direct database update if no handler is registered.
 */
export async function executeChangeViaService(
  tableName: string,
  id: string,
  data: any,
  environmentId: string,
  isCreate: boolean = false,
  userId?: string
): Promise<{ usedService: boolean; result?: any }> {
  const handler = getServiceHandler(tableName);

  if (!handler) {
    logger.warn(`No handler for table ${tableName}, fallback to direct update`);
    return { usedService: false };
  }

  try {
    let result: any;
    if (isCreate && handler.create) {
      result = await handler.create(data, environmentId, userId);
    } else {
      result = await handler.apply(id, data, environmentId, userId);
    }
    logger.info(`Applied change via service for ${tableName}:${id}`);
    return { usedService: true, result };
  } catch (error) {
    logger.error(`Failed to apply via service for ${tableName}:${id}`, error);
    throw error;
  }
}
