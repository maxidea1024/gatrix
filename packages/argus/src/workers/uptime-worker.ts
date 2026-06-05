import axios from 'axios';
import { mysqlPool } from '../config/mysql';
import { createLogger } from '../utils/logger';

const logger = createLogger('uptime-worker');

const LOOP_INTERVAL_MS = 10000; // Check every 10 seconds

export class UptimeWorker {
  private running = false;

  async start(): Promise<void> {
    this.running = true;
    logger.info('Uptime worker started');

    this.processLoop().catch((error) => {
      logger.error('Uptime worker loop crashed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  async close(): Promise<void> {
    this.running = false;
    logger.info('Uptime worker stopped');
  }

  private async processLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.pollMonitors();
      } catch (error) {
        logger.error('Error in uptime processing loop', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await this.sleep(LOOP_INTERVAL_MS);
    }
  }

  private async pollMonitors(): Promise<void> {
    // Find monitors that need to be checked
    // We check if (NOW - updated_at) >= interval_seconds
    // To handle first run, we also check if updated_at is NULL (but we set CURRENT_TIMESTAMP on create)
    // Actually we need a dedicated last_checked_at column or just rely on the latest checkin.
    // For simplicity, let's query monitors and check their latest checkin, or we can just add a last_checked_at to the monitor table.
    // In our schema: we didn't add last_checked_at. We can use updated_at, but updated_at changes on any edit.
    // Let's fetch all monitors and find the latest checkin for each to determine if it's due.
    
    // Better query: get monitors where time since latest checkin > interval_seconds.
    const [rows]: any = await mysqlPool.query(`
      SELECT m.*, 
        (SELECT MAX(checked_at) FROM g_argus_uptimeCheckins c WHERE c.monitor_id = m.id) as last_checked_at
      FROM g_argus_uptimeMonitors m
    `);

    const now = new Date().getTime();

    for (const monitor of rows) {
      const lastCheck = monitor.last_checked_at ? new Date(monitor.last_checked_at).getTime() : 0;
      const intervalMs = monitor.interval_seconds * 1000;

      if (now - lastCheck >= intervalMs) {
        await this.checkMonitor(monitor);
      }
    }
  }

  private async checkMonitor(monitor: any): Promise<void> {
    const startTime = Date.now();
    let status = 'up';
    let responseMs = 0;

    try {
      await axios.request({
        url: monitor.url,
        method: monitor.method || 'GET',
        timeout: 10000,
      });
      responseMs = Date.now() - startTime;
    } catch (error) {
      status = 'down';
      responseMs = Date.now() - startTime;
      logger.warn(`Uptime check failed for monitor ${monitor.id}`, { url: monitor.url, error: (error as Error).message });
    }

    // Insert checkin
    await mysqlPool.query(
      `INSERT INTO g_argus_uptimeCheckins (monitor_id, status, response_ms) VALUES (?, ?, ?)`,
      [monitor.id, status, responseMs]
    );

    // Update monitor stats
    // Calculate new uptime percent (simplified: just ratio of 'up' checkins)
    const [stats]: any = await mysqlPool.query(
      `SELECT 
        COUNT(*) as total, 
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count,
        AVG(response_ms) as avg_ms
       FROM g_argus_uptimeCheckins 
       WHERE monitor_id = ?`,
      [monitor.id]
    );

    const total = stats[0].total || 1;
    const upCount = stats[0].up_count || 0;
    const uptimePercent = (upCount / total) * 100;
    const avgMs = Math.round(stats[0].avg_ms || responseMs);

    await mysqlPool.query(
      `UPDATE g_argus_uptimeMonitors 
       SET status = ?, uptime_percent = ?, avg_response_ms = ?
       WHERE id = ?`,
      [status, uptimePercent.toFixed(2), avgMs, monitor.id]
    );

    // If down, create an issue
    if (status === 'down' && monitor.status === 'up') {
      await this.createIssue(monitor);
    }
  }

  private async createIssue(monitor: any): Promise<void> {
    // Basic issue creation for downtime
    const hash = require('crypto').createHash('md5').update(`uptime_down_${monitor.id}`).digest('hex');
    
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

    // Get internal project short ID counter
    const [project]: any = await mysqlPool.query(`SELECT id FROM g_argus_projects WHERE gatrix_project_id = ?`, [monitor.project_id]);
    if (!project || project.length === 0) return;
    
    // Very simplified issue creation (normally requires issue grouper logic)
    await mysqlPool.query(
      `INSERT INTO g_argus_issues (
        project_id, short_id, title, culprit, type, level, platform, 
        primary_hash, first_seen, last_seen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        monitor.project_id,
        Math.floor(Math.random() * 10000), // simplistic short_id
        `Uptime Monitor Down: ${monitor.name}`,
        monitor.url,
        'uptime_error',
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
