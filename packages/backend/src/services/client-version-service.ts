import {
  ClientVersionModel,
  ClientVersionAttributes,
  ClientVersionCreationAttributes,
  ClientStatus,
} from '../models/client-version';
import { pubSubService } from './pub-sub-service';
import { createLogger } from '../config/logger';
import { TagService } from './tag-service';

const logger = createLogger('ClientVersionService');
import {
  applyMaintenanceStatusCalculationToArray,
  applyMaintenanceStatusCalculation,
} from '../utils/maintenance-utils';
import { SERVER_SDK_ETAG } from '../constants/cache-keys';
import VarsModel from '../models/vars';
import { resolvePassiveData } from '../utils/passive-data-utils';

export interface ClientVersionFilters {
  version?: string | string[];
  platform?: string | string[];
  clientStatus?: ClientStatus | ClientStatus[];
  gameServerAddress?: string;
  patchAddress?: string;
  guestModeAllowed?: boolean | boolean[];
  externalClickLink?: string;
  memo?: string;
  customPayload?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAtFrom?: Date;
  createdAtTo?: Date;
  updatedAtFrom?: Date;
  updatedAtTo?: Date;
  search?: string;
  tags?: string[];
  tagsOperator?: 'any_of' | 'include_all';
}

export interface ClientVersionPagination {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface ClientVersionListResponse {
  clientVersions: ClientVersionAttributes[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BulkStatusUpdateRequest {
  ids: number[];
  clientStatus: ClientStatus;
  updatedBy: string;
  // Maintenance-related fields
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  maintenanceMessage?: string;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: Array<{ lang: 'ko' | 'en' | 'zh'; message: string }>;
  messageTemplateId?: string;
}

/**
 * Prepare client version data for SDK events
 * Parses customPayload and merges with passiveData to ensure meta is an object
 */
async function prepareClientVersionForSDK(
  version: ClientVersionAttributes,
  environmentId: string
): Promise<any> {
  // Get clientVersionPassiveData from KV settings using the resolved env
  let passiveData: Record<string, any> = {};
  try {
    const passiveDataStr = await VarsModel.get(
      '$clientVersionPassiveData',
      environmentId
    );
    passiveData = resolvePassiveData(passiveDataStr, version.clientVersion);
  } catch (error) {
    logger.warn(
      'Failed to resolve clientVersionPassiveData for SDK event:',
      error
    );
  }

  // Parse customPayload
  let customPayload: Record<string, any> = {};
  try {
    if (version.customPayload) {
      let parsed =
        typeof version.customPayload === 'string'
          ? JSON.parse(version.customPayload)
          : version.customPayload;

      // Handle double-encoded JSON string
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch (e) {
          // ignore
        }
      }

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        customPayload = parsed;
      }
    }
  } catch (error) {
    logger.warn(
      `Failed to parse customPayload for SDK event (version ${version.id}):`,
      error
    );
  }

  // Merge: passiveData first, then customPayload (customPayload overwrites)
  const mergedMeta = { ...passiveData, ...customPayload };

  return {
    ...version,
    customPayload: mergedMeta, // Return as object, not string
  };
}

export class ClientVersionService {
  // Get available version list (distinct)
  static async getAvailableVersions(projectId: string): Promise<string[]> {
    try {
      const versions =
        await ClientVersionModel.getDistinctVersions(projectId);
      return versions.sort((a, b) =>
        b.localeCompare(a, undefined, { numeric: true })
      );
    } catch (error) {
      logger.error('Error getting available versions:', error);
      throw error;
    }
  }

