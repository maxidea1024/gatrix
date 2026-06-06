import { DatasetConfig, ColumnDef } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Spans Dataset — argus.spans
// Source: 003_create_spans_table.sql
// Consumers: performance, traces
// ─────────────────────────────────────────────────────────────────────────────

const columns = new Map<string, ColumnDef>([
  ['span_id',          { name: 'span_id',          type: 'FixedString' }],
  ['trace_id',         { name: 'trace_id',         type: 'FixedString' }],
  ['parent_span_id',   { name: 'parent_span_id',   type: 'FixedString' }],
  ['transaction_id',   { name: 'transaction_id',   type: 'FixedString' }],
  ['project_id',       { name: 'project_id',       type: 'String' }],

  ['timestamp',        { name: 'timestamp',        type: 'DateTime64' }],
  ['start_timestamp',  { name: 'start_timestamp',  type: 'DateTime64' }],
  ['duration',         { name: 'duration',         type: 'UInt64' }],

  ['op',               { name: 'op',               type: 'String', lowCardinality: true }],
  ['description',      { name: 'description',      type: 'String', searchable: true }],
  ['status',           { name: 'status',           type: 'String', lowCardinality: true }],
  ['action',           { name: 'action',           type: 'String', lowCardinality: true }],
  ['domain',           { name: 'domain',           type: 'String', lowCardinality: true }],

  ['data',             { name: 'data',             type: 'Map(String,String)' }],
  ['tags',             { name: 'tags',             type: 'Map(String,String)' }],
]);

export const spansDataset: DatasetConfig = {
  name: 'spans',
  table: 'argus.spans',
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
  searchableColumns: ['description'],
  materializedViews: [],
};
