import { DatasetConfig, ColumnDef } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Metrics Dataset — argus.metrics
// Source: 006_create_metrics_table.sql
// Consumers: metrics
// ─────────────────────────────────────────────────────────────────────────────

const columns = new Map<string, ColumnDef>([
  ['project_id',         { name: 'project_id',         type: 'String' }],
  ['metric_type',        { name: 'metric_type',        type: 'String', lowCardinality: true }],
  ['name',               { name: 'name',               type: 'String', lowCardinality: true }],
  ['unit',               { name: 'unit',               type: 'String', lowCardinality: true }],

  ['timestamp',          { name: 'timestamp',          type: 'DateTime64' }],

  ['value_counter',      { name: 'value_counter',      type: 'Float64' }],
  ['value_gauge',        { name: 'value_gauge',        type: 'Float64' }],
  ['value_distribution', { name: 'value_distribution', type: 'Array(Float64)' }],
  ['value_set',          { name: 'value_set',          type: 'Array(String)' }],

  ['environment',        { name: 'environment',        type: 'String', lowCardinality: true }],
  ['release',            { name: 'release',            type: 'String', lowCardinality: true }],
  ['tags',               { name: 'tags',               type: 'Map(String,String)' }],
]);

export const metricsDataset: DatasetConfig = {
  name: 'metrics',
  table: 'argus.metrics',
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
  searchableColumns: [],
  materializedViews: [],
};
