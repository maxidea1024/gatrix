import { getDataset, hasDataset, getDatasetNames } from '../datasets';

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// Dataset Registry Unit Tests
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

describe('DatasetRegistry', () => {
  describe('getDataset', () => {
    it.each([
      ['errors', 'argus.errors'],
      ['transactions', 'argus.transactions'],
      ['spans', 'argus.spans'],
      ['sessions', 'argus.sessions'],
      ['logs', 'argus.logs'],
      ['metrics', 'argus.metrics'],
      ['feedback', 'argus.user_feedback'],
      ['cron_checkins', 'argus.cron_checkins'],
      ['uptime_checkins', 'argus.uptime_checkins'],
    ])('should return dataset "%s" with table "%s"', (name, expectedTable) => {
      const ds = getDataset(name);
      expect(ds.name).toBe(name);
      expect(ds.table).toBe(expectedTable);
    });

    it('should throw for unknown dataset', () => {
      expect(() => getDataset('nonexistent')).toThrow(/Unknown dataset/);
    });
  });

  describe('hasDataset', () => {
    it('should return true for registered datasets', () => {
      expect(hasDataset('errors')).toBe(true);
      expect(hasDataset('transactions')).toBe(true);
      expect(hasDataset('logs')).toBe(true);
    });

    it('should return false for unknown datasets', () => {
      expect(hasDataset('nonexistent')).toBe(false);
      expect(hasDataset('')).toBe(false);
    });
  });

  describe('getDatasetNames', () => {
    it('should return all 9 dataset names', () => {
      const names = getDatasetNames();
      expect(names).toHaveLength(9);
      expect(names).toContain('errors');
      expect(names).toContain('transactions');
      expect(names).toContain('spans');
      expect(names).toContain('sessions');
      expect(names).toContain('logs');
      expect(names).toContain('metrics');
      expect(names).toContain('feedback');
      expect(names).toContain('cron_checkins');
      expect(names).toContain('uptime_checkins');
    });
  });
});

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// Individual Dataset Schema Tests
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

describe('Dataset Schemas', () => {
  describe('errors dataset', () => {
    const ds = getDataset('errors');

    it('should have timestamp column', () => {
      expect(ds.timestampColumn).toBe('timestamp');
    });

    it('should have all expected columns', () => {
      const expectedColumns = [
        'event_id',
        'project_id',
        'issue_id',
        'timestamp',
        'received_at',
        'platform',
        'level',
        'logger',
        'type',
        'value',
        'mechanism',
        'fingerprint',
        'primary_hash',
        'exception',
        'stacktrace_frames',
        'breadcrumbs',
        'user_id',
        'user_email',
        'user_ip',
        'user_name',
        'environment',
        'release',
        'dist',
        'server_name',
        'transaction',
        'os_name',
        'os_version',
        'browser_name',
        'browser_version',
        'device_name',
        'device_family',
        'runtime_name',
        'runtime_version',
        'sdk_name',
        'sdk_version',
        'geo_country',
        'geo_city',
        'geo_region',
        'http_method',
        'http_url',
        'http_referer',
        'tags',
        'extra',
        'contexts',
        'is_handled',
        'is_symbolicated',
      ];
      for (const col of expectedColumns) {
        expect(ds.columns.has(col)).toBe(true);
      }
    });

    it('should have column aliases', () => {
      expect(ds.columnAliases.severity).toBe('level');
      expect(ds.columnAliases.message).toBe('value');
    });

    it('should have searchable columns', () => {
      expect(ds.searchableColumns).toContain('type');
      expect(ds.searchableColumns).toContain('value');
      expect(ds.searchableColumns).toContain('transaction');
      expect(ds.searchableColumns).toContain('http_url');
    });

    it('should mark LowCardinality columns', () => {
      expect(ds.columns.get('level')?.lowCardinality).toBe(true);
      expect(ds.columns.get('platform')?.lowCardinality).toBe(true);
      expect(ds.columns.get('environment')?.lowCardinality).toBe(true);
      expect(ds.columns.get('event_id')?.lowCardinality).toBeUndefined();
    });

    it('should have aggregates', () => {
      expect(ds.aggregates.has('count')).toBe(true);
      expect(ds.aggregates.has('uniq')).toBe(true);
      expect(ds.aggregates.has('avg')).toBe(true);
      expect(ds.aggregates.has('p95')).toBe(true);
    });

    it('should have materialized view config', () => {
      expect(ds.materializedViews).toHaveLength(1);
      expect(ds.materializedViews[0].table).toBe(
        'argus.error_frequency_hourly'
      );
    });
  });

  describe('transactions dataset', () => {
    const ds = getDataset('transactions');

    it('should have duration column as UInt64', () => {
      expect(ds.columns.get('duration')?.type).toBe('UInt64');
    });

    it('should have measurements as Map', () => {
      expect(ds.columns.get('measurements')?.type).toBe('Map(String,Float64)');
    });

    it('should have MV config', () => {
      expect(ds.materializedViews).toHaveLength(1);
      expect(ds.materializedViews[0].table).toBe(
        'argus.transaction_metrics_hourly'
      );
    });
  });

  describe('logs dataset', () => {
    const ds = getDataset('logs');

    it('should have aliases for severity and logger', () => {
      expect(ds.columnAliases.severity).toBe('level');
      expect(ds.columnAliases.logger).toBe('logger_name');
    });

    it('should have message and body as searchable', () => {
      expect(ds.searchableColumns).toContain('message');
      expect(ds.searchableColumns).toContain('body');
    });

    it('should have attributes as Map', () => {
      expect(ds.columns.get('attributes')?.type).toBe('Map(String,String)');
    });
  });

  describe('sessions dataset', () => {
    const ds = getDataset('sessions');

    it('should have duration as Nullable(UInt64)', () => {
      expect(ds.columns.get('duration')?.type).toBe('Nullable(UInt64)');
    });

    it('should have MV config', () => {
      expect(ds.materializedViews).toHaveLength(1);
      expect(ds.materializedViews[0].table).toBe('argus.session_health_daily');
    });
  });

  describe('feedback dataset', () => {
    const ds = getDataset('feedback');

    it('should use argus.user_feedback table', () => {
      expect(ds.table).toBe('argus.user_feedback');
    });

    it('should have columns from alter migrations', () => {
      expect(ds.columns.has('status')).toBe(true);
      expect(ds.columns.has('assigned_to')).toBe(true);
      expect(ds.columns.has('is_spam')).toBe(true);
      expect(ds.columns.has('attachments')).toBe(true);
      expect(ds.columns.has('resolved_at')).toBe(true);
    });
  });

  describe('monitor checkins datasets', () => {
    it('cron_checkins should have monitor_id', () => {
      const ds = getDataset('cron_checkins');
      expect(ds.columns.has('monitor_id')).toBe(true);
      expect(ds.columns.has('checkin_id')).toBe(true);
      expect(ds.columns.has('duration')).toBe(true);
    });

    it('uptime_checkins should have response_ms', () => {
      const ds = getDataset('uptime_checkins');
      expect(ds.columns.has('response_ms')).toBe(true);
      expect(ds.columns.has('status_code')).toBe(true);
      expect(ds.columns.has('error_message')).toBe(true);
    });
  });
});
