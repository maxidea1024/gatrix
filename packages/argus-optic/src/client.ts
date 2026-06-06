import {
  OpticQuery,
  OpticResult,
  TagDistributionOptions,
  RawQueryOptions,
  InsertOptions,
  QueryMeta,
} from './types';
import { buildQuery, buildTagDistributionQuery } from './query-builder';
import {
  getClickHouseClient,
  testClickHouseConnection,
  initClickHouseDatabase,
} from './config/clickhouse';
import { createLogger } from './utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Optic Client — Query execution, logging, and batch operations
//
// This is the main entry point for consuming packages to access ClickHouse.
// All ClickHouse interactions go through this client, which provides:
//   - Automatic SQL generation from OpticQuery
//   - Execution with timing and metadata
//   - Batch query execution (parallel)
//   - Tag distribution queries (UNION ALL pattern)
//   - Raw SQL escape hatch
//   - Batch INSERT for workers
//   - Connection testing and database initialization
//   - Slow query logging
// ─────────────────────────────────────────────────────────────────────────────

const logger = createLogger('optic');

/** Threshold for slow query warnings (ms) */
const SLOW_QUERY_THRESHOLD_MS = 2000;

/** Check if NODE_ENV is development */
const isDev = () => process.env.NODE_ENV === 'development';

export class OpticClient {
  /**
   * Execute a single OpticQuery.
   *
   * @example
   * ```typescript
   * const result = await optic.query<{ count: number }>({
   *   dataset: 'errors',
   *   projectId,
   *   timeRange: { period: '24h' },
   *   select: [{ field: 'count()', alias: 'count' }],
   * });
   * console.log(result.data[0].count);
   * ```
   */
  async query<T = Record<string, any>>(query: OpticQuery): Promise<OpticResult<T>> {
    const built = buildQuery(query);
    return this.executeQuery<T>(built.sql, built.params, query.dataset);
  }

  /**
   * Execute multiple OpticQueries in parallel.
   * Results are keyed by the same keys as the input.
   *
   * @example
   * ```typescript
   * const results = await optic.queryBatch({
   *   errors: { dataset: 'errors', projectId, timeRange, select: [...] },
   *   txns:   { dataset: 'transactions', projectId, timeRange, select: [...] },
   * });
   * console.log(results.errors.data);
   * console.log(results.txns.data);
   * ```
   */
  async queryBatch<T extends Record<string, OpticQuery>>(
    queries: T,
  ): Promise<{ [K in keyof T]: OpticResult<Record<string, any>> }> {
    const keys = Object.keys(queries) as (keyof T)[];
    const builtQueries = keys.map((key) => ({
      key,
      ...buildQuery(queries[key]),
      dataset: queries[key].dataset,
    }));

    const results = await Promise.all(
      builtQueries.map((bq) =>
        this.executeQuery<Record<string, any>>(bq.sql, bq.params, bq.dataset),
      ),
    );

    const resultMap = {} as { [K in keyof T]: OpticResult<Record<string, any>> };
    keys.forEach((key, i) => {
      resultMap[key] = results[i];
    });

    return resultMap;
  }

  /**
   * Execute a raw SQL query (escape hatch for complex queries like JOINs).
   *
   * @example
   * ```typescript
   * const result = await optic.rawQuery<SpanData>({
   *   query: `SELECT s.op, count() AS count FROM argus.spans s ...`,
   *   params: { projectId },
   * });
   * ```
   */
  async rawQuery<T = Record<string, any>>(
    options: RawQueryOptions,
  ): Promise<OpticResult<T>> {
    return this.executeQuery<T>(options.query, options.params, 'raw');
  }

  /**
   * Query tag distribution across multiple columns.
   * Generates a UNION ALL query and returns results grouped by tag key.
   *
   * @example
   * ```typescript
   * const tags = await optic.queryTagDistribution({
   *   dataset: 'errors',
   *   projectId,
   *   timeRange: { period: '30d' },
   *   tags: ['browser_name', 'os_name', 'level'],
   *   limit: 10,
   * });
   * // tags.browser_name = [{ value: 'Chrome', count: 1234 }, ...]
   * ```
   */
  async queryTagDistribution(
    options: TagDistributionOptions,
  ): Promise<Record<string, { value: string; count: number }[]>> {
    const built = buildTagDistributionQuery(options);
    const result = await this.executeQuery<{
      tag_key: string;
      tag_value: string;
      count: string;
    }>(built.sql, built.params, options.dataset);

    // Group results by tag_key
    const grouped: Record<string, { value: string; count: number }[]> = {};
    for (const tag of options.tags) {
      grouped[tag] = [];
    }
    for (const row of result.data) {
      if (grouped[row.tag_key]) {
        grouped[row.tag_key].push({
          value: row.tag_value,
          count: Number(row.count),
        });
      }
    }

    return grouped;
  }

