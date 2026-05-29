// =====================================================
// Argus Issue Types — MySQL metadata
// =====================================================

export type IssueStatus =
  | 'unresolved'
  | 'resolved'
  | 'ignored'
  | 'archived';

export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';

export interface ArgusIssue {
  id: number;
  project_id: number;
  short_id: number;
  title: string;
  culprit?: string;
  type: string;
  level: string;
  platform?: string;
  primary_hash: string;
  fingerprint?: string[];
  first_seen: Date;
  last_seen: Date;
  times_seen: number;
  num_users: number;
  status: IssueStatus;
  substatus?: string;
  resolved_at?: Date;
  resolved_by?: number;
  assigned_to?: number;
  first_release?: string;
  last_release?: string;
  priority: IssuePriority;
  created_at: Date;
  updated_at: Date;
}

export interface ArgusProject {
  id: number;
  gatrix_project_id: string;
  name: string;
  slug: string;
  platform: string;
  settings?: Record<string, unknown>;
  error_quota_daily: number;
  transaction_sample_rate: number;
  session_sample_rate: number;
  retention_days: number;
  created_at: Date;
  updated_at: Date;
}

export interface ArgusDsnKey {
  id: number;
  project_id: number;
  label: string;
  public_key: string;
  secret_key: string;
  is_active: boolean;
  rate_limit_window: number;
  rate_limit_count: number;
  created_at: Date;
}

export interface ArgusRelease {
  id: number;
  project_id: number;
  version: string;
  short_version?: string;
  total_errors: number;
  new_issues: number;
  crash_free_sessions?: number;
  crash_free_users?: number;
  total_sessions: number;
  total_users: number;
  commit_count: number;
  deploy_count: number;
  ref?: string;
  url?: string;
  date_released?: Date;
  date_deployed?: Date;
  created_at: Date;
}

export interface ArgusAlertRule {
  id: number;
  project_id: number;
  name: string;
  type: 'issue' | 'metric';
  is_active: boolean;
  conditions: unknown;
  filters?: unknown;
  actions: unknown;
  frequency: number;
  owner_id?: number;
  created_at: Date;
  updated_at: Date;
}

export interface ArgusFingerprintRule {
  id: number;
  project_id: number;
  matchers: unknown;
  fingerprint: unknown;
  is_active: boolean;
  priority: number;
  created_at: Date;
}
