/**
 * Argus Service — Frontend API client for the Argus error tracking backend.
 * Calls go through the Vite proxy: /argus/api/* -> localhost:45300
 */
import api from './api';

// ==================== Types ====================

export interface ArgusProject {
  id: number;
  gatrix_project_id: string;
  name: string;
  slug: string;
  platform: string;
  error_quota_daily: number;
  transaction_sample_rate: number;
  session_sample_rate: number;
  retention_days: number;
  created_at: string;
  updated_at: string;
  unresolved_issues?: number;
  active_dsn_count?: number;
  dsn_keys?: ArgusDsnKey[];
}

export interface ArgusDsnKey {
  id: number;
  label: string;
  public_key: string;
  secret_key?: string;
  is_active: boolean;
  rate_limit_window: number;
  rate_limit_count: number;
  created_at: string;
  dsn: string;
}

export interface ArgusIssue {
  id: number;
  project_id: number;
  fingerprint: string;
  title: string;
  culprit: string;
  level: string;
  status: string;
  platform: string;
  first_seen: string;
  last_seen: string;
  event_count: number;
  user_count: number;
  assigned_to: string | null;
  is_regression: number;
}

export interface ArgusIssueDetail extends ArgusIssue {
  latest_event?: ArgusErrorEvent;
}

export interface ArgusErrorEvent {
  event_id: string;
  project_id: string;
  timestamp: string;
  platform: string;
  level: string;
  environment: string;
  release: string;
  exception_type: string;
  exception_value: string;
  exception_mechanism: string;
  stacktrace_raw: string;
  transaction: string;
  user_id: string;
  user_email: string;
  user_ip: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  device: string;
  tags: Record<string, string>;
  breadcrumbs: string;
}

export interface ArgusIssueListParams {
  status?: string;
  level?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface ArgusProjectStats {
  hour: string;
  event_count: number;
  affected_users: number;
}

// ==================== Prefix for all Argus API calls ====================
const ARGUS_BASE = '/argus/api';

// ==================== Service ====================

class ArgusService {
  // --- Projects ---

  async listProjects(): Promise<ArgusProject[]> {
    const response = await api.get(`${ARGUS_BASE}/projects`);
    return response.data?.data || response.data || [];
  }

  async getProject(projectId: number | string): Promise<ArgusProject> {
    const response = await api.get(`${ARGUS_BASE}/projects/${projectId}`);
    return response.data?.data || response.data;
  }

  async createProject(data: {
    gatrix_project_id: string;
    name: string;
    slug: string;
    platform?: string;
  }): Promise<ArgusProject & { dsn: string }> {
    const response = await api.post(`${ARGUS_BASE}/projects`, data);
    return response.data?.data || response.data;
  }

  async updateProject(
    projectId: number | string,
    data: Partial<Pick<ArgusProject, 'name' | 'platform' | 'error_quota_daily' | 'transaction_sample_rate' | 'session_sample_rate' | 'retention_days'>>
  ): Promise<void> {
    await api.patch(`${ARGUS_BASE}/projects/${projectId}`, data);
  }

  async getProjectStats(
    projectId: number | string,
    period?: string
  ): Promise<ArgusProjectStats[]> {
    const response = await api.get(`${ARGUS_BASE}/projects/${projectId}/stats`, {
      params: { period },
    });
    return response.data?.data || response.data || [];
  }

  // --- DSN Keys ---

  async createDsnKey(
    projectId: number | string,
    label?: string
  ): Promise<ArgusDsnKey> {
    const response = await api.post(`${ARGUS_BASE}/projects/${projectId}/dsn-keys`, {
      label,
    });
    return response.data?.data || response.data;
  }

  async revokeDsnKey(projectId: number | string, keyId: number | string): Promise<void> {
    await api.delete(`${ARGUS_BASE}/projects/${projectId}/dsn-keys/${keyId}`);
  }

  // --- Issues ---

  async listIssues(
    projectId: number | string,
    params?: ArgusIssueListParams
  ): Promise<{ data: ArgusIssue[]; total: number }> {
    const response = await api.get(`${ARGUS_BASE}/issues/${projectId}`, {
      params,
    });
    const result = response.data;
    return {
      data: result?.data || [],
      total: result?.total || 0,
    };
  }

  async getIssueDetail(
    projectId: number | string,
    issueId: number | string
  ): Promise<ArgusIssueDetail> {
    const response = await api.get(`${ARGUS_BASE}/issues/${projectId}/${issueId}`);
    return response.data?.data || response.data;
  }

  async updateIssueStatus(
    projectId: number | string,
    issueId: number | string,
    status: string
  ): Promise<void> {
    await api.patch(`${ARGUS_BASE}/issues/${projectId}/${issueId}/status`, {
      status,
    });
  }

  async assignIssue(
    projectId: number | string,
    issueId: number | string,
    assignee: string | null
  ): Promise<void> {
    await api.patch(`${ARGUS_BASE}/issues/${projectId}/${issueId}/assign`, {
      assigned_to: assignee,
    });
  }
}

export const argusService = new ArgusService();
export default argusService;
