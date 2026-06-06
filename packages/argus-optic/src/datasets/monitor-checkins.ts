import { DatasetConfig, ColumnDef } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Cron Check-ins Dataset — argus.cron_checkins
// Source: 012_create_monitor_checkin_tables.sql
// Consumers: crons (supervisor)
// ─────────────────────────────────────────────────────────────────────────────

const cronColumns = new Map<string, ColumnDef>([
  ['monitor_id', { name: 'monitor_id', type: 'UInt64' }],
  ['project_id', { name: 'project_id', type: 'String' }],
  ['checkin_id', { name: 'checkin_id', type: 'String' }],
  ['status', { name: 'status', type: 'String', lowCardinality: true }],
  ['duration', { name: 'duration', type: 'Nullable(UInt32)' }],
  [
    'environment',
    { name: 'environment', type: 'String', lowCardinality: true },
  ],
  ['expected_time', { name: 'expected_time', type: 'Nullable(DateTime)' }],
  ['timeout_at', { name: 'timeout_at', type: 'Nullable(DateTime)' }],
  ['trace_id', { name: 'trace_id', type: 'Nullable(String)' }],
  ['timestamp', { name: 'timestamp', type: 'DateTime' }],
]);

export const cronCheckinsDataset: DatasetConfig = {
  name: 'cron_checkins',
  table: 'argus.cron_checkins',
  timestampColumn: 'timestamp',
  defaultOrderBy: 'timestamp DESC',
  columns: cronColumns,
  aggregates: new Set([
    'count',
    'uniq',
    'min',
    'max',
    'avg',
    'sum',
    'any',
    'anyLast',
    'countIf',
    'sumIf',
    'avgIf',
    'quantile',
    'p50',
    'p75',
    'p95',
    'p99',
  ]),
  columnAliases: {},
  searchableColumns: [],
  materializedViews: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Uptime Check-ins Dataset — argus.uptime_checkins
// Source: 012_create_monitor_checkin_tables.sql
// Consumers: uptime
// ─────────────────────────────────────────────────────────────────────────────

const uptimeColumns = new Map<string, ColumnDef>([
  ['monitor_id', { name: 'monitor_id', type: 'UInt64' }],
  ['project_id', { name: 'project_id', type: 'String' }],
  ['status', { name: 'status', type: 'String', lowCardinality: true }],
  ['response_ms', { name: 'response_ms', type: 'UInt32' }],
  ['status_code', { name: 'status_code', type: 'Nullable(UInt16)' }],
  ['error_message', { name: 'error_message', type: 'Nullable(String)' }],
  ['timestamp', { name: 'timestamp', type: 'DateTime' }],
]);

export const uptimeCheckinsDataset: DatasetConfig = {
  name: 'uptime_checkins',
  table: 'argus.uptime_checkins',
  timestampColumn: 'timestamp',
  defaultOrderBy: 'timestamp DESC',
  columns: uptimeColumns,
  aggregates: new Set([
    'count',
    'uniq',
    'min',
    'max',
    'avg',
    'sum',
    'any',
    'anyLast',
    'countIf',
    'sumIf',
    'avgIf',
    'quantile',
    'p50',
    'p75',
    'p95',
    'p99',
  ]),
  columnAliases: {},
  searchableColumns: [],
  materializedViews: [],
};
