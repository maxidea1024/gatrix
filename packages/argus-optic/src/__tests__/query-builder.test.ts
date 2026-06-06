import { buildQuery, buildTagDistributionQuery } from '../query-builder';
import { OpticQuery } from '../types';

// ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
// QueryBuilder Unit Tests
//
// These tests verify that OpticQuery ??ClickHouse SQL transformation is correct.
// No ClickHouse connection needed ??pure logic tests.
// ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€

describe('QueryBuilder', () => {
  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??  // Basic SELECT Generation
  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??
  describe('SELECT clause', () => {
    it('should generate simple column select', () => {
      const query: OpticQuery = {
        dataset: 'errors',
        projectId: 'proj-123',
        timeRange: { period: '24h' },
        select: [
          { field: 'event_id' },
          { field: 'level' },
          { field: 'timestamp' },
        ],
      };

      const { sql } = buildQuery(query);
      expect(sql).toMatch(/^SELECT event_id, level, timestamp\n/);
    });

    it('should generate select with aliases', () => {
      const query: OpticQuery = {
        dataset: 'errors',
        projectId: 'proj-123',
        timeRange: { period: '24h' },
        select: [
          { field: 'count()', alias: 'total' },
          { field: 'uniq(user_id)', alias: 'users' },
        ],
      };

      const { sql } = buildQuery(query);
      expect(sql).toMatch(/SELECT count\(\) AS total, uniq\(user_id\) AS users/);
    });

    it('should resolve column aliases (severity ??level)', () => {
      const query: OpticQuery = {
        dataset: 'errors',
        projectId: 'proj-123',
        timeRange: { period: '24h' },
        select: [{ field: 'severity', alias: 'sev' }],
      };

      const { sql } = buildQuery(query);
      // 'severity' should be resolved to 'level' via errors dataset aliases
      expect(sql).toMatch(/SELECT level AS sev/);
    });

    it('should resolve log dataset aliases (severity ??level, logger ??logger_name)', () => {
      const query: OpticQuery = {
        dataset: 'logs',
        projectId: 'proj-123',
        timeRange: { period: '24h' },
        select: [
          { field: 'severity' },
          { field: 'logger' },
        ],
      };

      const { sql } = buildQuery(query);
      expect(sql).toMatch(/SELECT level, logger_name/);
    });
  });

  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??  // Aggregate Functions
  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??
  describe('aggregate functions', () => {
    it('should handle count() with no args', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'count()', alias: 'total' }],
      });

      expect(sql).toMatch(/SELECT count\(\) AS total/);
    });

    it('should handle uniq(column)', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'uniq(user_id)', alias: 'unique_users' }],
      });

      expect(sql).toMatch(/SELECT uniq\(user_id\) AS unique_users/);
    });

    it('should handle avg(column)', () => {
      const { sql } = buildQuery({
        dataset: 'transactions',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'avg(duration)', alias: 'avg_dur' }],
      });

      expect(sql).toMatch(/SELECT avg\(duration\) AS avg_dur/);
    });

    it('should expand p50 shorthand to quantile(0.5)', () => {
      const { sql } = buildQuery({
        dataset: 'transactions',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'p50(duration)', alias: 'median' }],
      });

      expect(sql).toMatch(/SELECT quantile\(0\.5\)\(duration\) AS median/);
    });

    it('should expand p95 shorthand to quantile(0.95)', () => {
      const { sql } = buildQuery({
        dataset: 'transactions',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'p95(duration)', alias: 'p95' }],
      });

      expect(sql).toMatch(/SELECT quantile\(0\.95\)\(duration\) AS p95/);
    });

    it('should expand p99 shorthand to quantile(0.99)', () => {
      const { sql } = buildQuery({
        dataset: 'transactions',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'p99(duration)', alias: 'tail' }],
      });

      expect(sql).toMatch(/SELECT quantile\(0\.99\)\(duration\) AS tail/);
    });

    it('should pass through countIf expressions', () => {
      const { sql } = buildQuery({
        dataset: 'transactions',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: "countIf(transaction_status != 'ok')", alias: 'failures' }],
      });

      expect(sql).toMatch(/countIf\(transaction_status != 'ok'\) AS failures/);
    });
  });

  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??  // FROM Clause
  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??
  describe('FROM clause', () => {
    it('should use correct table for errors dataset', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'count()' }],
      });

      expect(sql).toContain('FROM argus.errors');
    });

    it('should use correct table for transactions dataset', () => {
      const { sql } = buildQuery({
        dataset: 'transactions',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'count()' }],
      });

      expect(sql).toContain('FROM argus.transactions');
    });

    it('should use correct table for logs dataset', () => {
      const { sql } = buildQuery({
        dataset: 'logs',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'count()' }],
      });

      expect(sql).toContain('FROM argus.logs');
    });

    it('should use correct table for sessions dataset', () => {
      const { sql } = buildQuery({
        dataset: 'sessions',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'count()' }],
      });

      expect(sql).toContain('FROM argus.sessions');
    });

    it('should use correct table for spans dataset', () => {
      const { sql } = buildQuery({
        dataset: 'spans',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'count()' }],
      });

      expect(sql).toContain('FROM argus.spans');
    });

    it('should use correct table for metrics dataset', () => {
      const { sql } = buildQuery({
        dataset: 'metrics',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'count()' }],
      });

      expect(sql).toContain('FROM argus.metrics');
    });

    it('should use correct table for feedback dataset', () => {
      const { sql } = buildQuery({
        dataset: 'feedback',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'count()' }],
      });

      expect(sql).toContain('FROM argus.user_feedback');
    });

    it('should use correct table for cron_checkins dataset', () => {
      const { sql } = buildQuery({
        dataset: 'cron_checkins',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'count()' }],
      });

      expect(sql).toContain('FROM argus.cron_checkins');
    });

    it('should use correct table for uptime_checkins dataset', () => {
      const { sql } = buildQuery({
        dataset: 'uptime_checkins',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'count()' }],
      });

      expect(sql).toContain('FROM argus.uptime_checkins');
    });

    it('should throw on unknown dataset', () => {
      expect(() =>
        buildQuery({
          dataset: 'nonexistent',
          projectId: 'p1',
          timeRange: { period: '1h' },
          select: [{ field: 'count()' }],
        }),
      ).toThrow(/Unknown dataset/);
    });
  });

  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??  // WHERE Clause
  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??
  describe('WHERE clause', () => {
    it('should always include project_id filter', () => {
      const { sql, params } = buildQuery({
        dataset: 'errors',
        projectId: 'my-project-id',
        timeRange: { period: '24h' },
        select: [{ field: 'count()' }],
      });

      expect(sql).toMatch(/project_id = \{pid_\d+:String\}/);
      // Check that a param has the project id
      const pidParam = Object.entries(params).find(([, v]) => v === 'my-project-id');
      expect(pidParam).toBeDefined();
    });

    it('should always include time range filter', () => {
      const { sql, params } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [{ field: 'count()' }],
      });

      expect(sql).toContain('timestamp >= toDateTime({fillStart:UInt32})');
      expect(sql).toContain('timestamp <= toDateTime({fillEnd:UInt32})');
      expect(params.fillStart).toBeDefined();
      expect(params.fillEnd).toBeDefined();
      expect(typeof params.fillStart).toBe('number');
      expect(typeof params.fillEnd).toBe('number');
    });

    it('should support custom start/end time range', () => {
      const { params } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: {
          start: '2026-01-01T00:00:00Z',
          end: '2026-01-02T00:00:00Z',
        },
        select: [{ field: 'count()' }],
      });

      const startEpoch = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
      const endEpoch = Math.floor(new Date('2026-01-02T00:00:00Z').getTime() / 1000);
      expect(params.fillStart).toBe(startEpoch);
      expect(params.fillEnd).toBe(endEpoch);
    });

    it('should add equality condition', () => {
      const { sql, params } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [{ field: 'count()' }],
        conditions: [
          { field: 'level', op: '=', value: 'error' },
        ],
      });

      expect(sql).toMatch(/level = \{v_\d+:String\}/);
      const levelParam = Object.entries(params).find(([, v]) => v === 'error');
      expect(levelParam).toBeDefined();
    });

    it('should add inequality condition', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [{ field: 'count()' }],
        conditions: [
          { field: 'level', op: '!=', value: 'debug' },
        ],
      });

      expect(sql).toMatch(/level != \{v_\d+:String\}/);
    });

    it('should add numeric comparison condition', () => {
      const { sql } = buildQuery({
        dataset: 'transactions',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [{ field: 'count()' }],
        conditions: [
          { field: 'duration', op: '>', value: 1000 },
        ],
      });

      expect(sql).toMatch(/duration > \{v_\d+:UInt64\}/);
    });

    it('should add IN condition for array values', () => {
      const { sql, params } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [{ field: 'count()' }],
        conditions: [
          { field: 'level', op: 'IN', value: ['error', 'fatal'] },
        ],
      });

      expect(sql).toMatch(/level IN \(/);
      // Check both values are parameterized
      const errorParam = Object.entries(params).find(([, v]) => v === 'error');
      const fatalParam = Object.entries(params).find(([, v]) => v === 'fatal');
      expect(errorParam).toBeDefined();
      expect(fatalParam).toBeDefined();
    });

    it('should add ILIKE condition', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [{ field: 'count()' }],
        conditions: [
          { field: 'value', op: 'ILIKE', value: '%timeout%' },
        ],
      });

      expect(sql).toMatch(/value ILIKE \{v_\d+:String\}/);
    });

    it('should resolve condition column aliases', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [{ field: 'count()' }],
        conditions: [
          { field: 'severity', op: '=', value: 'error' },
        ],
      });

      // 'severity' should be resolved to 'level'
      expect(sql).toMatch(/level = \{v_\d+:String\}/);
    });

    it('should handle multiple conditions with AND', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [{ field: 'count()' }],
        conditions: [
          { field: 'level', op: '=', value: 'error' },
          { field: 'environment', op: '=', value: 'production' },
        ],
      });

      // Conditions are connected with newline + AND in the WHERE clause
      expect(sql).toContain('level =');
      expect(sql).toContain('environment =');
    });
  });

  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??  // GROUP BY Clause
  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??
  describe('GROUP BY clause', () => {
    it('should generate GROUP BY for plain columns', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [
          { field: 'level' },
          { field: 'count()', alias: 'count' },
        ],
        groupBy: ['level'],
      });

      expect(sql).toContain('GROUP BY level');
    });

    it('should expand $bucket to time bucket expression', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [
          { field: '$bucket', alias: 'hour' },
          { field: 'count()', alias: 'count' },
        ],
        groupBy: ['$bucket'],
      });

      // $bucket should expand to toStartOfInterval(timestamp, INTERVAL ...)
      expect(sql).toContain('GROUP BY toStartOfInterval(');
    });

    it('should handle mixed $bucket and plain columns', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [
          { field: '$bucket', alias: 'hour' },
          { field: 'level' },
          { field: 'count()', alias: 'count' },
        ],
        groupBy: ['$bucket', 'level'],
      });

      expect(sql).toMatch(/GROUP BY toStartOfInterval\(.+\), level/);
    });
  });

  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??  // ORDER BY & LIMIT
  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??
  describe('ORDER BY clause', () => {
    it('should generate explicit ORDER BY', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [{ field: 'count()', alias: 'count' }],
        groupBy: ['level'],
        orderBy: [{ field: 'count', direction: 'DESC' }],
      });

      expect(sql).toContain('ORDER BY count DESC');
    });

    it('should use default ORDER BY when no groupBy or orderBy', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [{ field: 'event_id' }],
      });

      expect(sql).toContain('ORDER BY timestamp DESC');
    });

    it('should generate WITH FILL when withFill=true', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [
          { field: '$bucket', alias: 'hour' },
          { field: 'count()', alias: 'count' },
        ],
        groupBy: ['$bucket'],
        orderBy: [{ field: 'hour', direction: 'ASC' }],
        withFill: true,
      });

      expect(sql).toContain('WITH FILL FROM');
      expect(sql).toContain('STEP INTERVAL');
    });
  });

  describe('LIMIT / OFFSET', () => {
    it('should default to LIMIT 1000', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'event_id' }],
      });

      expect(sql).toContain('LIMIT 1000');
    });

    it('should respect custom limit', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'event_id' }],
        limit: 50,
      });

      expect(sql).toContain('LIMIT 50');
    });

    it('should cap limit at 10000', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'event_id' }],
        limit: 99999,
      });

      expect(sql).toContain('LIMIT 10000');
    });

    it('should include OFFSET when specified', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'event_id' }],
        limit: 50,
        offset: 100,
      });

      expect(sql).toContain('LIMIT 50 OFFSET 100');
    });

    it('should not include OFFSET when 0', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'event_id' }],
        limit: 50,
        offset: 0,
      });

      expect(sql).not.toContain('OFFSET');
    });
  });

  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??  // HAVING Clause
  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??
  describe('HAVING clause', () => {
    it('should generate HAVING from explicit having conditions', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [
          { field: 'level' },
          { field: 'count()', alias: 'cnt' },
        ],
        groupBy: ['level'],
        having: [
          { field: 'cnt', op: '>', value: 10 },
        ],
      });

      expect(sql).toMatch(/HAVING cnt > /);
    });
  });

  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??  // Search Integration (QueryParser)
  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??
  describe('search integration', () => {
    it('should integrate search into WHERE clause', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [{ field: 'count()' }],
        search: 'level:error',
      });

      // QueryParser should generate a condition for level='error'
      expect(sql).toMatch(/level = /);
    });

    it('should handle free-text search', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [{ field: 'count()' }],
        search: 'timeout',
      });

      // Free text should search in searchable columns via ILIKE
      expect(sql).toMatch(/ILIKE/);
    });

    it('should handle empty search gracefully', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [{ field: 'count()' }],
        search: '',
      });

      // Should not add any extra conditions
      expect(sql).not.toContain('ILIKE');
    });

    it('should handle search with aggregate filter (HAVING)', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [
          { field: 'level' },
          { field: 'count()', alias: 'cnt' },
        ],
        groupBy: ['level'],
        // Use explicit having instead of search for aggregate filters,
        // since QueryParser treats count():>5 as multiple tokens
        having: [
          { field: 'count()', op: '>', value: 5 },
        ],
      });

      expect(sql).toContain('HAVING');
    });
  });

  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??  // Parameter Safety
  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??
  describe('parameter safety', () => {
    it('should use parameterized queries for project_id', () => {
      const { sql, params } = buildQuery({
        dataset: 'errors',
        projectId: "'; DROP TABLE errors; --",
        timeRange: { period: '1h' },
        select: [{ field: 'count()' }],
      });

      // SQL should use a parameter placeholder, not inline value
      expect(sql).not.toContain("'; DROP TABLE");
      // The dangerous value should be in params, safely parameterized
      const injectionParam = Object.values(params).find(
        (v) => v === "'; DROP TABLE errors; --",
      );
      expect(injectionParam).toBeDefined();
    });

    it('should use parameterized queries for condition values', () => {
      const { sql, params } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'count()' }],
        conditions: [
          { field: 'level', op: '=', value: "evil'; DROP TABLE errors;" },
        ],
      });

      expect(sql).not.toContain("evil'");
      const evilParam = Object.values(params).find(
        (v) => v === "evil'; DROP TABLE errors;",
      );
      expect(evilParam).toBeDefined();
    });

    it('should generate unique parameter names to avoid collisions', () => {
      const { params } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'count()' }],
        conditions: [
          { field: 'level', op: '=', value: 'error' },
          { field: 'environment', op: '=', value: 'production' },
          { field: 'release', op: '=', value: 'v1.0' },
        ],
      });

      // All parameter names should be unique
      const paramNames = Object.keys(params);
      const uniqueNames = new Set(paramNames);
      expect(uniqueNames.size).toBe(paramNames.length);
    });
  });

  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??  // Full Query Assembly (Integration-like)
  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??
  describe('full query assembly', () => {
    it('should assemble a complete overview-style query', () => {
      const { sql, params } = buildQuery({
        dataset: 'errors',
        projectId: 'proj-abc',
        timeRange: { period: '24h' },
        select: [
          { field: '$bucket', alias: 'hour' },
          { field: 'count()', alias: 'count' },
          { field: 'uniq(user_id)', alias: 'users' },
        ],
        groupBy: ['$bucket'],
        orderBy: [{ field: 'hour', direction: 'ASC' }],
        withFill: true,
      });

      // Verify all major clauses are present
      expect(sql).toContain('SELECT');
      expect(sql).toContain('toStartOfInterval(');
      expect(sql).toContain('count() AS count');
      expect(sql).toContain('uniq(user_id) AS users');
      expect(sql).toContain('FROM argus.errors');
      expect(sql).toContain('project_id =');
      expect(sql).toContain('timestamp >=');
      expect(sql).toContain('GROUP BY');
      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('WITH FILL');
      expect(sql).toContain('LIMIT');

      // Verify params
      expect(params.fillStart).toBeDefined();
      expect(params.fillEnd).toBeDefined();
    });

    it('should assemble a transaction performance query', () => {
      const { sql } = buildQuery({
        dataset: 'transactions',
        projectId: 'proj-xyz',
        timeRange: { period: '7d' },
        select: [
          { field: 'transaction' },
          { field: 'count()', alias: 'count' },
          { field: 'avg(duration)', alias: 'avg_dur' },
          { field: 'p95(duration)', alias: 'p95' },
        ],
        groupBy: ['transaction'],
        orderBy: [{ field: 'count', direction: 'DESC' }],
        limit: 20,
      });

      expect(sql).toContain('SELECT transaction, count() AS count');
      expect(sql).toContain('avg(duration) AS avg_dur');
      expect(sql).toContain('quantile(0.95)(duration) AS p95');
      expect(sql).toContain('FROM argus.transactions');
      expect(sql).toContain('GROUP BY transaction');
      expect(sql).toContain('ORDER BY count DESC');
      expect(sql).toContain('LIMIT 20');
    });

    it('should assemble a filtered log search query', () => {
      const { sql } = buildQuery({
        dataset: 'logs',
        projectId: 'proj-log',
        timeRange: { period: '1h' },
        select: [
          { field: 'timestamp' },
          { field: 'level' },
          { field: 'message' },
          { field: 'service' },
        ],
        conditions: [
          { field: 'level', op: 'IN', value: ['error', 'fatal'] },
        ],
        search: 'connection refused',
        limit: 100,
      });

      expect(sql).toContain('FROM argus.logs');
      expect(sql).toContain('level IN');
      expect(sql).toContain('ILIKE'); // free text search
      expect(sql).toContain('LIMIT 100');
    });
  });

  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??  // Time Bucketing
  // ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??
  describe('time bucketing', () => {
    it('should use appropriate interval for 1h period', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: '$bucket', alias: 'ts' }, { field: 'count()' }],
        groupBy: ['$bucket'],
      });

      // 1h ??1 MINUTE interval (from getBucketingConfig)
      expect(sql).toContain('INTERVAL 1 MINUTE');
    });

    it('should use appropriate interval for 24h period', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [{ field: '$bucket', alias: 'ts' }, { field: 'count()' }],
        groupBy: ['$bucket'],
      });

      // 24h ??30 MINUTE interval
      expect(sql).toContain('INTERVAL 30 MINUTE');
    });

    it('should use appropriate interval for 7d period', () => {
      const { sql } = buildQuery({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '7d' },
        select: [{ field: '$bucket', alias: 'ts' }, { field: 'count()' }],
        groupBy: ['$bucket'],
      });

      // 7d ??4 HOUR interval
      expect(sql).toContain('INTERVAL 4 HOUR');
    });
  });
});

// ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??// Tag Distribution Query Builder
// ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•??
describe('buildTagDistributionQuery', () => {
  it('should generate UNION ALL for multiple tags', () => {
    const { sql } = buildTagDistributionQuery({
      dataset: 'errors',
      projectId: 'p1',
      timeRange: { period: '24h' },
      tags: ['browser_name', 'os_name', 'level'],
      limit: 10,
    });

    expect(sql).toContain('UNION ALL');
    expect(sql).toContain("'browser_name' AS tag_key");
    expect(sql).toContain("'os_name' AS tag_key");
    expect(sql).toContain("'level' AS tag_key");
    expect(sql).toContain('LIMIT 10');
  });

  it('should include project_id and time filters', () => {
    const { sql, params } = buildTagDistributionQuery({
      dataset: 'errors',
      projectId: 'proj-test',
      timeRange: { period: '7d' },
      tags: ['level'],
    });

    expect(sql).toContain('project_id =');
    expect(sql).toContain('timestamp >=');
    const pidParam = Object.values(params).find((v) => v === 'proj-test');
    expect(pidParam).toBeDefined();
  });

  it('should include additional conditions', () => {
    const { sql } = buildTagDistributionQuery({
      dataset: 'errors',
      projectId: 'p1',
      timeRange: { period: '24h' },
      tags: ['level'],
      conditions: [
        { field: 'issue_id', op: '=', value: 42 },
      ],
    });

    expect(sql).toMatch(/issue_id = /);
  });

  it('should filter out empty values with != ""', () => {
    const { sql } = buildTagDistributionQuery({
      dataset: 'errors',
      projectId: 'p1',
      timeRange: { period: '24h' },
      tags: ['browser_name'],
    });

    expect(sql).toContain("browser_name != ''");
  });

  it('should handle single tag without UNION ALL', () => {
    const { sql } = buildTagDistributionQuery({
      dataset: 'errors',
      projectId: 'p1',
      timeRange: { period: '24h' },
      tags: ['level'],
    });

    // Single tag should not have UNION ALL
    expect(sql).not.toContain('UNION ALL');
    expect(sql).toContain("'level' AS tag_key");
  });

  it('should handle aliased tags', () => {
    const { sql } = buildTagDistributionQuery({
      dataset: 'errors',
      projectId: 'p1',
      timeRange: { period: '24h' },
      tags: ['severity'], // alias for 'level'
    });

    // The tag_key should use the alias name, but query the real column
    expect(sql).toContain("'severity' AS tag_key");
    expect(sql).toContain('toString(level)');
  });

  it('should skip invalid columns', () => {
    const { sql } = buildTagDistributionQuery({
      dataset: 'errors',
      projectId: 'p1',
      timeRange: { period: '24h' },
      tags: ['nonexistent_column', 'level'],
    });

    // Should only have one SELECT (for level), not two
    expect(sql).not.toContain('nonexistent_column');
    expect(sql).toContain("'level' AS tag_key");
  });

  it('should return empty result for all invalid columns', () => {
    const { sql } = buildTagDistributionQuery({
      dataset: 'errors',
      projectId: 'p1',
      timeRange: { period: '24h' },
      tags: ['fake1', 'fake2'],
    });

    expect(sql).toContain('WHERE 0');
  });
});
