/**
 * ─── ClickHouse Table Schemas ────────────────────────────────────────────────
 *
 * Centralised schema definitions for all Argus ClickHouse tables.
 *
 * These schemas serve two purposes:
 *   1. Declare which columns exist (and their types) so QueryParser can
 *      generate valid SQL for them.
 *   2. Declare which Map(String, ...) columns exist so QueryParser can
 *      transparently fall back to map-access syntax for unknown keys.
 *
 * When a new column or table is added, update the schema HERE — QueryParser
 * and all routes that reference the schema will pick it up automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MapColumnDef {
  /** ClickHouse column name (e.g. 'tags', 'attributes', 'measurements') */
  name: string;
  /** Value type of the Map — determines parameter type hints in generated SQL */
  valueType: 'String' | 'Float64';
}

export interface TableSchema {
  /**
   * Top-level columns: column name → simple type hint.
   * 'string' columns use {param:String}, 'number' columns allow Float64
   * comparison when used with >, <, >=, <= operators.
   */
  columns: Record<string, 'string' | 'number'>;

  /**
   * Map(String, T) columns that support dynamic key access.
   * When a search key is NOT found in `columns`, QueryParser will fall back
   * to the first map column in this list and generate:
   *   mapContains(colName, key) AND colName[key] op value
   */
  mapColumns: MapColumnDef[];

  /**
   * User-friendly aliases → real column names.
   * e.g. { severity: 'level', browser_name: 'browser' }
   */
  aliases?: Record<string, string>;
}

// ─── Schema Definitions ─────────────────────────────────────────────────────

/** argus.errors — Error events (used by Discover, Issues) */
export const ERRORS_SCHEMA: TableSchema = {
  columns: {
    event_id: 'string',
    timestamp: 'number',
    platform: 'string',
    level: 'string',
    type: 'string',
    value: 'string',
    logger: 'string',
    transaction: 'string',
    server_name: 'string',
    release: 'string',
    dist: 'string',
    environment: 'string',
    http_url: 'string',
    http_method: 'string',
    browser_name: 'string',
    browser_version: 'string',
    os_name: 'string',
    os_version: 'string',
    device_name: 'string',
    device_family: 'string',
    runtime_name: 'string',
    runtime_version: 'string',
    sdk_name: 'string',
    sdk_version: 'string',
    issue_id: 'number',
    project_id: 'string',
    user_id: 'string',
    user_email: 'string',
    geo_country: 'string',
    geo_city: 'string',
    geo_region: 'string',
    is_handled: 'number',
  },
  mapColumns: [
    { name: 'tags', valueType: 'String' },
    { name: 'extra', valueType: 'String' },
  ],
};

/** argus.user_feedback — User feedback entries */
export const FEEDBACK_SCHEMA: TableSchema = {
  columns: {
    feedback_id: 'string',
    message: 'string',
    name: 'string',
    email: 'string',
    contact_email: 'string',
    url: 'string',
    status: 'string',
    assigned_to: 'string',
    environment: 'string',
    release: 'string',
    source: 'string',
    browser: 'string',
    os: 'string',
    device: 'string',
    user_id: 'string',
    locale: 'string',
    category: 'string',
    sentiment: 'string',
    timestamp: 'number',
  },
  mapColumns: [{ name: 'tags', valueType: 'String' }],
  aliases: {
    browser_name: 'browser',
    os_name: 'os',
    feedback: 'message',
    assigned: 'assigned_to',
  },
};

/** argus.logs — Structured log entries */
export const LOGS_SCHEMA: TableSchema = {
  columns: {
    log_id: 'string',
    trace_id: 'string',
    span_id: 'string',
    issue_id: 'number',
    timestamp: 'number',
    level: 'string',
    logger_name: 'string',
    message: 'string',
    body: 'string',
    service: 'string',
    environment: 'string',
    release: 'string',
  },
  mapColumns: [{ name: 'attributes', valueType: 'String' }],
  aliases: {
    severity: 'level',
    logger: 'logger_name',
  },
};

/** argus.transactions — Transaction performance data */
export const TRANSACTIONS_SCHEMA: TableSchema = {
  columns: {
    event_id: 'string',
    trace_id: 'string',
    span_id: 'string',
    parent_span_id: 'string',
    project_id: 'string',
    timestamp: 'number',
    start_timestamp: 'number',
    duration: 'number',
    transaction: 'string',
    transaction_op: 'string',
    transaction_status: 'string',
    http_method: 'string',
    http_status_code: 'number',
    platform: 'string',
    environment: 'string',
    release: 'string',
    user_id: 'string',
    span_count: 'number',
  },
  mapColumns: [
    { name: 'tags', valueType: 'String' },
    { name: 'measurements', valueType: 'Float64' },
  ],
};

/** argus.spans — Distributed tracing span data */
export const SPANS_SCHEMA: TableSchema = {
  columns: {
    span_id: 'string',
    trace_id: 'string',
    parent_span_id: 'string',
    transaction_id: 'string',
    project_id: 'string',
    timestamp: 'number',
    start_timestamp: 'number',
    duration: 'number',
    op: 'string',
    description: 'string',
    status: 'string',
    action: 'string',
    domain: 'string',
  },
  mapColumns: [
    { name: 'tags', valueType: 'String' },
    { name: 'data', valueType: 'String' },
  ],
};

/** argus.metrics — Custom metrics data */
export const METRICS_SCHEMA: TableSchema = {
  columns: {
    project_id: 'string',
    metric_type: 'string',
    name: 'string',
    unit: 'string',
    timestamp: 'number',
    value_counter: 'number',
    value_gauge: 'number',
    environment: 'string',
    release: 'string',
  },
  mapColumns: [{ name: 'tags', valueType: 'String' }],
};
