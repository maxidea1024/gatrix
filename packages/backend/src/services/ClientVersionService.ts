import { ClientVersionModel, ClientVersionAttributes, ClientVersionCreationAttributes, ClientStatus } from '../models/ClientVersion';
import { pubSubService } from './PubSubService';
import { Environment } from '../models/Environment';
import logger from '../config/logger';
import { applyMaintenanceStatusCalculationToArray, applyMaintenanceStatusCalculation } from '../utils/maintenanceUtils';
import { SERVER_SDK_ETAG } from '../constants/cacheKeys';
import VarsModel from '../models/Vars';
import { resolvePassiveData } from '../utils/passiveDataUtils';



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
  createdBy?: number;
  updatedBy?: number;
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
  updatedBy: number;
  // 점검 관련 필드들
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  maintenanceMessage?: string;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: Array<{ lang: 'ko' | 'en' | 'zh', message: string }>;
  messageTemplateId?: number;
}

/**
 * Prepare client version data for SDK events
 * Parses customPayload and merges with passiveData to ensure meta is an object
 */
async function prepareClientVersionForSDK(
  version: ClientVersionAttributes,
  environment: string
): Promise<any> {
  // Get clientVersionPassiveData from KV settings and resolve by version
  let passiveData: Record<string, any> = {};
  try {
    const passiveDataStr = await VarsModel.get('$clientVersionPassiveData', environment);
    passiveData = resolvePassiveData(passiveDataStr, version.clientVersion);
  } catch (error) {
    logger.warn('Failed to resolve clientVersionPassiveData for SDK event:', error);
  }

  // Parse customPayload
  let customPayload: Record<string, any> = {};
  try {
    if (version.customPayload) {
      let parsed = typeof version.customPayload === 'string'
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
    logger.warn(`Failed to parse customPayload for SDK event (version ${version.id}):`, error);
  }

  // Merge: passiveData first, then customPayload (customPayload overwrites)
  const mergedMeta = { ...passiveData, ...customPayload };

  return {
    ...version,
    customPayload: mergedMeta, // Return as object, not string
  };
}

export class ClientVersionService {
  // 사용 가능한 버전 목록 조회 (distinct)
  static async getAvailableVersions(environment: string): Promise<string[]> {
    try {
      const versions = await ClientVersionModel.getDistinctVersions(environment);
      return versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    } catch (error) {
      logger.error('Error getting available versions:', error);
      throw error;
    }
  }

  static async getClientVersions(
    environment: string,
    filters: Omit<ClientVersionFilters, 'environment'> = {},
    pagination: ClientVersionPagination
  ): Promise<{ data: ClientVersionAttributes[], total: number }> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC' } = pagination;
    const offset = (page - 1) * limit;

    const whereConditions: any = { environment };

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
    environment: string,
    filters: Omit<ClientVersionFilters, 'environment'> = {},
    pagination: ClientVersionPagination
  ): Promise<ClientVersionListResponse> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC' } = pagination;
    const offset = (page - 1) * limit;

    // 검색 조건 구성
    const whereConditions: any = { environment };

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

    // 날짜 필터 구현
    if (filters.createdAtFrom || filters.createdAtTo) {
      const dateFilters: any = { environment };
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
      const processedVersions = applyMaintenanceStatusCalculationToArray(clientVersions);

      return {
        clientVersions: processedVersions,
        total,
        page,
        limit,
        totalPages,
      };
    }

    // 전체 검색 - 간단한 구현
    if (filters.search) {
      // 검색어가 있으면 다른 필터는 무시하고 검색만 수행
      const searchConditions: any = { environment };
      // 여러 필드에서 검색하는 로직은 모델에서 처리
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
      const processedVersions = applyMaintenanceStatusCalculationToArray(clientVersions);

      return {
        clientVersions: processedVersions,
        total,
        page,
        limit,
        totalPages,
      };
    }

    // ClientVersionModel 사용
    const result = await ClientVersionModel.findAll({
      environment,
      clientVersion: filters.version,
      platform: filters.platform,
      clientStatus: filters.clientStatus,
      guestModeAllowed: filters.guestModeAllowed,
      tags: (filters as any).tags,
      tagsOperator: (filters as any).tagsOperator,
      limit,
      offset,
      sortBy,
      sortOrder
    });

    const totalPages = Math.ceil(result.total / limit);

    // Apply maintenance status calculation based on time constraints
    const processedVersions = applyMaintenanceStatusCalculationToArray(result.clientVersions);

    return {
      clientVersions: processedVersions,
      total: result.total,
      page,
      limit,
      totalPages,
    };
  }

  static async getClientVersionById(id: number, environment: string): Promise<ClientVersionAttributes | null> {
    const version = await ClientVersionModel.findById(id, environment);
    if (!version) return null;
    // Apply maintenance status calculation based on time constraints
    return applyMaintenanceStatusCalculation(version);
  }

  static async createClientVersion(
    data: ClientVersionCreationAttributes,
    environment: string
  ): Promise<ClientVersionAttributes> {
    const result = await ClientVersionModel.create(data, environment);

    // Invalidate client version cache (including ETag cache for SDK)
    await pubSubService.invalidateByPattern('*client_version:*');
    if (environment) {
      await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.CLIENT_VERSIONS}:${environment}`);
    }

    // Publish event with full data for SDK cache update
    try {
      const environment = result.environment;

      // Get full client version with tags for SDK cache
      const fullClientVersion = await this.getClientVersionById(result.id!, environment);

      // Prepare data for SDK (parse customPayload and merge with passiveData)
      const sdkReadyClientVersion = fullClientVersion
        ? await prepareClientVersionForSDK(fullClientVersion, environment)
        : null;

      await pubSubService.publishSDKEvent({
        type: 'client_version.created',
        data: {
          id: result.id,
          environment,
          timestamp: Date.now(),
          clientVersion: sdkReadyClientVersion
        }
      });
    } catch (err) {
      logger.error('Failed to publish client version event', err);
    }

    return result;
  }

  static async bulkCreateClientVersions(
    data: any,
    environment: string
  ): Promise<ClientVersionAttributes[]> {
    // 중복 체크
    const duplicates = [];
    for (const platform of data.platforms) {
      const isDuplicate = await ClientVersionModel.checkDuplicate(platform.platform, data.clientVersion, undefined, environment);
      if (isDuplicate) {
        duplicates.push(`${platform.platform}-${data.clientVersion}`);
      }
    }

    if (duplicates.length > 0) {
      throw new Error(`DUPLICATE_CLIENT_VERSIONS:${duplicates.join(', ')}`);
    }

    // 받은 데이터를 각 플랫폼별로 클라이언트 버전 배열로 변환
    const clientVersions = data.platforms.map((platform: any) => ({
      environment,
      platform: platform.platform,
      clientVersion: data.clientVersion,
      clientStatus: data.clientStatus,
      gameServerAddress: platform.gameServerAddress,
      gameServerAddressForWhiteList: platform.gameServerAddressForWhiteList || null,
      patchAddress: platform.patchAddress,
      patchAddressForWhiteList: platform.patchAddressForWhiteList || null,
      guestModeAllowed: data.guestModeAllowed,
      externalClickLink: data.externalClickLink || null,
      memo: data.memo || null,
      customPayload: data.customPayload || null,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    }));

    const result = await ClientVersionModel.bulkCreate(clientVersions, environment);

    // 태그가 있는 경우 각 생성된 클라이언트 버전에 태그 설정
    if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
      const tagIds = data.tags.map((tag: any) => tag.id).filter((id: any) => id); // null/undefined 제거

      if (tagIds.length > 0) {
        // 각 생성된 클라이언트 버전에 태그 설정
        for (const clientVersion of result) {
          if (clientVersion && clientVersion.id) {
            try {
              await ClientVersionModel.setTags(clientVersion.id, tagIds, data.createdBy);
            } catch (error) {
              logger.error(`Failed to set tags for client version ${clientVersion.id}:`, error);
              // 태그 설정 실패는 전체 작업을 중단하지 않음
            }
          } else {
            logger.warn('Skipping tag setting for invalid client version:', clientVersion);
          }
        }
      }
    }

    // Invalidate client version cache (including ETag cache for SDK - all environments for bulk op)
    await pubSubService.invalidateByPattern('*client_version:*');
    await pubSubService.invalidateByPattern(`${SERVER_SDK_ETAG.CLIENT_VERSIONS}:*`);

    // Publish generic update event (bulk op)
    await pubSubService.publishSDKEvent({
      type: 'client_version.updated',
      data: { timestamp: Date.now(), environment }
    });

    return result;
  }

  static async updateClientVersion(
    id: number,
    data: Partial<ClientVersionCreationAttributes>,
    environment: string
  ): Promise<ClientVersionAttributes | null> {
    const updatedRowsCount = await ClientVersionModel.update(id, data, environment);

    if (updatedRowsCount === 0) {
      return null;
    }

    // Invalidate client version cache
    await pubSubService.invalidateByPattern('*client_version:*');

    const updatedClientVersion = await this.getClientVersionById(id, environment);

    // Invalidate ETag cache for SDK
    if (environment) {
      await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.CLIENT_VERSIONS}:${environment}`);
    }

    // Publish event with full data for SDK cache update
    if (updatedClientVersion) {
      try {
        const environment = updatedClientVersion.environment;

        // Prepare data for SDK (parse customPayload and merge with passiveData)
        const sdkReadyClientVersion = await prepareClientVersionForSDK(
          updatedClientVersion,
          environment
        );

        await pubSubService.publishSDKEvent({
          type: 'client_version.updated',
          data: {
            id: updatedClientVersion.id,
            environment,
            timestamp: Date.now(),
            clientVersion: sdkReadyClientVersion
          }
        });
      } catch (err) {
        logger.error('Failed to publish client version event', err);
      }
    }

    return updatedClientVersion;
  }

  static async deleteClientVersion(id: number, environment: string): Promise<boolean> {
    const clientVersion = await ClientVersionModel.findById(id, environment);
    await ClientVersionModel.delete(id, environment);
    const deletedRowsCount = 1;

    if (deletedRowsCount > 0) {

      // Publish generic update event (deletion)
      await pubSubService.publishSDKEvent({
        type: 'client_version.deleted',
        data: { id, environment, timestamp: Date.now() }
      });

      // Invalidate client version cache (including ETag cache - all environments for deletion)
      await pubSubService.invalidateByPattern('*client_version:*');
      if (environment) {
        await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.CLIENT_VERSIONS}:${environment}`);
      }
    }

    return deletedRowsCount > 0;
  }

  static async bulkUpdateStatus(data: BulkStatusUpdateRequest, environment: string): Promise<number> {
    const result = await ClientVersionModel.bulkUpdateStatus(data, environment);

    if (result > 0) {
      // Publish generic update event (bulk status)
      await pubSubService.publishSDKEvent({
        type: 'client_version.updated',
        data: { timestamp: Date.now() }
      });

      // Invalidate client version cache (including ETag cache - all environments for bulk op)
      await pubSubService.invalidateByPattern('*client_version:*');
      if (environment) {
        await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.CLIENT_VERSIONS}:${environment}`);
      }
    }

    return result;
  }

  static async getPlatforms(environment: string): Promise<string[]> {
    return await ClientVersionModel.getPlatforms(environment);
  }

  static async checkDuplicate(
    platform: string,
    clientVersion: string,
    excludeId?: number,
    environment?: string
  ): Promise<boolean> {
    return await ClientVersionModel.checkDuplicate(platform, clientVersion, excludeId, environment);
  }

  /**
   * Find exactly matching client version by platform and clientVersion
   * Returns any status version (ONLINE, OFFLINE, MAINTENANCE, etc.)
   * Only returns null if the version doesn't exist
   */
  static async findByExact(
    platform: string,
    clientVersion: string,
    environment: string
  ): Promise<ClientVersionAttributes | null> {
    const result = await ClientVersionModel.findAll({
      platform,
      clientVersion,
      environment,
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
    environment: string
  ): Promise<ClientVersionAttributes | null> {
    return this.findByExact(platform, clientVersion, environment);
  }

  /**
   * Find the latest client version for a given platform
   * Since versions are validated on creation (must be greater than previous),
   * the most recently created version is the latest.
   *
   * @param platform - Platform identifier
   * @param status - Optional status filter. If provided, only versions with this status are considered.
   *                 If not provided, all versions are considered regardless of status.
   * @param environment - Environment identifier
   */
  static async findLatestByPlatform(
    platform: string,
    status?: ClientStatus | ClientStatus[],
    environment?: string
  ): Promise<ClientVersionAttributes | null> {
    const queryOptions: any = {
      platform,
      environment,
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
