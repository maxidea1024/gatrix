/**
 * Argus shared type definitions.
 * Extracted from argusService.ts for modularity.
 */

// ==================== Project / DSN ====================

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
  metrics_group_limit: number;
  analytics_breakdown_limit: number;
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
  first_seen: string | null;
  last_seen: string | null;
  created_at: string;
  dsn: string;
}

export interface ArgusDsnKeyStatsPoint {
  timestamp: string;
  errors: number;
  transactions: number;
}

export interface ArgusDsnKeyStatsResponse {
  data: ArgusDsnKeyStatsPoint[];
  totals: { errors: number; transactions: number };
}

// ==================== Issues ====================

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
  short_id?: string;
  is_subscribed?: boolean;
  is_bookmarked?: boolean;
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
  message?: string;
}

export interface ArgusIssueActivity {
  id: number;
  project_id: number;
  issue_id: number;
  user_name: string | null;
  action: 'status_change' | 'assign' | 'comment' | 'priority_change' | 'merge' | 'external_link' | 'external_unlink' | 'external_sync';
  data: Record<string, any> | null;
  created_at: string;
}

export interface ArgusIssueTagGroup {
  key: string;
  totalValues: number;
  topValues: { value: string; count: number }[];
}

export interface ArgusIssueListParams {
  status?: string;
  level?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  search?: string;
  query?: string;
  environment?: string;
  browser?: string;
  os?: string;
  period?: string;
  start?: string;
  end?: string;
  substatus?: string;
  assigned_to?: string;
  release?: string;
  is_unhandled?: boolean;
}

// ==================== Saved Queries ====================

export type SavedQueryType =
  | 'discover'
  | 'logs'
  | 'traces'
  | 'metrics'
  | 'issues'
  | 'analytics-insights'
  | 'analytics-funnels'
  | 'analytics-retention'
  | 'analytics-flows'
  | 'revenue';

export interface ArgusSavedQuery {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  query_type: SavedQueryType;
  query_config: {
    fields?: string[];
    conditions?: string;
    groupBy?: string[];
    orderBy?: string;
    period?: string;
    [key: string]: any;
  };
  display_type: 'table' | 'bar' | 'line' | 'number';
  is_global: boolean;
  is_favorite?: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ==================== Integrations / Trackers / Commits ====================

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
  provider:
    | 'jira'
    | 'github'
    | 'linear'
    | 'clickup'
    | 'asana'
    | 'notion'
    | 'shortcut'
    | 'azure_devops'
    | 'redmine'
    | 'youtrack'
    | 'trello';
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

// ==================== Overview / Stats ====================

export interface ArgusProjectStats {
  hour: string;
  event_count: number;
  affected_users: number;
}

export interface ArgusOverviewData {
  error_trend: { hour: string; count: number; users: number }[];
  error_summary: {
    total_errors: number;
    affected_users: number;
    unique_issues: number;
  };
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

// ==================== Performance / Traces ====================

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
  summary: {
    count: number;
    avg_duration: number;
    p50: number;
    p95: number;
    error_rate: number;
  };
  trend: {
    hour: string;
    count: number;
    avg_duration: number;
    p95: number;
    error_rate: number;
  }[];
  histogram: { bucket: string; count: number }[];
  spans: {
    description: string;
    op: string;
    count: number;
    avg_duration: number;
    p95: number;
  }[];
  recent_traces: ArgusRecentTrace[];
  suspect_tags: {
    tag_key: string;
    tag_value: string;
    count: number;
    avg_duration: number;
    p95: number;
  }[];
  related_issues: {
    issue_id: string;
    event_count: number;
    last_seen: string;
    title?: string;
    subtitle?: string;
    level?: string;
  }[];
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

// ==================== Sessions ====================

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
  trend: {
    hour: string;
    total: number;
    crashed: number;
    healthy: number;
    crash_free_rate: number;
  }[];
  by_release: {
    release: string;
    total: number;
    crashed: number;
    crash_free_rate: number;
    users: number;
  }[];
  duration_distribution: { bucket: string; count: number }[];
  status_timeline: {
    hour: string;
    healthy: number;
    errored: number;
    crashed: number;
    abnormal: number;
  }[];
  crash_by_browser: {
    browser: string;
    total: number;
    crashed: number;
    crash_rate: number;
  }[];
  crash_by_os: {
    os: string;
    total: number;
    crashed: number;
    crash_rate: number;
  }[];
  previous_period: {
    total_sessions: number;
    crashed: number;
    crash_free_rate: number;
    unique_users: number;
  };
}

// ==================== Feedback ====================

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
  // Device context
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  device: string;
  // User identity
  user_id: string;
  locale: string;
  // Workflow
  is_read: number;
  // AI classification
  category: string;
  sentiment: string;
  // Issue linking
  issue_id: number | null;
  issue_title: string | null;
  issue_status: string | null;
  // Avatar
  avatar_url: string;
}

