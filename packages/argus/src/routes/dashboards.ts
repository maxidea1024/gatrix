import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../config/knex';
import { optic, parseSearchToSQL, getDataset } from '@gatrix/argus-optic';
import { createLogger } from '../utils/logger';
import { getBucketingConfig } from '../utils/timeBucket';

const logger = createLogger('argus-dashboards');

/* ?�?�?� Dashboard Presets ?�?�?� */

interface DashboardPreset {
  id: string;
  title: string;
  description: string;
  widgets: WidgetConfig[];
}

type WidgetType =
  | 'time-series' | 'stat' | 'gauge' | 'bar-gauge'
  | 'pie' | 'horizontal-bar' | 'table' | 'top-list'
  | 'heatmap' | 'histogram' | 'scatter' | 'geo-map'
  | 'event-stream' | 'text' | 'treemap' | 'status-timeline'
  // Legacy types (accepted, normalized on frontend)
  | 'line' | 'bar' | 'area' | 'number';

interface WidgetConfig {
  id: string;
  title: string;
  description?: string;
  category?: 'discover' | 'insights' | 'funnels' | 'retention' | 'flows' | 'text';
  type: WidgetType;
  chart_style?: 'line' | 'bar' | 'area' | 'stacked-bar' | 'stacked-area';
  query: {
    fields: string[];
    conditions?: string;
    groupBy?: string[];
    orderBy?: string;
    limit?: number;
    offset?: number;
    period?: string;
    start?: string;
    end?: string;
    dataset?: 'errors' | 'transactions' | 'spans' | 'logs' | 'metrics';
    // Analytics widget support
    analytics_type?: 'insights' | 'funnels' | 'retention' | 'flows';
    analytics_config?: Record<string, any>;
  };
  layout: { x: number; y: number; w: number; h: number };
  viz_options?: Record<string, any>;
  data_transforms?: Record<string, any>[];
  field_overrides?: Record<string, any>[];
}

