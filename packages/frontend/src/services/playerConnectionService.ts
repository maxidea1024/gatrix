import api from './api';

// Types
export interface CcuData {
  total: number;
  botTotal: number;
  worlds: Array<{
    worldId: string;
    name: string;
    count: number;
    botCount: number;
  }>;
}

export interface CcuHistoryRecord {
  id: number;
  environmentId: number;
  worldId: string | null;
  worldName: string | null;
  playerCount: number;
  botCount: number;
  recordedAt: string;
}

export interface ConnectedUser {
  userId: string;
  accountId?: string;
  characterId?: string;
  userName?: string;
  worldId?: string;
  worldName?: string;
  connectedAt?: string;
  ip?: string;
  [key: string]: any; // Allow additional fields from admind API
}

export interface ConnectedUsersResponse {
  users: ConnectedUser[];
  total: number;
  page: number;
  limit: number;
}

export interface KickRequest {
  type: 'all' | 'world' | 'user';
  worldId?: string;
  userId?: string;
  message?: string;
}

export interface KickResponse {
  kicked: number;
}

// Service
const playerConnectionService = {
  /**
   * Get real-time CCU from admind API
   */
  async getCcu(projectApiPath: string): Promise<CcuData> {
    const res = await api.get(`${projectApiPath}/player-connections/ccu`);
    return res.data || { total: 0, worlds: [] };
  },

  /**
   * Get CCU history from database for graphing
   */
  async getCcuHistory(
    projectApiPath: string,
    params: { from: string; to: string; worldId?: string }
  ): Promise<CcuHistoryRecord[]> {
    const searchParams = new URLSearchParams({
      from: params.from,
      to: params.to,
    });
    if (params.worldId !== undefined) {
      searchParams.set('worldId', params.worldId);
    }
    const res = await api.get(
      `${projectApiPath}/player-connections/ccu/history?${searchParams}`
    );
    return res.data?.records || [];
  },

  /**
   * Get connected users list with pagination
   */
  async getConnectedUsers(
    projectApiPath: string,
    params: {
      page?: number;
      limit?: number;
      worldId?: string;
      search?: string;
      sortBy?: string;
      sortDesc?: boolean;
    }
  ): Promise<ConnectedUsersResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.worldId) searchParams.set('worldId', params.worldId);
    if (params.search) searchParams.set('search', params.search);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortDesc !== undefined)
      searchParams.set('sortDesc', String(params.sortDesc));

    const res = await api.get(
      `${projectApiPath}/player-connections/users?${searchParams}`
    );
    return res.data || { users: [], total: 0, page: 1, limit: 20 };
  },

  /**
   * Kick players
   */
  async kickPlayers(
    projectApiPath: string,
    request: KickRequest
  ): Promise<KickResponse> {
    const res = await api.post(
      `${projectApiPath}/player-connections/kick`,
      request
    );
    return res.data || { kicked: 0 };
  },
};

export default playerConnectionService;
