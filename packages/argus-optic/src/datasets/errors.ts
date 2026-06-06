import { DatasetConfig, ColumnDef } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Errors Dataset — argus.errors
// Source: 001_create_errors_table.sql
// Consumers: overview, discover, issues, releases, projects, feedback, cron-supervisor
// ─────────────────────────────────────────────────────────────────────────────

const columns = new Map<string, ColumnDef>([
  ['event_id', { name: 'event_id', type: 'FixedString' }],
  ['project_id', { name: 'project_id', type: 'String' }],
  ['issue_id', { name: 'issue_id', type: 'UInt64' }],

  ['timestamp', { name: 'timestamp', type: 'DateTime64' }],
  ['received_at', { name: 'received_at', type: 'DateTime64' }],

  ['platform', { name: 'platform', type: 'String', lowCardinality: true }],
  ['level', { name: 'level', type: 'String', lowCardinality: true }],
  ['logger', { name: 'logger', type: 'String', lowCardinality: true }],
  [
    'type',
    { name: 'type', type: 'String', lowCardinality: true, searchable: true },
  ],
  ['value', { name: 'value', type: 'String', searchable: true }],
  ['mechanism', { name: 'mechanism', type: 'String', lowCardinality: true }],

  ['fingerprint', { name: 'fingerprint', type: 'Array(String)' }],
  ['primary_hash', { name: 'primary_hash', type: 'FixedString' }],

  ['exception', { name: 'exception', type: 'String' }],
  ['stacktrace_frames', { name: 'stacktrace_frames', type: 'String' }],
  ['breadcrumbs', { name: 'breadcrumbs', type: 'String' }],

  ['user_id', { name: 'user_id', type: 'String' }],
  ['user_email', { name: 'user_email', type: 'String' }],
  ['user_ip', { name: 'user_ip', type: 'String' }],
  ['user_name', { name: 'user_name', type: 'String' }],

  [
    'environment',
    { name: 'environment', type: 'String', lowCardinality: true },
  ],
  ['release', { name: 'release', type: 'String', lowCardinality: true }],
  ['dist', { name: 'dist', type: 'String', lowCardinality: true }],
  [
    'server_name',
    { name: 'server_name', type: 'String', lowCardinality: true },
  ],
  ['transaction', { name: 'transaction', type: 'String', searchable: true }],

  ['os_name', { name: 'os_name', type: 'String', lowCardinality: true }],
  ['os_version', { name: 'os_version', type: 'String', lowCardinality: true }],
  [
    'browser_name',
    { name: 'browser_name', type: 'String', lowCardinality: true },
  ],
  [
    'browser_version',
    { name: 'browser_version', type: 'String', lowCardinality: true },
  ],
  [
    'device_name',
    { name: 'device_name', type: 'String', lowCardinality: true },
  ],
  [
    'device_family',
    { name: 'device_family', type: 'String', lowCardinality: true },
  ],
  [
    'runtime_name',
    { name: 'runtime_name', type: 'String', lowCardinality: true },
  ],
  [
    'runtime_version',
    { name: 'runtime_version', type: 'String', lowCardinality: true },
  ],
  ['sdk_name', { name: 'sdk_name', type: 'String', lowCardinality: true }],
  [
    'sdk_version',
    { name: 'sdk_version', type: 'String', lowCardinality: true },
  ],

  [
    'geo_country',
    { name: 'geo_country', type: 'FixedString', lowCardinality: true },
  ],
  ['geo_city', { name: 'geo_city', type: 'String' }],
  ['geo_region', { name: 'geo_region', type: 'String', lowCardinality: true }],

  [
    'http_method',
    { name: 'http_method', type: 'String', lowCardinality: true },
  ],
  ['http_url', { name: 'http_url', type: 'String', searchable: true }],
  ['http_referer', { name: 'http_referer', type: 'String' }],

  ['tags', { name: 'tags', type: 'Map(String,String)' }],
  ['extra', { name: 'extra', type: 'Map(String,String)' }],
  ['contexts', { name: 'contexts', type: 'String' }],

  ['is_handled', { name: 'is_handled', type: 'UInt8' }],
  ['is_symbolicated', { name: 'is_symbolicated', type: 'UInt8' }],
]);

export const errorsDataset: DatasetConfig = {
  name: 'errors',
  table: 'argus.errors',
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
    'p99', // shorthand aliases
    'groupArray',
    'topK',
  ]),
  columnAliases: {
    severity: 'level',
    message: 'value',
  },
  searchableColumns: ['type', 'value', 'transaction', 'http_url'],
  materializedViews: [
    {
      table: 'argus.error_frequency_hourly',
      requiredGroupBy: ['project_id', 'issue_id'],
      availableAggregates: [
        'countMerge(event_count)',
        'uniqMerge(affected_users)',
      ],
      mergeFunctions: {
        'count()': 'countMerge(event_count)',
        'uniq(user_id)': 'uniqMerge(affected_users)',
      },
    },
  ],
};