export interface ArgusFeedbackSummary {
  total_feedback: number;
  unique_users: number;
  with_contact: number;
  avg_message_length: number;
  unresolved_count: number;
  resolved_count: number;
  spam_count: number;
  // AI classification stats
  sentiment_positive?: number;
  sentiment_negative?: number;
  sentiment_neutral?: number;
  category_bug?: number;
  category_feature?: number;
  category_complaint?: number;
  category_praise?: number;
  category_question?: number;
}

export interface ArgusFeedbackResponse {
  items: ArgusFeedbackItem[];
  total: number;
  trend: { day: string; count: number }[];
  summary: ArgusFeedbackSummary;
}

export interface ArgusFeedbackActivity {
  id: number;
  project_id: number;
  feedback_id: string;
  user_name: string | null;
  action: 'status_change' | 'assign' | 'comment' | 'mark_spam' | 'unmark_spam';
  data: Record<string, any> | null;
  created_at: string;
}

// ==================== Releases ====================

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

// ==================== Alerts ====================

export interface ArgusAlertCondition {
  type:
    | 'new_issue'
    | 'event_frequency'
    | 'user_count'
    | 'regression'
    | 'new_feedback'
    | 'high_priority_issue'
    | 'property_match'
    | 'project_error_rate';
  value?: number | string;
  interval?: number; // seconds
  property?: string;
  operator?: string;
}

export interface ArgusAlertAction {
  type: 'webhook' | 'email' | 'slack' | 'jira' | 'linear' | 'pagerduty';
  target_url?: string;
  target_email?: string;
  channel?: string;
}

export interface ArgusAlertRule {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  conditions: ArgusAlertCondition[];
  actions: ArgusAlertAction[];
  frequency: number;
  environment?: string;
  level?: string;
  tags?: Record<string, string>;
  dataset?: 'errors' | 'spans' | 'logs' | 'metrics';
  query_config?: any;
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
  status?: string;
  response_body?: string;
}

// ==================== Logs ====================

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

// ==================== Source Maps ====================

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

// ==================== Analytics / Lexicon ====================

export interface AnalyticsEventNameEntry {
  name: string;
  count: number;
  display_name: string | null;
  icon: string | null;
  icon_color: string | null;
  description: string | null;
  status: string;
  is_reserved: boolean;
  category: string | null;
}

export interface ArgusLexiconEvent {
  id: number;
  project_id: string;
  event_name: string;
  display_name: string | null;
  icon: string | null;
  icon_color: string | null;
  description: string | null;
  category: string | null;
  status: 'active' | 'deprecated' | 'hidden';
  is_reserved: boolean;
  owner: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArgusLexiconProperty {
  id: number;
  project_id: string;
  property_name: string;
  display_name: string | null;
  description: string | null;
  data_type: 'string' | 'number' | 'boolean' | 'date';
  status: 'active' | 'deprecated' | 'hidden';
  is_reserved: boolean;
  created_at: string;
  updated_at: string;
}

// ==================== User Profiles ====================

export type ChurnRisk = 'none' | 'low' | 'medium' | 'high' | 'churned';

export interface ArgusUserProfile {
  user_id: string;
  first_seen: string;
  last_seen: string;
  total_events: number;
  unique_events?: number;
  total_sessions: number;
  platform: string | null;
  country: string | null;
  city?: string | null;
  os: string | null;
  app_version: string | null;
  device_id?: string | null;
  top_events?: { event_name: string; count: number }[];
  avatar_url?: string | null;
  email?: string | null;
  browser?: string | null;
  activity_sparkline?: number[] | null;
  days_inactive?: number;
  avg_session_gap_days?: number;
  churn_risk?: ChurnRisk;
  was_reactivated?: boolean; // derived client-side from sparkline
  net_revenue?: number;
  purchase_count?: number;
}

export interface ArgusUserEvent {
  event_id: string;
  event_name: string;
  timestamp: string;
  session_id: string;
  platform: string | null;
  country: string | null;
  os: string | null;
  properties: Record<string, string>;
  numeric_properties: Record<string, number>;
}

export interface ArgusUserSession {
  session_id: string;
  start_time: string;
  end_time: string;
  event_count: number;
  unique_events: number;
  platform: string | null;
  country: string | null;
  os: string | null;
  browser: string | null;
  duration_seconds: number;
}

export interface ArgusUserProperty {
  key: string;
  value: string;
  type: 'string' | 'number';
}

// ==================== Cohorts ====================

export interface ArgusCohortRule {
  event: string;
  operator: '>=' | '<=' | '==' | '>' | '<';
  count: number;
  timeRange: string;
}

export interface ArgusCohortDefinition {
  rules: ArgusCohortRule[];
  combinator: 'and' | 'or';
}

export interface ArgusCohort {
  id: number;
  project_id: string;
  name: string;
  description: string | null;
  definition: ArgusCohortDefinition;
  user_count: number;
  last_computed: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
