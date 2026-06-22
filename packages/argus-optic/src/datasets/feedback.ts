import { DatasetConfig, ColumnDef } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// User Feedback Dataset — argus.user_feedback
// Source: 005_create_user_feedback_table.sql + 009_alter + 010_alter
// Consumers: feedback
// ─────────────────────────────────────────────────────────────────────────────

const columns = new Map<string, ColumnDef>([
  ['feedback_id', { name: 'feedback_id', type: 'String' }],
  ['project_id', { name: 'project_id', type: 'String' }],
  ['event_id', { name: 'event_id', type: 'FixedString' }],

  ['timestamp', { name: 'timestamp', type: 'DateTime64' }],

  ['name', { name: 'name', type: 'String', searchable: true }],
  ['email', { name: 'email', type: 'String' }],
  ['message', { name: 'message', type: 'String', searchable: true }],
  ['contact_email', { name: 'contact_email', type: 'String' }],
  ['url', { name: 'url', type: 'String', searchable: true }],

  [
    'environment',
    { name: 'environment', type: 'String', lowCardinality: true },
  ],
  ['release', { name: 'release', type: 'String', lowCardinality: true }],
  ['source', { name: 'source', type: 'String', lowCardinality: true }],
  ['tags', { name: 'tags', type: 'Map(String,String)' }],

  // Added by 009_alter_user_feedback.sql
  ['status', { name: 'status', type: 'String', lowCardinality: true }],
  ['assigned_to', { name: 'assigned_to', type: 'String' }],
  ['is_spam', { name: 'is_spam', type: 'UInt8' }],
  ['attachments', { name: 'attachments', type: 'Array(String)' }],
  ['resolved_at', { name: 'resolved_at', type: 'Nullable(DateTime64)' }],

  // Added by 010_alter_user_feedback.sql
  ['browser', { name: 'browser', type: 'String', lowCardinality: true }],
  ['browser_version', { name: 'browser_version', type: 'String' }],
  ['os', { name: 'os', type: 'String', lowCardinality: true }],
  ['os_version', { name: 'os_version', type: 'String' }],
  ['device', { name: 'device', type: 'String', lowCardinality: true }],
  ['user_id', { name: 'user_id', type: 'String' }],
  ['locale', { name: 'locale', type: 'String', lowCardinality: true }],
  ['is_read', { name: 'is_read', type: 'UInt8' }],
  ['category', { name: 'category', type: 'String', lowCardinality: true }],
  ['sentiment', { name: 'sentiment', type: 'String', lowCardinality: true }],
]);

export const feedbackDataset: DatasetConfig = {
  name: 'feedback',
  table: 'argus.user_feedback',
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
  ]),
  columnAliases: {
    os_name: 'os',
    browser_name: 'browser',
    assigned: 'assigned_to',
    feedback: 'message',
  },
  searchableColumns: ['name', 'message', 'url', 'contact_email'],
  materializedViews: [],
};
