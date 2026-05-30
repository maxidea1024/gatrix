/**
 * Argus Service — Frontend API client for the Argus error tracking backend.
 * Uses a dedicated axios instance (no /api/v1 prefix) so requests hit the
 * Vite proxy: /argus/api/* -> localhost:45300
 */
import axios, { AxiosInstance } from 'axios';
import { apiService } from './api';

// Dedicated axios instance for Argus — no baseURL prefix
const argusApi: AxiosInstance = axios.create({
  timeout: 60000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Share the auth token from the main ApiService
argusApi.interceptors.request.use((config) => {
  const token = apiService.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
  substatus?: string;
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
  contexts: string | Record<string, any>;
  extra?: string | Record<string, any>;
}

export interface ArgusIssueListParams {
  status?: string;
  level?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  search?: string;
  environment?: string;
  browser?: string;
  os?: string;
  period?: string;
  start?: string;
  end?: string;
}

export interface ArgusProjectStats {
  hour: string;
  event_count: number;
  affected_users: number;
}

export interface ArgusOverviewData {
  error_trend: { hour: string; count: number; users: number }[];
  error_summary: { total_errors: number; affected_users: number; unique_issues: number };
  transaction_summary: {
    total_transactions: number;
    avg_duration: number;
    p50: number;
    p95: number;
    p99: number;
    error_rate: number;
  };
  transaction_trend: { hour: string; count: number; avg_duration: number }[];
  session_summary: {
    total_sessions: number;
    crashed_sessions: number;
    errored_sessions: number;
    crash_free_rate: number;
  };
  top_issues: {
    fingerprint: string;
    title: string;
    subtitle: string;
    level?: string;
    event_count: number;
    user_count: number;
    last_seen: string;
  }[];
  // NEW — Insight data
  error_heatmap: { day: number; hour: number; count: number }[];
  error_by_environment: { environment: string; count: number }[];
  error_by_browser: { browser: string; count: number }[];
  error_by_os: { os: string; count: number }[];
  error_by_release: { release: string; count: number; users: number }[];
  unhandled_rate: number;
  previous_period: {
    total_errors: number;
    affected_users: number;
    total_transactions: number;
    crash_free_rate: number;
  };
}

export interface ArgusTransaction {
  name: string;
  count: number;
  avg_duration: number;
  p50: number;
  p75: number;
  p95: number;
  p99: number;
  error_rate: number;
  last_seen: string;
}

export interface ArgusTransactionDetail {
  trend: { hour: string; count: number; avg_duration: number; p95: number; error_rate: number }[];
  histogram: { bucket: string; count: number }[];
  spans: { description: string; op: string; count: number; avg_duration: number; p95: number }[];
  recent_traces: ArgusRecentTrace[];
}

export interface ArgusRecentTrace {
  event_id: string;
  trace_id: string;
  timestamp: string;
  duration: number;
  transaction_status: string;
  http_status_code: number;
  span_count: number;
  user_id: string;
}

export interface ArgusTraceDetail {
  trace_id: string;
  root: any;
  transactions: any[];
  spans: ArgusTraceSpan[];
  total_spans: number;
}

export interface ArgusTraceSpan {
  span_id: string;
  trace_id: string;
  parent_span_id: string;
  transaction_id: string;
  op: string;
  description: string;
  status: string;
  action: string;
  domain: string;
  timestamp: string;
  start_timestamp: string;
  duration: number;
  data: Record<string, string>;
  tags: Record<string, string>;
}

export interface ArgusSessionHealth {
  summary: {
    total_sessions: number;
    crashed: number;
    errored: number;
    healthy: number;
    abnormal: number;
    crash_free_rate: number;
    unique_users: number;
    avg_duration: number;
  };
  trend: { hour: string; total: number; crashed: number; healthy: number; crash_free_rate: number }[];
  by_release: { release: string; total: number; crashed: number; crash_free_rate: number; users: number }[];
  duration_distribution: { bucket: string; count: number }[];
  status_timeline: { hour: string; healthy: number; errored: number; crashed: number; abnormal: number }[];
  crash_by_browser: { browser: string; total: number; crashed: number; crash_rate: number }[];
  crash_by_os: { os: string; total: number; crashed: number; crash_rate: number }[];
  previous_period: { total_sessions: number; crashed: number; crash_free_rate: number; unique_users: number };
}

export interface ArgusFeedbackItem {
  event_id: string;
  email: string;
  name: string;
  message: string;
  contact_email: string;
  submitted_at: string;
  url: string;
}

export interface ArgusFeedbackSummary {
  total_feedback: number;
  unique_users: number;
  with_contact: number;
  avg_message_length: number;
}

export interface ArgusFeedbackResponse {
  items: ArgusFeedbackItem[];
  total: number;
  trend: { day: string; count: number }[];
  summary: ArgusFeedbackSummary;
}

export interface ArgusRelease {
  release: string;
  first_seen: string;
  last_seen: string;
  error_count: number;
  affected_users: number;
  issue_count: number;
  fatal_count: number;
  unhandled_count: number;
  total_sessions: number;
  crash_free_rate: number;
  session_users: number;
  transaction_count: number;
  avg_duration: number;
  p95: number;
  txn_error_rate: number;
  error_trend: number[];
}

// ==================== Prefix for all Argus API calls ====================
const ARGUS_BASE = '/argus/api';

// ==================== Service ====================

class ArgusService {
  // --- Overview ---

  async getOverview(
    projectId: number | string,
    period?: string,
    start?: string,
    end?: string
  ): Promise<ArgusOverviewData> {
    const response = await argusApi.get(`${ARGUS_BASE}/overview/${projectId}`, {
      params: { period, start, end },
    });
    return response.data?.data || response.data;
  }

  // --- Filter Options ---

  async getFilterOptions(
    projectId: number | string,
    period?: string
  ): Promise<{ environments: string[]; browsers: string[]; os: string[] }> {
    const response = await argusApi.get(`${ARGUS_BASE}/filters/${projectId}`, {
      params: { period },
    });
    return response.data?.data || response.data || { environments: [], browsers: [], os: [] };
  }

  // --- Performance ---

  async getTransactions(
    projectId: number | string,
    params?: { period?: string; sort?: string; limit?: number; start?: string; end?: string }
  ): Promise<ArgusTransaction[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/performance/${projectId}/transactions`, {
      params,
    });
    return response.data?.data || response.data || [];
  }

  async getTransactionDetail(
    projectId: number | string,
    txnName: string,
    period?: string,
    start?: string,
    end?: string
  ): Promise<ArgusTransactionDetail> {
    const response = await argusApi.get(
      `${ARGUS_BASE}/performance/${projectId}/transactions/${encodeURIComponent(txnName)}`,
      { params: { period, start, end } }
    );
    return response.data?.data || response.data;
  }

  async getTraceDetail(
    projectId: number | string,
    traceId: string
  ): Promise<ArgusTraceDetail> {
    const response = await argusApi.get(
      `${ARGUS_BASE}/performance/${projectId}/traces/${traceId}`
    );
    return response.data?.data || response.data;
  }

  // --- Sessions ---

  async getSessionHealth(
    projectId: number | string,
    period?: string,
    start?: string,
    end?: string
  ): Promise<ArgusSessionHealth> {
    const response = await argusApi.get(`${ARGUS_BASE}/sessions/${projectId}`, {
      params: { period, start, end },
    });
    return response.data?.data || response.data;
  }

  // --- Feedback ---

  async getFeedback(
    projectId: number | string,
    params?: { period?: string; page?: number; limit?: number; search?: string; start?: string; end?: string }
  ): Promise<ArgusFeedbackResponse> {
    const response = await argusApi.get(`${ARGUS_BASE}/feedback/${projectId}`, { params });
    return response.data?.data || response.data;
  }

  // --- Releases ---

  async getReleases(
    projectId: number | string,
    period?: string,
    start?: string,
    end?: string
  ): Promise<ArgusRelease[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/releases/${projectId}`, {
      params: { period, start, end },
    });
    return response.data?.data || response.data || [];
  }

  // --- Projects ---

  async listProjects(): Promise<ArgusProject[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/projects`);
    return response.data?.data || response.data || [];
  }

  async getProject(projectId: number | string): Promise<ArgusProject> {
    const response = await argusApi.get(`${ARGUS_BASE}/projects/${projectId}`);
    return response.data?.data || response.data;
  }

  async createProject(data: {
    gatrix_project_id: string;
    name: string;
    slug: string;
    platform?: string;
  }): Promise<ArgusProject & { dsn: string }> {
    const response = await argusApi.post(`${ARGUS_BASE}/projects`, data);
    return response.data?.data || response.data;
  }

  async updateProject(
    projectId: number | string,
    data: Partial<Pick<ArgusProject, 'name' | 'platform' | 'error_quota_daily' | 'transaction_sample_rate' | 'session_sample_rate' | 'retention_days'>>
  ): Promise<void> {
    await argusApi.patch(`${ARGUS_BASE}/projects/${projectId}`, data);
  }

  async getProjectStats(
    projectId: number | string,
    period?: string
  ): Promise<ArgusProjectStats[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/projects/${projectId}/stats`, {
      params: { period },
    });
    return response.data?.data || response.data || [];
  }

  // --- DSN Keys ---

  async createDsnKey(
    projectId: number | string,
    label?: string
  ): Promise<ArgusDsnKey> {
    const response = await argusApi.post(`${ARGUS_BASE}/projects/${projectId}/dsn-keys`, {
      label,
    });
    return response.data?.data || response.data;
  }

  async revokeDsnKey(projectId: number | string, keyId: number | string): Promise<void> {
    await argusApi.delete(`${ARGUS_BASE}/projects/${projectId}/dsn-keys/${keyId}`);
  }

  // --- Issues ---

  async listIssues(
    projectId: number | string,
    params?: ArgusIssueListParams
  ): Promise<{ data: ArgusIssue[]; total: number }> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/issues`, {
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
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/issues/${issueId}`);
    return response.data?.data || response.data;
  }

  async updateIssueStatus(
    projectId: number | string,
    issueId: number | string,
    status: string
  ): Promise<void> {
    await argusApi.patch(`${ARGUS_BASE}/${projectId}/issues/${issueId}`, {
      status,
    });
  }

  async assignIssue(
    projectId: number | string,
    issueId: number | string,
    assignee: string | null
  ): Promise<void> {
    await argusApi.patch(`${ARGUS_BASE}/${projectId}/issues/${issueId}`, {
      assigned_to: assignee,
    });
  }

  async mergeIssues(
    projectId: number | string,
    issueIds: number[]
  ): Promise<{ primary_id: number; merged_count: number }> {
    const response = await argusApi.post(`${ARGUS_BASE}/${projectId}/issues/merge`, {
      issue_ids: issueIds,
    });
    return response.data?.data || response.data;
  }

  // --- Alert Rules ---

  async listAlertRules(projectId: number | string): Promise<ArgusAlertRule[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/alerts`);
    return response.data?.data || response.data || [];
  }

  async createAlertRule(
    projectId: number | string,
    rule: Omit<ArgusAlertRule, 'id' | 'created_at' | 'updated_at' | 'last_triggered_at'>
  ): Promise<{ id: number }> {
    const response = await argusApi.post(`${ARGUS_BASE}/${projectId}/alerts`, rule);
    return response.data?.data || response.data;
  }

  async updateAlertRule(
    projectId: number | string,
    ruleId: number | string,
    updates: Partial<ArgusAlertRule>
  ): Promise<void> {
    await argusApi.put(`${ARGUS_BASE}/${projectId}/alerts/${ruleId}`, updates);
  }

  async deleteAlertRule(projectId: number | string, ruleId: number | string): Promise<void> {
    await argusApi.delete(`${ARGUS_BASE}/${projectId}/alerts/${ruleId}`);
  }

  async testAlertRule(projectId: number | string, ruleId: number | string): Promise<void> {
    await argusApi.post(`${ARGUS_BASE}/${projectId}/alerts/${ruleId}/test`);
  }

  async getAlertHistory(
    projectId: number | string,
    params?: { limit?: number; ruleId?: number }
  ): Promise<ArgusAlertHistory[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/alerts/history`, { params });
    return response.data?.data || response.data || [];
  }

  // --- Structured Logs ---

  async getLogs(
    projectId: number | string,
    params: { trace_id?: string; issue_id?: string | number; level?: string; search?: string; limit?: number }
  ): Promise<ArgusLogEntry[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/logs`, { params });
    return response.data?.data || response.data || [];
  }

  // --- Source Maps ---

  async listSourcemapReleases(projectId: number | string): Promise<ArgusSourcemapRelease[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/sourcemaps`);
    return response.data?.data || response.data || [];
  }

  async uploadSourcemaps(
    projectId: number | string,
    release: string,
    files: File[],
    dist?: string
  ): Promise<{ release_id: number; file_count: number }> {
    const formData = new FormData();
    formData.append('release', release);
    if (dist) formData.append('dist', dist);
    files.forEach(f => formData.append('files', f));
    const response = await argusApi.post(`${ARGUS_BASE}/${projectId}/sourcemaps`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data?.data || response.data;
  }

  async deleteSourcemapRelease(projectId: number | string, releaseId: number): Promise<void> {
    await argusApi.delete(`${ARGUS_BASE}/${projectId}/sourcemaps/${releaseId}`);
  }

  async listSourcemapFiles(projectId: number | string, releaseId: number): Promise<ArgusSourcemapFile[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/sourcemaps/${releaseId}/files`);
    return response.data?.data || response.data || [];
  }
}

// --- Alert Rule Types ---

export interface ArgusAlertCondition {
  type: 'new_issue' | 'event_frequency' | 'user_count' | 'regression';
  value?: number;
  interval?: number; // seconds
}

export interface ArgusAlertAction {
  type: 'webhook' | 'email';
  target_url?: string;
  channel?: string;
}

export interface ArgusAlertRule {
  id: number;
  project_id: number;
  name: string;
  conditions: ArgusAlertCondition[];
  actions: ArgusAlertAction[];
  frequency: number;
  environment?: string;
  level?: string;
  enabled: boolean;
  last_triggered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ArgusAlertHistory {
  id: number;
  rule_id: number;
  rule_name?: string;
  project_id: number;
  issue_id?: number;
  message: string;
  triggered_at: string;
}

export interface ArgusLogEntry {
  log_id: string;
  trace_id: string;
  span_id: string;
  timestamp: string;
  level: string;
  logger_name: string;
  message: string;
  body: string;
  service: string;
  environment: string;
  release: string;
  attributes: Record<string, string>;
}

export interface ArgusSourcemapRelease {
  id: number;
  project_id: number;
  release: string;
  dist: string;
  file_count: number;
  created_at: string;
}

export interface ArgusSourcemapFile {
  id: number;
  file_path: string;
  file_name: string;
  file_size: number;
  created_at: string;
}

export const argusService = new ArgusService();
export default argusService;
