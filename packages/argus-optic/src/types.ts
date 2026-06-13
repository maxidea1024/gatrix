// ─────────────────────────────────────────────────────────────────────────────
// Optic — Argus Query Abstraction Layer: Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// Dataset Schema Types
// ═══════════════════════════════════════════════════════════════════════════

/** ClickHouse column type identifiers */
export type CHColumnType =
  | 'String'
  | 'FixedString'
  | 'UInt8'
  | 'UInt16'
  | 'UInt32'
  | 'UInt64'
  | 'Float64'
  | 'DateTime'
  | 'DateTime64'
  | 'Date'
  | 'Array(String)'
  | 'Array(Float64)'
  | 'Map(String,String)'
  | 'Map(String,Float64)'
  | 'Nullable(UInt64)'
  | 'Nullable(UInt32)'
  | 'Nullable(UInt16)'
  | 'Nullable(String)'
  | 'Nullable(DateTime)'
  | 'Nullable(DateTime64)';

/** Column definition within a Dataset */
export interface ColumnDef {
  /** DB column name */
  name: string;
  /** ClickHouse type (used for parameterized query generation) */
  type: CHColumnType;
  /** Whether the column is LowCardinality (useful for tag distribution queries) */
  lowCardinality?: boolean;
  /** Whether the column supports ILIKE full-text search */
  searchable?: boolean;
}

/** Map(String, T) column definition for QueryParser dynamic key access */
export interface MapColumnDef {
  /** ClickHouse column name (e.g. 'tags', 'attributes', 'measurements') */
  name: string;
  /** Value type of the Map — determines parameter type hints in generated SQL */
  valueType: 'String' | 'Float64';
}

/**
 * Search schema used by QueryParser for Map column fallback.
 * When a search key (e.g. 'server.region') is NOT a known column,
 * QueryParser falls back to the first Map column and generates:
 *   mapContains(tags, 'server.region') AND tags['server.region'] = value
 */
export interface SearchSchema {
  /** Top-level columns: column name → simple type hint */
  columns: Record<string, 'string' | 'number'>;
  /** Map(String, T) columns that support dynamic key access */
  mapColumns: MapColumnDef[];
  /** User-friendly aliases → real column names (e.g. severity → level) */
  aliases?: Record<string, string>;
}

/** Materialized View configuration for auto-routing */
export interface MaterializedViewDef {
  /** MV target table name (e.g., 'argus.error_frequency_hourly') */
  table: string;
  /** Required groupBy columns to use this MV */
  requiredGroupBy: string[];
  /** Available aggregate expressions in this MV */
  availableAggregates: string[];
  /** Merge function mapping: source aggregate → MV merge function */
  mergeFunctions: Record<string, string>;
}

/** Complete dataset configuration */
export interface DatasetConfig {
  /** Dataset identifier (e.g., 'errors', 'transactions') */
  name: string;
  /** ClickHouse table full path (e.g., 'argus.errors') */
  table: string;
  /** Timestamp column name (used for time filters) */
  timestampColumn: string;
  /** Default ORDER BY clause */
  defaultOrderBy: string;
  /** Allowed column definitions — key is the column name */
  columns: Map<string, ColumnDef>;
  /** Allowed aggregate function names (e.g., 'count', 'uniq', 'avg') */
  aggregates: Set<string>;
  /** Column alias mapping: UI-friendly name → DB column name */
  columnAliases: Record<string, string>;
  /** Columns that support ILIKE search (derived from columns with searchable=true) */
  searchableColumns: string[];
  /** Materialized view definitions for auto-routing */
  materializedViews: MaterializedViewDef[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Query Language Types
// ═══════════════════════════════════════════════════════════════════════════

/** Time range for queries */
export interface TimeRange {
  /** Preset period ('5min', '1h', '6h', '24h', '7d', '14d', '30d', '90d') */
  period?: string;
  /** Custom start time (ISO 8601) */
  start?: string;
  /** Custom end time (ISO 8601) */
  end?: string;
}

/** SELECT field definition */
export interface SelectField {
  /**
   * Column name or aggregate expression.
   * Examples: 'level', 'count()', 'avg(duration)', 'p95(duration)',
   *           'uniq(user_id)', 'countIf(status != \'ok\')'
   */
  field: string;
  /** AS alias */
  alias?: string;
}

/** WHERE/HAVING condition */
export interface Condition {
  field: string;
  op:
    | '='
    | '!='
    | '>'
    | '<'
    | '>='
    | '<='
    | 'IN'
    | 'NOT IN'
    | 'ILIKE'
    | 'NOT ILIKE';
  value: string | number | string[] | number[];
}

/** ORDER BY specification */
export interface OrderBy {
  field: string;
  direction: 'ASC' | 'DESC';
}

/** The main query interface — what routes pass to OpticClient */
export interface OpticQuery {
  /** Target dataset name */
  dataset: string;

  /** Project ID (auto-injected as WHERE project_id = ?) */
  projectId: string;

  /** Time range (auto-generates timestamp filter + bucketing) */
  timeRange: TimeRange;

  /** SELECT fields */
  select: SelectField[];

  /** Additional WHERE conditions (beyond project_id + timeRange) */
  conditions?: Condition[];

  /** GROUP BY columns. '$bucket' is replaced with auto time bucket expression */
  groupBy?: string[];

  /** ORDER BY */
  orderBy?: OrderBy[];

  /** HAVING conditions (aggregate filters) */
  having?: Condition[];

  /** Free-text search (uses QueryParser) */
  search?: string;

  /** Auto-apply WITH FILL for time-series charts */
  withFill?: boolean;

  /** LIMIT (default: 1000, max: 10000) */
  limit?: number;

  /** OFFSET */
  offset?: number;

  /**
   * Override the dataset's default timestamp column for time filtering.
   * e.g., sessions uses 'started' instead of 'timestamp'.
   */
  timestampField?: string;
}

/** Tag distribution query options */
export interface TagDistributionOptions {
  dataset: string;
  projectId: string;
  timeRange: TimeRange;
  conditions?: Condition[];
  tags: string[];
  limit?: number;
}

/** Raw query options (escape hatch) */
export interface RawQueryOptions {
  query: string;
  params: Record<string, any>;
}

/** Batch insert options for worker data ingestion */
export interface InsertOptions<T> {
  /** Target table (e.g., 'argus.errors') */
  table: string;
  /** Rows to insert */
  values: T[];
  /** ClickHouse format (default: 'JSONEachRow') */
  format?: 'JSONEachRow' | 'JSONCompactEachRow';
}

// ═══════════════════════════════════════════════════════════════════════════
// Result Types
// ═══════════════════════════════════════════════════════════════════════════

/** Query execution metadata */
export interface QueryMeta {
  /** Query execution time in ms */
  executionTimeMs: number;
  /** Rows read (from ClickHouse statistics) */
  rowsRead: number;
  /** Bytes read */
  bytesRead: number;
  /** Generated SQL (only in development mode) */
  sql?: string;
  /** Query parameters (only in development mode) */
  params?: Record<string, any>;
}

/** Standard query result wrapper */
export interface OpticResult<T = Record<string, any>> {
  /** Result data rows */
  data: T[];
  /** Execution metadata */
  meta: QueryMeta;
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal Types (used by QueryBuilder)
// ═══════════════════════════════════════════════════════════════════════════

/** Output of QueryBuilder — ready to execute against ClickHouse */
export interface BuiltQuery {
  /** Parameterized SQL string */
  sql: string;
  /** Parameter values for ClickHouse query_params */
  params: Record<string, any>;
}
