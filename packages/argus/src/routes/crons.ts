import { FastifyInstance } from 'fastify';
import { mysqlPool } from '../config/mysql';
import { createLogger } from '../utils/logger';
import { buildScheduleConfig, getNextSchedule } from '../utils/cron-schedule';

const logger = createLogger('crons-api');

/**
 * After a terminal checkin (ok or error), update the monitor's
 * last_status, last_checkin_at, and compute next_checkin_at
 * using the actual cron-parser schedule.
 */
async function updateMonitorAfterCheckin(monitor: any, status: string) {
  let nextCheckinAt: Date | null = null;

  try {
    const scheduleConfig = buildScheduleConfig(
      monitor.schedule_type,
      monitor.schedule_value,
      monitor.schedule_unit
    );
    const tz = monitor.timezone && monitor.timezone !== 'UTC' ? monitor.timezone : undefined;
    nextCheckinAt = getNextSchedule(new Date(), scheduleConfig, tz);
  } catch {
    // If schedule parsing fails, leave next_checkin_at as null.
    logger.warn('Failed to compute next_checkin_at', { monitorId: monitor.id });
  }

  await mysqlPool.query(
    `UPDATE g_argus_cronMonitors 
       SET last_checkin_at = NOW(), last_status = ?, next_checkin_at = ?
     WHERE id = ?`,
    [status, nextCheckinAt, monitor.id]
  );
}

