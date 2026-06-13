// =====================================================
// Argus Event Types — Ingestion Protocol
// =====================================================

/**
 * Base event fields common to all Argus event types.
 */
export interface ArgusBaseEvent {
  type: ArgusEventType;
  event_id: string;
  timestamp: string;
  project_id?: string; // Set server-side from DSN
  platform: string;
  environment?: string;
  release?: string;
  dist?: string;
  server_name?: string;
  sdk?: {
    name: string;
    version: string;
  };
  user?: ArgusUser;
  tags?: Record<string, string>;
  extra?: Record<string, string>;
  contexts?: ArgusContexts;
}

export type ArgusEventType =
  | 'error'
  | 'transaction'
  | 'session'
  | 'feedback'
  | 'checkin'
  | 'metric'
  | 'activity';

// =====================================================
// Error Event
// =====================================================

export interface ArgusErrorEvent extends ArgusBaseEvent {
  type: 'error';
  level: ArgusLevel;
  logger?: string;
  transaction?: string;
  fingerprint?: string[];
  exception: ArgusException;
  breadcrumbs?: ArgusBreadcrumb[];
}

export type ArgusLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export interface ArgusException {
  type: string;
  value: string;
  mechanism?: string;
  stacktrace?: ArgusStacktrace;
}

export interface ArgusStacktrace {
  frames: ArgusStackFrame[];
}

export interface ArgusStackFrame {
  filename?: string;
  function?: string;
  module?: string;
  lineno?: number;
  colno?: number;
  abs_path?: string;
  in_app?: boolean;
  context_line?: string;
  pre_context?: string[];
  post_context?: string[];
}

export interface ArgusBreadcrumb {
  timestamp: string;
  category: string;
  type?: string;
  level?: string;
  message?: string;
  data?: Record<string, unknown>;
}

// =====================================================
// Transaction / Span Event (Phase 3)
// =====================================================

export interface ArgusTransactionEvent extends ArgusBaseEvent {
  type: 'transaction';
  transaction: string;
  transaction_op: string;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  start_timestamp: string;
  duration: number; // ms
  transaction_status: string;
  http_method?: string;
  http_status_code?: number;
  measurements?: Record<string, number>;
  spans?: ArgusSpan[];
}

export interface ArgusSpan {
  span_id: string;
  parent_span_id?: string;
  trace_id: string;
  op: string;
  description?: string;
  status?: string;
  start_timestamp: string;
  timestamp: string;
  duration: number; // ms
  data?: Record<string, string>;
  tags?: Record<string, string>;
}

// =====================================================
// Session Event (Phase 2)
// =====================================================

export interface ArgusSessionEvent extends ArgusBaseEvent {
  type: 'session';
  session_id: string;
  started: string;
  status: 'ok' | 'exited' | 'crashed' | 'abnormal';
  seq: number;
  duration?: number;
  errors?: number;
  distinct_id?: string;
  user_agent?: string;
}

// =====================================================
// User Feedback (Phase 4)
// =====================================================

export interface ArgusFeedbackEvent extends ArgusBaseEvent {
  type: 'feedback';
  feedback_id?: string;
  linked_event_id?: string;
  name?: string;
  email?: string;
  message: string;
  contact_email?: string;
  url?: string;
  source?: string;
}

// =====================================================
// Cron Check-in (Phase 4)
// =====================================================

export interface ArgusCheckinEvent extends ArgusBaseEvent {
  type: 'checkin';
  monitor_slug: string;
  checkin_id?: string;
  status: 'in_progress' | 'ok' | 'error';
  duration?: number;
}

// =====================================================
// Custom Metric (Phase 4)
// =====================================================

export interface ArgusMetricEvent extends ArgusBaseEvent {
  type: 'metric';
  metric_type: 'counter' | 'gauge' | 'distribution' | 'set';
  name: string;
  unit?: string;
  value: number | number[] | string[];
}

// =====================================================
// Activity Event (Product Analytics)
// =====================================================

export interface ArgusActivityEvent extends ArgusBaseEvent {
  type: 'activity';
  event_name: string;
  user_id?: string;
  device_id?: string;
  session_id?: string;
  country?: string;
  city?: string;
  os?: string;
  app_version?: string;
  properties?: Record<string, string>;
  numeric_properties?: Record<string, number>;
}

// =====================================================
// Shared Contexts
// =====================================================

export interface ArgusUser {
  id?: string;
  email?: string;
  ip_address?: string;
  username?: string;
}

export interface ArgusContexts {
  os?: { name?: string; version?: string };
  browser?: { name?: string; version?: string };
  device?: { name?: string; family?: string };
  runtime?: { name?: string; version?: string };
  [key: string]: unknown;
}

// =====================================================
// Batch Ingest Payload
// =====================================================

export interface ArgusBatchPayload {
  events: ArgusEvent[];
}

export type ArgusEvent =
  | ArgusErrorEvent
  | ArgusTransactionEvent
  | ArgusSessionEvent
  | ArgusFeedbackEvent
  | ArgusCheckinEvent
  | ArgusMetricEvent
  | ArgusActivityEvent;
