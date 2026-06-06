import { OpticClient } from '../client';

// ?????????????????????????????????????????????????????????????????????????????
// Mock ClickHouse client
// ?????????????????????????????????????????????????????????????????????????????

const mockJson = jest.fn();
const mockQuery = jest.fn().mockResolvedValue({ json: mockJson });

jest.mock('../config/clickhouse', () => ({
  getClickHouseClient: () => ({
    query: mockQuery,
  }),
}));

// ?????????????????????????????????????????????????????????????????????????????
// OpticClient Unit Tests
// ?????????????????????????????????????????????????????????????????????????????

describe('OpticClient', () => {
  let client: OpticClient;

  beforeEach(() => {
    client = new OpticClient();
    mockQuery.mockClear();
    mockJson.mockClear();
    mockJson.mockResolvedValue([{ count: 42 }]);
  });

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??  // query()
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  describe('query()', () => {
    it('should execute a query and return result with metadata', async () => {
      const result = await client.query<{ count: number }>({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '24h' },
        select: [{ field: 'count()', alias: 'count' }],
      });

      expect(result.data).toEqual([{ count: 42 }]);
      expect(result.meta.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.meta.rowsRead).toBe(0);
      expect(result.meta.bytesRead).toBe(0);
    });

    it('should pass SQL and params to ClickHouse', async () => {
      await client.query({
        dataset: 'errors',
        projectId: 'proj-test',
        timeRange: { period: '1h' },
        select: [{ field: 'count()' }],
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const callArgs = mockQuery.mock.calls[0][0];
      expect(callArgs.query).toContain('SELECT count()');
      expect(callArgs.query).toContain('FROM argus.errors');
      expect(callArgs.query_params).toBeDefined();
      // Project ID should be in params
      const pidValue = Object.values(callArgs.query_params).find(
        (v) => v === 'proj-test'
      );
      expect(pidValue).toBeDefined();
    });

    it('should handle ClickHouse errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('ClickHouse timeout'));

      await expect(
        client.query({
          dataset: 'errors',
          projectId: 'p1',
          timeRange: { period: '1h' },
          select: [{ field: 'count()' }],
        })
      ).rejects.toThrow('ClickHouse timeout');
    });

    it('should handle missing statistics gracefully', async () => {
      mockJson.mockResolvedValueOnce([{ total: 10 }]);

      const result = await client.query({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '1h' },
        select: [{ field: 'count()', alias: 'total' }],
      });

      expect(result.data).toEqual([{ total: 10 }]);
      expect(result.meta.rowsRead).toBe(0);
      expect(result.meta.bytesRead).toBe(0);
    });
  });

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??  // queryBatch()
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  describe('queryBatch()', () => {
    it('should execute multiple queries in parallel', async () => {
      mockJson
        .mockResolvedValueOnce([{ errors: 10 }])
        .mockResolvedValueOnce([{ txns: 200 }]);

      const results = await client.queryBatch({
        errorCount: {
          dataset: 'errors',
          projectId: 'p1',
          timeRange: { period: '1h' },
          select: [{ field: 'count()', alias: 'errors' }],
        },
        txnCount: {
          dataset: 'transactions',
          projectId: 'p1',
          timeRange: { period: '1h' },
          select: [{ field: 'count()', alias: 'txns' }],
        },
      });

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(results.errorCount.data).toEqual([{ errors: 10 }]);
      expect(results.txnCount.data).toEqual([{ txns: 200 }]);
    });

    it('should maintain correct key mapping', async () => {
      mockJson
        .mockResolvedValueOnce([{ a: 1 }])
        .mockResolvedValueOnce([{ b: 2 }])
        .mockResolvedValueOnce([{ c: 3 }]);

      const results = await client.queryBatch({
        first: {
          dataset: 'errors',
          projectId: 'p1',
          timeRange: { period: '1h' },
          select: [{ field: 'count()', alias: 'a' }],
        },
        second: {
          dataset: 'errors',
          projectId: 'p1',
          timeRange: { period: '1h' },
          select: [{ field: 'count()', alias: 'b' }],
        },
        third: {
          dataset: 'errors',
          projectId: 'p1',
          timeRange: { period: '1h' },
          select: [{ field: 'count()', alias: 'c' }],
        },
      });

      expect(Object.keys(results)).toEqual(['first', 'second', 'third']);
    });
  });

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??  // rawQuery()
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  describe('rawQuery()', () => {
    it('should execute raw SQL directly', async () => {
      mockJson.mockResolvedValueOnce([{ op: 'db', count: 50 }]);

      const result = await client.rawQuery<{ op: string; count: number }>({
        query:
          'SELECT op, count() AS count FROM argus.spans WHERE project_id = {pid:String} GROUP BY op',
        params: { pid: 'p1' },
      });

      expect(result.data).toEqual([{ op: 'db', count: 50 }]);
      expect(mockQuery).toHaveBeenCalledWith({
        query: expect.stringContaining('SELECT op, count()'),
        query_params: { pid: 'p1' },
        format: 'JSONEachRow',
      });
    });
  });

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??  // queryTagDistribution()
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  describe('queryTagDistribution()', () => {
    it('should group results by tag key', async () => {
      mockJson.mockResolvedValueOnce([
        { tag_key: 'browser_name', tag_value: 'Chrome', count: '100' },
        { tag_key: 'browser_name', tag_value: 'Firefox', count: '50' },
        { tag_key: 'os_name', tag_value: 'Windows', count: '80' },
        { tag_key: 'os_name', tag_value: 'macOS', count: '60' },
      ]);

      const result = await client.queryTagDistribution({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '7d' },
        tags: ['browser_name', 'os_name'],
        limit: 5,
      });

      expect(result.browser_name).toEqual([
        { value: 'Chrome', count: 100 },
        { value: 'Firefox', count: 50 },
      ]);
      expect(result.os_name).toEqual([
        { value: 'Windows', count: 80 },
        { value: 'macOS', count: 60 },
      ]);
    });

    it('should return empty arrays for tags with no data', async () => {
      mockJson.mockResolvedValueOnce([
        { tag_key: 'level', tag_value: 'error', count: '10' },
      ]);

      const result = await client.queryTagDistribution({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '1h' },
        tags: ['level', 'browser_name'],
      });

      expect(result.level).toHaveLength(1);
      expect(result.browser_name).toEqual([]);
    });

    it('should convert count strings to numbers', async () => {
      mockJson.mockResolvedValueOnce([
        { tag_key: 'level', tag_value: 'error', count: '12345' },
      ]);

      const result = await client.queryTagDistribution({
        dataset: 'errors',
        projectId: 'p1',
        timeRange: { period: '1h' },
        tags: ['level'],
      });

      expect(result.level[0].count).toBe(12345);
      expect(typeof result.level[0].count).toBe('number');
    });
  });
});