export default async function cronsRoutes(app: FastifyInstance) {
  // 1. List Crons for a project
  app.get<{ Params: { projectId: string } }>(
    '/:projectId/crons',
    async (request, reply) => {
      try {
        const { projectId } = request.params;
        const [rows] = await mysqlPool.query(
          `SELECT * FROM g_argus_cronMonitors WHERE project_id = ? ORDER BY created_at DESC`,
          [projectId]
        );
        return reply.send({ success: true, data: rows });
      } catch (error) {
        logger.error('Failed to list cron monitors', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );

  // 2. Create Cron Monitor
  app.post<{
    Params: { projectId: string };
    Body: {
      name: string;
      slug: string;
      schedule_type: string;
      schedule_value: string;
      schedule_unit?: string;
      environment?: string;
      checkin_margin?: number;
      max_runtime?: number;
      timezone?: string;
      failure_issue_threshold?: number;
      recovery_threshold?: number;
    }
  }>(
    '/:projectId/crons',
    async (request, reply) => {
      try {
        const { projectId } = request.params;
        const {
          name, slug, schedule_type, schedule_value, schedule_unit,
          environment = 'production', checkin_margin = 5, max_runtime = 30,
          timezone = 'UTC', failure_issue_threshold = 1, recovery_threshold = 1
        } = request.body;

        if (!name || !slug || !schedule_type || !schedule_value) {
          return reply.code(400).send({ success: false, error: 'Missing required fields' });
        }

        // Compute next_checkin_at using cron-parser
        let nextCheckinAt: Date | null = null;
        try {
          const scheduleConfig = buildScheduleConfig(schedule_type, schedule_value, schedule_unit);
          nextCheckinAt = getNextSchedule(new Date(), scheduleConfig, timezone !== 'UTC' ? timezone : undefined);
        } catch (schedErr) {
          logger.warn('Invalid schedule expression', { schedule_value, error: schedErr });
          return reply.code(400).send({ success: false, error: 'Invalid schedule expression' });
        }

        const [result]: any = await mysqlPool.query(
          `INSERT INTO g_argus_cronMonitors 
            (project_id, name, slug, schedule_type, schedule_value, environment,
             checkin_margin, max_runtime, timezone, failure_issue_threshold,
             recovery_threshold, next_checkin_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [projectId, name, slug, schedule_type, schedule_value, environment,
           checkin_margin, max_runtime, timezone, failure_issue_threshold,
           recovery_threshold, nextCheckinAt]
        );

        const [newMonitor] = await mysqlPool.query(
          `SELECT * FROM g_argus_cronMonitors WHERE id = ?`,
          [result.insertId]
        );

        return reply.code(201).send({ success: true, data: (newMonitor as any[])[0] });
      } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
          return reply.code(409).send({ success: false, error: 'Monitor slug already exists' });
        }
        logger.error('Failed to create cron monitor', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );

  // 3. Update Cron Monitor
  app.put<{
    Params: { projectId: string; monitorId: string };
    Body: {
      name?: string;
      schedule_value?: string;
      environment?: string;
      checkin_margin?: number;
      max_runtime?: number;
      status?: string;
      timezone?: string;
      failure_issue_threshold?: number;
      recovery_threshold?: number;
      is_muted?: boolean;
    }
  }>(
    '/:projectId/crons/:monitorId',
    async (request, reply) => {
      try {
        const { projectId, monitorId } = request.params;
        const body = request.body;
        
        // Whitelist allowed fields to prevent SQL injection via key names
        const allowedFields = [
          'name', 'schedule_value', 'environment', 'checkin_margin',
          'max_runtime', 'status', 'timezone', 'failure_issue_threshold',
          'recovery_threshold', 'is_muted'
        ];
        const updates: string[] = [];
        const values: any[] = [];
        
        for (const [key, val] of Object.entries(body)) {
          if (val !== undefined && allowedFields.includes(key)) {
            updates.push(`${key} = ?`);
            values.push(val);
          }
        }
        
        if (updates.length === 0) {
          return reply.code(400).send({ success: false, error: 'No fields to update' });
        }
        
        values.push(monitorId, projectId);
        
        const [result]: any = await mysqlPool.query(
          `UPDATE g_argus_cronMonitors SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          values
        );
        
        if (result.affectedRows === 0) {
          return reply.code(404).send({ success: false, error: 'Monitor not found' });
        }
        
        return reply.send({ success: true, message: 'Monitor updated' });
      } catch (error) {
        logger.error('Failed to update cron monitor', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );

  // 4. Delete Cron Monitor
  app.delete<{ Params: { projectId: string; monitorId: string } }>(
    '/:projectId/crons/:monitorId',
    async (request, reply) => {
      try {
        const { projectId, monitorId } = request.params;
        
        const [result]: any = await mysqlPool.query(
          `DELETE FROM g_argus_cronMonitors WHERE id = ? AND project_id = ?`,
          [monitorId, projectId]
        );
        
        if (result.affectedRows === 0) {
          return reply.code(404).send({ success: false, error: 'Monitor not found' });
        }
        
        return reply.send({ success: true, message: 'Monitor deleted' });
      } catch (error) {
        logger.error('Failed to delete cron monitor', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );

  // 5. Ingest Checkin API (SDK calls this)
  //
  // State Machine (mirrors Sentry's MonitorCheckIn):
  //   - `in_progress`: job has started, records `date_in_progress` and `timeout_at`
  //   - `ok`:          job completed successfully, computes duration if preceded by `in_progress`
  //   - `error`:       job failed
  //   - `missed`:      supervisor-generated when no checkin arrives before deadline
  //   - `timeout`:     supervisor-generated when `in_progress` exceeds `max_runtime`
  //
  app.post<{
    Params: { projectId: string; slug: string };
    Body: {
      status: 'in_progress' | 'ok' | 'error';
      check_in_id?: string;
      duration?: number;
      environment?: string;
      trace_id?: string;
    }
  }>(
    '/:projectId/crons/:slug/checkin',
    async (request, reply) => {
      try {
        const { projectId, slug } = request.params;
        const { status, check_in_id, duration, environment, trace_id } = request.body;
        
        // Find monitor
        const [monitors]: any = await mysqlPool.query(
          `SELECT * FROM g_argus_cronMonitors WHERE project_id = ? AND slug = ?`,
          [projectId, slug]
        );
        
        if (monitors.length === 0) {
          return reply.code(404).send({ success: false, error: 'Monitor not found' });
        }
        const monitor = monitors[0];

        // If check_in_id is provided AND status is ok/error, try to close an existing in_progress checkin
        if (check_in_id && (status === 'ok' || status === 'error')) {
          const [existing]: any = await mysqlPool.query(
            `SELECT * FROM g_argus_cronCheckins WHERE checkin_id = ? AND monitor_id = ? AND status = 'in_progress'`,
            [check_in_id, monitor.id]
          );
          if (existing.length > 0) {
            const inProgressCheckin = existing[0];
            const computedDuration = duration ?? (Date.now() - new Date(inProgressCheckin.date_in_progress).getTime());
            await mysqlPool.query(
              `UPDATE g_argus_cronCheckins SET status = ?, duration = ? WHERE id = ?`,
              [status, computedDuration, inProgressCheckin.id]
            );
            // Update monitor: next_checkin_at, last_checkin_at, last_status
            await updateMonitorAfterCheckin(monitor, status);
            return reply.send({ success: true, checkin_id: check_in_id });
          }
        }
        
        // Create new checkin record
        const checkinId = check_in_id || require('crypto').randomBytes(16).toString('hex');
        const now = new Date();
        
        let timeoutAt: Date | null = null;
        let dateInProgress: Date | null = null;

        if (status === 'in_progress') {
          dateInProgress = now;
          // max_runtime is in seconds
          timeoutAt = new Date(now.getTime() + (monitor.max_runtime || 30) * 60_000);
        }

        await mysqlPool.query(
          `INSERT INTO g_argus_cronCheckins 
            (monitor_id, checkin_id, status, duration, environment, timeout_at, date_in_progress, trace_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            monitor.id, checkinId, status,
            status === 'in_progress' ? null : (duration || null),
            environment || monitor.environment,
            timeoutAt, dateInProgress, trace_id || null
          ]
        );
        
        // Update monitor: last_checkin_at and last_status.
        // For `in_progress`, only update last_checkin_at (status remains unchanged until terminal state).
        // For `ok`/`error`, also compute next_checkin_at.
        if (status === 'in_progress') {
          await mysqlPool.query(
            `UPDATE g_argus_cronMonitors SET last_checkin_at = NOW() WHERE id = ?`,
            [monitor.id]
          );
        } else {
          await updateMonitorAfterCheckin(monitor, status);
        }
        
        return reply.send({ success: true, checkin_id: checkinId });
      } catch (error) {
        logger.error('Failed to process checkin', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );

  // 6. Get Checkin History for a monitor (paginated)
  app.get<{
    Params: { projectId: string; monitorId: string };
    Querystring: { limit?: string; offset?: string };
  }>(
    '/:projectId/crons/:monitorId/checkins',
    async (request, reply) => {
      try {
        const { projectId, monitorId } = request.params;
        const limit = Math.min(parseInt(request.query.limit || '50', 10), 200);
        const offset = parseInt(request.query.offset || '0', 10);

        // Verify monitor belongs to project
        const [monitors]: any = await mysqlPool.query(
          `SELECT id FROM g_argus_cronMonitors WHERE id = ? AND project_id = ?`,
          [monitorId, projectId]
        );
        if (monitors.length === 0) {
          return reply.code(404).send({ success: false, error: 'Monitor not found' });
        }

        const [rows] = await mysqlPool.query(
          `SELECT * FROM g_argus_cronCheckins
           WHERE monitor_id = ?
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
          [monitorId, limit, offset]
        );

        const [countResult]: any = await mysqlPool.query(
          `SELECT COUNT(*) as total FROM g_argus_cronCheckins WHERE monitor_id = ?`,
          [monitorId]
        );

        return reply.send({
          success: true,
          data: rows,
          total: countResult[0].total,
        });
      } catch (error) {
        logger.error('Failed to get cron checkins', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );

  // 7. Send a manual test checkin (from UI)
  app.post<{
    Params: { projectId: string; monitorId: string };
    Body: { status?: 'ok' | 'error' };
  }>(
    '/:projectId/crons/:monitorId/test-checkin',
    async (request, reply) => {
      try {
        const { projectId, monitorId } = request.params;
        const testStatus = request.body?.status || 'ok';

        // Verify monitor belongs to project
        const [monitors]: any = await mysqlPool.query(
          `SELECT * FROM g_argus_cronMonitors WHERE id = ? AND project_id = ?`,
          [monitorId, projectId]
        );
        if (monitors.length === 0) {
          return reply.code(404).send({ success: false, error: 'Monitor not found' });
        }
        const monitor = monitors[0];

        // Create test checkin
        const checkinId = require('crypto').randomBytes(16).toString('hex');
        await mysqlPool.query(
          `INSERT INTO g_argus_cronCheckins
            (monitor_id, checkin_id, status, duration, environment)
           VALUES (?, ?, ?, ?, ?)`,
          [monitor.id, checkinId, testStatus, 0, monitor.environment]
        );

        // Update monitor
        await updateMonitorAfterCheckin(monitor, testStatus);

        return reply.send({ success: true, checkin_id: checkinId, status: testStatus });
      } catch (error) {
        logger.error('Failed to send test checkin', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );
}
