import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { mysqlPool } from '../config/mysql';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';

const logger = createLogger('argus-dashboards');

/* ─── Dashboard Presets ─── */

interface DashboardPreset {
  id: string;
  title: string;
  description: string;
  widgets: WidgetConfig[];
}

interface WidgetConfig {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'area' | 'number' | 'table' | 'pie';
  query: {
    fields: string[];
    conditions?: string;
    groupBy?: string[];
    orderBy?: string;
    limit?: number;
    period?: string;
    dataset?: 'errors' | 'spans' | 'logs' | 'metrics';
  };
  layout: { x: number; y: number; w: number; h: number };
}

const DASHBOARD_PRESETS: DashboardPreset[] = [
  {
    id: 'errors-overview',
    title: 'Errors Overview',
    description: 'Monitor error trends, top issues, and affected users',
    widgets: [
      {
        id: 'w1', title: 'Error Count', type: 'number',
        query: { fields: ['count()'], period: '24h' },
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w2', title: 'Unique Issues', type: 'number',
        query: { fields: ['uniq(primary_hash)'], period: '24h' },
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w3', title: 'Affected Users', type: 'number',
        query: { fields: ['uniq(user_id)'], period: '24h' },
        layout: { x: 6, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w4', title: 'Unhandled Rate', type: 'number',
        query: { fields: ['avg(is_handled)'], period: '24h' },
        layout: { x: 9, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w5', title: 'Errors Over Time', type: 'line',
        query: { fields: ['count()'], groupBy: ['timestamp'], period: '24h' },
        layout: { x: 0, y: 2, w: 8, h: 4 },
      },
      {
        id: 'w6', title: 'Errors by Level', type: 'pie',
        query: { fields: ['count()', 'level'], groupBy: ['level'], period: '24h' },
        layout: { x: 8, y: 2, w: 4, h: 4 },
      },
      {
        id: 'w7', title: 'Top Issues', type: 'table',
        query: { fields: ['count()', 'type', 'value'], groupBy: ['type', 'value'], orderBy: '-count', limit: 10, period: '24h' },
        layout: { x: 0, y: 6, w: 12, h: 4 },
      },
    ],
  },
  {
    id: 'frontend-health',
    title: 'Frontend Health',
    description: 'Browser and device error distribution',
    widgets: [
      {
        id: 'w1', title: 'Errors by Browser', type: 'bar',
        query: { fields: ['count()', 'browser'], groupBy: ['browser'], orderBy: '-count', limit: 10, period: '7d' },
        layout: { x: 0, y: 0, w: 6, h: 4 },
      },
      {
        id: 'w2', title: 'Errors by OS', type: 'bar',
        query: { fields: ['count()', 'os'], groupBy: ['os'], orderBy: '-count', limit: 10, period: '7d' },
        layout: { x: 6, y: 0, w: 6, h: 4 },
      },
      {
        id: 'w3', title: 'Errors by Platform', type: 'pie',
        query: { fields: ['count()', 'platform'], groupBy: ['platform'], orderBy: '-count', limit: 8, period: '7d' },
        layout: { x: 0, y: 4, w: 4, h: 4 },
      },
      {
        id: 'w4', title: 'Error Trend by Browser', type: 'line',
        query: { fields: ['count()', 'browser'], groupBy: ['browser', 'timestamp'], orderBy: '-count', limit: 5, period: '7d' },
        layout: { x: 4, y: 4, w: 8, h: 4 },
      },
    ],
  },
  {
    id: 'release-tracking',
    title: 'Release Tracking',
    description: 'Monitor errors across releases',
    widgets: [
      {
        id: 'w1', title: 'Errors by Release', type: 'bar',
        query: { fields: ['count()', 'release'], groupBy: ['release'], orderBy: '-count', limit: 10, period: '30d' },
        layout: { x: 0, y: 0, w: 8, h: 4 },
      },
      {
        id: 'w2', title: 'Users by Release', type: 'bar',
        query: { fields: ['uniq(user_id)', 'release'], groupBy: ['release'], orderBy: '-uniq_user_id', limit: 10, period: '30d' },
        layout: { x: 8, y: 0, w: 4, h: 4 },
      },
      {
        id: 'w3', title: 'Release Error Trend', type: 'line',
        query: { fields: ['count()', 'release'], groupBy: ['release', 'timestamp'], orderBy: '-count', limit: 5, period: '30d' },
        layout: { x: 0, y: 4, w: 12, h: 4 },
      },
    ],
  },
  {
    id: 'performance-overview',
    title: 'Performance Overview',
    description: 'Transaction latency and throughput metrics',
    widgets: [
      {
        id: 'w1', title: 'Total Transactions', type: 'number',
        query: { fields: ['count()'], period: '24h' },
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w2', title: 'Avg Duration', type: 'number',
        query: { fields: ['avg(duration)'], period: '24h' },
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w3', title: 'P95 Latency', type: 'number',
        query: { fields: ['p95(duration)'], period: '24h' },
        layout: { x: 6, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w4', title: 'Throughput', type: 'line',
        query: { fields: ['count()'], groupBy: ['timestamp'], period: '24h' },
        layout: { x: 0, y: 2, w: 12, h: 4 },
      },
    ],
  },
];

/* ─── Routes ─── */

export default async function dashboardRoutes(app: FastifyInstance) {

  // ─── Get Presets ───
  app.get(
    '/:projectId/dashboards/presets',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        data: DASHBOARD_PRESETS.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description,
          widgetCount: p.widgets.length,
        })),
      });
    }
  );

  // ─── Get Single Preset ───
  app.get(
    '/:projectId/dashboards/presets/:presetId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { presetId } = request.params as { presetId: string };
      const preset = DASHBOARD_PRESETS.find(p => p.id === presetId);
      if (!preset) return reply.code(404).send({ error: 'Preset not found' });
      return reply.send({ data: preset });
    }
  );

  // ─── List Dashboards ───
  app.get(
    '/:projectId/dashboards',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      try {
        const [rows] = await mysqlPool.query(
          `SELECT id, project_id, title, description, widgets_config, created_at, updated_at
           FROM g_argus_dashboards WHERE project_id = ? ORDER BY updated_at DESC`,
          [projectId]
        );
        return reply.send({ data: rows });
      } catch (error) {
        logger.error('Failed to list dashboards', { projectId, error: String(error) });
        return reply.code(500).send({ error: 'Failed to list dashboards' });
      }
    }
  );

  // ─── Get Single Dashboard ───
  app.get(
    '/:projectId/dashboards/:dashboardId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, dashboardId } = request.params as { projectId: string; dashboardId: string };
      try {
        const [rows] = await mysqlPool.query(
          `SELECT * FROM g_argus_dashboards WHERE id = ? AND project_id = ?`,
          [dashboardId, projectId]
        );
        const arr = rows as any[];
        if (arr.length === 0) return reply.code(404).send({ error: 'Dashboard not found' });
        const row = arr[0];
        row.widgets_config = typeof row.widgets_config === 'string' ? JSON.parse(row.widgets_config) : row.widgets_config;
        return reply.send({ data: row });
      } catch (error) {
        logger.error('Failed to get dashboard', { dashboardId, error: String(error) });
        return reply.code(500).send({ error: 'Failed to get dashboard' });
      }
    }
  );

  // ─── Create Dashboard ───
  app.post(
    '/:projectId/dashboards',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { title, description, widgets_config, preset_id } = request.body as {
        title: string; description?: string; widgets_config?: any; preset_id?: string;
      };

      try {
        let widgets = widgets_config || [];

        // If creating from preset, use preset widgets
        if (preset_id) {
          const preset = DASHBOARD_PRESETS.find(p => p.id === preset_id);
          if (preset) {
            widgets = preset.widgets;
          }
        }

        const [result] = await mysqlPool.query(
          `INSERT INTO g_argus_dashboards (project_id, title, description, widgets_config)
           VALUES (?, ?, ?, ?)`,
          [projectId, title, description || '', JSON.stringify(widgets)]
        );
        const insertId = (result as any).insertId;
        return reply.code(201).send({ data: { id: insertId, title, description, widgets_config: widgets } });
      } catch (error) {
        logger.error('Failed to create dashboard', { projectId, error: String(error) });
        return reply.code(500).send({ error: 'Failed to create dashboard' });
      }
    }
  );

  // ─── Update Dashboard ───
  app.put(
    '/:projectId/dashboards/:dashboardId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, dashboardId } = request.params as { projectId: string; dashboardId: string };
      const { title, description, widgets_config } = request.body as {
        title?: string; description?: string; widgets_config?: any;
      };

      try {
        const updates: string[] = [];
        const values: any[] = [];

        if (title !== undefined) { updates.push('title = ?'); values.push(title); }
        if (description !== undefined) { updates.push('description = ?'); values.push(description); }
        if (widgets_config !== undefined) { updates.push('widgets_config = ?'); values.push(JSON.stringify(widgets_config)); }

        if (updates.length === 0) return reply.code(400).send({ error: 'Nothing to update' });

        values.push(dashboardId, projectId);
        await mysqlPool.query(
          `UPDATE g_argus_dashboards SET ${updates.join(', ')}, updated_at = UTC_TIMESTAMP() WHERE id = ? AND project_id = ?`,
          values
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update dashboard', { dashboardId, error: String(error) });
        return reply.code(500).send({ error: 'Failed to update dashboard' });
      }
    }
  );

  // ─── Delete Dashboard ───
  app.delete(
    '/:projectId/dashboards/:dashboardId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, dashboardId } = request.params as { projectId: string; dashboardId: string };
      try {
        await mysqlPool.query(
          `DELETE FROM g_argus_dashboards WHERE id = ? AND project_id = ?`,
          [dashboardId, projectId]
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to delete dashboard', { dashboardId, error: String(error) });
        return reply.code(500).send({ error: 'Failed to delete dashboard' });
      }
    }
  );

  // ─── Execute Widget Query ───
  app.post(
    '/:projectId/dashboards/widget-query',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { query } = request.body as { query: WidgetConfig['query'] };

      try {
        const { fields = ['count()'], conditions, groupBy, orderBy, limit = 20, period = '24h', dataset = 'errors' } = query;

        const periodMap: Record<string, string> = {
          '1h': '1 HOUR', '6h': '6 HOUR', '12h': '12 HOUR', '24h': '24 HOUR',
          '7d': '7 DAY', '14d': '14 DAY', '30d': '30 DAY', '90d': '90 DAY',
        };
        const interval = periodMap[period] || '24 HOUR';

        // Determine table based on dataset
        const datasetTableMap: Record<string, string> = {
          errors: 'argus.errors',
          spans: 'argus.spans',
          logs: 'argus.logs',
          metrics: 'argus.metrics',
        };
        const tableName = datasetTableMap[dataset] || 'argus.errors';

        // Build simple query (reuse discover logic)
        const selectParts = fields.map(f => {
          const aggMatch = f.match(/^(\w+)\((\w*)\)$/);
          if (aggMatch) {
            const [, fn, col] = aggMatch;
            if (fn === 'count' && !col) return 'count() AS count';
            if (fn === 'uniq') return `uniq(${col || '*'}) AS uniq_${col || 'all'}`;
            if (['p50', 'p75', 'p95', 'p99'].includes(fn)) {
              const pct = parseInt(fn.replace('p', ''), 10);
              return `quantile(${pct / 100})(${col || 'timestamp'}) AS ${fn}_${col || 'timestamp'}`;
            }
            return `${fn}(${col || '*'}) AS ${fn}_${col || 'all'}`;
          }
          return f;
        });

        let sql = `SELECT ${selectParts.join(', ')} FROM ${tableName} WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval}`;

        if (conditions) {
          sql += ` AND ${conditions}`;
        }

        if (groupBy && groupBy.length > 0) {
          const safeCols = groupBy.filter(c => c !== 'timestamp');
          if (groupBy.includes('timestamp')) {
            safeCols.unshift('toStartOfHour(timestamp) AS hour');
          }
          if (safeCols.length > 0) sql += ` GROUP BY ${safeCols.map(c => c.startsWith('toStart') ? 'hour' : c).join(', ')}`;
        }

        if (orderBy) {
          const desc = orderBy.startsWith('-');
          const col = orderBy.replace(/^-/, '');
          sql += ` ORDER BY ${col} ${desc ? 'DESC' : 'ASC'}`;
        }

        sql += ` LIMIT ${Math.min(limit, 1000)}`;

        const result = await clickhouse.query({ query: sql, query_params: { projectId: String(projectId) } });
        const json = await result.json();

        return reply.send({ data: json.data || [] });
      } catch (error) {
        logger.error('Widget query failed', { projectId, error: String(error) });
        return reply.code(500).send({ error: 'Widget query failed' });
      }
    }
  );
}
