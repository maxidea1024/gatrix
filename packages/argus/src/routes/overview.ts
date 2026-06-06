import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import { createLogger } from '../utils/logger';

const logger = createLogger('overview-api');

/** Compute previous period time range for comparison */
function getPrevPeriodRange(period: string): { start: string; end: string } {
  const ms: Record<string, number> = {
    '1h': 3_600_000, '6h': 21_600_000, '24h': 86_400_000,
    '7d': 604_800_000, '30d': 2_592_000_000,
  };
  const periodMs = ms[period] || 86_400_000;
  const now = Date.now();
  return {
    start: new Date(now - 2 * periodMs).toISOString(),
    end: new Date(now - periodMs).toISOString(),
  };
}

export default async function overviewRoutes(app: FastifyInstance) {
  // ?€?€ Overview stats ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  app.get(
    '/overview/:projectId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h' } = request.query as { period?: string };

      try {
        const prevRange = getPrevPeriodRange(period);

        const [batch, prevBatch] = await Promise.all([
          // ?€?€ Main queries ??all share same projectId + period ?€?€
          optic.queryBatch({
            errorTrend: {
              dataset: 'errors', projectId, timeRange: { period },
              select: [
                { field: '$bucket', alias: 'hour' },
                { field: 'count()', alias: 'count' },
                { field: 'uniq(user_id)', alias: 'users' },
              ],
              groupBy: ['$bucket'],
              orderBy: [{ field: 'hour', direction: 'ASC' }],
              withFill: true,
            },

            errorSummary: {
              dataset: 'errors', projectId, timeRange: { period },
              select: [
                { field: 'count()', alias: 'total_errors' },
                { field: 'uniq(user_id)', alias: 'affected_users' },
                { field: 'uniq(primary_hash)', alias: 'unique_issues' },
              ],
            },

            txnSummary: {
              dataset: 'transactions', projectId, timeRange: { period },
              select: [
                { field: 'count()', alias: 'total_transactions' },
                { field: 'avg(duration)', alias: 'avg_duration' },
                { field: 'p50(duration)', alias: 'p50' },
                { field: 'p95(duration)', alias: 'p95' },
                { field: 'p99(duration)', alias: 'p99' },
                { field: "countIf(transaction_status != 'ok') / count() * 100", alias: 'error_rate' },
              ],
            },

            txnTrend: {
              dataset: 'transactions', projectId, timeRange: { period },
              select: [
                { field: '$bucket', alias: 'hour' },
                { field: 'count()', alias: 'count' },
                { field: 'avg(duration)', alias: 'avg_duration' },
              ],
              groupBy: ['$bucket'],
              orderBy: [{ field: 'hour', direction: 'ASC' }],
              withFill: true,
            },

            sessionSummary: {
              dataset: 'sessions', projectId, timeRange: { period },
              select: [
                { field: 'count()', alias: 'total_sessions' },
                { field: "countIf(status = 'crashed')", alias: 'crashed_sessions' },
                { field: "countIf(status = 'errored')", alias: 'errored_sessions' },
                { field: "if(count() > 0, (count() - countIf(status = 'crashed')) / count() * 100, 100)", alias: 'crash_free_rate' },
              ],
            },

            topIssues: {
              dataset: 'errors', projectId, timeRange: { period },
              select: [
                { field: 'primary_hash' },
                { field: 'any(type)', alias: 'title' },
                { field: 'any(value)', alias: 'subtitle' },
                { field: 'any(level)', alias: 'level' },
                { field: 'count()', alias: 'event_count' },
                { field: 'uniq(user_id)', alias: 'user_count' },
                { field: 'max(timestamp)', alias: 'last_seen' },
              ],
              groupBy: ['primary_hash'],
              orderBy: [{ field: 'event_count', direction: 'DESC' }],
              limit: 5,
            },

            heatmap: {
              dataset: 'errors', projectId, timeRange: { period: '7d' },
              select: [
                { field: 'toDayOfWeek(timestamp)', alias: 'day' },
                { field: 'toHour(timestamp)', alias: 'hour' },
                { field: 'count()', alias: 'count' },
              ],
              groupBy: ['day', 'hour'],
              orderBy: [
                { field: 'day', direction: 'ASC' },
                { field: 'hour', direction: 'ASC' },
              ],
            },

            envDist: {
              dataset: 'errors', projectId, timeRange: { period },
              select: [
                { field: "if(environment = '', 'unknown', environment)", alias: 'environment' },
                { field: 'count()', alias: 'count' },
              ],
              groupBy: ['environment'],
              orderBy: [{ field: 'count', direction: 'DESC' }],
              limit: 10,
            },

            browserDist: {
              dataset: 'errors', projectId, timeRange: { period },
              select: [
                { field: "if(browser_name = '', 'Unknown', browser_name)", alias: 'browser' },
                { field: 'count()', alias: 'count' },
              ],
              groupBy: ['browser'],
              orderBy: [{ field: 'count', direction: 'DESC' }],
              limit: 8,
            },

            osDist: {
              dataset: 'errors', projectId, timeRange: { period },
              select: [
                { field: "if(os_name = '', 'Unknown', os_name)", alias: 'os' },
                { field: 'count()', alias: 'count' },
              ],
              groupBy: ['os'],
              orderBy: [{ field: 'count', direction: 'DESC' }],
              limit: 8,
            },

            releaseDist: {
              dataset: 'errors', projectId, timeRange: { period },
              select: [
                { field: "if(release = '', 'unknown', release)", alias: 'release' },
                { field: 'count()', alias: 'count' },
                { field: 'uniq(user_id)', alias: 'users' },
              ],
              groupBy: ['release'],
              orderBy: [{ field: 'count', direction: 'DESC' }],
              limit: 5,
            },

            unhandled: {
              dataset: 'errors', projectId, timeRange: { period },
              select: [
                { field: 'countIf(is_handled = 0)', alias: 'unhandled' },
                { field: 'count()', alias: 'total' },
                { field: 'if(count() > 0, countIf(is_handled = 0) / count() * 100, 0)', alias: 'unhandled_rate' },
              ],
            },
          }),

          // ?€?€ Previous period ??for comparison ?€?€
          optic.queryBatch({
            errors: {
              dataset: 'errors', projectId,
              timeRange: prevRange,
              select: [
                { field: 'count()', alias: 'total_errors' },
                { field: 'uniq(user_id)', alias: 'affected_users' },
              ],
            },
            transactions: {
              dataset: 'transactions', projectId,
              timeRange: prevRange,
              select: [
                { field: 'count()', alias: 'total_transactions' },
              ],
            },
            sessions: {
              dataset: 'sessions', projectId,
              timeRange: prevRange,
              select: [
                { field: "if(count() > 0, (count() - countIf(status = 'crashed')) / count() * 100, 100)", alias: 'crash_free_rate' },
              ],
            },
          }),
        ]);

        // ?€?€ Assemble response ?€?€
        const unhandledRow = batch.unhandled.data[0] as any || {};
        const prevErrorRow = prevBatch.errors.data[0] as any || {};
        const prevTxnRow = prevBatch.transactions.data[0] as any || {};
        const prevSessionRow = prevBatch.sessions.data[0] as any || {};

        return reply.send({
          data: {
            error_trend: batch.errorTrend.data,
            error_summary: batch.errorSummary.data[0] || { total_errors: 0, affected_users: 0, unique_issues: 0 },
            transaction_summary: batch.txnSummary.data[0] || { total_transactions: 0, avg_duration: 0, p50: 0, p95: 0, p99: 0, error_rate: 0 },
            transaction_trend: batch.txnTrend.data,
            session_summary: batch.sessionSummary.data[0] || { total_sessions: 0, crashed_sessions: 0, errored_sessions: 0, crash_free_rate: 100 },
            top_issues: batch.topIssues.data,
            error_heatmap: batch.heatmap.data,
            error_by_environment: batch.envDist.data,
            error_by_browser: batch.browserDist.data,
            error_by_os: batch.osDist.data,
            error_by_release: batch.releaseDist.data,
            unhandled_rate: Number(unhandledRow.unhandled_rate) || 0,
            previous_period: {
              total_errors: Number(prevErrorRow.total_errors) || 0,
              affected_users: Number(prevErrorRow.affected_users) || 0,
              total_transactions: Number(prevTxnRow.total_transactions) || 0,
              crash_free_rate: Number(prevSessionRow.crash_free_rate) || 100,
            },
          },
        });
      } catch (error) {
        logger.error('Failed to get overview stats', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get overview stats' });
      }
    }
  );

  // ?€?€ Filter Options ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  app.get(
    '/filters/:projectId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '30d' } = request.query as { period?: string };

      try {
        const batch = await optic.queryBatch({
          environments: {
            dataset: 'errors', projectId, timeRange: { period },
            select: [{ field: 'environment' }],
            groupBy: ['environment'],
            orderBy: [{ field: 'environment', direction: 'ASC' }],
          },
          browsers: {
            dataset: 'errors', projectId, timeRange: { period },
            select: [{ field: 'browser_name' }],
            conditions: [{ field: 'browser_name', op: '!=', value: '' }],
            groupBy: ['browser_name'],
            orderBy: [{ field: 'browser_name', direction: 'ASC' }],
          },
          os: {
            dataset: 'errors', projectId, timeRange: { period },
            select: [{ field: 'os_name' }],
            conditions: [{ field: 'os_name', op: '!=', value: '' }],
            groupBy: ['os_name'],
            orderBy: [{ field: 'os_name', direction: 'ASC' }],
          },
        });

        return reply.send({
          data: {
            environments: batch.environments.data.map((r: any) => r.environment).filter(Boolean),
            browsers: batch.browsers.data.map((r: any) => r.browser_name).filter(Boolean),
            os: batch.os.data.map((r: any) => r.os_name).filter(Boolean),
          },
        });
      } catch (error) {
        logger.error('Failed to get filter options', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get filter options' });
      }
    }
  );
}
