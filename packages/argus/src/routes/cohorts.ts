import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import db from '../config/knex';
import { createLogger } from '../utils/logger';

const TABLE = 'argus.activities';
const logger = createLogger('cohorts-api');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface CohortRule {
  event: string;
  operator: '>=' | '<=' | '==' | '>' | '<';
  count: number;
  timeRange: string; // e.g. '7d', '30d'
}

interface CohortDefinition {
  rules: CohortRule[];
  combinator: 'and' | 'or';
}

const TIME_RANGE_MAP: Record<string, string> = {
  '1d': '1 DAY',
  '3d': '3 DAY',
  '7d': '7 DAY',
  '14d': '14 DAY',
  '30d': '30 DAY',
  '60d': '60 DAY',
  '90d': '90 DAY',
};

const OP_MAP: Record<string, string> = {
  '>=': '>=',
  '<=': '<=',
  '==': '=',
  '>': '>',
  '<': '<',
};

/**
 * Build a ClickHouse sub-query that returns user_ids matching a single rule.
 */
function buildRuleSubquery(
  rule: CohortRule,
  projectIdParam: string,
  ruleIndex: number
): { sql: string; params: Record<string, any> } {
  const interval = TIME_RANGE_MAP[rule.timeRange] || '30 DAY';
  const eventParam = `cohortEvent_${ruleIndex}`;
  const countParam = `cohortCount_${ruleIndex}`;

  return {
    sql: `(
      SELECT user_id
      FROM ${TABLE}
      WHERE project_id = {${projectIdParam}:String}
        AND event_name = {${eventParam}:String}
        AND user_id != ''
        AND timestamp >= now() - INTERVAL ${interval}
      GROUP BY user_id
      HAVING count() ${OP_MAP[rule.operator] || '>='} {${countParam}:UInt64}
    )`,
    params: {
      [eventParam]: rule.event,
      [countParam]: rule.count,
    },
  };
}

export { buildCohortQuery, CohortDefinition };

/**
 * Build a ClickHouse query that returns user_ids matching all/any cohort rules.
 */
