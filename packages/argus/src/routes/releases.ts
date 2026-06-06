import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import db from '../config/knex';
import { createLogger } from '../utils/logger';

const logger = createLogger('releases-api');

export default async function releasesRoutes(app: FastifyInstance) {
  // ?€?€ Release health time-series (for a specific release) ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  app.get(
    '/releases/:projectId/health',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { release, period = '30d' } = request.query as { release: string; period?: string };

      if (!release) {
        return reply.code(400).send({ error: 'release query param is required' });
      }

      try {
        const result = await optic.query({
          dataset: 'sessions', projectId, timestampField: 'started',
          timeRange: { period },
          select: [
            { field: '$bucket', alias: 'timestamp' },
            { field: 'count()', alias: 'total_sessions' },
            { field: "countIf(status = 'crashed')", alias: 'crashed_sessions' },
            { field: "countIf(status = 'errored')", alias: 'errored_sessions' },
            { field: "countIf(status = 'abnormal')", alias: 'abnormal_sessions' },
            { field: "countIf(status IN ('ok', 'exited'))", alias: 'healthy_sessions' },
            { field: "if(count() > 0, (1 - countIf(status = 'crashed') / count()) * 100, 100)", alias: 'crash_free_rate' },
            { field: 'uniq(distinct_id)', alias: 'total_users' },
            { field: "uniqIf(distinct_id, status = 'crashed')", alias: 'crashed_users' },
            { field: "if(uniq(distinct_id) > 0, (1 - uniqIf(distinct_id, status = 'crashed') / uniq(distinct_id)) * 100, 100)", alias: 'crash_free_users' },
          ],
          conditions: [{ field: 'release', op: '=', value: release }],
          groupBy: ['$bucket'],
          orderBy: [{ field: 'timestamp', direction: 'ASC' }],
          withFill: true,
        });

        return reply.send({ data: result.data });
      } catch (error) {
        logger.error('Failed to get release health', {
          projectId, release,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get release health' });
      }
    }
  );

  // ?€?€ List releases with enriched stats ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  app.get(
    '/releases/:projectId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '30d' } = request.query as { period?: string };

      try {
        const [chBatch, newIssuesResult] = await Promise.all([
          optic.queryBatch({
            // Error stats per release
            errors: {
              dataset: 'errors', projectId, timeRange: { period },
              select: [
                { field: 'release' },
                { field: 'min(timestamp)', alias: 'first_seen' },
                { field: 'max(timestamp)', alias: 'last_seen' },
                { field: 'count()', alias: 'error_count' },
                { field: 'uniq(user_id)', alias: 'affected_users' },
                { field: 'uniqExact(fingerprint)', alias: 'issue_count' },
                { field: "countIf(level = 'fatal')", alias: 'fatal_count' },
                { field: 'countIf(is_handled = 0)', alias: 'unhandled_count' },
              ],
              conditions: [{ field: 'release', op: '!=', value: '' }],
              groupBy: ['release'],
              orderBy: [{ field: 'last_seen', direction: 'DESC' }],
            },

            // Session crash-free per release
            sessions: {
              dataset: 'sessions', projectId, timestampField: 'started',
              timeRange: { period },
              select: [
                { field: 'release' },
                { field: 'count()', alias: 'total_sessions' },
                { field: "countIf(status = 'crashed')", alias: 'crashed' },
                { field: "if(count() > 0, (1 - countIf(status = 'crashed') / count()) * 100, 100)", alias: 'crash_free_rate' },
                { field: 'uniq(distinct_id)', alias: 'session_users' },
                { field: "uniqIf(distinct_id, status = 'crashed')", alias: 'crashed_users' },
                { field: "if(uniq(distinct_id) > 0, (1 - uniqIf(distinct_id, status = 'crashed') / uniq(distinct_id)) * 100, 100)", alias: 'crash_free_users' },
              ],
              conditions: [{ field: 'release', op: '!=', value: '' }],
              groupBy: ['release'],
            },

            // Transaction performance per release
            transactions: {
              dataset: 'transactions', projectId, timeRange: { period },
              select: [
                { field: 'release' },
                { field: 'count()', alias: 'transaction_count' },
                { field: 'avg(duration)', alias: 'avg_duration' },
                { field: 'p95(duration)', alias: 'p95' },
                { field: "countIf(transaction_status != 'ok') / count() * 100", alias: 'error_rate' },
              ],
              conditions: [{ field: 'release', op: '!=', value: '' }],
              groupBy: ['release'],
            },

            // Error trend per release (for sparklines)
            errorTrend: {
              dataset: 'errors', projectId, timeRange: { period },
              select: [
                { field: 'release' },
                { field: '$bucket', alias: 'day' },
                { field: 'count()', alias: 'count' },
              ],
              conditions: [{ field: 'release', op: '!=', value: '' }],
              groupBy: ['release', '$bucket'],
              orderBy: [
                { field: 'release', direction: 'ASC' },
                { field: 'day', direction: 'ASC' },
              ],
            },
          }),

          // New Issues from MySQL (not ClickHouse)
          db('g_argus_issues')
            .select('first_release as release_name')
            .count('* as new_issues')
            .where('project_id', projectId)
            .whereNotNull('first_release')
            .groupBy('first_release'),
        ]);

        const newIssuesRows = newIssuesResult as any[];

        // Build lookup maps
        const sessionMap = new Map<string, any>();
        for (const s of chBatch.sessions.data as any[]) {
          sessionMap.set(s.release, s);
        }

        const txnMap = new Map<string, any>();
        for (const t of chBatch.transactions.data as any[]) {
          txnMap.set(t.release, t);
        }

        const trendMap = new Map<string, number[]>();
        for (const t of chBatch.errorTrend.data as any[]) {
          if (!trendMap.has(t.release)) trendMap.set(t.release, []);
          trendMap.get(t.release)!.push(Number(t.count));
        }

        const newIssuesMap = new Map<string, number>();
        for (const row of newIssuesRows) {
          newIssuesMap.set(row.release_name, row.new_issues);
        }

        // Merge all data
        const releases = (chBatch.errors.data as any[]).map((r: any) => {
          const sess = sessionMap.get(r.release);
          const txn = txnMap.get(r.release);
          return {
            ...r,
            total_sessions: Number(sess?.total_sessions || 0),
            crash_free_rate: Number(sess?.crash_free_rate || 100),
            crash_free_users: Number(sess?.crash_free_users || 100),
            session_users: Number(sess?.session_users || 0),
            transaction_count: Number(txn?.transaction_count || 0),
            avg_duration: Number(txn?.avg_duration || 0),
            p95: Number(txn?.p95 || 0),
            txn_error_rate: Number(txn?.error_rate || 0),
            error_trend: trendMap.get(r.release) || [],
            new_issues: newIssuesMap.get(r.release) || 0,
          };
        });

        return reply.send({ data: releases });
      } catch (error) {
        logger.error('Failed to get releases', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get releases' });
      }
    }
  );
}
