import { mysqlPool } from '../config/mysql';
import { createLogger } from '../utils/logger';

const logger = createLogger('cron-supervisor-worker');

const LOOP_INTERVAL_MS = 60000; // Check every 60 seconds

export class CronSupervisorWorker {
  private running = false;

  async start(): Promise<void> {
    this.running = true;
    logger.info('Cron Supervisor worker started');

    this.processLoop().catch((error) => {
      logger.error('Cron Supervisor loop crashed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  async close(): Promise<void> {
    this.running = false;
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