  /**
   * Execute a ClickHouse command (ALTER TABLE UPDATE/DELETE, INSERT, etc.)
   * This is not a query — it does not return data rows.
   *
   * @example
   * ```typescript
   * await optic.command({
   *   query: `ALTER TABLE argus.user_feedback UPDATE status = {status:String}
   *     WHERE project_id = {projectId:String} AND feedback_id = {feedbackId:String}`,
   *   params: { projectId, feedbackId, status: 'resolved' },
   * });
   * ```
   */
  async command(options: RawQueryOptions): Promise<void> {
    const startTime = Date.now();
    const clickhouse = getClickHouseClient();

    try {
      await clickhouse.command({
        query: options.query,
        query_params: options.params,
      });

      const executionTimeMs = Date.now() - startTime;
      if (executionTimeMs > SLOW_QUERY_THRESHOLD_MS) {
        logger.warn('Slow command detected', {
          executionTimeMs,
          query: options.query.substring(0, 200),
        });
      }
    } catch (error) {
      logger.error('ClickHouse command failed', {
        error: error instanceof Error ? error.message : String(error),
        query: options.query.substring(0, 500),
      });
      throw error;
    }
  }

  /**
   * Batch insert rows into a ClickHouse table.
   * Used by workers for high-throughput data ingestion.
   *
   * @example
   * ```typescript
   * await optic.insert({
   *   table: 'argus.errors',
   *   values: normalizedEvents,
   *   format: 'JSONEachRow',
   * });
   * ```
   */
  async insert<T>(options: InsertOptions<T>): Promise<void> {
    const startTime = Date.now();
    const clickhouse = getClickHouseClient();

    try {
      await clickhouse.insert({
        table: options.table,
        values: options.values,
        format: options.format || 'JSONEachRow',
      });

      const executionTimeMs = Date.now() - startTime;
      if (executionTimeMs > SLOW_QUERY_THRESHOLD_MS) {
        logger.warn('Slow insert detected', {
          table: options.table,
          rowCount: options.values.length,
          executionTimeMs,
        });
      }
    } catch (error) {
      logger.error('ClickHouse insert failed', {
        table: options.table,
        rowCount: options.values.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Test ClickHouse connectivity.
   * Returns true if the connection is healthy.
   */
  async testConnection(): Promise<boolean> {
    return testClickHouseConnection();
  }

  /**
   * Initialize ClickHouse database and run migrations.
   */
  async initDatabase(): Promise<void> {
    return initClickHouseDatabase();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: Execute a query against ClickHouse
  // ─────────────────────────────────────────────────────────────────────────

  private async executeQuery<T>(
    sql: string,
    params: Record<string, any>,
    datasetName: string,
  ): Promise<OpticResult<T>> {
    const startTime = Date.now();
    const clickhouse = getClickHouseClient();

    try {
      const result = await clickhouse.query({
        query: sql,
        query_params: params,
        format: 'JSONEachRow',
      });

      const data = await result.json() as T[];

      const executionTimeMs = Date.now() - startTime;

      const meta: QueryMeta = {
        executionTimeMs,
        rowsRead: 0,
        bytesRead: 0,
      };

      // Include SQL in dev mode for debugging
      if (isDev()) {
        meta.sql = sql;
        meta.params = params;
      }

      // Slow query warning
      if (executionTimeMs > SLOW_QUERY_THRESHOLD_MS) {
        logger.warn('Slow query detected', {
          dataset: datasetName,
          executionTimeMs,
          rowsRead: meta.rowsRead,
          sql: sql.substring(0, 200),
        });
      }

      return {
        data,
        meta,
      };
    } catch (error) {
      logger.error('ClickHouse query failed', {
        dataset: datasetName,
        error: error instanceof Error ? error.message : String(error),
        sql: sql.substring(0, 500),
      });
      throw error;
    }
  }
}
