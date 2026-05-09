/**
 * Ripple Service
 * Provides API calls for Ripple monitoring via admind proxy.
 */
import api from './api';

// ── Types ──

export interface RippleRefreshable {
  key: string;
  timeoutMs: number;
  debounceMs: number;
  dependsOn: string[];
}

export interface RippleHealthData {
  status: string;
  registeredCount: number;
}

export interface RippleStatusResponse {
  health: RippleHealthData;
  refreshables: RippleRefreshable[];
  registeredCount: number;
  admindUrl?: string;
}

export interface RippleRefreshResult {
  requestId: string;
  pattern: string;
  matchedKeys: string[];
  matchedCount: number;
  cascade: boolean;
  status: string;
}

export interface RippleHistoryEvent {
  eventId: string;
  serverId: string;
  serviceType?: string;
  requestId: string;
  pattern: string;
  handlerKey: string;
  status: 'success' | 'failure' | 'timeout' | 'skipped';
  durationMs: number;
  delayMs: number;
  error?: string;
  retryCount?: number;
  triggeredBy?: string;
  tableName?: string | null;
  createdAt: number | string;
  startedAt: number | string;
  finishedAt: number | string;
}

// ── API ──

const rippleService = {
  /**
   * Get Ripple status (health + refreshable handlers list)
   */
  async getStatus(projectApiPath: string): Promise<RippleStatusResponse> {
    const res = await api.get(`${projectApiPath}/ripple-cms/ripple/status`);
    return res.data;
  },

  /**
   * Trigger a Ripple refresh
   */
  async triggerRefresh(
    projectApiPath: string,
    pattern: string,
    cascade = false,
    metadata?: Record<string, string>
  ): Promise<RippleRefreshResult> {
    const res = await api.post(`${projectApiPath}/ripple-cms/ripple/refresh`, {
      pattern,
      cascade,
      metadata,
    });
    return res.data;
  },

  /**
   * Get Ripple Prometheus metrics (raw text)
   */
  async getMetrics(projectApiPath: string): Promise<any> {
    const res = await api.get(`${projectApiPath}/ripple-cms/ripple/metrics`);
    return res.data;
  },

  /**
   * Get Ripple Execution Event History
   */
  async getHistory(
    projectApiPath: string,
    requestId?: string,
    limit?: number,
    handlerKey?: string
  ): Promise<{ items: RippleHistoryEvent[] }> {
    const params = new URLSearchParams();
    if (requestId) params.append('requestId', requestId);
    if (handlerKey) params.append('handlerKey', handlerKey);
    if (limit) params.append('limit', limit.toString());

    const qs = params.toString();
    const res = await api.get(
      `${projectApiPath}/ripple-cms/ripple/history${qs ? `?${qs}` : ''}`
    );

    // api.get returns the unwrapped AxiosResponse.data, so res is { success: boolean, data: { items: [] } }
    // res.data is already { items: [...] }
    return res.data || { items: [] };
  },

  /**
   * Clear execution log (and optionally refresh history)
   */
  async clearHistory(
    projectApiPath: string,
    includeHistory = false
  ): Promise<{ deletedExecutionLogs: number; deletedHistory: number }> {
    const qs = includeHistory ? '?includeHistory=true' : '';
    const res = await api.delete(
      `${projectApiPath}/ripple-cms/ripple/history${qs}`
    );
    return res.data;
  },
};

export default rippleService;
