import { FastifyInstance } from 'fastify';
import { mysqlPool } from '../config/mysql';
import { createLogger } from '../utils/logger';

const logger = createLogger('uptime-api');

export default async function uptimeRoutes(app: FastifyInstance) {
  // 1. List Uptime Monitors
  app.get<{ Params: { projectId: string } }>(
    '/:projectId/uptime',
    async (request, reply) => {
      try {
        const { projectId } = request.params;
        const [rows] = await mysqlPool.query(
          `SELECT * FROM g_argus_uptimeMonitors WHERE project_id = ? ORDER BY created_at DESC`,
          [projectId]
        );
        return reply.send({ success: true, data: rows });
      } catch (error) {
        logger.error('Failed to list uptime monitors', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );

  // 2. Create Uptime Monitor
  app.post<{
    Params: { projectId: string };
    Body: {
      name: string;
      url: string;
      method?: string;
      interval_seconds?: number;
      environment?: string;
    }
  }>(
    '/:projectId/uptime',
    async (request, reply) => {
      try {
        const { projectId } = request.params;
        const {
          name, url, method = 'GET', interval_seconds = 60, environment = 'production'
        } = request.body;

        if (!name || !url) {
          return reply.code(400).send({ success: false, error: 'Missing required fields (name, url)' });
        }

        const [result]: any = await mysqlPool.query(
          `INSERT INTO g_argus_uptimeMonitors 
            (project_id, name, url, method, interval_seconds, environment)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [projectId, name, url, method, interval_seconds, environment]
        );

        const [newMonitor] = await mysqlPool.query(
          `SELECT * FROM g_argus_uptimeMonitors WHERE id = ?`,
          [result.insertId]
        );

        return reply.code(201).send({ success: true, data: (newMonitor as any[])[0] });
      } catch (error) {
        logger.error('Failed to create uptime monitor', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );

  // 3. Update Uptime Monitor
  app.put<{
    Params: { projectId: string; monitorId: string };
    Body: {
      name?: string;
      url?: string;
      method?: string;
      interval_seconds?: number;
      environment?: string;
      status?: string;
    }
  }>(
    '/:projectId/uptime/:monitorId',
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
          `UPDATE g_argus_uptimeMonitors SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          values
        );
        
        if (result.affectedRows === 0) {
          return reply.code(404).send({ success: false, error: 'Monitor not found' });
        }
        
        return reply.send({ success: true, message: 'Monitor updated' });
      } catch (error) {
        logger.error('Failed to update uptime monitor', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );

  // 4. Delete Uptime Monitor
  app.delete<{ Params: { projectId: string; monitorId: string } }>(
    '/:projectId/uptime/:monitorId',
    async (request, reply) => {
      try {
        const { projectId, monitorId } = request.params;
        
        const [result]: any = await mysqlPool.query(
          `DELETE FROM g_argus_uptimeMonitors WHERE id = ? AND project_id = ?`,
          [monitorId, projectId]
        );
        
        if (result.affectedRows === 0) {
          return reply.code(404).send({ success: false, error: 'Monitor not found' });
        }
        
        return reply.send({ success: true, message: 'Monitor deleted' });
      } catch (error) {
        logger.error('Failed to delete uptime monitor', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );
}
