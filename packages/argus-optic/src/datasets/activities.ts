import { DatasetConfig, ColumnDef } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Activities Dataset — argus.activities
// Source: 014_create_custom_events_table.sql
// Consumers: analytics (insights, funnels, retention, flows)
// ─────────────────────────────────────────────────────────────────────────────

const columns = new Map<string, ColumnDef>([
  ['event_id', { name: 'event_id', type: 'FixedString' }],
  ['project_id', { name: 'project_id', type: 'String' }],
  ['timestamp', { name: 'timestamp', type: 'DateTime64' }],

  [
    'event_name',
    { name: 'event_name', type: 'String', searchable: true },
  ],

  ['user_id', { name: 'user_id', type: 'String', searchable: true }],
  ['device_id', { name: 'device_id', type: 'String' }],
  ['session_id', { name: 'session_id', type: 'String' }],

  [
    'platform',
    { name: 'platform', type: 'String', lowCardinality: true },
  ],
  [
    'environment',
    { name: 'environment', type: 'String', lowCardinality: true },
  ],
  [
    'release',
    { name: 'release', type: 'String', lowCardinality: true },
  ],

  // GeoIP (derived server-side, IP NOT stored)
  [
    'country',
    { name: 'country', type: 'String', lowCardinality: true },
  ],
  [
    'city',
    { name: 'city', type: 'String', lowCardinality: true },
  ],

  // Device / App context
  [
    'os',
    { name: 'os', type: 'String', lowCardinality: true },
  ],
  [
    'app_version',
    { name: 'app_version', type: 'String', lowCardinality: true },
  ],

  ['properties', { name: 'properties', type: 'Map(String,String)' }],
  [
    'numeric_properties',
    { name: 'numeric_properties', type: 'Map(String,Float64)' },
  ],
]);

export const activitiesDataset: DatasetConfig = {
  name: 'activities',
  table: 'argus.activities',
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
    'groupArray',
    'topK',
  ]),
  columnAliases: {},
  searchableColumns: ['event_name', 'user_id'],
  materializedViews: [],
};
