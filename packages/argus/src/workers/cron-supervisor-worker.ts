import { mysqlPool } from '../config/mysql';
import { clickhouse } from '../config/clickhouse';
import { redis } from '../config/redis';
import { createLogger } from '../utils/logger';
import { CACHE } from '../config/redis-keys';
import { pipelineConfig } from '../config/pipeline-config';

const logger = createLogger('cron-supervisor-worker');

const LOOP_INTERVAL_MS = 60000; // Check every 60 seconds

export class CronSupervisorWorker {
  private running = false;
  private discoverCacheTimer: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    this.running = true;
    logger.info('Cron Supervisor worker started');

    // Start cron-missed check loop
    this.processLoop().catch((error) => {
      logger.error('Cron Supervisor loop crashed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // Start periodic discover tag cache refresh
    this.discoverCacheTimer = setInterval(
      () => this.refreshDiscoverCaches(),
      pipelineConfig.discoverCache.refreshIntervalMs
    );
    logger.info('Discover cache cron started', {
      intervalMs: pipelineConfig.discoverCache.refreshIntervalMs,
    });
  }

  async close(): Promise<void> {
    this.running = false;
    if (this.discoverCacheTimer) clearInterval(this.discoverCacheTimer);
    logger.info('Cron Supervisor worker stopped');
  }

  private async processLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.checkCrons();
      } catch (error) {
        logger.error('Error in cron supervisor loop', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await this.sleep(LOOP_INTERVAL_MS);
    }
  }

  private async checkCrons(): Promise<void> {
    // Check for missed cron checkins
    // Criteria: next_checkin_at + checkin_margin < NOW()
    // And status is currently 'active' or 'ok' or 'in_progress'

    const [rows]: any = await mysqlPool.query(`
      SELECT * FROM g_argus_cronMonitors 
      WHERE status != 'disabled' 
      AND next_checkin_at IS NOT NULL
      AND DATE_ADD(next_checkin_at, INTERVAL checkin_margin MINUTE) < NOW()
      AND last_status NOT IN ('missed', 'error')
    `);

    for (const monitor of rows) {
      logger.warn(`Cron monitor missed checkin: ${monitor.id}`);
      
      await mysqlPool.query(
        `UPDATE g_argus_cronMonitors SET last_status = 'missed' WHERE id = ?`,
        [monitor.id]
      );

      await this.createIssue(monitor);
    }
  }

  /**
   * Refresh discover tag caches for recently active projects.
   *
   * Queries ClickHouse for distinct tag values (browser, os, level, etc.)
   * and caches them in Redis. This means the Discover page filters load
   * instantly without hitting ClickHouse on every page open.
   */
  private async refreshDiscoverCaches(): Promise<void> {
    try {
      // Find projects with recent activity (last N hours)
      const hours = pipelineConfig.discoverCache.activeProjectHours;
      const [projects]: any = await mysqlPool.query(
        `SELECT DISTINCT p.gatrix_project_id
         FROM g_argus_projects p
         JOIN g_argus_issues i ON i.project_id = p.id
         WHERE i.last_seen >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
        [hours]
      );

      for (const project of projects) {
        try {
          await this.refreshProjectDiscoverTags(project.gatrix_project_id);
        } catch (e) {
          logger.warn('Failed to refresh discover cache for project', {
            projectId: project.gatrix_project_id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      logger.debug('Discover cache refresh complete', {
        projectCount: projects.length,
      });
    } catch (error) {
      logger.error('Discover cache refresh failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Fetch and cache discover tag values for a single project.
   * Caches distinct values for: browser, os, level, environment, release, platform.
   */
  private async refreshProjectDiscoverTags(projectId: string): Promise<void> {
    const tagColumns = [
      { key: 'browser', column: 'browser_name' },
      { key: 'os', column: 'os_name' },
      { key: 'level', column: 'level' },
      { key: 'environment', column: 'environment' },
      { key: 'release', column: 'release' },
      { key: 'platform', column: 'platform' },
    ];

    const tagData: Record<string, string[]> = {};

    await Promise.all(
      tagColumns.map(async ({ key, column }) => {
        const result = await clickhouse.query({
          query: `SELECT DISTINCT ${column} AS val FROM argus.errors
                  WHERE project_id = {projectId:String}
                    AND ${column} != ''
                    AND timestamp >= now() - INTERVAL 7 DAY
                  ORDER BY val
                  LIMIT 100`,
          query_params: { projectId },
          format: 'JSONEachRow',
        });
        const rows = (await result.json()) as any[];
        tagData[key] = rows.map((r) => r.val);
      })
    );

    // Cache for 10 minutes (cron refreshes every 5 min, so there's overlap)
    await redis.set(
      CACHE.DISCOVER_TAGS(projectId),
      JSON.stringify(tagData),
      'EX',
      600
    );
  }

  private async createIssue(monitor: any): Promise<void> {
    const hash = require('crypto').createHash('md5').update(`cron_missed_${monitor.id}`).digest('hex');
    
    // Check if unresolved issue already exists
    const [existing]: any = await mysqlPool.query(
      `SELECT id FROM g_argus_issues WHERE project_id = ? AND primary_hash = ? AND status = 'unresolved'`,
      [monitor.project_id, hash]
    );

    if (existing.length > 0) {
      await mysqlPool.query(
        `UPDATE g_argus_issues SET times_seen = times_seen + 1, last_seen = NOW() WHERE id = ?`,
        [existing[0].id]
      );
      return;
    }

    await mysqlPool.query(
      `INSERT INTO g_argus_issues (
        project_id, short_id, title, culprit, type, level, platform, 
        primary_hash, first_seen, last_seen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        monitor.project_id,
        Math.floor(Math.random() * 10000), 
        `Cron Monitor Missed Check-in: ${monitor.name}`,
        monitor.slug,
        'cron_error',
        'error',
        'other',
        hash
      ]
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
