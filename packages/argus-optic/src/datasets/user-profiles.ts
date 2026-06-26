import { DatasetConfig, ColumnDef } from '../types';

const columns = new Map<string, ColumnDef>([
  ['user_id', { name: 'user_id', type: 'String', searchable: true }],
  ['platform', { name: 'platform', type: 'String', lowCardinality: true }],
  ['country', { name: 'country', type: 'String', lowCardinality: true }],
  ['browser', { name: 'browser', type: 'String', lowCardinality: true }],
  ['os', { name: 'os', type: 'String', lowCardinality: true }],
  ['app_version', { name: 'app_version', type: 'String', lowCardinality: true }],
  ['net_revenue', { name: 'net_revenue', type: 'Float64' }],
  ['days_inactive', { name: 'days_inactive', type: 'UInt32' }],
  ['purchase_count', { name: 'purchase_count', type: 'UInt32' }],
  ['total_events', { name: 'total_events', type: 'UInt32' }],
  ['total_sessions', { name: 'total_sessions', type: 'UInt32' }],
  ['churn_risk', { name: 'churn_risk', type: 'String', lowCardinality: true }],
  ['cohort', { name: 'cohort', type: 'String', lowCardinality: true }],
]);

export const userProfilesDataset: DatasetConfig = {
  name: 'user_profiles',
  table: 'argus.activities',
  timestampColumn: 'timestamp',
  defaultOrderBy: 'last_seen DESC',
  columns,
  aggregates: new Set([
    'count',
    'uniq',
    'min',
    'max',
    'avg',
    'sum',
  ]),
  columnAliases: {
    browser: "properties['browser']",
  },
  searchableColumns: ['user_id'],
  materializedViews: [],
};