  static async getClientVersions(
    projectId: string,
    filters: Omit<ClientVersionFilters, 'projectId'> = {},
    pagination: ClientVersionPagination
  ): Promise<{ data: ClientVersionAttributes[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = pagination;
    const offset = (page - 1) * limit;

    const whereConditions: any = { projectId };

    // Apply filters
    if (filters.platform) {
      whereConditions.platform = filters.platform;
    }
    if (filters.clientStatus) {
      whereConditions.clientStatus = filters.clientStatus;
    }
    if (filters.gameServerAddress) {
      whereConditions.gameServerAddress = filters.gameServerAddress;
    }
    if (filters.patchAddress) {
      whereConditions.patchAddress = filters.patchAddress;
    }
    if (filters.guestModeAllowed !== undefined) {
      whereConditions.guestModeAllowed = filters.guestModeAllowed;
    }

    const result = await ClientVersionModel.findAll({
      ...whereConditions,
      limit,
      offset,
      sortBy,
      sortOrder,
    });
    const { clientVersions: data, total } = result;

    // Apply maintenance status calculation based on time constraints
    const processedData = applyMaintenanceStatusCalculationToArray(data);
    return { data: processedData, total };
  }

  static async getAllClientVersions(
    projectId: string,
    filters: Omit<ClientVersionFilters, 'projectId'> = {},
    pagination: ClientVersionPagination
  ): Promise<ClientVersionListResponse> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = pagination;
    const offset = (page - 1) * limit;

    // Build search conditions
    const whereConditions: any = { projectId };

    if (filters.version) {
      whereConditions.clientVersion = filters.version;
    }

    if (filters.platform) {
      whereConditions.platform = { like: filters.platform };
    }

    if (filters.clientStatus) {
      whereConditions.clientStatus = filters.clientStatus;
    }

    if (filters.gameServerAddress) {
      whereConditions.gameServerAddress = { like: filters.gameServerAddress };
    }

    if (filters.patchAddress) {
      whereConditions.patchAddress = { like: filters.patchAddress };
    }

    if (filters.guestModeAllowed !== undefined) {
      whereConditions.guestModeAllowed = filters.guestModeAllowed;
    }

    if (filters.externalClickLink) {
      whereConditions.externalClickLink = { like: filters.externalClickLink };
    }

    if (filters.memo) {
      whereConditions.memo = { like: filters.memo };
    }

    if (filters.customPayload) {
      whereConditions.customPayload = { like: filters.customPayload };
    }

    if (filters.createdBy) {
      whereConditions.createdBy = filters.createdBy;
    }

    if (filters.updatedBy) {
      whereConditions.updatedBy = filters.updatedBy;
    }

    // Date filter implementation
    if (filters.createdAtFrom || filters.createdAtTo) {
      const dateFilters: any = { projectId };
      if (filters.createdAtFrom) {
        dateFilters.createdAtFrom = filters.createdAtFrom;
      }
      if (filters.createdAtTo) {
        dateFilters.createdAtTo = filters.createdAtTo;
      }

      const result = await ClientVersionModel.findAll({
        ...dateFilters,
        limit,
        offset,
        sortBy,
        sortOrder,
      });
      const { clientVersions, total } = result;

      const totalPages = Math.ceil(total / limit);

      // Apply maintenance status calculation based on time constraints
      const processedVersions =
        applyMaintenanceStatusCalculationToArray(clientVersions);

      return {
        clientVersions: processedVersions,
        total,
        page,
        limit,
        totalPages,
      };
    }

    // Full text search - simple implementation
    if (filters.search) {
      // If search query exists, ignore other filters and perform search only
      const searchConditions: any = { projectId };
      // Multi-field search logic is handled in the Model
      searchConditions.search = filters.search;
      const result = await ClientVersionModel.findAll({
        ...searchConditions,
        limit,
        offset,
        sortBy,
        sortOrder,
      });
      const { clientVersions, total } = result;

      const totalPages = Math.ceil(total / limit);

      // Apply maintenance status calculation based on time constraints
      const processedVersions =
        applyMaintenanceStatusCalculationToArray(clientVersions);

      return {
        clientVersions: processedVersions,
        total,
        page,
        limit,
        totalPages,
      };
    }

    // ClientVersionModel Used
    const result = await ClientVersionModel.findAll({
      projectId,
      clientVersion: filters.version,
      platform: filters.platform,
      clientStatus: filters.clientStatus,
      guestModeAllowed: filters.guestModeAllowed,
      tags: (filters as any).tags,
      tagsOperator: (filters as any).tagsOperator,
      limit,
      offset,
      sortBy,
      sortOrder,
    });

    const totalPages = Math.ceil(result.total / limit);

    // Apply maintenance status calculation based on time constraints
    const processedVersions = applyMaintenanceStatusCalculationToArray(
      result.clientVersions
    );

    return {
      clientVersions: processedVersions,
      total: result.total,
      page,
      limit,
      totalPages,
    };
  }

  static async getClientVersionById(
    id: string,
    projectId: string
  ): Promise<ClientVersionAttributes | null> {
    const version = await ClientVersionModel.findById(id, projectId);
    if (!version) return null;
    // Apply maintenance status calculation based on time constraints
    return applyMaintenanceStatusCalculation(version);
  }

