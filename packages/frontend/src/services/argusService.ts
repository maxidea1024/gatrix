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
  priority?: 'critical' | 'high' | 'medium' | 'low';
  stats_24h?: number[];
  external_url?: string | null;
  external_key?: string | null;
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

export interface ArgusIssueActivity {
  id: number;
  project_id: number;
  issue_id: number;
  user_name: string | null;
  action: 'status_change' | 'assign' | 'comment' | 'priority_change' | 'merge';
  data: Record<string, any> | null;
  created_at: string;
}

export interface ArgusIssueTagGroup {
  key: string;
  totalValues: number;
  topValues: { value: string; count: number }[];
}

export interface ArgusSavedQuery {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  query_config: {
    fields: string[];
    conditions?: string;
    groupBy?: string[];
    orderBy?: string;
    period?: string;
  };
  display_type: 'table' | 'bar' | 'line' | 'number';
  is_global: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ArgusIntegration {
  id: number;
  project_id: number;
  provider: 'github' | 'gitlab' | 'bitbucket';
  repo_url: string;
  default_branch: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ArgusIssueTracker {
  id: number;
  project_id: number;
  provider: 'jira' | 'github' | 'linear';
  name: string;
  api_url: string;
  config: Record<string, any>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ArgusCommit {
  id: number;
  project_id: number;
  commit_hash: string;
  author_name: string | null;
  author_email: string | null;
  message: string | null;
  timestamp: string | null;
  release_version: string | null;
  files_changed: string | null;
  additions: number;
  deletions: number;
  created_at: string;
}

export interface ArgusOwnershipRule {
  id: number;
  project_id: number;
  name: string;
  match_type: 'path' | 'module' | 'tag' | 'url';
  match_pattern: string;
  owners: string[];
  priority: number;
  auto_assign: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
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
  substatus?: string;
  assigned_to?: string;
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
  feedback_id: string;
  event_id: string;
  email: string;
  name: string;
  message: string;
  contact_email: string;
  submitted_at: string;
  url: string;
  status: 'unresolved' | 'resolved' | 'spam';
  assigned_to: string;
  is_spam: number;
  attachments: string[];
  environment: string;
  release: string;
  source: string;
  tags: Record<string, string>;
  // Issue linking
  issue_id: number | null;
  issue_title: string | null;
  issue_status: string | null;
}

export interface ArgusFeedbackSummary {
  total_feedback: number;
  unique_users: number;
  with_contact: number;
  avg_message_length: number;
  unresolved_count: number;
  resolved_count: number;
  spam_count: number;
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
  crash_free_users?: number;
  new_issues?: number;
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
    params?: {
      period?: string; page?: number; limit?: number; search?: string; status?: string;
      start?: string; end?: string; sort?: string;
      filterUrl?: string; filterAssigned?: string; filterEnvironment?: string;
    }
  ): Promise<ArgusFeedbackResponse> {
    const response = await argusApi.get(`${ARGUS_BASE}/feedback/${projectId}`, { params });
    return response.data?.data || response.data;
  }

  async updateFeedback(
    projectId: number | string,
    feedbackId: string,
    data: { status?: string; assigned_to?: string; is_spam?: boolean }
  ): Promise<void> {
    await argusApi.patch(`${ARGUS_BASE}/feedback/${projectId}/${feedbackId}`, data);
  }

  async bulkFeedbackAction(
    projectId: number | string,
    feedbackIds: string[],
    action: 'resolve' | 'unresolve' | 'spam' | 'not_spam' | 'assign',
    assignedTo?: string
  ): Promise<void> {
    await argusApi.post(`${ARGUS_BASE}/feedback/${projectId}/bulk`, {
      feedback_ids: feedbackIds,
      action,
      assigned_to: assignedTo,
    });
  }

  async uploadFeedbackAttachments(
    projectId: number | string,
    feedbackId: string,
    files: File[]
  ): Promise<{ urls: string[] }> {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    const response = await argusApi.post(
      `${ARGUS_BASE}/feedback/${projectId}/${feedbackId}/attachments`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data?.data || response.data;
  }

  // --- Issue Creation (from feedback) ---

  async createIssue(
    projectId: number | string,
    data: { title: string; level?: string; message?: string; culprit?: string; tracker_id?: number }
  ): Promise<{ id: number; external_url?: string; external_key?: string }> {
    const response = await argusApi.post(`${ARGUS_BASE}/${projectId}/issues`, data);
    return response.data?.data || response.data;
  }

  // --- Issue Trackers ---

  async listIssueTrackers(
    projectId: number | string
  ): Promise<ArgusIssueTracker[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/issue-trackers`);
    return response.data?.data || response.data || [];
  }

  async createIssueTracker(
    projectId: number | string,
    data: { provider: string; name: string; api_url: string; api_token: string; config?: Record<string, any> }
  ): Promise<{ id: number }> {
    const response = await argusApi.post(`${ARGUS_BASE}/${projectId}/issue-trackers`, data);
    return response.data?.data || response.data;
  }

  async updateIssueTracker(
    projectId: number | string,
    trackerId: number,
    data: Partial<{ name: string; api_url: string; api_token: string; config: Record<string, any>; enabled: boolean }>
  ): Promise<void> {
    await argusApi.put(`${ARGUS_BASE}/${projectId}/issue-trackers/${trackerId}`, data);
  }

  async deleteIssueTracker(
    projectId: number | string,
    trackerId: number
  ): Promise<void> {
    await argusApi.delete(`${ARGUS_BASE}/${projectId}/issue-trackers/${trackerId}`);
  }

  async testIssueTracker(
    projectId: number | string,
    trackerId: number
  ): Promise<{ ok: boolean; message: string }> {
    const response = await argusApi.post(`${ARGUS_BASE}/${projectId}/issue-trackers/${trackerId}/test`);
    return response.data?.data || response.data;
  }

  // --- Spam Filter Keywords ---

  async getSpamKeywords(
    projectId: number | string
  ): Promise<{ id: number; keyword: string; is_regex: boolean; created_at: string }[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/feedback/${projectId}/spam-keywords`);
    return response.data?.data || response.data || [];
  }

  async addSpamKeyword(
    projectId: number | string,
    keyword: string,
    isRegex: boolean = false
  ): Promise<{ id: number }> {
    const response = await argusApi.post(`${ARGUS_BASE}/feedback/${projectId}/spam-keywords`, {
      keyword,
      is_regex: isRegex,
    });
    return response.data?.data || response.data;
  }

  async deleteSpamKeyword(
    projectId: number | string,
    keywordId: number
  ): Promise<void> {
    await argusApi.delete(`${ARGUS_BASE}/feedback/${projectId}/spam-keywords/${keywordId}`);
  }

  async runAutoSpam(
    projectId: number | string
  ): Promise<{ matched: number }> {
    const response = await argusApi.post(`${ARGUS_BASE}/feedback/${projectId}/auto-spam`);
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

  async bulkUpdateIssues(
    projectId: number | string,
    issueIds: number[],
    update: { status?: string; assigned_to?: string | null }
  ): Promise<{ updated: number }> {
    const response = await argusApi.put(`${ARGUS_BASE}/${projectId}/issues/bulk`, {
      issue_ids: issueIds,
      ...update,
    });
    return response.data?.data || response.data;
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

  async getIssueActivity(
    projectId: number | string,
    issueId: number | string
  ): Promise<ArgusIssueActivity[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/issues/${issueId}/activity`);
    return response.data?.data || [];
  }

  async addIssueComment(
    projectId: number | string,
    issueId: number | string,
    text: string
  ): Promise<void> {
    await argusApi.post(`${ARGUS_BASE}/${projectId}/issues/${issueId}/comments`, { text });
  }

  async getIssueTags(
    projectId: number | string,
    issueId: number | string
  ): Promise<ArgusIssueTagGroup[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/issues/${issueId}/tags`);
    return response.data?.data || [];
  }

  async listIssueEvents(
    projectId: number | string,
    issueId: number | string,
    params?: { limit?: number; offset?: number }
  ): Promise<{ data: ArgusErrorEvent[] }> {
    const response = await argusApi.get(
      `${ARGUS_BASE}/${projectId}/issues/${issueId}/events`,
      { params }
    );
    return { data: response.data?.data || response.data || [] };
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
    params: { trace_id?: string; issue_id?: string | number; level?: string; search?: string; limit?: number; order?: string; cursor?: string }
  ): Promise<{ data: ArgusLogEntry[]; meta: { count: number; hasMore: boolean } }> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/logs`, { params });
    const result = response.data?.data ? response.data : { data: response.data || [], meta: { count: 0, hasMore: false } };
    // Backward compat: if result.data is directly the array (old format)
    if (Array.isArray(result)) {
      return { data: result, meta: { count: result.length, hasMore: false } };
    }
    return { data: result.data || [], meta: result.meta || { count: 0, hasMore: false } };
  }

  async browseLogs(
    projectId: number | string,
    params: { period?: string; level?: string; search?: string; service?: string; environment?: string; limit?: number; order?: string; cursor?: string }
  ): Promise<{ data: ArgusLogEntry[]; meta: { count: number; hasMore: boolean } }> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/logs/browse`, { params });
    return response.data || { data: [], meta: { count: 0, hasMore: false } };
  }

  async getLogFacets(
    projectId: number | string,
    period?: string
  ): Promise<{
    levels: { level: string; count: number }[];
    services: { service: string; count: number }[];
    environments: { environment: string; count: number }[];
    loggers: { logger_name: string; count: number }[];
  }> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/logs/facets`, { params: { period } });
    return response.data?.data || { levels: [], services: [], environments: [], loggers: [] };
  }

  async getLogVolume(
    projectId: number | string,
    params?: { period?: string; level?: string }
  ): Promise<{ bucket: string; level: string; count: number }[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/logs/volume`, { params });
    return response.data?.data || [];
  }

  async getLogAggregate(
    projectId: number | string,
    params: { period?: string; groupBy?: string; search?: string; service?: string; environment?: string }
  ): Promise<{
    groupBy: string;
    topValues: { group_value: string; count: number }[];
    timeSeries: { bucket: string; group_value: string; count: number }[];
  }> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/logs/aggregate`, { params });
    return response.data?.data || { groupBy: 'level', topValues: [], timeSeries: [] };
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

  async discoverQuery(
    projectId: number | string,
    query: {
      fields: string[];
      conditions?: string;
      groupBy?: string[];
      orderBy?: string;
      limit?: number;
      offset?: number;
      period?: string;
      start?: string;
      end?: string;
    }
  ): Promise<{ data: Record<string, any>[]; meta: { fields: { name: string; type: string }[] } }> {
    const response = await argusApi.post(`${ARGUS_BASE}/${projectId}/discover`, query);
    return response.data?.data ? response.data : { data: [], meta: { fields: [] } };
  }

  async discoverTags(
    projectId: number | string
  ): Promise<{
    columns: string[];
    aggregates: string[];
    stats: Record<string, any>;
    tags: Record<string, { value: string; count: number }[]>;
  }> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/discover/tags`);
    return response.data?.data || { columns: [], aggregates: [], stats: {}, tags: {} };
  }

  async getDiscoverVolume(
    projectId: number | string,
    params: { period?: string; start?: string; end?: string; search?: string }
  ): Promise<{ bucket: string; level: string; count: number }[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/discover/volume`, { params });
    return response.data?.data || [];
  }

  async listSavedQueries(projectId: number | string): Promise<ArgusSavedQuery[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/discover/saved`);
    return response.data?.data || [];
  }

  async createSavedQuery(
    projectId: number | string,
    data: { name: string; description?: string; query_config: Record<string, any>; display_type?: string; is_global?: boolean }
  ): Promise<{ id: number; name: string }> {
    const response = await argusApi.post(`${ARGUS_BASE}/${projectId}/discover/saved`, data);
    return response.data?.data || response.data;
  }

  async deleteSavedQuery(projectId: number | string, queryId: number): Promise<void> {
    await argusApi.delete(`${ARGUS_BASE}/${projectId}/discover/saved/${queryId}`);
  }

  // === Dashboards ===

  async listDashboards(projectId: number | string): Promise<any[]> {
    try {
      const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/dashboards`);
      return response.data?.data || [];
    } catch { return []; }
  }

  async listDashboardPresets(projectId: number | string): Promise<any[]> {
    try {
      const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/dashboards/presets`);
      return response.data?.data || [];
    } catch { return []; }
  }

  async createDashboard(projectId: number | string, data: { title: string; description?: string; preset_id?: string }): Promise<any> {
    const response = await argusApi.post(`${ARGUS_BASE}/${projectId}/dashboards`, data);
    return response.data?.data || response.data;
  }

  async getDashboard(projectId: number | string, dashboardId: number): Promise<any> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/dashboards/${dashboardId}`);
    return response.data?.data || response.data;
  }

  async updateDashboard(projectId: number | string, dashboardId: number, data: any): Promise<void> {
    await argusApi.put(`${ARGUS_BASE}/${projectId}/dashboards/${dashboardId}`, data);
  }

  async deleteDashboard(projectId: number | string, dashboardId: number): Promise<void> {
    await argusApi.delete(`${ARGUS_BASE}/${projectId}/dashboards/${dashboardId}`);
  }

  async queryDashboardWidget(projectId: number | string, query: any): Promise<any[]> {
    try {
      const response = await argusApi.post(`${ARGUS_BASE}/${projectId}/dashboards/widget-query`, { query });
      return response.data?.data || [];
    } catch { return []; }
  }

  // === Integrations ===

  async listIntegrations(projectId: number | string): Promise<ArgusIntegration[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/integrations`);
    return response.data?.data || [];
  }

  async createIntegration(
    projectId: number | string,
    data: { provider: string; repo_url: string; default_branch?: string; access_token?: string }
  ): Promise<{ id: number }> {
    const response = await argusApi.post(`${ARGUS_BASE}/${projectId}/integrations`, data);
    return response.data?.data || response.data;
  }

  async updateIntegration(projectId: number | string, integrationId: number, data: Partial<ArgusIntegration>): Promise<void> {
    await argusApi.patch(`${ARGUS_BASE}/${projectId}/integrations/${integrationId}`, data);
  }

  async deleteIntegration(projectId: number | string, integrationId: number): Promise<void> {
    await argusApi.delete(`${ARGUS_BASE}/${projectId}/integrations/${integrationId}`);
  }

  // === Commits ===

  async listCommits(projectId: number | string, release?: string): Promise<ArgusCommit[]> {
    const params: Record<string, string> = {};
    if (release) params.release = release;
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/commits`, { params });
    return response.data?.data || [];
  }

  async getSuspectCommits(projectId: number | string, issueId: number | string): Promise<ArgusCommit[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/issues/${issueId}/suspect-commits`);
    return response.data?.data || [];
  }

  // === Ownership Rules ===

  async listOwnershipRules(projectId: number | string): Promise<ArgusOwnershipRule[]> {
    const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/ownership`);
    return response.data?.data || [];
  }

  async createOwnershipRule(
    projectId: number | string,
    data: { name: string; match_type: string; match_pattern: string; owners: string[]; priority?: number; auto_assign?: boolean }
  ): Promise<{ id: number }> {
    const response = await argusApi.post(`${ARGUS_BASE}/${projectId}/ownership`, data);
    return response.data?.data || response.data;
  }

  async updateOwnershipRule(projectId: number | string, ruleId: number, data: Partial<ArgusOwnershipRule>): Promise<void> {
    await argusApi.patch(`${ARGUS_BASE}/${projectId}/ownership/${ruleId}`, data);
  }

  async deleteOwnershipRule(projectId: number | string, ruleId: number): Promise<void> {
    await argusApi.delete(`${ARGUS_BASE}/${projectId}/ownership/${ruleId}`);
  }
}

// --- Alert Rule Types ---

export interface ArgusAlertCondition {
  type: 'new_issue' | 'event_frequency' | 'user_count' | 'regression' | 'new_feedback';
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
  tags?: Record<string, string>;
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
