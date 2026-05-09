/**
 * CMS Service
 * Provides API calls for CMS table management via admind proxy.
 */
import api from './api';

// ── Types ──

export interface CmsTable {
  tableName: string;
  binaryCode: string | null;
  version: number;
  contentHash: string;
  comment: string | null;
  uploadedAt: string | null;
  uploadedBy: string | null;
  dataSize: number;
  reloadability: 'hot' | 'restart';
  rippleRegistered: boolean;
  rippleKey: string;
  runtime: {
    loadedVersion: number;
    loadedHash: string;
    synced: boolean;
  } | null;
}

export interface CmsTableDetail extends CmsTable {
  runtime: {
    loadedVersion: number;
    loadedHash: string;
    synced: boolean;
  } | null;
}

export interface CmsHistoryEntry {
  version: number;
  contentHash: string;
  comment: string | null;
  uploadedAt: string | null;
  uploadedBy: string | null;
  isActive: boolean;
}

export interface CmsTableHistoryResponse {
  tableName: string;
  binaryCode: string | null;
  activeVersion: number | null;
  count: number;
  history: CmsHistoryEntry[];
}

export interface CmsUploadResult {
  status: 'uploaded' | 'skipped';
  reason?: string;
  tableName: string;
  binaryCode: string | null;
  version: number;
  previousVersion?: number;
  contentHash: string;
  reloadability: 'hot' | 'restart';
  refresh?: {
    status: string;
    requestId?: string;
    pattern?: string;
    error?: string;
  } | null;
}

export interface CmsRollbackResult {
  status: 'rolled_back';
  tableName: string;
  binaryCode: string | null;
  previousVersion: number;
  rolledBackToVersion: number;
  newVersion: number;
  contentHash: string;
  reloadability: 'hot' | 'restart';
  refresh?: {
    status: string;
    requestId?: string;
    error?: string;
  } | null;
}

export interface CmsRefreshHistoryItem {
  key: string;
  timeoutMs: number;
  debounceMs: number;
  dependsOn: string[];
  lastSuccessAt: string | null;
}

// ── API ──

const cmsService = {
  /**
   * Get all CMS tables
   */
  async getTables(
    projectApiPath: string
  ): Promise<{ count: number; tables: CmsTable[]; admindUrl?: string }> {
    const res = await api.get(`${projectApiPath}/ripple-cms/cms/tables`);
    return res.data;
  },

  /**
   * Get CMS table detail
   */
  async getTableDetail(
    projectApiPath: string,
    tableName: string,
    binaryCode?: string
  ): Promise<CmsTableDetail> {
    const qs = binaryCode ? `?binaryCode=${binaryCode}` : '';
    const res = await api.get(
      `${projectApiPath}/ripple-cms/cms/tables/${encodeURIComponent(tableName)}${qs}`
    );
    return res.data;
  },

  /**
   * Get CMS table version history
   */
  async getTableHistory(
    projectApiPath: string,
    tableName: string,
    limit = 20,
    binaryCode?: string
  ): Promise<CmsTableHistoryResponse> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (binaryCode) params.set('binaryCode', binaryCode);
    const res = await api.get(
      `${projectApiPath}/ripple-cms/cms/tables/${encodeURIComponent(tableName)}/history?${params}`
    );
    return res.data;
  },

  /**
   * Upload CMS table data
   */
  async uploadTable(
    projectApiPath: string,
    tableName: string,
    data: any,
    comment: string,
    options?: { binaryCode?: string; refresh?: boolean; cascade?: boolean }
  ): Promise<CmsUploadResult> {
    const res = await api.post(`${projectApiPath}/ripple-cms/cms/upload`, {
      tableName,
      binaryCode: options?.binaryCode || null,
      data,
      comment,
      refresh: options?.refresh || false,
      cascade: options?.cascade || false,
    });
    return res.data;
  },

  /**
   * Rollback CMS table to a previous version
   */
  async rollbackTable(
    projectApiPath: string,
    tableName: string,
    version: number,
    options?: { binaryCode?: string; refresh?: boolean }
  ): Promise<CmsRollbackResult> {
    const res = await api.post(`${projectApiPath}/ripple-cms/cms/rollback`, {
      tableName,
      version,
      binaryCode: options?.binaryCode || null,
      refresh: options?.refresh || false,
    });
    return res.data;
  },

  /**
   * Get CMS Ripple refresh handler history
   */
  async getRefreshHistory(
    projectApiPath: string
  ): Promise<{ count: number; items: CmsRefreshHistoryItem[] }> {
    const res = await api.get(
      `${projectApiPath}/ripple-cms/cms/refresh-history`
    );
    return res.data;
  },

  /**
   * Get decompressed JSON data for a specific history version
   */
  async getTableVersionData(
    projectApiPath: string,
    tableName: string,
    version: number,
    binaryCode?: string
  ): Promise<{
    tableName: string;
    version: number;
    contentHash: string;
    data: any;
  }> {
    const params = new URLSearchParams();
    if (binaryCode) params.set('binaryCode', binaryCode);
    const qs = params.toString() ? `?${params}` : '';
    const res = await api.get(
      `${projectApiPath}/ripple-cms/cms/tables/${encodeURIComponent(tableName)}/history/${version}/data${qs}`
    );
    return res.data;
  },

  /**
   * Get pre-computed unified diff patch for a specific history version
   * Returns the patch text string, or null if not available
   */
  async getTableVersionDiff(
    projectApiPath: string,
    tableName: string,
    version: number,
    binaryCode?: string
  ): Promise<string | null> {
    try {
      const params = new URLSearchParams();
      if (binaryCode) params.set('binaryCode', binaryCode);
      const qs = params.toString() ? `?${params}` : '';
      const res = await api.get(
        `${projectApiPath}/ripple-cms/cms/tables/${encodeURIComponent(tableName)}/history/${version}/diff${qs}`,
        { responseType: 'text', transformResponse: [(data: any) => data] }
      );
      return res.data;
    } catch {
      return null;
    }
  },
};

export default cmsService;
