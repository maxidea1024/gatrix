import { OpticClient } from './client';

// Singleton instance - all consumers share one client
export const optic = new OpticClient();

// Re-export types for convenient imports
export { OpticClient } from './client';
export {
  buildQuery,
  buildTagDistributionQuery,
  parseSearchToSQL,
} from './query-builder';
export { getDataset, hasDataset, getDatasetNames } from './datasets';
export { getBucketingConfig } from './utils/timeBucket';
export { QueryParser } from './utils/queryParser';
export type { ASTNode } from './utils/queryParser';
export type {
  OpticQuery,
  OpticResult,
  SelectField,
  Condition,
  OrderBy,
  TimeRange,
  TagDistributionOptions,
  RawQueryOptions,
  InsertOptions,
  DatasetConfig,
  ColumnDef,
  SearchSchema,
  MapColumnDef,
  QueryMeta,
  BuiltQuery,
} from './types';
