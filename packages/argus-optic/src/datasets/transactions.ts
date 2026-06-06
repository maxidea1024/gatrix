import { DatasetConfig, ColumnDef } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Transactions Dataset — argus.transactions
// Source: 002_create_transactions_table.sql
// Consumers: overview, performance, traces
// ─────────────────────────────────────────────────────────────────────────────

const columns = new Map<string, ColumnDef>([
  ['event_id',           { name: 'event_id',           type: 'FixedString' }],
  ['trace_id',           { name: 'trace_id',           type: 'FixedString' }],
  ['span_id',            { name: 'span_id',            type: 'FixedString' }],
  ['parent_span_id',     { name: 'parent_span_id',     type: 'FixedString' }],
  ['project_id',         { name: 'project_id',         type: 'String' }],

  ['timestamp',          { name: 'timestamp',          type: 'DateTime64' }],
  ['start_timestamp',    { name: 'start_timestamp',    type: 'DateTime64' }],
  ['duration',           { name: 'duration',           type: 'UInt64' }],

  ['transaction',        { name: 'transaction',        type: 'String', searchable: true }],
  ['transaction_op',     { name: 'transaction_op',     type: 'String', lowCardinality: true }],
  ['transaction_status', { name: 'transaction_status', type: 'String', lowCardinality: true }],
  ['http_method',        { name: 'http_method',        type: 'String', lowCardinality: true }],
  ['http_status_code',   { name: 'http_status_code',   type: 'UInt16' }],

  ['platform',           { name: 'platform',           type: 'String', lowCardinality: true }],
  ['environment',        { name: 'environment',        type: 'String', lowCardinality: true }],
  ['release',            { name: 'release',            type: 'String', lowCardinality: true }],
  ['user_id',            { name: 'user_id',            type: 'String' }],

  ['measurements',       { name: 'measurements',       type: 'Map(String,Float64)' }],
  ['tags',               { name: 'tags',               type: 'Map(String,String)' }],
  ['span_count',         { name: 'span_count',         type: 'UInt32' }],
]);

export const transactionsDataset: DatasetConfig = {
  name: 'transactions',
  table: 'argus.transactions',
  timestampColumn: 'timestamp',
  defaultOrderBy: 'timestamp DESC',
  columns,
  aggregates: new Set([
    'count', 'uniq', 'min', 'max', 'avg', 'sum',
    'any', 'anyLast',
    'countIf', 'sumIf', 'avgIf',
    'quantile', 'quantiles',
    'p50', 'p75', 'p95', 'p99',
    'groupArray', 'topK',
  ]),
  columnAliases: {},
  searchableColumns: ['transaction'],
  materializedViews: [
    {
      table: 'argus.transaction_metrics_hourly',
      requiredGroupBy: ['project_id', 'transaction'],
      availableAggregates: [
        'countMerge(txn_count)',
        'avgMerge(avg_duration)',
        'quantilesMerge(0.5, 0.75, 0.95, 0.99)(duration_quantiles)',
      ],
      mergeFunctions: {
        'count()': 'countMerge(txn_count)',
        'avg(duration)': 'avgMerge(avg_duration)',
      },
    },
  ],
};
