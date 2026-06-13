import {
  DatasetConfig,
  OpticQuery,
  Condition,
  BuiltQuery,
  SearchSchema,
  MapColumnDef,
} from './types';
import { getDataset } from './datasets';
import { getBucketingConfig } from './utils/timeBucket';
import { QueryParser } from './utils/queryParser';

// ─────────────────────────────────────────────────────────────────────────────
// Optic Query Builder
//
// Transforms an OpticQuery (declarative query object) into a parameterized
// ClickHouse SQL string + params, ready for execution.
//
// Pipeline:
//   1. Resolve dataset
//   2. Validate columns and aggregates
//   3. Build SELECT clause
//   4. Build FROM clause
//   5. Build WHERE clause (project_id + timeRange + conditions + search)
//   6. Build GROUP BY clause
//   7. Build HAVING clause
//   8. Build ORDER BY clause
//   9. Build LIMIT/OFFSET
//  10. Generate WITH FILL (if withFill=true)
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum allowed limit */
const MAX_LIMIT = 10000;
/** Default limit */
const DEFAULT_LIMIT = 1000;

/** Quantile shorthand mapping */
const QUANTILE_SHORTHANDS: Record<string, number> = {
  p50: 0.5,
  p75: 0.75,
  p90: 0.9,
  p95: 0.95,
  p99: 0.99,
};

/**
 * Build a ClickHouse SQL query from an OpticQuery.
 */