  static async createClientVersion(
    data: ClientVersionCreationAttributes,
    projectId: string
  ): Promise<ClientVersionAttributes> {
    const result = await ClientVersionModel.create(data, projectId);

    // Invalidate client version cache (including ETag cache for SDK)
    await pubSubService.invalidateByPattern('*client_version:*');
    // Use targetEnv for SDK cache key if available
    const targetEnv = result.targetEnv;
    if (targetEnv) {
      await pubSubService.invalidateKey(
        `${SERVER_SDK_ETAG.CLIENT_VERSIONS}:${targetEnv}`
      );
    }

    // Publish event with full data for SDK cache update
    try {
      // Get full client version with tags for SDK cache
      const fullClientVersion = await this.getClientVersionById(
        result.id!,
        projectId
      );

      // Prepare data for SDK (parse customPayload and merge with passiveData)
      const sdkReadyClientVersion = fullClientVersion && targetEnv
        ? await prepareClientVersionForSDK(fullClientVersion, targetEnv)
        : fullClientVersion;

      await pubSubService.publishSDKEvent(
        {
          type: 'client_version.created',
          data: {
            id: result.id,
            projectId,
            clientVersion: sdkReadyClientVersion,
          },
        },
        { projectId }
      );
    } catch (err) {
      logger.error('Failed to publish client version event', err);
    }

    return result;
  }

  static async bulkCreateClientVersions(
    data: any,
    projectId: string
  ): Promise<ClientVersionAttributes[]> {
    // Duplicate check
    const duplicates = [];
    for (const platform of data.platforms) {
      const isDuplicate = await ClientVersionModel.checkDuplicate(
        platform.platform,
        data.clientVersion,
        undefined,
        projectId
      );
      if (isDuplicate) {
        duplicates.push(`${platform.platform}-${data.clientVersion}`);
      }
    }

    if (duplicates.length > 0) {
      throw new Error(`DUPLICATE_CLIENT_VERSIONS:${duplicates.join(', ')}`);
    }

    // Transform received data into client version arrays per platform
    const clientVersions = data.platforms.map((platform: any) => ({
      projectId,
      targetEnv: data.targetEnv || null,
      platform: platform.platform,
      clientVersion: data.clientVersion,
      clientStatus: data.clientStatus,
      gameServerAddress: platform.gameServerAddress,
      gameServerAddressForWhiteList:
        platform.gameServerAddressForWhiteList || null,
      patchAddress: platform.patchAddress,
      patchAddressForWhiteList: platform.patchAddressForWhiteList || null,
      guestModeAllowed: data.guestModeAllowed,
      externalClickLink: data.externalClickLink || null,
      memo: data.memo || null,
      customPayload: data.customPayload || null,
      minPatchVersion: data.minPatchVersion || null,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    }));

    const result = await ClientVersionModel.bulkCreate(
      clientVersions,
      projectId
    );

    // Set tags for each created client version if tags are provided
    if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
      const tagIds = data.tags
        .map((tag: any) => tag.id)
        .filter((id: any) => id); // Remove null/undefined

      if (tagIds.length > 0) {
        // Set tags for each created client version
        for (const clientVersion of result) {
          if (clientVersion && clientVersion.id) {
            try {
              await TagService.setTagsForEntity(
                'client_version',
                clientVersion.id,
                tagIds,
                data.createdBy
              );
            } catch (error) {
              logger.error(
                `Failed to set tags for client version ${clientVersion.id}:`,
                error
              );
              // Tag setting failure should not abort the entire operation
            }
          } else {
            logger.warn(
              'Skipping tag setting for invalid client version:',
              clientVersion
            );
          }
        }
      }
    }

    // Invalidate client version cache (including ETag cache for SDK - all projects for bulk op)
    await pubSubService.invalidateByPattern('*client_version:*');
    await pubSubService.invalidateByPattern(
      `${SERVER_SDK_ETAG.CLIENT_VERSIONS}:*`
    );

    // Publish generic update event (bulk op)
    await pubSubService.publishSDKEvent(
      {
        type: 'client_version.updated',
        data: { projectId },
      },
      { projectId }
    );

    return result;
  }

  static async updateClientVersion(
    id: string,
    data: Partial<ClientVersionCreationAttributes>,
    projectId: string
  ): Promise<ClientVersionAttributes | null> {
    const updatedRowsCount = await ClientVersionModel.update(
      id,
      data,
      projectId
    );

    if (updatedRowsCount === 0) {
      return null;
    }

    // Invalidate client version cache
    await pubSubService.invalidateByPattern('*client_version:*');

    const updatedClientVersion = await this.getClientVersionById(
      id,
      projectId
    );

    // Invalidate ETag cache for SDK using targetEnv
    const targetEnv = updatedClientVersion?.targetEnv;
    if (targetEnv) {
      await pubSubService.invalidateKey(
        `${SERVER_SDK_ETAG.CLIENT_VERSIONS}:${targetEnv}`
      );
    }

    // Publish event with full data for SDK cache update
    if (updatedClientVersion) {
      try {
        // Prepare data for SDK (parse customPayload and merge with passiveData)
        const sdkReadyClientVersion = targetEnv
          ? await prepareClientVersionForSDK(updatedClientVersion, targetEnv)
          : updatedClientVersion;

        await pubSubService.publishSDKEvent(
          {
            type: 'client_version.updated',
            data: {
              id: updatedClientVersion.id,
              projectId,
              clientVersion: sdkReadyClientVersion,
            },
          },
          { projectId }
        );
      } catch (err) {
        logger.error('Failed to publish client version event', err);
      }
    }

    return updatedClientVersion;
  }

