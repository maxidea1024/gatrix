import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import { createLogger } from '../utils/logger';

const TABLE = 'argus.activities';
const logger = createLogger('realtime-api');

// ─────────────────────────────────────────────────────────────────────────────
// Route Registration
// ─────────────────────────────────────────────────────────────────────────────

export default async function realtimeRoutes(app: FastifyInstance) {
  // ─── GET /projects/:projectId/analytics/realtime ───────────────────────
  // Snapshot of the last 30 minutes (polled by frontend every 5s)
  app.get(
    '/projects/:projectId/analytics/realtime',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };

      try {
        const params = { projectId };

        const ERROR_EVENTS = ['client_error', 'high_ping_warning', 'crash', 'out_of_memory'];

        // ── Run all queries in parallel ──────────────────────────────────
        const [
          activeResult,
          prevActiveResult,
          epmResult,
          prevEpmResult,
          topEventsResult,
          topCountriesResult,
          recentResult,
          errorResult,
        ] = await Promise.all([
          // 1) Active users (last 30 min)
          optic.rawQuery({
            query: `
              SELECT uniqExact(user_id) AS active_users
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND timestamp >= now() - INTERVAL 30 MINUTE
                AND user_id != ''
            `,
            params,
          }),

          // 2) Previous period active users (yesterday same time)
          optic.rawQuery({
            query: `
              SELECT uniqExact(user_id) AS active_users
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND timestamp >= now() - INTERVAL 1 DAY - INTERVAL 30 MINUTE
                AND timestamp <  now() - INTERVAL 1 DAY
                AND user_id != ''
            `,
            params,
          }),

          // 3) Events per minute (last 30 minutes)
          optic.rawQuery({
            query: `
              SELECT
                toStartOfMinute(timestamp) AS minute,
                count() AS count
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND timestamp >= now() - INTERVAL 30 MINUTE
              GROUP BY minute
              ORDER BY minute ASC
              WITH FILL
                FROM toStartOfMinute(now() - INTERVAL 30 MINUTE)
                TO toStartOfMinute(now()) + INTERVAL 1 MINUTE
                STEP INTERVAL 1 MINUTE
            `,
            params,
          }),

          // 4) Previous period EPM (yesterday same window, shifted +1 day)
          optic.rawQuery({
            query: `
              SELECT
                toStartOfMinute(timestamp + INTERVAL 1 DAY) AS minute,
                count() AS count
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND timestamp >= now() - INTERVAL 1 DAY - INTERVAL 30 MINUTE
                AND timestamp <  now() - INTERVAL 1 DAY
              GROUP BY minute
              ORDER BY minute ASC
              WITH FILL
                FROM toStartOfMinute(now() - INTERVAL 30 MINUTE)
                TO toStartOfMinute(now()) + INTERVAL 1 MINUTE
                STEP INTERVAL 1 MINUTE
            `,
            params,
          }),

          // 5) Top events
          optic.rawQuery({
            query: `
              SELECT event_name, count() AS count
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND timestamp >= now() - INTERVAL 30 MINUTE
              GROUP BY event_name
              ORDER BY count DESC
              LIMIT 10
            `,
            params,
          }),

          // 6) Top countries
          optic.rawQuery({
            query: `
              SELECT country, count() AS count
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND timestamp >= now() - INTERVAL 30 MINUTE
                AND country != ''
              GROUP BY country
              ORDER BY count DESC
              LIMIT 10
            `,
            params,
          }),

          // 7) Recent events
          optic.rawQuery({
            query: `
              SELECT
                event_name, user_id, timestamp, country, platform, session_id
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND timestamp >= now() - INTERVAL 30 MINUTE
              ORDER BY timestamp DESC
              LIMIT 50
            `,
            params,
          }),

          // 8) Error rate
          optic.rawQuery({
            query: `
              SELECT
                countIf(event_name IN ('client_error', 'high_ping_warning', 'crash', 'out_of_memory')) AS error_count,
                count() AS total_count
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND timestamp >= now() - INTERVAL 30 MINUTE
            `,
            params,
          }),
        ]);

        // ── Parse results ────────────────────────────────────────────────
        const activeUsers =
          Number((activeResult.data as any[])?.[0]?.active_users) || 0;
        const prevActiveUsers =
          Number((prevActiveResult.data as any[])?.[0]?.active_users) || 0;

        const eventsPerMinute = ((epmResult.data as any[]) || []).map(
          (r: any) => ({
            minute: r.minute,
            count: Number(r.count) || 0,
          })
        );

        const prevEventsPerMinute = ((prevEpmResult.data as any[]) || []).map(
          (r: any) => ({
            minute: r.minute,
            count: Number(r.count) || 0,
          })
        );

        const topEvents = ((topEventsResult.data as any[]) || []).map(
          (r: any) => ({
            name: r.event_name,
            count: Number(r.count) || 0,
          })
        );

        const topCountries = ((topCountriesResult.data as any[]) || []).map(
          (r: any) => ({
            country: r.country,
            count: Number(r.count) || 0,
          })
        );

        const recentEvents = ((recentResult.data as any[]) || []).map(
          (r: any) => ({
            event_name: r.event_name,
            user_id: r.user_id || null,
            timestamp: r.timestamp,
            country: r.country || null,
            platform: r.platform || null,
          })
        );

        const totalEvents = eventsPerMinute.reduce(
          (sum, e) => sum + e.count,
          0
        );
        const prevTotalEvents = prevEventsPerMinute.reduce(
          (sum, e) => sum + e.count,
          0
        );

        const errorRow = (errorResult.data as any[])?.[0];
        const errorCount = Number(errorRow?.error_count) || 0;
        const totalCount = Number(errorRow?.total_count) || 1;
        const errorRate = Math.round((errorCount / totalCount) * 10000) / 100; // percentage with 2 decimals

        // ── Anomaly detection ────────────────────────────────────────────
        const activeUsersDelta = prevActiveUsers > 0
          ? (activeUsers - prevActiveUsers) / prevActiveUsers
          : 0;
        const volumeDelta = prevTotalEvents > 0
          ? (totalEvents - prevTotalEvents) / prevTotalEvents
          : 0;

        const anomalies = {
          active_users: Math.abs(activeUsersDelta) < 0.3 ? 'normal' as const
            : activeUsersDelta > 0 ? 'high' as const : 'low' as const,
          error_rate: errorRate < 1 ? 'normal' as const
            : errorRate < 5 ? 'warning' as const : 'critical' as const,
          event_volume: Math.abs(volumeDelta) < 0.5 ? 'normal' as const
            : volumeDelta > 0 ? 'high' as const : 'low' as const,
        };

        return reply.send({
          success: true,
          data: {
            active_users: activeUsers,
            total_events: totalEvents,
            events_per_minute: eventsPerMinute,
            top_events: topEvents,
            top_countries: topCountries,
            recent_events: recentEvents,
            // ── New: comparison & insight fields ──
            prev_active_users: prevActiveUsers,
            prev_total_events: prevTotalEvents,
            prev_events_per_minute: prevEventsPerMinute,
            error_rate: errorRate,
            error_count: errorCount,
            anomalies,
          },
        });
      } catch (err) {
        logger.error('Realtime query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.send({
          success: true,
          data: {
            active_users: 0,
            total_events: 0,
            events_per_minute: [],
            top_events: [],
            top_countries: [],
            recent_events: [],
            prev_active_users: 0,
            prev_total_events: 0,
            prev_events_per_minute: [],
            error_rate: 0,
            error_count: 0,
            anomalies: {
              active_users: 'normal',
              error_rate: 'normal',
              event_volume: 'normal',
            },
          },
        });
      }
    }
  );

  // ─── GET /projects/:projectId/tracking/realtime ──────────────────────
  // System health snapshot: errors, performance, logs (last 30 min)
  app.get(
    '/projects/:projectId/tracking/realtime',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };

      try {
        const params = { projectId };

        const [
          errorCountResult,
          prevErrorCountResult,
          errorsPerMinResult,
          prevErrorsPerMinResult,
          perfResult,
          prevPerfResult,
          perfTimeseriesResult,
          errorTypesResult,
          logLevelsResult,
          recentErrorsResult,
          slowTxnsResult,
          logCountResult,
          prevLogCountResult,
          errorsByReleaseResult,
          feedbackSummaryResult,
          recentFeedbackResult,
        ] = await Promise.all([
          // 1) Error count (30 min)
          optic.rawQuery({
            query: `SELECT count() AS cnt FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 MINUTE`,
            params,
          }),
          // 2) Prev error count (yesterday)
          optic.rawQuery({
            query: `SELECT count() AS cnt FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 1 DAY - INTERVAL 30 MINUTE AND timestamp < now() - INTERVAL 1 DAY`,
            params,
          }),
          // 3) Errors per minute
          optic.rawQuery({
            query: `
              SELECT toStartOfMinute(timestamp) AS minute, count() AS count
              FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 MINUTE
              GROUP BY minute ORDER BY minute ASC
              WITH FILL FROM toStartOfMinute(now() - INTERVAL 30 MINUTE) TO toStartOfMinute(now()) + INTERVAL 1 MINUTE STEP INTERVAL 1 MINUTE
            `,
            params,
          }),
          // 4) Prev errors per minute
          optic.rawQuery({
            query: `
              SELECT toStartOfMinute(timestamp + INTERVAL 1 DAY) AS minute, count() AS count
              FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 1 DAY - INTERVAL 30 MINUTE AND timestamp < now() - INTERVAL 1 DAY
              GROUP BY minute ORDER BY minute ASC
              WITH FILL FROM toStartOfMinute(now() - INTERVAL 30 MINUTE) TO toStartOfMinute(now()) + INTERVAL 1 MINUTE STEP INTERVAL 1 MINUTE
            `,
            params,
          }),
          // 5) P50/P95 response time (30 min)
          optic.rawQuery({
            query: `
              SELECT quantile(0.5)(duration) AS p50, quantile(0.95)(duration) AS p95, count() AS cnt
              FROM argus.transactions WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 MINUTE
            `,
            params,
          }),
          // 6) Prev P50/P95
          optic.rawQuery({
            query: `
              SELECT quantile(0.5)(duration) AS p50, quantile(0.95)(duration) AS p95
              FROM argus.transactions WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 1 DAY - INTERVAL 30 MINUTE AND timestamp < now() - INTERVAL 1 DAY
            `,
            params,
          }),
          // 7) P50/P95 per minute timeseries
          optic.rawQuery({
            query: `
              SELECT toStartOfMinute(timestamp) AS minute, quantile(0.5)(duration) AS p50, quantile(0.95)(duration) AS p95, count() AS cnt
              FROM argus.transactions WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 MINUTE
              GROUP BY minute ORDER BY minute ASC
              WITH FILL FROM toStartOfMinute(now() - INTERVAL 30 MINUTE) TO toStartOfMinute(now()) + INTERVAL 1 MINUTE STEP INTERVAL 1 MINUTE
            `,
            params,
          }),
          // 8) Error types top 10
          optic.rawQuery({
            query: `
              SELECT type, count() AS count FROM argus.errors
              WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 MINUTE
              GROUP BY type ORDER BY count DESC LIMIT 10
            `,
            params,
          }),
          // 9) Log levels distribution
          optic.rawQuery({
            query: `
              SELECT level, count() AS count FROM argus.logs
              WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 MINUTE
              GROUP BY level ORDER BY count DESC
            `,
            params,
          }),
          // 10) Recent errors (10)
          optic.rawQuery({
            query: `
              SELECT type, value, timestamp, platform, release, environment
              FROM argus.errors
              WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 MINUTE
              ORDER BY timestamp DESC LIMIT 10
            `,
            params,
          }),
          // 11) Slow transactions top 10
          optic.rawQuery({
            query: `
              SELECT transaction, quantile(0.95)(duration) AS p95, count() AS count
              FROM argus.transactions
              WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 MINUTE
              GROUP BY transaction ORDER BY p95 DESC LIMIT 10
            `,
            params,
          }),
          // 12) Log count (30 min)
          optic.rawQuery({
            query: `SELECT count() AS cnt FROM argus.logs WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 MINUTE`,
            params,
          }),
          // 13) Prev log count
          optic.rawQuery({
            query: `SELECT count() AS cnt FROM argus.logs WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 1 DAY - INTERVAL 30 MINUTE AND timestamp < now() - INTERVAL 1 DAY`,
            params,
          }),
          // 14) Errors by release per minute (for heatmap + stacked chart)
          optic.rawQuery({
            query: `
              SELECT release, toStartOfMinute(timestamp) AS minute, count() AS count
              FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 MINUTE
              GROUP BY release, minute ORDER BY release, minute ASC
            `,
            params,
          }),
          // 15) Feedback summary (30 min)
          optic.rawQuery({
            query: `
              SELECT
                count() AS total,
                countIf(sentiment = 'negative') AS negative,
                countIf(sentiment = 'positive') AS positive,
                countIf(sentiment = 'neutral') AS neutral,
                countIf(category = 'bug') AS bugs
              FROM argus.user_feedback
              WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 MINUTE
            `,
            params,
          }),
          // 16) Recent feedback (5)
          optic.rawQuery({
            query: `
              SELECT message, sentiment, category, email, timestamp, release
              FROM argus.user_feedback
              WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 MINUTE
              ORDER BY timestamp DESC LIMIT 5
            `,
            params,
          }),
        ]);

        // Parse
        const errorCount = Number((errorCountResult.data as any[])?.[0]?.cnt) || 0;
        const prevErrorCount = Number((prevErrorCountResult.data as any[])?.[0]?.cnt) || 0;

        const errorsPerMin = ((errorsPerMinResult.data as any[]) || []).map((r: any) => ({
          minute: r.minute, count: Number(r.count) || 0,
        }));
        const prevErrorsPerMin = ((prevErrorsPerMinResult.data as any[]) || []).map((r: any) => ({
          minute: r.minute, count: Number(r.count) || 0,
        }));

        const perfRow = (perfResult.data as any[])?.[0];
        const p50 = Math.round(Number(perfRow?.p50) || 0);
        const p95 = Math.round(Number(perfRow?.p95) || 0);
        const txnCount = Number(perfRow?.cnt) || 0;

        const prevPerfRow = (prevPerfResult.data as any[])?.[0];
        const prevP50 = Math.round(Number(prevPerfRow?.p50) || 0);
        const prevP95 = Math.round(Number(prevPerfRow?.p95) || 0);

        const perfTimeseries = ((perfTimeseriesResult.data as any[]) || []).map((r: any) => ({
          minute: r.minute, p50: Math.round(Number(r.p50) || 0), p95: Math.round(Number(r.p95) || 0), cnt: Number(r.cnt) || 0,
        }));

        const errorTypes = ((errorTypesResult.data as any[]) || []).map((r: any) => ({
          type: r.type, count: Number(r.count) || 0,
        }));

        const logLevels = ((logLevelsResult.data as any[]) || []).map((r: any) => ({
          level: r.level, count: Number(r.count) || 0,
        }));

        const recentErrors = ((recentErrorsResult.data as any[]) || []).map((r: any) => ({
          type: r.type, value: r.value, timestamp: r.timestamp,
          platform: r.platform || null, release: r.release || null, environment: r.environment || null,
        }));

        const slowTransactions = ((slowTxnsResult.data as any[]) || []).map((r: any) => ({
          transaction: r.transaction, p95: Math.round(Number(r.p95) || 0), count: Number(r.count) || 0,
        }));

        const logCount = Number((logCountResult.data as any[])?.[0]?.cnt) || 0;
        const prevLogCount = Number((prevLogCountResult.data as any[])?.[0]?.cnt) || 0;

        // Anomaly detection
        const errorDelta = prevErrorCount > 0 ? (errorCount - prevErrorCount) / prevErrorCount : 0;
        const p95Delta = prevP95 > 0 ? (p95 - prevP95) / prevP95 : 0;

        const anomalies = {
          errors: Math.abs(errorDelta) < 0.3 ? 'normal' as const
            : errorDelta > 0 ? 'high' as const : 'low' as const,
          p95: Math.abs(p95Delta) < 0.5 ? 'normal' as const
            : p95Delta > 0 ? 'high' as const : 'low' as const,
        };

        return reply.send({
          success: true,
          data: {
            error_count: errorCount,
            prev_error_count: prevErrorCount,
            errors_per_minute: errorsPerMin,
            prev_errors_per_minute: prevErrorsPerMin,
            p50, p95, txn_count: txnCount,
            prev_p50: prevP50, prev_p95: prevP95,
            perf_timeseries: perfTimeseries,
            error_types: errorTypes,
            log_levels: logLevels,
            recent_errors: recentErrors,
            slow_transactions: slowTransactions,
            log_count: logCount,
            prev_log_count: prevLogCount,
            anomalies,
            errors_by_release: ((errorsByReleaseResult.data as any[]) || []).map((r: any) => ({
              release: r.release, minute: r.minute, count: Number(r.count) || 0,
            })),
            feedback_summary: (() => {
              const row = (feedbackSummaryResult.data as any[])?.[0];
              return {
                total: Number(row?.total) || 0,
                negative: Number(row?.negative) || 0,
                positive: Number(row?.positive) || 0,
                neutral: Number(row?.neutral) || 0,
                bugs: Number(row?.bugs) || 0,
              };
            })(),
            recent_feedback: ((recentFeedbackResult.data as any[]) || []).map((r: any) => ({
              message: r.message, sentiment: r.sentiment, category: r.category,
              email: r.email, timestamp: r.timestamp, release: r.release,
            })),
          },
        });
      } catch (err) {
        logger.error('Tracking realtime query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.send({
          success: true,
          data: {
            error_count: 0, prev_error_count: 0,
            errors_per_minute: [], prev_errors_per_minute: [],
            p50: 0, p95: 0, txn_count: 0,
            prev_p50: 0, prev_p95: 0,
            perf_timeseries: [],
            error_types: [], log_levels: [],
            recent_errors: [], slow_transactions: [],
            log_count: 0, prev_log_count: 0,
            anomalies: { errors: 'normal', p95: 'normal' },
            errors_by_release: [],
            feedback_summary: { total: 0, negative: 0, positive: 0, neutral: 0, bugs: 0 },
            recent_feedback: [],
          },
        });
      }
    }
  );
}
