import { createLogger } from '../utils/logger';
import { ArgusTransactionEvent, ArgusSpan } from '../types/events';

const logger = createLogger('txn-normalizer');

/**
 * Normalized transaction ready for ClickHouse insertion.
 */
export interface NormalizedTransaction {
  event_id: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string;
  project_id: string;

  timestamp: string;
  start_timestamp: string;
  duration: number;

  transaction: string;
  transaction_op: string;
  transaction_status: string;
  http_method: string;
  http_status_code: number;

  platform: string;
  environment: string;
  release: string;
  user_id: string;

  measurements: Record<string, number>;
  tags: Record<string, string>;
  span_count: number;
}

/**
 * Normalized span ready for ClickHouse insertion.
 */
export interface NormalizedSpan {
  span_id: string;
  trace_id: string;
  parent_span_id: string;
  transaction_id: string;
  project_id: string;

  timestamp: string;
  start_timestamp: string;
  duration: number;

  op: string;
  description: string;
  status: string;
  action: string;
  domain: string;

  data: Record<string, string>;
  tags: Record<string, string>;
}

/**
 * Normalize a raw transaction event into flat structures for ClickHouse.
 * Returns both the transaction record and extracted span records.
 */
export function normalizeTransactionEvent(
  event: ArgusTransactionEvent,
  projectId: string
): { transaction: NormalizedTransaction; spans: NormalizedSpan[] } {
  const user = event.user || {};
  const spans = event.spans || [];

  const transaction: NormalizedTransaction = {
    event_id: event.event_id,
    trace_id: event.trace_id || '',
    span_id: event.span_id || '',
    parent_span_id: event.parent_span_id || '',
    project_id: projectId,

    timestamp: event.timestamp || new Date().toISOString(),
    start_timestamp: event.start_timestamp || event.timestamp || new Date().toISOString(),
    duration: event.duration || 0,

    transaction: event.transaction || '',
    transaction_op: event.transaction_op || '',
    transaction_status: event.transaction_status || 'ok',
    http_method: event.http_method || '',
    http_status_code: event.http_status_code || 0,

    platform: event.platform || 'other',
    environment: event.environment || '',
    release: event.release || '',
    user_id: user.id || '',

    measurements: event.measurements || {},
    tags: event.tags || {},
    span_count: spans.length,
  };

  const normalizedSpans = spans.map((span) => normalizeSpan(span, event.event_id, projectId));

  logger.debug('Transaction normalized', {
    eventId: event.event_id,
    transaction: transaction.transaction,
    spanCount: normalizedSpans.length,
  });

  return { transaction, spans: normalizedSpans };
}

function normalizeSpan(
  span: ArgusSpan,
  transactionId: string,
  projectId: string
): NormalizedSpan {
  // Extract action and domain from op/description
  const { action, domain } = extractSpanMeta(span);

  return {
    span_id: span.span_id,
    trace_id: span.trace_id || '',
    parent_span_id: span.parent_span_id || '',
    transaction_id: transactionId,
    project_id: projectId,

    timestamp: span.timestamp || new Date().toISOString(),
    start_timestamp: span.start_timestamp || span.timestamp || new Date().toISOString(),
    duration: span.duration || 0,

    op: span.op || '',
    description: span.description || '',
    status: span.status || 'ok',
    action,
    domain,

    data: span.data || {},
    tags: span.tags || {},
  };
}

/**
 * Extract action and domain from span metadata.
 * e.g. op="db.query" description="SELECT * FROM users"
 *   -> action="SELECT", domain="db"
 */
function extractSpanMeta(span: ArgusSpan): { action: string; domain: string } {
  let action = '';
  let domain = '';

  // Domain from op (first segment)
  if (span.op) {
    const parts = span.op.split('.');
    domain = parts[0] || '';
  }

  // Action from description for common op types
  if (span.description) {
    if (domain === 'db') {
      // SQL: extract verb (SELECT, INSERT, UPDATE, DELETE)
      const match = span.description.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i);
      if (match) {
        action = match[1].toUpperCase();
      }
    } else if (domain === 'http') {
      // HTTP: extract method
      const match = span.description.match(/^\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s/i);
      if (match) {
        action = match[1].toUpperCase();
      }
    }
  }

  return { action, domain };
}