const DASHBOARD_PRESETS: DashboardPreset[] = [
  {
    id: 'errors-overview',
    title: 'Errors Overview',
    description: 'Monitor error trends, top issues, and affected users',
    widgets: [
      {
        id: 'w1',
        title: 'Error Count',
        type: 'stat',
        query: { fields: ['count()'], period: '14d' },
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w2',
        title: 'Unique Issues',
        type: 'stat',
        query: { fields: ['uniq(primary_hash)'], period: '14d' },
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w3',
        title: 'Affected Users',
        type: 'stat',
        query: { fields: ['uniq(user_id)'], period: '14d' },
        layout: { x: 6, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w4',
        title: 'Unhandled Rate',
        type: 'stat',
        query: { fields: ['avg(is_handled)'], period: '14d' },
        layout: { x: 9, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w5',
        title: 'Errors Over Time',
        type: 'time-series',
        chart_style: 'line',
        query: { fields: ['count()'], groupBy: ['timestamp'], period: '14d' },
        layout: { x: 0, y: 2, w: 8, h: 4 },
      },
      {
        id: 'w6',
        title: 'Errors by Level',
        type: 'pie',
        query: {
          fields: ['count()', 'level'],
          groupBy: ['level'],
          period: '14d',
        },
        layout: { x: 8, y: 2, w: 4, h: 4 },
      },
      {
        id: 'w7',
        title: 'Top Issues',
        type: 'table',
        query: {
          fields: ['count()', 'type', 'value'],
          groupBy: ['type', 'value'],
          orderBy: '-count',
          limit: 10,
          period: '14d',
        },
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
        id: 'w1',
        title: 'Errors by Browser',
        type: 'horizontal-bar',
        query: {
          fields: ['count()', 'browser_name'],
          groupBy: ['browser_name'],
          orderBy: '-count',
          limit: 10,
          period: '14d',
        },
        layout: { x: 0, y: 0, w: 6, h: 4 },
      },
      {
        id: 'w2',
        title: 'Errors by OS',
        type: 'horizontal-bar',
        query: {
          fields: ['count()', 'os_name'],
          groupBy: ['os_name'],
          orderBy: '-count',
          limit: 10,
          period: '14d',
        },
        layout: { x: 6, y: 0, w: 6, h: 4 },
      },
      {
        id: 'w3',
        title: 'Errors by Platform',
        type: 'pie',
        query: {
          fields: ['count()', 'platform'],
          groupBy: ['platform'],
          orderBy: '-count',
          limit: 8,
          period: '14d',
        },
        layout: { x: 0, y: 4, w: 4, h: 4 },
      },
      {
        id: 'w4',
        title: 'Error Trend by Browser',
        type: 'time-series',
        chart_style: 'line',
        query: {
          fields: ['count()', 'browser_name'],
          groupBy: ['browser_name', 'timestamp'],
          orderBy: '-count',
          limit: 5,
          period: '14d',
        },
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
        id: 'w1',
        title: 'Errors by Release',
        type: 'horizontal-bar',
        query: {
          fields: ['count()', 'release'],
          groupBy: ['release'],
          orderBy: '-count',
          limit: 10,
          period: '30d',
        },
        layout: { x: 0, y: 0, w: 8, h: 4 },
      },
      {
        id: 'w2',
        title: 'Users by Release',
        type: 'horizontal-bar',
        query: {
          fields: ['uniq(user_id)', 'release'],
          groupBy: ['release'],
          orderBy: '-uniq_user_id',
          limit: 10,
          period: '30d',
        },
        layout: { x: 8, y: 0, w: 4, h: 4 },
      },
      {
        id: 'w3',
        title: 'Release Error Trend',
        type: 'time-series',
        chart_style: 'line',
        query: {
          fields: ['count()', 'release'],
          groupBy: ['release', 'timestamp'],
          orderBy: '-count',
          limit: 5,
          period: '30d',
        },
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
        id: 'w1',
        title: 'Total Transactions',
        type: 'stat',
        query: { fields: ['count()'], period: '14d', dataset: 'transactions' },
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w2',
        title: 'Avg Duration',
        type: 'stat',
        viz_options: { unit: 'ms' },
        query: { fields: ['avg(duration)'], period: '14d', dataset: 'transactions' },
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w3',
        title: 'P95 Latency',
        type: 'stat',
        viz_options: { unit: 'ms' },
        query: { fields: ['p95(duration)'], period: '14d', dataset: 'transactions' },
        layout: { x: 6, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w4',
        title: 'Throughput',
        type: 'time-series',
        chart_style: 'area',
        query: { fields: ['count()'], groupBy: ['timestamp'], period: '14d', dataset: 'transactions' },
        layout: { x: 0, y: 2, w: 12, h: 4 },
      },
    ],
  },
  {
    id: 'geographic-errors',
    title: 'Geographic Errors',
    description: 'Error distribution by country and region',
    widgets: [
      {
        id: 'w1',
        title: 'Total Errors',
        type: 'stat',
        query: { fields: ['count()'], period: '14d' },
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w2',
        title: 'Affected Countries',
        type: 'stat',
        query: { fields: ['uniq(geo_country)'], period: '14d' },
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w3',
        title: 'Errors by Country',
        type: 'geo-map',
        query: {
          fields: ['count()', 'geo_country'],
          groupBy: ['geo_country'],
          orderBy: '-count',
          limit: 30,
          period: '14d',
        },
        viz_options: {
          geo: { country_field: 'geo_country', value_field: 'count' },
        },
        layout: { x: 0, y: 2, w: 6, h: 6 },
      },
      {
        id: 'w4',
        title: 'Top Countries',
        type: 'horizontal-bar',
        query: {
          fields: ['count()', 'geo_country'],
          groupBy: ['geo_country'],
          orderBy: '-count',
          limit: 10,
          period: '14d',
        },
        layout: { x: 6, y: 2, w: 6, h: 6 },
      },
      {
        id: 'w5',
        title: 'Error Trend by Region',
        type: 'time-series',
        chart_style: 'stacked-area',
        query: {
          fields: ['count()', 'geo_country'],
          groupBy: ['geo_country', 'timestamp'],
          orderBy: '-count',
          limit: 5,
          period: '14d',
        },
        layout: { x: 0, y: 8, w: 12, h: 4 },
      },
    ],
  },
  {
    id: 'logs-overview',
    title: 'Logs Overview',
    description: 'Log volume, levels, and event stream',
    widgets: [
      {
        id: 'w1',
        title: 'Total Logs',
        type: 'stat',
        query: { fields: ['count()'], period: '14d', dataset: 'logs' },
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w2',
        title: 'Unique Services',
        type: 'stat',
        query: { fields: ['uniq(service)'], period: '14d', dataset: 'logs' },
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w3',
        title: 'Error Rate',
        type: 'gauge',
        query: {
          fields: ['avg(CASE WHEN level IN (\'error\', \'fatal\') THEN 1 ELSE 0 END)'],
          period: '14d',
          dataset: 'logs',
        },
        viz_options: { unit: 'percent', max: 1 },
        layout: { x: 6, y: 0, w: 3, h: 2 },
      },
      {
        id: 'w4',
        title: 'Logs Over Time',
        type: 'time-series',
        chart_style: 'bar',
        query: {
          fields: ['count()', 'level'],
          groupBy: ['level', 'timestamp'],
          period: '14d',
          dataset: 'logs',
        },
        layout: { x: 0, y: 2, w: 8, h: 4 },
      },
      {
        id: 'w5',
        title: 'Logs by Level',
        type: 'pie',
        query: {
          fields: ['count()', 'level'],
          groupBy: ['level'],
          period: '14d',
          dataset: 'logs',
        },
        layout: { x: 8, y: 2, w: 4, h: 4 },
      },
      {
        id: 'w6',
        title: 'Recent Logs',
        type: 'event-stream',
        query: {
          fields: ['timestamp', 'level', 'service', 'message'],
          orderBy: '-timestamp',
          limit: 50,
          period: '14d',
          dataset: 'logs',
        },
        layout: { x: 0, y: 6, w: 12, h: 5 },
      },
    ],
  },
];

/* --- Routes --- */

export default async function dashboardRoutes(app: FastifyInstance) {
  // --- Get Presets ---
  app.get(
    '/:projectId/dashboards/presets',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        data: DASHBOARD_PRESETS.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          widgetCount: p.widgets.length,
        })),
      });
    }
  );

  // --- Get Single Preset ---
  app.get(
    '/:projectId/dashboards/presets/:presetId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { presetId } = request.params as { presetId: string };
      const preset = DASHBOARD_PRESETS.find((p) => p.id === presetId);
      if (!preset) return reply.code(404).send({ error: 'Preset not found' });
      return reply.send({ data: preset });
    }
  );

  // --- List Dashboards ---
  app.get(
    '/:projectId/dashboards',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      try {
        const rows = await db('g_argus_dashboards')
          .select(
            'id',
            'project_id',
            'title',
            'description',
            'widgets_config',
            'is_favorite',
            'owner_user_id',
            'visibility',
            'shared_with',
            'created_at',
            'updated_at'
          )
          .where('project_id', projectId)
          .orderBy([
            { column: 'is_favorite', order: 'desc' },
            { column: 'updated_at', order: 'desc' },
          ]);
        return reply.send({ data: rows });
      } catch (error) {
        logger.error('Failed to list dashboards', {
          projectId,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to list dashboards' });
      }
    }
  );

  // --- Get Single Dashboard ---
  app.get(
    '/:projectId/dashboards/:dashboardId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, dashboardId } = request.params as {
        projectId: string;
        dashboardId: string;
      };
      try {
        const rows = await db('g_argus_dashboards').where({
          id: dashboardId,
          project_id: projectId,
        });
        const arr = rows;
        if (arr.length === 0)
          return reply.code(404).send({ error: 'Dashboard not found' });
        const row = arr[0];
        row.widgets_config =
          typeof row.widgets_config === 'string'
            ? JSON.parse(row.widgets_config)
            : row.widgets_config;
        return reply.send({ data: row });
      } catch (error) {
        logger.error('Failed to get dashboard', {
          dashboardId,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to get dashboard' });
      }
    }
  );

  // --- Create Dashboard ---
  app.post(
    '/:projectId/dashboards',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { title, description, widgets_config, preset_id } =
        request.body as {
          title: string;
          description?: string;
          widgets_config?: any;
          preset_id?: string;
        };

      try {
        let widgets = widgets_config || [];
        let finalTitle = title;
        let finalDescription = description;

        // If creating from preset, use preset widgets and metadata
        if (preset_id) {
          const preset = DASHBOARD_PRESETS.find((p) => p.id === preset_id);
          if (preset) {
            widgets = preset.widgets;
            if (!finalTitle) finalTitle = preset.title;
            if (!finalDescription) finalDescription = preset.description;
          }
        }

        const ownerUserId = (request.headers['x-user-name'] as string) || null;

        const [insertId] = await db('g_argus_dashboards').insert({
          project_id: projectId,
          title: finalTitle || 'Untitled',
          description: finalDescription || '',
          widgets_config: JSON.stringify(widgets),
          owner_user_id: ownerUserId,
          visibility: 'project',
        });
        return reply.code(201).send({
          data: { id: insertId, title: finalTitle, description: finalDescription, widgets_config: widgets },
        });
      } catch (error) {
        logger.error('Failed to create dashboard', {
          projectId,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to create dashboard' });
      }
    }
  );

  // --- Update Dashboard ---
  app.put(
    '/:projectId/dashboards/:dashboardId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, dashboardId } = request.params as {
        projectId: string;
        dashboardId: string;
      };
      const { title, description, widgets_config } = request.body as {
        title?: string;
        description?: string;
        widgets_config?: any;
      };

      try {
        const updateObj: any = {};
        if (title !== undefined) updateObj.title = title;
        if (description !== undefined) updateObj.description = description;
        if (widgets_config !== undefined)
          updateObj.widgets_config = JSON.stringify(widgets_config);

        if (Object.keys(updateObj).length === 0)
          return reply.code(400).send({ error: 'Nothing to update' });

        updateObj.updated_at = db.fn.now();
        await db('g_argus_dashboards')
          .where({ id: dashboardId, project_id: projectId })
          .update(updateObj);
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update dashboard', {
          dashboardId,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to update dashboard' });
      }
    }
  );

  // --- Delete Dashboard ---
  app.delete(
    '/:projectId/dashboards/:dashboardId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, dashboardId } = request.params as {
        projectId: string;
        dashboardId: string;
      };
      try {
        // Verify ownership before deletion
        const dashboard = await db('g_argus_dashboards')
          .where({ id: dashboardId, project_id: projectId })
          .first();
        if (!dashboard) {
          return reply.code(404).send({ error: 'Dashboard not found' });
        }
        const currentUser = request.headers['x-user-name'] as string;
        if (dashboard.owner_user_id && currentUser && dashboard.owner_user_id !== currentUser) {
          return reply.code(403).send({ error: 'Only the owner can delete this dashboard' });
        }

        await db('g_argus_dashboards')
          .where({ id: dashboardId, project_id: projectId })
          .del();
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to delete dashboard', {
          dashboardId,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to delete dashboard' });
      }
    }
  );

  // --- Update Dashboard Visibility / Sharing ---
  app.patch(
    '/:projectId/dashboards/:dashboardId/sharing',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, dashboardId } = request.params as {
        projectId: string;
        dashboardId: string;
      };
      const { visibility, shared_with } = request.body as {
        visibility?: 'personal' | 'team' | 'project';
        shared_with?: string[];
      };

      try {
        // Verify ownership before changing sharing settings
        const dashboard = await db('g_argus_dashboards')
          .where({ id: dashboardId, project_id: projectId })
          .first();
        if (!dashboard) {
          return reply.code(404).send({ error: 'Dashboard not found' });
        }
        const currentUser = request.headers['x-user-name'] as string;
        if (dashboard.owner_user_id && currentUser && dashboard.owner_user_id !== currentUser) {
          return reply.code(403).send({ error: 'Only the owner can change sharing settings' });
        }

        // Validate visibility value
        if (visibility !== undefined && !['personal', 'team', 'project'].includes(visibility)) {
          return reply.code(400).send({ error: 'Invalid visibility value' });
        }

        const updateObj: any = {};
        if (visibility !== undefined) updateObj.visibility = visibility;
        if (shared_with !== undefined)
          updateObj.shared_with = JSON.stringify(shared_with);

        if (Object.keys(updateObj).length === 0)
          return reply.code(400).send({ error: 'Nothing to update' });

        updateObj.updated_at = db.fn.now();
        await db('g_argus_dashboards')
          .where({ id: dashboardId, project_id: projectId })
          .update(updateObj);

        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update sharing', {
          dashboardId,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to update sharing' });
      }
    }
  );

  // --- Toggle Dashboard Favorite ---
  app.patch(
    '/:projectId/dashboards/:dashboardId/favorite',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, dashboardId } = request.params as {
        projectId: string;
        dashboardId: string;
      };
      const { is_favorite } = request.body as { is_favorite: boolean };
      try {
        await db('g_argus_dashboards')
          .where({ id: dashboardId, project_id: projectId })
          .update({ is_favorite: is_favorite ? 1 : 0 });
        return reply.send({ success: true, is_favorite });
      } catch (error) {
        logger.error('Failed to toggle favorite', {
          dashboardId,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to toggle favorite' });
      }
    }
  );

  // --- Execute Widget Query ---
  app.post(
    '/:projectId/dashboards/widget-query',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { query } = request.body as { query: WidgetConfig['query'] };

      let sql = '';
      try {
        // -- Analytics widget: delegate to internal analytics API --
        if (query.analytics_type && query.analytics_config) {
          const analyticsRouteMap: Record<string, string> = {
            insights: `/argus/api/projects/${projectId}/analytics/insights`,
            funnels: `/argus/api/projects/${projectId}/analytics/funnels`,
            retention: `/argus/api/projects/${projectId}/analytics/retention`,
            flows: `/argus/api/projects/${projectId}/analytics/flows`,
          };
          const route = analyticsRouteMap[query.analytics_type];
          if (!route) {
            return reply.code(400).send({ error: `Unknown analytics_type: ${query.analytics_type}` });
          }

          // Inject period/start/end from widget query into analytics config
          const analyticsBody = {
            ...query.analytics_config,
            period: query.period || query.analytics_config.period || '14d',
            start: query.start || query.analytics_config.start,
            end: query.end || query.analytics_config.end,
          };

          const internalResponse = await app.inject({
            method: 'POST',
            url: route,
            payload: analyticsBody,
            headers: {
              'content-type': 'application/json',
              ...(request.headers.authorization
                ? { authorization: request.headers.authorization as string }
                : {}),
              ...(request.headers['x-user-name']
                ? { 'x-user-name': request.headers['x-user-name'] as string }
                : {}),
            },
          });

          // Safe JSON parse — analytics service may return non-JSON on error
          let parsed;
          try {
            parsed = JSON.parse(internalResponse.body);
          } catch {
            logger.error('Invalid analytics response body', {
              statusCode: internalResponse.statusCode,
              body: String(internalResponse.body).slice(0, 200),
            });
            return reply.code(502).send({ error: 'Invalid analytics response' });
          }
          return reply.code(internalResponse.statusCode).send(parsed);
        }

        // -- Standard Discover widget query --
        const {
          fields = ['count()'],
          conditions,
          groupBy,
          orderBy,
          limit = 20,
          period = '24h',
          dataset = 'errors',
          start,
          end,
        } = query;

        const bucket = getBucketingConfig(period, start, end);

        // Validate dataset and get allowed columns from schema
        const VALID_DATASETS = new Set(['errors', 'transactions', 'spans', 'logs', 'metrics']);
        const safeDataset = VALID_DATASETS.has(dataset) ? dataset : 'errors';
        const ds = getDataset(safeDataset);
        const allowedColumns = new Set(
          [...ds.columns.entries()]
            .filter(([, def]) => !def.type.startsWith('Map('))
            .map(([n]) => n)
        );
        const allowedAggregates = new Set([
          ...ds.aggregates,
          'count', 'uniq', 'min', 'max', 'avg', 'sum',
          'p50', 'p75', 'p95', 'p99',
        ]);
        const tableName = ds.table;

        // Build SELECT with whitelist validation (matching discover.ts pattern)
        const selectAliases: string[] = [];
        const selectParts = fields.map((f) => {
          const aggMatch = f.match(/^(\w+)\((\w*)\)$/);
          if (aggMatch) {
            const [, fn, col] = aggMatch;
            const safeFn = fn.toLowerCase();
            if (!allowedAggregates.has(safeFn)) {
              // Skip disallowed aggregates — fall back to count
              selectAliases.push('count');
              return 'count() AS count';
            }
            if (col && col !== '*' && !allowedColumns.has(col)) {
              // Column not in schema — skip
              selectAliases.push('count');
              return 'count() AS count';
            }
            if (safeFn === 'count' && !col) {
              selectAliases.push('count');
              return 'count() AS count';
            }
            if (safeFn === 'uniq') {
              const alias = `uniq_${col || 'all'}`;
              selectAliases.push(alias);
              return `uniq(${col || '*'}) AS ${alias}`;
            }
            if (['p50', 'p75', 'p95', 'p99'].includes(safeFn)) {
              const pct = parseInt(safeFn.replace('p', ''), 10);
              const alias = `${safeFn}_${col || 'timestamp'}`;
              selectAliases.push(alias);
              return `quantile(${pct / 100})(${col || 'timestamp'}) AS ${alias}`;
            }
            const alias = `${safeFn}_${col || 'all'}`;
            selectAliases.push(alias);
            return `${safeFn}(${col || '*'}) AS ${alias}`;
          }
          // Plain column — validate against allowedColumns
          if (allowedColumns.has(f)) {
            selectAliases.push(f);
            return f;
          }
          // Disallowed plain field — skip silently
          return null;
        }).filter((s): s is string => s !== null);

        if (selectParts.length === 0) {
          selectParts.push('count() AS count');
          selectAliases.push('count');
        }

        // Process groupBy with validation
        let groupByClause = '';
        let orderByClause = '';

        if (groupBy && groupBy.length > 0) {
          const safeCols = groupBy
            .filter((c) => c !== 'timestamp' && allowedColumns.has(c));
          if (groupBy.includes('timestamp')) {
            selectParts.push(`${bucket.selectExpr} AS hour`);
            selectAliases.push('hour');
            safeCols.unshift('hour');
          }
          if (safeCols.length > 0)
            groupByClause = ` GROUP BY ${safeCols.join(', ')}`;
        }

        // Validate orderBy — must match /^-?\w+$/ and be an allowed column or alias
        if (orderBy) {
          const orderMatch = orderBy.match(/^(-?)(\w+)$/);
          if (orderMatch) {
            const [, descPrefix, col] = orderMatch;
            if (allowedColumns.has(col) || selectAliases.includes(col) || col === 'hour') {
              orderByClause = ` ORDER BY ${col} ${descPrefix === '-' ? 'DESC' : 'ASC'}`;
            }
          }
          // Invalid orderBy is silently ignored (no injection possible)
        }

        // Apply fill expr if timestamp is in group by
        let fillClause = '';
        if (groupBy && groupBy.includes('timestamp') && !orderBy) {
          orderByClause = ` ORDER BY hour`;
          fillClause = ` ${bucket.fillExpr}`;
        } else if (groupBy && groupBy.includes('timestamp') && orderBy) {
          if (orderBy.replace(/^-/, '') === 'hour') {
            fillClause = ` ${bucket.fillExpr}`;
          }
        }

        // Build the full SQL with validated selectParts
        const queryParams: Record<string, any> = {
          projectId: String(projectId),
          fillStart: bucket.queryParams.fillStart,
          fillEnd: bucket.queryParams.fillEnd,
        };

        sql = `SELECT ${selectParts.join(', ')} FROM ${tableName} WHERE project_id = {projectId:String} AND timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})`;

        // Parse conditions safely using parseSearchToSQL (same as discover.ts)
        if (conditions && conditions.trim()) {
          try {
            const { where } = parseSearchToSQL(safeDataset, conditions, queryParams);
            if (where) sql += ` AND (${where})`;
          } catch (parseError) {
            logger.warn('Widget query conditions parse failed', {
              conditions,
              error: parseError instanceof Error ? parseError.message : String(parseError),
            });
            // Return error to user rather than silently ignoring bad conditions
            return reply.code(400).send({
              error: 'Invalid query conditions',
              detail: parseError instanceof Error ? parseError.message : 'Parse failed',
            });
          }
        }

        sql += groupByClause + orderByClause + fillClause;

        // Enforce limit bounds: min 1, max 1000
        sql += ` LIMIT ${Math.max(1, Math.min(limit, 1000))}`;

        const result = await optic.rawQuery({
          query: sql,
          params: queryParams,
        });

        return reply.send({ data: result.data || [] });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Widget query failed', {
          projectId,
          sql: sql || undefined,
          error: errorMessage,
        });
        // Never expose SQL or internal details to client
        return reply.code(500).send({
          error: 'Widget query failed',
        });
      }
    }
  );
}