function buildCohortQuery(
  definition: CohortDefinition,
  projectId: string
): { sql: string; params: Record<string, any> } {
  const params: Record<string, any> = { cohortProjectId: projectId };

  if (definition.rules.length === 0) {
    return {
      sql: `SELECT DISTINCT user_id FROM ${TABLE} WHERE project_id = {cohortProjectId:String} AND user_id != '' LIMIT 0`,
      params,
    };
  }

  if (definition.rules.length === 1) {
    const sub = buildRuleSubquery(definition.rules[0], 'cohortProjectId', 0);
    Object.assign(params, sub.params);
    return { sql: `SELECT user_id FROM ${sub.sql}`, params };
  }

  const subqueries = definition.rules.map((rule, i) => {
    const sub = buildRuleSubquery(rule, 'cohortProjectId', i);
    Object.assign(params, sub.params);
    return sub.sql;
  });

  if (definition.combinator === 'and') {
    // INTERSECT — users must match ALL rules
    const joined = subqueries.join('\nINTERSECT\n');
    return { sql: joined, params };
  } else {
    // UNION — users must match ANY rule
    const joined = subqueries.join('\nUNION DISTINCT\n');
    return { sql: joined, params };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Registration
// ─────────────────────────────────────────────────────────────────────────────

export default async function cohortsRoutes(app: FastifyInstance) {

  // ─── GET /projects/:projectId/analytics/cohorts ─────────────────────────
  app.get(
    '/projects/:projectId/analytics/cohorts',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      try {
        const [rows] = await db.raw(
          'SELECT * FROM g_argus_cohorts WHERE project_id = ? ORDER BY updated_at DESC',
          [projectId]
        );
        // Parse definition JSON for each row
        const cohorts = (rows as any[]).map((r: any) => ({
          ...r,
          definition:
            typeof r.definition === 'string'
              ? JSON.parse(r.definition)
              : r.definition,
        }));
        return reply.send({ success: true, data: cohorts });
      } catch (error: any) {
        if (error?.code === 'ER_NO_SUCH_TABLE') {
          return reply.send({ success: true, data: [] });
        }
        logger.error('Failed to list cohorts', { error: error?.message });
        return reply.code(500).send({ error: 'Failed to list cohorts' });
      }
    }
  );

  // ─── POST /projects/:projectId/analytics/cohorts ────────────────────────
  app.post(
    '/projects/:projectId/analytics/cohorts',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { name, description, definition } = request.body as {
        name: string;
        description?: string;
        definition: CohortDefinition;
      };

      if (!name || !definition || !definition.rules?.length) {
        return reply
          .code(400)
          .send({ error: 'name and definition with rules are required' });
      }

      try {
        // Compute initial user count
        const { sql, params } = buildCohortQuery(definition, projectId);
        const countSql = `SELECT count() AS cnt FROM (${sql})`;
        const result = await optic.rawQuery({ query: countSql, params });
        const userCount =
          Number((result.data as any[])?.[0]?.cnt) || 0;

        const [insertResult] = await db.raw(
          `INSERT INTO g_argus_cohorts (project_id, name, description, definition, user_count, last_computed)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            projectId,
            name,
            description || null,
            JSON.stringify(definition),
            userCount,
          ]
        );

        const id = (insertResult as any).insertId;

        return reply.code(201).send({
          success: true,
          data: { id, name, description, definition, user_count: userCount },
        });
      } catch (error: any) {
        logger.error('Failed to create cohort', { error: error?.message });
        return reply.code(500).send({ error: 'Failed to create cohort' });
      }
    }
  );

  // ─── PUT /projects/:projectId/analytics/cohorts/:id ─────────────────────
  app.put(
    '/projects/:projectId/analytics/cohorts/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, id } = request.params as {
        projectId: string;
        id: string;
      };
      const { name, description, definition } = request.body as {
        name?: string;
        description?: string;
        definition?: CohortDefinition;
      };

      const updates: string[] = [];
      const values: any[] = [];

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
      }
      if (definition !== undefined) {
        updates.push('definition = ?');
        values.push(JSON.stringify(definition));
      }

      if (updates.length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      values.push(id, projectId);

      try {
        await db.raw(
          `UPDATE g_argus_cohorts SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          values
        );
        return reply.send({ success: true });
      } catch (error: any) {
        logger.error('Failed to update cohort', { error: error?.message });
        return reply.code(500).send({ error: 'Failed to update cohort' });
      }
    }
  );

  // ─── DELETE /projects/:projectId/analytics/cohorts/:id ──────────────────
  app.delete(
    '/projects/:projectId/analytics/cohorts/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, id } = request.params as {
        projectId: string;
        id: string;
      };

      try {
        await db.raw(
          'DELETE FROM g_argus_cohorts WHERE id = ? AND project_id = ?',
          [id, projectId]
        );
        return reply.send({ success: true });
      } catch (error: any) {
        logger.error('Failed to delete cohort', { error: error?.message });
        return reply.code(500).send({ error: 'Failed to delete cohort' });
      }
    }
  );

  // ─── POST /projects/:projectId/analytics/cohorts/:id/compute ────────────
  // Recompute cohort user count
  app.post(
    '/projects/:projectId/analytics/cohorts/:id/compute',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, id } = request.params as {
        projectId: string;
        id: string;
      };

      try {
        const [rows] = await db.raw(
          'SELECT definition FROM g_argus_cohorts WHERE id = ? AND project_id = ?',
          [id, projectId]
        );
        const row = (rows as any[])?.[0];
        if (!row) {
          return reply.code(404).send({ error: 'Cohort not found' });
        }

        const definition: CohortDefinition =
          typeof row.definition === 'string'
            ? JSON.parse(row.definition)
            : row.definition;

        const { sql, params } = buildCohortQuery(definition, projectId);
        const countSql = `SELECT count() AS cnt FROM (${sql})`;
        const result = await optic.rawQuery({ query: countSql, params });
        const userCount =
          Number((result.data as any[])?.[0]?.cnt) || 0;

        await db.raw(
          'UPDATE g_argus_cohorts SET user_count = ?, last_computed = NOW() WHERE id = ? AND project_id = ?',
          [userCount, id, projectId]
        );

        return reply.send({ success: true, data: { user_count: userCount } });
      } catch (error: any) {
        logger.error('Failed to compute cohort', { error: error?.message });
        return reply.code(500).send({ error: 'Failed to compute cohort' });
      }
    }
  );

  // ─── GET /projects/:projectId/analytics/cohorts/:id/users ───────────────
  // List users in a cohort
  app.get(
    '/projects/:projectId/analytics/cohorts/:id/users',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, id } = request.params as {
        projectId: string;
        id: string;
      };
      const { limit: limitStr, offset: offsetStr } = (
        request.query as any
      ) || {};
      const limit = Math.min(parseInt(limitStr || '50', 10), 200);
      const offset = parseInt(offsetStr || '0', 10);

      try {
        const [rows] = await db.raw(
          'SELECT definition FROM g_argus_cohorts WHERE id = ? AND project_id = ?',
          [id, projectId]
        );
        const row = (rows as any[])?.[0];
        if (!row) {
          return reply.code(404).send({ error: 'Cohort not found' });
        }

        const definition: CohortDefinition =
          typeof row.definition === 'string'
            ? JSON.parse(row.definition)
            : row.definition;

        const { sql, params } = buildCohortQuery(definition, projectId);
        const usersSql = `
          SELECT user_id FROM (${sql})
          ORDER BY user_id
          LIMIT ${limit}
          OFFSET ${offset}
        `;
        const result = await optic.rawQuery({ query: usersSql, params });
        const users = ((result.data as any[]) || []).map(
          (r: any) => r.user_id
        );

        return reply.send({ success: true, data: users });
      } catch (error: any) {
        logger.error('Failed to list cohort users', { error: error?.message });
        return reply.code(500).send({ error: 'Failed to list cohort users' });
      }
    }
  );

  // ─── POST /projects/:projectId/analytics/cohorts/preview ────────────────
  // Preview user count for a cohort definition (without saving)
  app.post(
    '/projects/:projectId/analytics/cohorts/preview',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { definition } = request.body as {
        definition: CohortDefinition;
      };

      if (!definition || !definition.rules?.length) {
        return reply.send({ success: true, data: { user_count: 0 } });
      }

      try {
        const { sql, params } = buildCohortQuery(definition, projectId);
        const countSql = `SELECT count() AS cnt FROM (${sql})`;
        const result = await optic.rawQuery({ query: countSql, params });
        const userCount =
          Number((result.data as any[])?.[0]?.cnt) || 0;

        return reply.send({ success: true, data: { user_count: userCount } });
      } catch (error: any) {
        logger.error('Failed to preview cohort', { error: error?.message });
        return reply.send({ success: true, data: { user_count: 0 } });
      }
    }
  );
}
