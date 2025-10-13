import { ClientVersionModel, ClientVersionAttributes, ClientVersionCreationAttributes, ClientStatus } from '../models/ClientVersion';
import { pubSubService } from './PubSubService';
import logger from '../config/logger';

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
  maintenanceLocales?: Array<{lang: 'ko' | 'en' | 'zh', message: string}>;
  messageTemplateId?: number;
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

    return { data, total };
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

      return {
        clientVersions,
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

      return {
        clientVersions,
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

    return {
      clientVersions: result.clientVersions,
      total: result.total,
      page,
      limit,
      totalPages,
    };
  }

  static async getClientVersionById(id: number): Promise<ClientVersionAttributes | null> {
    return await ClientVersionModel.findById(id);
  }

  static async createClientVersion(
    data: ClientVersionCreationAttributes
  ): Promise<ClientVersionAttributes> {
    const result = await ClientVersionModel.create(data);

    // Invalidate client version cache
    await pubSubService.invalidateByPattern('client_version:.*');

    return result;
  }

  static async bulkCreateClientVersions(
    data: any
  ): Promise<ClientVersionAttributes[]> {
    // 중복 체크
    const duplicates = [];
    for (const platform of data.platforms) {
      const isDuplicate = await ClientVersionModel.checkDuplicate(platform.platform, data.clientVersion);
      if (isDuplicate) {
        duplicates.push(`${platform.platform}-${data.clientVersion}`);
      }
    }

    if (duplicates.length > 0) {
      throw new Error(`Duplicate client versions found: ${duplicates.join(', ')}`);
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

    // Invalidate client version cache
    await pubSubService.invalidateByPattern('client_version:.*');

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
    return updatedClientVersion;
  }

  static async deleteClientVersion(id: number): Promise<boolean> {
    await ClientVersionModel.delete(id);
    const deletedRowsCount = 1;

    if (deletedRowsCount > 0) {
      // Invalidate client version cache
      await pubSubService.invalidateByPattern('client_version:.*');
    }

    return deletedRowsCount > 0;
  }

  static async bulkUpdateStatus(data: BulkStatusUpdateRequest): Promise<number> {
    const result = await ClientVersionModel.bulkUpdateStatus(data);

    if (result > 0) {
      // Invalidate client version cache
      await pubSubService.invalidateByPattern('client_version:.*');
    }

    return result;
  }

  static async getPlatforms(): Promise<string[]> {
    return await ClientVersionModel.getPlatforms();
  }

  static async checkDuplicate(
    platform: string,
    clientVersion: string,
    excludeId?: number
  ): Promise<boolean> {
    return await ClientVersionModel.checkDuplicate(platform, clientVersion, excludeId);
  }

  /**
   * Find exactly matching ONLINE client version by channel, subChannel and clientVersion
   */
  static async findOnlineByExact(
    platform: string,
    clientVersion: string
  ): Promise<ClientVersionAttributes | null> {
    const result = await ClientVersionModel.findAll({
      platform,
      clientVersion,
      clientStatus: ClientStatus.ONLINE,
      limit: 1,
      offset: 0,
      sortBy: 'id',
      sortOrder: 'DESC',
    });
    const { clientVersions: rows } = result;

    return rows[0] || null;
  }
}

export default ClientVersionService;
