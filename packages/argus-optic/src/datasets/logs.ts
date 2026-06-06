import { DatasetConfig, ColumnDef } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Logs Dataset — argus.logs
// Source: 008_create_logs_table.sql
// Consumers: logs
// ─────────────────────────────────────────────────────────────────────────────

const columns = new Map<string, ColumnDef>([
  ['log_id', { name: 'log_id', type: 'String' }],
  ['project_id', { name: 'project_id', type: 'String' }],
  ['trace_id', { name: 'trace_id', type: 'String' }],
  ['span_id', { name: 'span_id', type: 'String' }],
  ['issue_id', { name: 'issue_id', type: 'UInt64' }],

  ['timestamp', { name: 'timestamp', type: 'DateTime64' }],

  ['level', { name: 'level', type: 'String', lowCardinality: true }],
  [
    'logger_name',
    { name: 'logger_name', type: 'String', lowCardinality: true },
  ],
  ['message', { name: 'message', type: 'String', searchable: true }],
  ['body', { name: 'body', type: 'String', searchable: true }],

  [
    'environment',
    { name: 'environment', type: 'String', lowCardinality: true },
  ],
  ['release', { name: 'release', type: 'String', lowCardinality: true }],
  ['service', { name: 'service', type: 'String', lowCardinality: true }],

  ['attributes', { name: 'attributes', type: 'Map(String,String)' }],
]);

export const logsDataset: DatasetConfig = {
  name: 'logs',
  table: 'argus.logs',
  timestampColumn: 'timestamp',
  defaultOrderBy: 'timestamp DESC',
  columns,
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
    'quantiles',
    'p50',
    'p75',
    'p95',
    'p99',
    'topK',
    'groupArray',
  ]),
  columnAliases: {
    severity: 'level',
    logger: 'logger_name',
  },
  searchableColumns: ['message', 'body'],
  materializedViews: [],
};