  static async deleteClientVersion(
    id: string,
    projectId: string
  ): Promise<boolean> {
    const clientVersion = await ClientVersionModel.findById(id, projectId);
    await ClientVersionModel.delete(id, projectId);
    const deletedRowsCount = 1;
    const targetEnv = clientVersion?.targetEnv;

    if (deletedRowsCount > 0) {
      // Publish generic update event (deletion)
      await pubSubService.publishSDKEvent(
        {
          type: 'client_version.deleted',
          data: { id, projectId },
        },
        { projectId }
      );

      // Invalidate client version cache (including ETag cache)
      await pubSubService.invalidateByPattern('*client_version:*');
      if (targetEnv) {
        await pubSubService.invalidateKey(
          `${SERVER_SDK_ETAG.CLIENT_VERSIONS}:${targetEnv}`
        );
      }
    }

    return deletedRowsCount > 0;
  }

  static async bulkUpdateStatus(
    data: BulkStatusUpdateRequest,
    projectId: string
  ): Promise<number> {
    const result = await ClientVersionModel.bulkUpdateStatus(
      data,
      projectId
    );

    if (result > 0) {
      // Publish generic update event (bulk status)
      await pubSubService.publishSDKEvent(
        {
          type: 'client_version.updated',
          data: { projectId },
        },
        { projectId }
      );

      // Invalidate client version cache (including ETag cache - all for bulk op)
      await pubSubService.invalidateByPattern('*client_version:*');
      await pubSubService.invalidateByPattern(
        `${SERVER_SDK_ETAG.CLIENT_VERSIONS}:*`
      );
    }

    return result;
  }

  static async getPlatforms(projectId: string): Promise<string[]> {
    return await ClientVersionModel.getPlatforms(projectId);
  }

  static async checkDuplicate(
    platform: string,
    clientVersion: string,
    excludeId?: string,
    projectId?: string
  ): Promise<boolean> {
    return await ClientVersionModel.checkDuplicate(
      platform,
      clientVersion,
      excludeId,
      projectId
    );
  }

  /**
   * Find exactly matching client version by platform and clientVersion
   * Returns any status version (ONLINE, OFFLINE, MAINTENANCE, etc.)
   * Only returns null if the version doesn't exist
   */
  static async findByExact(
    platform: string,
    clientVersion: string,
    projectId: string
  ): Promise<ClientVersionAttributes | null> {
    const result = await ClientVersionModel.findAll({
      platform,
      clientVersion,
      projectId,
      limit: 1,
      offset: 0,
      sortBy: 'id',
      sortOrder: 'DESC',
    });
    const { clientVersions: rows } = result;

    if (!rows[0]) return null;
    // Apply maintenance status calculation based on time constraints
    return applyMaintenanceStatusCalculation(rows[0]);
  }

  /**
   * @deprecated Use findByExact instead
   * Find exactly matching ONLINE or MAINTENANCE client version by platform and clientVersion
   */
  static async findOnlineByExact(
    platform: string,
    clientVersion: string,
    projectId: string
  ): Promise<ClientVersionAttributes | null> {
    return this.findByExact(platform, clientVersion, projectId);
  }

  /**
   * Find the latest client version for a given platform
   * Since versions are validated on creation (must be greater than previous),
   * the most recently created version is the latest.
   *
   * @param platform - Platform identifier
   * @param status - Optional status filter. If provided, only versions with this status are considered.
   *                 If not provided, all versions are considered regardless of status.
   * @param projectId - Project identifier
   */
  static async findLatestByPlatform(
    platform: string,
    status?: ClientStatus | ClientStatus[],
    projectId?: string
  ): Promise<ClientVersionAttributes | null> {
    const queryOptions: any = {
      platform,
      projectId,
      limit: 1,
      offset: 0,
      sortBy: 'id',
      sortOrder: 'DESC',
    };

    // Only filter by status if explicitly provided
    if (status) {
      queryOptions.clientStatus = status;
    }

    const result = await ClientVersionModel.findAll(queryOptions);
    const { clientVersions: rows } = result;

    if (rows.length === 0) return null;

    // Apply maintenance status calculation based on time constraints
    return applyMaintenanceStatusCalculation(rows[0]);
  }
}

export default ClientVersionService;
