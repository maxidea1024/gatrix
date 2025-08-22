import ClientVersionModel, { ClientVersionAttributes, ClientVersionCreationAttributes, ClientStatus } from '../models/ClientVersion';

export interface ClientVersionFilters {
  channel?: string;
  subChannel?: string;
  clientStatus?: ClientStatus;
  gameServerAddress?: string;
  patchAddress?: string;
  guestModeAllowed?: boolean;
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
}

export class ClientVersionService {
  static async getAllClientVersions(
    filters: ClientVersionFilters = {},
    pagination: ClientVersionPagination
  ): Promise<ClientVersionListResponse> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC' } = pagination;
    const offset = (page - 1) * limit;

    // 검색 조건 구성
    const whereConditions: any = {};

    if (filters.channel) {
      whereConditions.channel = { like: filters.channel };
    }

    if (filters.subChannel) {
      whereConditions.subChannel = { like: filters.subChannel };
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

    // 날짜 필터는 나중에 구현
    // if (filters.createdAtFrom || filters.createdAtTo) {
    //   // TODO: 날짜 범위 필터 구현
    // }

    // 전체 검색 - 간단한 구현
    if (filters.search) {
      // 검색어가 있으면 다른 필터는 무시하고 검색만 수행
      const searchConditions: any = {};
      // 여러 필드에서 검색하는 로직은 모델에서 처리
      searchConditions.search = filters.search;
      const { rows: clientVersions, count: total } = await ClientVersionModel.findAll({
        where: searchConditions,
        limit,
        offset,
        orderBy: sortBy,
        orderDirection: sortOrder,
      });

      const totalPages = Math.ceil(total / limit);

      return {
        clientVersions,
        total,
        page,
        limit,
        totalPages,
      };
    }

    const { rows: clientVersions, count: total } = await ClientVersionModel.findAll({
      where: whereConditions,
      limit,
      offset,
      orderBy: sortBy,
      orderDirection: sortOrder,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      clientVersions,
      total,
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
    return await ClientVersionModel.create(data);
  }

  static async updateClientVersion(
    id: number,
    data: Partial<ClientVersionCreationAttributes>
  ): Promise<ClientVersionAttributes | null> {
    const updatedRowsCount = await ClientVersionModel.update(id, data);

    if (updatedRowsCount === 0) {
      return null;
    }

    const updatedClientVersion = await this.getClientVersionById(id);
    return updatedClientVersion;
  }

  static async deleteClientVersion(id: number): Promise<boolean> {
    const deletedRowsCount = await ClientVersionModel.delete(id);
    return deletedRowsCount > 0;
  }

  static async bulkUpdateStatus(data: BulkStatusUpdateRequest): Promise<number> {
    return await ClientVersionModel.bulkUpdateStatus(data.ids, data.clientStatus, data.updatedBy);
  }

  static async getChannels(): Promise<string[]> {
    return await ClientVersionModel.getChannels();
  }

  static async getSubChannels(channel?: string): Promise<string[]> {
    return await ClientVersionModel.getSubChannels(channel);
  }

  static async checkDuplicate(
    channel: string,
    subChannel: string,
    clientVersion: string,
    excludeId?: number
  ): Promise<boolean> {
    return await ClientVersionModel.checkDuplicate(channel, subChannel, clientVersion, excludeId);
  }
}

export default ClientVersionService;
