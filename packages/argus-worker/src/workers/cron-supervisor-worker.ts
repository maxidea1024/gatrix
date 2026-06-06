import {
  mysqlPool,
  redis,
  createLogger,
  CACHE,
  COUNTERS,
  pipelineConfig,
  buildScheduleConfig,
  getNextSchedule,
} from '@gatrix/argus';
import { optic } from '@gatrix/argus-optic';

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
        await this.checkMissed();
        await this.checkTimeout();
      } catch (error) {
        logger.error('Error in cron supervisor loop', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await this.sleep(LOOP_INTERVAL_MS);
    }
  }

  /**
   * Detect missed check-ins.
   *
   * Mirrors Sentry's clock_dispatch.py + detect_missed_checkins task:
   *   - For each non-disabled monitor where
   *     `next_checkin_at + checkin_margin < NOW()`
   *     and the last_status is NOT already 'missed' or 'error'
   *   - Create a synthetic 'missed' checkin record
   *   - Evaluate failure_issue_threshold before creating an issue
   *   - Compute the next next_checkin_at so we don't fire again
   */
  private async checkMissed(): Promise<void> {
    const [rows]: any = await mysqlPool.query(`
      SELECT * FROM g_argus_cronMonitors 
      WHERE status != 'disabled' 
      AND next_checkin_at IS NOT NULL
      AND DATE_ADD(next_checkin_at, INTERVAL checkin_margin MINUTE) < NOW()
      AND last_status NOT IN ('missed', 'error')
    `);

    for (const monitor of rows) {
      logger.warn('Cron monitor missed checkin', {
        monitorId: monitor.id,
        name: monitor.name,
        nextCheckinAt: monitor.next_checkin_at,
      });

      // 1. Create synthetic 'missed' checkin record
      const checkinId = require('crypto').randomBytes(16).toString('hex');
      await mysqlPool.query(
        `INSERT INTO g_argus_cronCheckins
          (monitor_id, checkin_id, status, environment, expected_time)
         VALUES (?, ?, 'missed', ?, ?)`,
        [monitor.id, checkinId, monitor.environment, monitor.next_checkin_at]
      );

      // 2. Update monitor last_status and compute next next_checkin_at
      let nextCheckinAt: Date | null = null;
      try {
        const scheduleConfig = buildScheduleConfig(
          monitor.schedule_type,
          monitor.schedule_value,
          monitor.schedule_unit
        );
        const tz =
          monitor.timezone && monitor.timezone !== 'UTC'
            ? monitor.timezone
            : undefined;
        nextCheckinAt = getNextSchedule(new Date(), scheduleConfig, tz);
      } catch {
        logger.warn('Failed to compute next_checkin_at for missed monitor', {
          monitorId: monitor.id,
        });
      }

      await mysqlPool.query(
        `UPDATE g_argus_cronMonitors 
           SET last_status = 'missed', next_checkin_at = ?
         WHERE id = ?`,
        [nextCheckinAt, monitor.id]
      );

      // 3. Evaluate failure_issue_threshold before creating an issue
      //    (mirrors Sentry's try_incident_threshold)
      const threshold = monitor.failure_issue_threshold || 1;
      if (threshold > 1) {
        const [recentCheckins]: any = await mysqlPool.query(
          `SELECT status FROM g_argus_cronCheckins
           WHERE monitor_id = ?
           ORDER BY created_at DESC
           LIMIT ?`,
          [monitor.id, threshold]
        );
        const allFailed =
          recentCheckins.length >= threshold &&
          recentCheckins.every((c: any) => c.status !== 'ok');
        if (!allFailed) continue; // Not enough consecutive failures
      }

      // 4. Only create issue if monitor is not muted
      if (!monitor.is_muted) {
        await this.createIssue(monitor);
      }
    }
  }

  /**
   * Detect timed-out in_progress check-ins.
   *
   * Mirrors Sentry's detect_timeout logic:
   *   - Find all checkins with status='in_progress' AND timeout_at < NOW()
   *   - Transition them to 'timeout'
   *   - Evaluate threshold and create issue
   */
  private async checkTimeout(): Promise<void> {
    const [rows]: any = await mysqlPool.query(`
      SELECT ci.*, m.name AS monitor_name, m.project_id, m.slug,
             m.failure_issue_threshold, m.is_muted, m.schedule_type,
             m.schedule_value, m.schedule_unit, m.timezone
      FROM g_argus_cronCheckins ci
      JOIN g_argus_cronMonitors m ON m.id = ci.monitor_id
      WHERE ci.status = 'in_progress'
      AND ci.timeout_at IS NOT NULL
      AND ci.timeout_at < NOW()
    `);

    for (const checkin of rows) {
      logger.warn('Cron checkin timed out', {
        checkinId: checkin.checkin_id,
        monitorId: checkin.monitor_id,
        monitorName: checkin.monitor_name,
      });

      // 1. Update checkin status to 'timeout'
      const computedDuration = checkin.date_in_progress
        ? Date.now() - new Date(checkin.date_in_progress).getTime()
        : null;

      await mysqlPool.query(
        `UPDATE g_argus_cronCheckins SET status = 'timeout', duration = ? WHERE id = ?`,
        [computedDuration, checkin.id]
      );

      // 2. Update monitor last_status and next_checkin_at
      let nextCheckinAt: Date | null = null;
      try {
        const scheduleConfig = buildScheduleConfig(
          checkin.schedule_type,
          checkin.schedule_value,
          checkin.schedule_unit
        );
        const tz =
          checkin.timezone && checkin.timezone !== 'UTC'
            ? checkin.timezone
            : undefined;
        nextCheckinAt = getNextSchedule(new Date(), scheduleConfig, tz);
      } catch {
        // best effort
      }

      await mysqlPool.query(
        `UPDATE g_argus_cronMonitors 
           SET last_status = 'timeout', next_checkin_at = ?
         WHERE id = ?`,
        [nextCheckinAt, checkin.monitor_id]
      );

      // 3. Create issue if not muted
      if (!checkin.is_muted) {
        await this.createIssue({
          id: checkin.monitor_id,
          project_id: checkin.project_id,
          name: checkin.monitor_name,
          slug: checkin.slug,
        });
      }
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

      // Circuit breaker: stop after consecutive failures (e.g. ClickHouse down)
      const MAX_CONSECUTIVE_FAILURES = 3;
      let consecutiveFailures = 0;

      for (const project of projects) {
        try {
          await this.refreshProjectDiscoverTags(project.gatrix_project_id);
          consecutiveFailures = 0; // Reset on success
        } catch (e) {
          consecutiveFailures++;
          logger.warn('Failed to refresh discover cache for project', {
            projectId: project.gatrix_project_id,
            error: e instanceof Error ? e.message : String(e),
          });

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            logger.error(
              'Discover cache refresh aborted: too many consecutive failures',
              {
                failures: consecutiveFailures,
                remainingProjects: projects.length,
              }
            );
            break;
          }
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
    // Single UNION ALL query instead of 6 individual queries
    const result = await optic.rawQuery({
      query: `
        SELECT 'browser' AS key, browser_name AS val FROM argus.errors
        WHERE project_id = {projectId:String} AND browser_name != '' AND timestamp >= now() - INTERVAL 7 DAY
        GROUP BY browser_name ORDER BY count() DESC LIMIT 100
        UNION ALL
        SELECT 'os' AS key, os_name AS val FROM argus.errors
        WHERE project_id = {projectId:String} AND os_name != '' AND timestamp >= now() - INTERVAL 7 DAY
        GROUP BY os_name ORDER BY count() DESC LIMIT 100
        UNION ALL
        SELECT 'level' AS key, level AS val FROM argus.errors
        WHERE project_id = {projectId:String} AND level != '' AND timestamp >= now() - INTERVAL 7 DAY
        GROUP BY level ORDER BY count() DESC LIMIT 100
        UNION ALL
        SELECT 'environment' AS key, environment AS val FROM argus.errors
        WHERE project_id = {projectId:String} AND environment != '' AND timestamp >= now() - INTERVAL 7 DAY
        GROUP BY environment ORDER BY count() DESC LIMIT 100
        UNION ALL
        SELECT 'release' AS key, release AS val FROM argus.errors
        WHERE project_id = {projectId:String} AND release != '' AND timestamp >= now() - INTERVAL 7 DAY
        GROUP BY release ORDER BY count() DESC LIMIT 100
        UNION ALL
        SELECT 'platform' AS key, platform AS val FROM argus.errors
        WHERE project_id = {projectId:String} AND platform != '' AND timestamp >= now() - INTERVAL 7 DAY
        GROUP BY platform ORDER BY count() DESC LIMIT 100
      `,
      params: { projectId },
    });
    const rows = result.data as any[];

    // Group results by key
    const tagData: Record<string, string[]> = {};
    for (const row of rows) {
      if (!tagData[row.key]) tagData[row.key] = [];
      tagData[row.key].push(row.val);
    }

    // Cache for 10 minutes (cron refreshes every 5 min, so there's overlap)
    await redis.set(
      CACHE.DISCOVER_TAGS(projectId),
      JSON.stringify(tagData),
      'EX',
      600
    );
  }

  private async createIssue(monitor: any): Promise<void> {
    const hash = require('crypto')
      .createHash('md5')
      .update(`cron_missed_${monitor.id}`)
      .digest('hex');

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

    // Atomic short_id via Redis (consistent with issue-grouper)
    const nextShortId = await redis.hincrby(
      COUNTERS.ISSUE_SHORT_ID(monitor.project_id),
      'seq',
      1
    );

    await mysqlPool.query(
      `INSERT IGNORE INTO g_argus_issues (
        project_id, short_id, title, culprit, type, level, platform, 
        primary_hash, first_seen, last_seen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        monitor.project_id,
        nextShortId,
        `Cron Monitor Missed Check-in: ${monitor.name}`,
        monitor.slug,
        'cron_error',
        'error',
        'other',
        hash,
      ]
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
