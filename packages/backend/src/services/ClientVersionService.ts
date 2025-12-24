import { ClientVersionModel, ClientVersionAttributes, ClientVersionCreationAttributes, ClientStatus } from '../models/ClientVersion';
import { pubSubService } from './PubSubService';
import { Environment } from '../models/Environment';
import logger from '../config/logger';
import { applyMaintenanceStatusCalculationToArray, applyMaintenanceStatusCalculation } from '../utils/maintenanceUtils';
import { SERVER_SDK_ETAG } from '../constants/cacheKeys';
import VarsModel from '../models/Vars';

/**
 * Parse semver string to numeric array [major, minor, patch]
 */
function parseSemver(version: string): [number, number, number] {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

/**
 * Compare two semver versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareSemver(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseSemver(a);
  const [bMajor, bMinor, bPatch] = parseSemver(b);

  if (aMajor !== bMajor) return aMajor > bMajor ? 1 : -1;
  if (aMinor !== bMinor) return aMinor > bMinor ? 1 : -1;
  if (aPatch !== bPatch) return aPatch > bPatch ? 1 : -1;
  return 0;
}

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
  environmentId?: string
): Promise<any> {
  // Get clientVersionPassiveData from KV settings
  let passiveData: Record<string, any> = {};
  try {
    const passiveDataStr = await VarsModel.get('$clientVersionPassiveData', environmentId);
    if (passiveDataStr) {
      let parsed = JSON.parse(passiveDataStr);
      // Handle double-encoded JSON string
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch (e) {
          // ignore
        }
      }
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        passiveData = parsed;
      }
    }
  } catch (error) {
    logger.warn('Failed to parse clientVersionPassiveData for SDK event:', error);
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

  // Remove internal fields from response
  const { environmentId: _envId, ...versionWithoutEnvId } = version as any;
  void _envId;

  return {
    ...versionWithoutEnvId,
    customPayload: mergedMeta, // Return as object, not string
  };
}

export class ClientVersionService {
  // 사용 가능한 버전 목록 조회 (distinct)
  static async getAvailableVersions(): Promise<string[]> {
    try {
      const versions = await ClientVersionModel.getDistinctVersions();
      return versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    } catch (error) {
      logger.error('Error getting available versions:', error);
      throw error;
    }
  }

  static async getClientVersions(
    filters: ClientVersionFilters = {},
    pagination: ClientVersionPagination
  ): Promise<{ data: ClientVersionAttributes[], total: number }> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC' } = pagination;
    const offset = (page - 1) * limit;

    const whereConditions: any = {};

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
    filters: ClientVersionFilters = {},
    pagination: ClientVersionPagination
  ): Promise<ClientVersionListResponse> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC' } = pagination;
    const offset = (page - 1) * limit;

    // 검색 조건 구성
    const whereConditions: any = {};

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
      const dateFilters: any = {};
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
      const searchConditions: any = {};
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

  static async getClientVersionById(id: number): Promise<ClientVersionAttributes | null> {
    const version = await ClientVersionModel.findById(id);
    if (!version) return null;
    // Apply maintenance status calculation based on time constraints
    return applyMaintenanceStatusCalculation(version);
  }

  static async createClientVersion(
    data: ClientVersionCreationAttributes
  ): Promise<ClientVersionAttributes> {
    // [DISABLED] Validate that the new version is greater than the latest version for this platform
    // const latestVersion = await this.findLatestByPlatform(data.platform);
    // if (latestVersion && compareSemver(data.clientVersion, latestVersion.clientVersion) <= 0) {
    //   throw new Error(
    //     `VERSION_TOO_OLD:${latestVersion.clientVersion}` // Error code format for i18n
    //   );
    // }

    const result = await ClientVersionModel.create(data);

    // Invalidate client version cache (including ETag cache for SDK)
    await pubSubService.invalidateByPattern('client_version:.*');
    if (result.environmentId) {
      await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.CLIENT_VERSIONS}:${result.environmentId}`);
    }

    // Publish event with full data for SDK cache update
    try {
      let environment: string | undefined;
      if (result.environmentId) {
        const env = await Environment.query().findById(result.environmentId);
        environment = env?.environmentName;
      }

      // Get full client version with tags for SDK cache
      const fullClientVersion = await this.getClientVersionById(result.id);

      // Prepare data for SDK (parse customPayload and merge with passiveData)
      const sdkReadyClientVersion = fullClientVersion
        ? await prepareClientVersionForSDK(fullClientVersion, result.environmentId)
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
    data: any
  ): Promise<ClientVersionAttributes[]> {
    // [DISABLED] Version validation for each platform
    // const versionErrors: string[] = [];
    // for (const platform of data.platforms) {
    //   const latestVersion = await this.findLatestByPlatform(platform.platform);
    //   if (latestVersion && compareSemver(data.clientVersion, latestVersion.clientVersion) <= 0) {
    //     versionErrors.push(`${platform.platform}: ${latestVersion.clientVersion}`);
    //   }
    // }
    //
    // if (versionErrors.length > 0) {
    //   throw new Error(
    //     `VERSION_TOO_OLD_BULK:${versionErrors.join(', ')}` // Error code format for i18n
    //   );
    // }

    // 중복 체크 (환경 컨텍스트 내에서 자동으로 체크됨)
    const duplicates = [];
    for (const platform of data.platforms) {
      // checkDuplicate now automatically uses getCurrentEnvironmentId() from context
      const isDuplicate = await ClientVersionModel.checkDuplicate(platform.platform, data.clientVersion);
      if (isDuplicate) {
        duplicates.push(`${platform.platform}-${data.clientVersion}`);
      }
    }

    if (duplicates.length > 0) {
      throw new Error(`DUPLICATE_CLIENT_VERSIONS:${duplicates.join(', ')}`);
    }

    // 받은 데이터를 각 플랫폼별로 클라이언트 버전 배열로 변환
    const clientVersions = data.platforms.map((platform: any) => ({
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

    const result = await ClientVersionModel.bulkCreate(clientVersions);

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
    await pubSubService.invalidateByPattern('client_version:.*');
    await pubSubService.invalidateByPattern(`${SERVER_SDK_ETAG.CLIENT_VERSIONS}:*`);

    // Publish generic update event (bulk op)
    // Resolve environment name from the first result
    let bulkEnvName: string | undefined;
    if (result[0]?.environmentId) {
      const env = await Environment.query().findById(result[0].environmentId);
      bulkEnvName = env?.environmentName;
    }
    await pubSubService.publishSDKEvent({
      type: 'client_version.updated',
      data: { timestamp: Date.now(), environment: bulkEnvName }
    });

    return result;
  }

  static async updateClientVersion(
    id: number,
    data: Partial<ClientVersionCreationAttributes>
  ): Promise<ClientVersionAttributes | null> {
    const updatedRowsCount = await ClientVersionModel.update(id, data);

    if (updatedRowsCount === 0) {
      return null;
    }

    // Invalidate client version cache
    await pubSubService.invalidateByPattern('client_version:.*');

    const updatedClientVersion = await this.getClientVersionById(id);

    // Invalidate ETag cache for SDK
    if (updatedClientVersion?.environmentId) {
      await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.CLIENT_VERSIONS}:${updatedClientVersion.environmentId}`);
    }

    // Publish event with full data for SDK cache update
    if (updatedClientVersion) {
      try {
        let environment: string | undefined;
        if (updatedClientVersion.environmentId) {
          const env = await Environment.query().findById(updatedClientVersion.environmentId);
          environment = env?.environmentName;
        }

        // Prepare data for SDK (parse customPayload and merge with passiveData)
        const sdkReadyClientVersion = await prepareClientVersionForSDK(
          updatedClientVersion,
          updatedClientVersion.environmentId
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

  static async deleteClientVersion(id: number): Promise<boolean> {
    const clientVersion = await ClientVersionModel.findById(id);
    await ClientVersionModel.delete(id);
    const deletedRowsCount = 1;

    if (deletedRowsCount > 0) {
      let environment: string | undefined;
      if (clientVersion?.environmentId) {
        const env = await Environment.query().findById(clientVersion.environmentId);
        environment = env?.environmentName;
      }

      // Publish generic update event (deletion)
      await pubSubService.publishSDKEvent({
        type: 'client_version.deleted',
        data: { id, environment, timestamp: Date.now() }
      });

      // Invalidate client version cache (including ETag cache - all environments for deletion)
      await pubSubService.invalidateByPattern('client_version:.*');
      await pubSubService.invalidateByPattern(`${SERVER_SDK_ETAG.CLIENT_VERSIONS}:*`);
    }

    return deletedRowsCount > 0;
  }

  static async bulkUpdateStatus(data: BulkStatusUpdateRequest): Promise<number> {
    const result = await ClientVersionModel.bulkUpdateStatus(data);

    if (result > 0) {
      // Publish generic update event (bulk status)
      // Note: Bulk status update may affect multiple environments
      // For now, sdk will refresh all environments when environment is missing
      // TODO: Consider getting environment from the first affected item
      await pubSubService.publishSDKEvent({
        type: 'client_version.updated',
        data: { timestamp: Date.now() }
      });

      // Invalidate client version cache (including ETag cache - all environments for bulk op)
      await pubSubService.invalidateByPattern('client_version:.*');
      await pubSubService.invalidateByPattern(`${SERVER_SDK_ETAG.CLIENT_VERSIONS}:*`);
    }

    return result;
  }

  static async getPlatforms(): Promise<string[]> {
    return await ClientVersionModel.getPlatforms();
  }

  static async checkDuplicate(
    platform: string,
    clientVersion: string,
    excludeId?: number,
    environmentId?: string
  ): Promise<boolean> {
    return await ClientVersionModel.checkDuplicate(platform, clientVersion, excludeId, environmentId);
  }

  /**
   * Find exactly matching client version by platform and clientVersion
   * Returns any status version (ONLINE, OFFLINE, MAINTENANCE, etc.)
   * Only returns null if the version doesn't exist
   */
  static async findByExact(
    platform: string,
    clientVersion: string,
    environmentId?: string
  ): Promise<ClientVersionAttributes | null> {
    const result = await ClientVersionModel.findAll({
      platform,
      clientVersion,
      environmentId,
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
    clientVersion: string
  ): Promise<ClientVersionAttributes | null> {
    return this.findByExact(platform, clientVersion);
  }

  /**
   * Find the latest client version for a given platform
   * Since versions are validated on creation (must be greater than previous),
   * the most recently created version is the latest.
   *
   * @param platform - Platform identifier
   * @param status - Optional status filter. If provided, only versions with this status are considered.
   *                 If not provided, all versions are considered regardless of status.
   */
  static async findLatestByPlatform(
    platform: string,
    status?: ClientStatus | ClientStatus[],
    environmentId?: string
  ): Promise<ClientVersionAttributes | null> {
    const queryOptions: any = {
      platform,
      environmentId,
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
