import { FastifyInstance } from 'fastify';
import { mysqlPool } from '../config/mysql';
import { createLogger } from '../utils/logger';

const logger = createLogger('crons-api');

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
      environment?: string;
      checkin_margin?: number;
      max_runtime?: number;
    }
  }>(
    '/:projectId/crons',
    async (request, reply) => {
      try {
        const { projectId } = request.params;
        const {
          name, slug, schedule_type, schedule_value,
          environment = 'production', checkin_margin = 5, max_runtime = 30
        } = request.body;

        if (!name || !slug || !schedule_type || !schedule_value) {
          return reply.code(400).send({ success: false, error: 'Missing required fields' });
        }

        const [result]: any = await mysqlPool.query(
          `INSERT INTO g_argus_cronMonitors 
            (project_id, name, slug, schedule_type, schedule_value, environment, checkin_margin, max_runtime)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [projectId, name, slug, schedule_type, schedule_value, environment, checkin_margin, max_runtime]
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
    }
  }>(
    '/:projectId/crons/:monitorId',
    async (request, reply) => {
      try {
        const { projectId, monitorId } = request.params;
        const body = request.body;
        
        const updates: string[] = [];
        const values: any[] = [];
        
        for (const [key, val] of Object.entries(body)) {
          if (val !== undefined) {
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
  app.post<{
    Params: { projectId: string; slug: string };
    Body: {
      status: 'in_progress' | 'ok' | 'error';
      duration?: number;
      environment?: string;
    }
  }>(
    '/:projectId/crons/:slug/checkin',
    async (request, reply) => {
      try {
        const { projectId, slug } = request.params;
        const { status, duration, environment } = request.body;
        
        // Find monitor
        const [monitors]: any = await mysqlPool.query(
          `SELECT * FROM g_argus_cronMonitors WHERE project_id = ? AND slug = ?`,
          [projectId, slug]
        );
        
        if (monitors.length === 0) {
          return reply.code(404).send({ success: false, error: 'Monitor not found' });
        }
        const monitor = monitors[0];
        
        // Create checkin record
        const checkinId = require('crypto').randomBytes(16).toString('hex');
        await mysqlPool.query(
          `INSERT INTO g_argus_cronCheckins (monitor_id, checkin_id, status, duration, environment)
           VALUES (?, ?, ?, ?, ?)`,
          [monitor.id, checkinId, status, duration || null, environment || monitor.environment]
        );
        
        // Update monitor last status
        // Basic calculation of next checkin (for demonstration, a real parser would parse schedule_value)
        // Here we just set it to UTC NOW + 1 hour as a placeholder until the supervisor handles it properly.
        // In a full implementation, you'd parse cron-parser here.
        
        await mysqlPool.query(
          `UPDATE g_argus_cronMonitors SET last_checkin_at = NOW(), last_status = ? WHERE id = ?`,
          [status, monitor.id]
        );
        
        return reply.send({ success: true, checkin_id: checkinId });
      } catch (error) {
        logger.error('Failed to process checkin', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );
}