export function buildQuery(query: OpticQuery): BuiltQuery {
  const dataset = getDataset(query.dataset);
  const params: Record<string, any> = {};
  let paramCounter = 0;

  const nextParam = (prefix: string): string => {
    return `${prefix}_${paramCounter++}`;
  };

  // Determine timestamp column (allow per-query override)
  const tsCol = query.timestampField || dataset.timestampColumn;

  const bucketConfig = getBucketingConfig(
    query.timeRange.period,
    query.timeRange.start,
    query.timeRange.end,
    tsCol,
    query.interval
  );

  const selectParts: string[] = query.select.map((field) => {
    const expr = resolveSelectField(
      field.field,
      dataset,
      bucketConfig.selectExpr
    );
    return field.alias ? `${expr} AS ${field.alias}` : expr;
  });

  // ── 2. Build WHERE clause ───────────────────────────────────────────────

  const whereParts: string[] = [];

  // 2a. project_id filter (always required)
  const projectParam = nextParam('pid');
  params[projectParam] = query.projectId;
  whereParts.push(`project_id = {${projectParam}:String}`);

  // 2b. Time range filter
  Object.assign(params, {
    fillStart: bucketConfig.queryParams.fillStart,
    fillEnd: bucketConfig.queryParams.fillEnd,
  });
  whereParts.push(`${tsCol} >= toDateTime({fillStart:UInt32})`);
  whereParts.push(`${tsCol} <= toDateTime({fillEnd:UInt32})`);

  // 2c. Additional conditions
  if (query.conditions) {
    for (const cond of query.conditions) {
      const sql = buildCondition(cond, dataset, params, nextParam);
      if (sql) whereParts.push(sql);
    }
  }

  // 2d. Search (QueryParser integration — schema-based with Map column fallback)
  let havingFromSearch = '';
  if (query.search && query.search.trim()) {
    const schema = deriveSearchSchema(dataset);
    const parser = new QueryParser(schema, dataset.aggregates);
    const ast = parser.parse(query.search);
    if (ast) {
      const searchParams: Record<string, string> = {};
      const generated = parser.generateSQL(ast, searchParams);
      Object.assign(params, searchParams);
      if (generated.where) {
        whereParts.push(generated.where);
      }
      if (generated.having) {
        havingFromSearch = generated.having;
      }
    }
  }

  // ── 3. Build GROUP BY clause ────────────────────────────────────────────

  let groupByParts: string[] = [];
  if (query.groupBy && query.groupBy.length > 0) {
    groupByParts = query.groupBy.map((col) => {
      if (col === '$bucket') {
        return bucketConfig.selectExpr;
      }
      return resolveColumn(col, dataset);
    });
  }

  // ── 4. Build HAVING clause ──────────────────────────────────────────────

  const havingParts: string[] = [];
  if (havingFromSearch) {
    havingParts.push(havingFromSearch);
  }
  if (query.having) {
    for (const cond of query.having) {
      const sql = buildCondition(cond, dataset, params, nextParam);
      if (sql) havingParts.push(sql);
    }
  }

  // ── 5. Build ORDER BY clause ────────────────────────────────────────────

  let orderByParts: string[] = [];
  if (query.orderBy && query.orderBy.length > 0) {
    orderByParts = query.orderBy.map((o) => {
      const col = resolveColumn(o.field, dataset);
      return `${col} ${o.direction}`;
    });
  }

  // ── 6. Build LIMIT/OFFSET ──────────────────────────────────────────────

  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = query.offset ?? 0;

  // ── 7. Assemble SQL ────────────────────────────────────────────────────

  let sql = `SELECT ${selectParts.join(', ')}`;
  sql += `\nFROM ${dataset.table}`;
  sql += `\nWHERE ${whereParts.join('\n  AND ')}`;

  if (groupByParts.length > 0) {
    sql += `\nGROUP BY ${groupByParts.join(', ')}`;
  }

  if (havingParts.length > 0) {
    sql += `\nHAVING ${havingParts.join(' AND ')}`;
  }

  if (orderByParts.length > 0) {
    // If withFill, append fill expression to the first ORDER BY column
    if (
      query.withFill &&
      groupByParts.some((g) => g === bucketConfig.selectExpr)
    ) {
      const fillExpr = bucketConfig.fillExpr;
      sql += `\nORDER BY ${orderByParts[0]} ${fillExpr}`;
      if (orderByParts.length > 1) {
        sql += `, ${orderByParts.slice(1).join(', ')}`;
      }
    } else {
      sql += `\nORDER BY ${orderByParts.join(', ')}`;
    }
  } else if (groupByParts.length === 0) {
    // No explicit order, no group by → use dataset default
    // But ONLY if the query selects non-aggregate columns,
    // otherwise ClickHouse rejects ORDER BY on non-grouped columns.
    const hasOnlyAggregates = query.select.every((s) => {
      const f = s.field.trim();
      return (
        /^(count|sum|avg|min|max|uniq|any|p\d+|quantile|countIf|sumIf|if)\s*\(/i.test(
          f
        ) || /\/\s*count\(\)/i.test(f)
      ); // e.g., countIf(x) / count() * 100
    });
    if (!hasOnlyAggregates) {
      sql += `\nORDER BY ${dataset.defaultOrderBy}`;
    }
  }

  sql += `\nLIMIT ${limit}`;
  if (offset > 0) {
    sql += ` OFFSET ${offset}`;
  }

  return { sql, params };
}

/**
 * Parse a search string into SQL conditions using the dataset's schema.
 *
 * This is a convenience helper for routes that use rawQuery but still need
 * schema-based search parsing with Map column fallback.
 *
 * @param datasetName  Dataset name (e.g. 'spans', 'logs', 'errors')
 * @param search       Raw AQL search string from the client
 * @param params       Mutable params map — will be populated with search parameters
 * @returns            SQL WHERE fragment to inject, or empty string if no search
 *
 * @example
 * ```typescript
 * const params = { projectId, fillStart, fillEnd };
 * const searchCond = parseSearchToSQL('spans', search, params);
 * const sql = `SELECT ... WHERE project_id = ... ${searchCond ? `AND (${searchCond})` : ''}`;
 * const result = await optic.rawQuery({ query: sql, params });
 * ```
 */
export function parseSearchToSQL(
  datasetName: string,
  search: string | undefined,
  params: Record<string, any>
): { where: string; having: string } {
  if (!search || !search.trim()) return { where: '', having: '' };
  const dataset = getDataset(datasetName);
  const schema = deriveSearchSchema(dataset);
  const parser = new QueryParser(schema, dataset.aggregates);
  const ast = parser.parse(search);
  if (!ast) return { where: '', having: '' };
  const searchParams: Record<string, string> = {};
  const generated = parser.generateSQL(ast, searchParams);
  Object.assign(params, searchParams);
  return { where: generated.where || '', having: generated.having || '' };
}

/**
 * Build a UNION ALL query for tag distribution across multiple columns.
 */
export function buildTagDistributionQuery(options: {
  dataset: string;
  projectId: string;
  timeRange: { period?: string; start?: string; end?: string };
  conditions?: Condition[];
  tags: string[];
  limit?: number;
}): BuiltQuery {
  const dataset = getDataset(options.dataset);
  const params: Record<string, any> = {};
  let paramCounter = 0;

  const nextParam = (prefix: string): string => {
    return `${prefix}_${paramCounter++}`;
  };

  const bucketConfig = getBucketingConfig(
    options.timeRange.period,
    options.timeRange.start,
    options.timeRange.end,
    dataset.timestampColumn
  );

  Object.assign(params, {
    fillStart: bucketConfig.queryParams.fillStart,
    fillEnd: bucketConfig.queryParams.fillEnd,
  });

  const projectParam = nextParam('pid');
  params[projectParam] = options.projectId;

  // Build base WHERE clause
  const baseWhere: string[] = [
    `project_id = {${projectParam}:String}`,
    `${dataset.timestampColumn} >= toDateTime({fillStart:UInt32})`,
    `${dataset.timestampColumn} <= toDateTime({fillEnd:UInt32})`,
  ];

  if (options.conditions) {
    for (const cond of options.conditions) {
      const sql = buildCondition(cond, dataset, params, nextParam);
      if (sql) baseWhere.push(sql);
    }
  }

  const whereStr = baseWhere.join(' AND ');
  const tagLimit = options.limit ?? 10;

  // Validate all tags exist as columns
  const validTags = options.tags.filter((tag) => {
    const resolved = dataset.columnAliases[tag] || tag;
    return dataset.columns.has(resolved);
  });

  if (validTags.length === 0) {
    return { sql: 'SELECT 1 WHERE 0', params: {} };
  }

  // Build UNION ALL
  const unions = validTags.map((tag) => {
    const resolved = dataset.columnAliases[tag] || tag;
    return `SELECT '${tag}' AS tag_key, toString(${resolved}) AS tag_value, count() AS count
FROM ${dataset.table}
WHERE ${whereStr} AND ${resolved} != ''
GROUP BY tag_value
ORDER BY count DESC
LIMIT ${tagLimit}`;
  });

  const sql = unions.join('\nUNION ALL\n');

  return { sql, params };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a select field expression, handling:
 * - $bucket → time bucket expression
 * - p50/p75/p95/p99 shorthand → quantile()
 * - Column alias resolution
 */
function resolveSelectField(
  field: string,
  dataset: DatasetConfig,
  bucketExpr: string
): string {
  // $bucket → auto time bucket
  if (field === '$bucket') {
    return bucketExpr;
  }

  // Quantile shorthands: p50(duration) → quantile(0.5)(duration)
  const pMatch = field.match(/^(p50|p75|p90|p95|p99)\((.+)\)$/);
  if (pMatch) {
    const q = QUANTILE_SHORTHANDS[pMatch[1]];
    const innerCol = resolveColumn(pMatch[2], dataset);
    return `quantile(${q})(${innerCol})`;
  }

  // Regular aggregate: count(), avg(duration), uniq(user_id), etc.
  const aggMatch = field.match(/^(\w+)\((.*?)\)$/);
  if (aggMatch) {
    const fn = aggMatch[1];
    const innerArg = aggMatch[2];

    // count() with no args
    if (!innerArg) {
      return `${fn}()`;
    }

    // countIf/sumIf/avgIf with expression (pass through)
    if (
      [
        'countIf',
        'sumIf',
        'avgIf',
        'uniqIf',
        'countIfMerge',
        'uniqIfMerge',
      ].includes(fn)
    ) {
      return field;
    }

    // Regular aggregate with column: avg(duration) → avg(duration)
    const resolvedCol = resolveColumn(innerArg, dataset);
    return `${fn}(${resolvedCol})`;
  }

  // Plain column name
  return resolveColumn(field, dataset);
}

/**
 * Resolve a column name through the dataset's alias mapping.
 */
function resolveColumn(name: string, dataset: DatasetConfig): string {
  return dataset.columnAliases[name] || name;
}

/**
 * Build a SQL condition string from a Condition object.
 */
function buildCondition(
  cond: Condition,
  dataset: DatasetConfig,
  params: Record<string, any>,
  nextParam: (prefix: string) => string
): string | null {
  const field = resolveColumn(cond.field, dataset);

  // Array values → IN / NOT IN
  if (Array.isArray(cond.value)) {
    const paramNames = cond.value.map((v) => {
      const p = nextParam('v');
      params[p] = v;
      return `{${p}:String}`;
    });
    const op =
      cond.op === '!='
        ? 'NOT IN'
        : cond.op === 'IN' || cond.op === 'NOT IN'
          ? cond.op
          : 'IN';
    return `${field} ${op} (${paramNames.join(', ')})`;
  }

  // Single value
  const p = nextParam('v');
  params[p] = cond.value;

  // Determine ClickHouse type hint
  const colDef = dataset.columns.get(field);
  const isNumericOp = ['>', '<', '>=', '<='].includes(cond.op);
  const isNumericValue =
    typeof cond.value === 'number' ||
    (typeof cond.value === 'string' && !isNaN(Number(cond.value)));

  if (isNumericOp && isNumericValue) {
    // Numeric comparison
    const numType =
      colDef?.type === 'UInt64'
        ? 'UInt64'
        : colDef?.type === 'UInt32'
          ? 'UInt32'
          : colDef?.type === 'UInt16'
            ? 'UInt16'
            : colDef?.type === 'Float64'
              ? 'Float64'
              : 'Float64'; // default to Float64 for numeric comparisons
    return `${field} ${cond.op} {${p}:${numType}}`;
  }

  // String comparison (=, !=, ILIKE, NOT ILIKE)
  return `${field} ${cond.op} {${p}:String}`;
}

/**
 * Derive a SearchSchema from a DatasetConfig.
 *
 * This auto-converts the DatasetConfig's column Map into the format QueryParser
 * needs. Map(String,T) type columns are automatically registered as mapColumns,
 * enabling unknown search keys (e.g. 'server.region') to fall back to map access.
 */
function deriveSearchSchema(dataset: DatasetConfig): SearchSchema {
  const columns: Record<string, 'string' | 'number'> = {};
  const mapCols: MapColumnDef[] = [];

  for (const [name, colDef] of dataset.columns) {
    // Map columns → register for fallback
    if (colDef.type === 'Map(String,String)') {
      mapCols.push({ name, valueType: 'String' });
    } else if (colDef.type === 'Map(String,Float64)') {
      mapCols.push({ name, valueType: 'Float64' });
    } else {
      // Regular columns
      const isNumeric = [
        'UInt8',
        'UInt16',
        'UInt32',
        'UInt64',
        'Float64',
        'Nullable(UInt64)',
        'Nullable(UInt32)',
        'Nullable(UInt16)',
      ].includes(colDef.type);
      columns[name] = isNumeric ? 'number' : 'string';
    }
  }

  // String Map columns first (e.g. tags) — QueryParser uses mapColumns[0] as
  // the default fallback for unknown keys, and string tags are the most common
  // target. Float64 Maps (e.g. measurements) should come after.
  mapCols.sort(
    (a, b) =>
      (a.valueType === 'String' ? -1 : 1) - (b.valueType === 'String' ? -1 : 1)
  );

  return {
    columns,
    mapColumns: mapCols,
    aliases: dataset.columnAliases,
  };
}
