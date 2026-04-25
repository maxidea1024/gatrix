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
  admindUrl?: string;
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
  level?: number;
  nationCmsId?: number;
  isBot?: boolean;
  storeCode?: string;
  appVersion?: string;
  deviceType?: string;
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

export interface AllPlayer {
  userId: number;
  characterId: string;
  name: string;
  nationCmsId: number;
  worldId: string;
  accountId: string;
  isOnline: boolean;
  lastLoginTimeUtc: string | null;
  loginPlatform: string;
  clientVersion: string;
  lastWorldId: string;
  accessLevel: number;
  createTimeUtc: string | null;
  blockTimeUtcByAdmin: string | null;
  revokedTimeUtc: string | null;
  lastUserId: number | null;
}

export interface AllPlayersResponse {
  users: AllPlayer[];
  total: number;
  page: number;
  limit: number;
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

  /**
   * Get all registered players from game DB (via admind)
   * Server-side pagination
   */
  async getAllPlayers(
    projectApiPath: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      worldId?: string;
      sortBy?: string;
      sortDesc?: boolean;
      isOnline?: string;
      loginPlatform?: string;
    }
  ): Promise<AllPlayersResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.search) searchParams.set('search', params.search);
    if (params.worldId) searchParams.set('worldId', params.worldId);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortDesc !== undefined)
      searchParams.set('sortDesc', String(params.sortDesc));
    if (params.isOnline !== undefined && params.isOnline !== '')
      searchParams.set('isOnline', params.isOnline);
    if (params.loginPlatform)
      searchParams.set('loginPlatform', params.loginPlatform);

    const res = await api.get(
      `${projectApiPath}/player-connections/all-players?${searchParams}`
    );
    return res.data || { users: [], total: 0, page: 1, limit: 20 };
  },

  async getAllCharacters(
    projectApiPath: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      worldId?: string;
      sortBy?: string;
      sortDesc?: boolean;
      isOnline?: string;
      loginPlatform?: string;
    }
  ): Promise<AllPlayersResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.search) searchParams.set('search', params.search);
    if (params.worldId) searchParams.set('worldId', params.worldId);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortDesc !== undefined)
      searchParams.set('sortDesc', String(params.sortDesc));
    if (params.isOnline !== undefined && params.isOnline !== '')
      searchParams.set('isOnline', params.isOnline);
    if (params.loginPlatform)
      searchParams.set('loginPlatform', params.loginPlatform);

    const res = await api.get(
      `${projectApiPath}/player-connections/all-characters?${searchParams}`
    );
    return res.data || { users: [], total: 0, page: 1, limit: 20 };
  },

  /**
   * Preview sync online status: dry-run that returns stale users without fixing
   */
  async previewSyncOnlineStatus(projectApiPath: string): Promise<{
    totalDbOnline: number;
    totalActualOnline: number;
    staleCount: number;
    staleUsers: Array<{
      accountId: string;
      lastUserId: number;
      name: string;
      characterId: string;
      worldId: string;
      lastLoginTimeUtc: string | null;
      loginPlatform: string;
      clientVersion: string;
    }>;
    hasMore: boolean;
  }> {
    const res = await api.get(
      `${projectApiPath}/player-connections/sync-online-status/preview`
    );
    return (
      res.data || {
        totalDbOnline: 0,
        totalActualOnline: 0,
        staleCount: 0,
        staleUsers: [],
        hasMore: false,
      }
    );
  },

  /**
   * Sync online status: cross-reference actual connected users with DB isOnline flags
   */
  async syncOnlineStatus(projectApiPath: string): Promise<{
    fixed: number;
    staleAccountIds: string[];
    totalDbOnline: number;
    totalActualOnline: number;
  }> {
    const res = await api.post(
      `${projectApiPath}/player-connections/sync-online-status`
    );
    return (
      res.data || {
        fixed: 0,
        staleAccountIds: [],
        totalDbOnline: 0,
        totalActualOnline: 0,
      }
    );
  },

  /**
   * Get payment statistics from authd (token-secured).
   * Returns null if denied or unavailable.
   */
  async getPaymentStats(
    projectApiPath: string
  ): Promise<{ totalCount: number; totalAmount: number } | null> {
    try {
      const res = await api.get(
        `${projectApiPath}/player-connections/payment-stats`
      );
      return res.data || null;
    } catch {
      return null;
    }
  },
};

export default playerConnectionService;
