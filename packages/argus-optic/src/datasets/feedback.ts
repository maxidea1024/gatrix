import { DatasetConfig, ColumnDef } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// User Feedback Dataset — argus.user_feedback
// Source: 005_create_user_feedback_table.sql + 009_alter + 010_alter
// Consumers: feedback
// ─────────────────────────────────────────────────────────────────────────────

const columns = new Map<string, ColumnDef>([
  ['feedback_id',   { name: 'feedback_id',   type: 'String' }],
  ['project_id',    { name: 'project_id',    type: 'String' }],
  ['event_id',      { name: 'event_id',      type: 'FixedString' }],

  ['timestamp',     { name: 'timestamp',     type: 'DateTime64' }],

  ['name',          { name: 'name',          type: 'String', searchable: true }],
  ['email',         { name: 'email',         type: 'String' }],
  ['message',       { name: 'message',       type: 'String', searchable: true }],
  ['contact_email', { name: 'contact_email', type: 'String' }],
  ['url',           { name: 'url',           type: 'String', searchable: true }],

  ['environment',   { name: 'environment',   type: 'String', lowCardinality: true }],
  ['release',       { name: 'release',       type: 'String', lowCardinality: true }],
  ['source',        { name: 'source',        type: 'String', lowCardinality: true }],
  ['tags',          { name: 'tags',          type: 'Map(String,String)' }],

  // Added by 009_alter_user_feedback.sql
  ['status',        { name: 'status',        type: 'String', lowCardinality: true }],
  ['assigned_to',   { name: 'assigned_to',   type: 'String' }],
  ['is_spam',       { name: 'is_spam',       type: 'UInt8' }],
  ['attachments',   { name: 'attachments',   type: 'Array(String)' }],
  ['resolved_at',   { name: 'resolved_at',   type: 'Nullable(DateTime64)' }],
]);

export const feedbackDataset: DatasetConfig = {
  name: 'feedback',
  table: 'argus.user_feedback',
  timestampColumn: 'timestamp',
  defaultOrderBy: 'timestamp DESC',
  columns,
  aggregates: new Set([
    'count', 'uniq', 'min', 'max', 'avg', 'sum',
    'any', 'anyLast',
    'countIf',
  ]),
  columnAliases: {},
  searchableColumns: ['name', 'message', 'url'],
  materializedViews: [],
};
