import { DatasetConfig, ColumnDef } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Sessions Dataset — argus.sessions
// Source: 004_create_sessions_table.sql
// Consumers: overview, sessions, releases
// ─────────────────────────────────────────────────────────────────────────────

const columns = new Map<string, ColumnDef>([
  ['session_id', { name: 'session_id', type: 'String' }],
  ['project_id', { name: 'project_id', type: 'String' }],

  ['timestamp', { name: 'timestamp', type: 'DateTime64' }],
  ['started', { name: 'started', type: 'DateTime64' }],

  ['status', { name: 'status', type: 'String', lowCardinality: true }],
  ['seq', { name: 'seq', type: 'UInt64' }],
  ['duration', { name: 'duration', type: 'Nullable(UInt64)' }],
  ['errors', { name: 'errors', type: 'UInt32' }],

  [
    'environment',
    { name: 'environment', type: 'String', lowCardinality: true },
  ],
  ['release', { name: 'release', type: 'String', lowCardinality: true }],
  ['distinct_id', { name: 'distinct_id', type: 'String' }],
  ['user_agent', { name: 'user_agent', type: 'String' }],
]);

export const sessionsDataset: DatasetConfig = {
  name: 'sessions',
  table: 'argus.sessions',
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
    'uniqIf',
    'quantile',
    'quantiles',
    'p50',
    'p75',
    'p95',
    'p99',
  ]),
  columnAliases: {},
  searchableColumns: [],
  materializedViews: [
    {
      table: 'argus.session_health_daily',
      requiredGroupBy: ['project_id', 'release'],
      availableAggregates: [
        'countMerge(total_sessions)',
        'countIfMerge(crashed_sessions)',
        'uniqMerge(total_users)',
        'uniqIfMerge(crashed_users)',
      ],
      mergeFunctions: {
        'count()': 'countMerge(total_sessions)',
        'uniq(distinct_id)': 'uniqMerge(total_users)',
      },
    },
  ],
};
