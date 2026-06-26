import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import { createLogger } from '../utils/logger';
import {
  buildTimeRangeConditions,
  PERIOD_TO_SECONDS,
} from '../utils/timeBucket';
import { buildSegmentFilter } from '../utils/segmentFilter';
import {
  generateInsights,
  buildSegmentMatrix,
} from '../utils/monetizationInsights';

const TABLE = 'argus.activities';
const logger = createLogger('monetization-api');

// Event conventions
const PURCHASE_EVENT = 'purchase';
const REFUND_EVENT = 'refund';
const GRANT_EVENT = 'grant';
const AMOUNT_PROP = 'amount';
const RESOURCE_SOURCE_EVENT = 'resource_source';
const RESOURCE_SINK_EVENT = 'resource_sink';
const AD_IMPRESSION_EVENT = 'ad_impression';
const AD_CLICK_EVENT = 'ad_click';

// ??? Helpers ?????????????????????????????????????????????????????????????????

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build previous-period time conditions that mirror the selected range.
 */
function buildPreviousPeriodConditions(
  period?: string,
  start?: string,
  end?: string
): { conditions: string[]; params: Record<string, any> } {
  const conditions: string[] = [];
  const params: Record<string, any> = {};

  if (start && end) {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const duration = endMs - startMs;
    const prevStart = Math.floor((startMs - duration) / 1000);
    const prevEnd = Math.floor(startMs / 1000);
    conditions.push('timestamp >= toDateTime({prevStartTs:UInt32})');
    conditions.push('timestamp < toDateTime({prevEndTs:UInt32})');
    params.prevStartTs = prevStart;
    params.prevEndTs = prevEnd;
  } else {
    const seconds = PERIOD_TO_SECONDS[period || '30d'] || 2592000;
    conditions.push(`timestamp >= now() - INTERVAL ${seconds * 2} SECOND`);
    conditions.push(`timestamp < now() - INTERVAL ${seconds} SECOND`);
  }

  return { conditions, params };
}

// ?????????????????????????????????????????????????????????????????????????????
// Route Registration
// ?????????????????????????????????????????????????????????????????????????????

export default async function monetizationRoutes(app: FastifyInstance) {
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // 1. GET /projects/:projectId/analytics/monetization ??Main Revenue Dashboard
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period,
        start,
        end,
        granularity,
        country,
        platform,
        app_version,
      } = request.query as {
        period?: string;
        start?: string;
        end?: string;
        granularity?: string;
        country?: string;
        platform?: string;
        app_version?: string;
      };

      try {
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });
        const params: Record<string, any> = {
          projectId,
          purchaseEvent: PURCHASE_EVENT,
          ...timeParams,
          ...segmentParams,
        };

        const grain = granularity === 'hour' ? 'toStartOfHour' : 'toDate';

        // ?? Current period: Revenue over time ??
        const revenueResult = await optic.rawQuery({
          query: `
            SELECT
              ${grain}(timestamp) AS period,
              sum(numeric_properties['${AMOUNT_PROP}']) AS revenue,
              count() AS transactions,
              uniqExact(user_id) AS paying_users
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND ${timeWhere} ${segmentWhere}
            GROUP BY period
            ORDER BY period ASC
          `,
          params,
        });
        const revenueOverTime = ((revenueResult.data as any[]) || []).map(
          (r: any) => ({
            period: r.period,
            revenue: Number(r.revenue) || 0,
            transactions: Number(r.transactions) || 0,
            paying_users: Number(r.paying_users) || 0,
          })
        );

        // ?? Current period: Summary KPIs ??
        const summaryResult = await optic.rawQuery({
          query: `
            SELECT
              sum(numeric_properties['${AMOUNT_PROP}']) AS total_revenue,
              count() AS total_transactions,
              uniqExact(user_id) AS total_paying_users,
              avg(numeric_properties['${AMOUNT_PROP}']) AS avg_order_value
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND ${timeWhere} ${segmentWhere}
          `,
          params,
        });
        const summary = (summaryResult.data as any[])?.[0] || {};

        // ?? Current period: Total unique users (for ARPU) ??
        const totalUsersResult = await optic.rawQuery({
          query: `
            SELECT uniqExact(user_id) AS total_users
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND user_id != ''
              AND ${timeWhere} ${segmentWhere}
          `,
          params,
        });
        const totalUsers =
          Number((totalUsersResult.data as any[])?.[0]?.total_users) || 1;
        const totalRevenue = Number(summary.total_revenue) || 0;
        const payingUsers = Number(summary.total_paying_users) || 1;

        // ?? Previous period: Summary KPIs ??
        const { conditions: prevConds, params: prevParams } =
          buildPreviousPeriodConditions(period, start, end);
        const prevWhere = prevConds.join(' AND ');
        const prevKpiParams = {
          projectId,
          purchaseEvent: PURCHASE_EVENT,
          ...prevParams,
          ...segmentParams,
        };

        const prevSummaryResult = await optic.rawQuery({
          query: `
            SELECT
              sum(numeric_properties['${AMOUNT_PROP}']) AS total_revenue,
              count() AS total_transactions,
              uniqExact(user_id) AS total_paying_users,
              avg(numeric_properties['${AMOUNT_PROP}']) AS avg_order_value
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND ${prevWhere} ${segmentWhere}
          `,
          params: prevKpiParams,
        });
        const prevSummary = (prevSummaryResult.data as any[])?.[0] || {};

        const prevTotalUsersResult = await optic.rawQuery({
          query: `
            SELECT uniqExact(user_id) AS total_users
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND user_id != ''
              AND ${prevWhere} ${segmentWhere}
          `,
          params: prevKpiParams,
        });
        const prevTotalUsers =
          Number((prevTotalUsersResult.data as any[])?.[0]?.total_users) || 1;
        const prevTotalRevenue = Number(prevSummary.total_revenue) || 0;
        const prevPayingUsers = Number(prevSummary.total_paying_users) || 1;

        // ?? First purchasers (users whose first-ever purchase is in this period) ??
        const firstPurchasersResult = await optic.rawQuery({
          query: `
            SELECT count() AS first_purchasers FROM (
              SELECT user_id, min(timestamp) AS first_purchase
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {purchaseEvent:String}
                AND user_id != ''
              GROUP BY user_id
              HAVING ${timeWhere.replace(/timestamp/g, 'first_purchase')}
            )
          `,
          params,
        });
        const firstPurchasers =
          Number(
            (firstPurchasersResult.data as any[])?.[0]?.first_purchasers
          ) || 0;
        const realPayingUsers = Number(summary.total_paying_users) || 0;

        // ?? ARPDAU: daily active users for ARPDAU calculation ??
        const dauResult = await optic.rawQuery({
          query: `
            SELECT
              ${grain}(timestamp) AS period,
              uniqExact(user_id) AS dau
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND user_id != ''
              AND ${timeWhere} ${segmentWhere}
            GROUP BY period
            ORDER BY period ASC
          `,
          params,
        });
        const dauMap = new Map<string, number>();
        for (const r of (dauResult.data as any[]) || []) {
          dauMap.set(r.period, Number(r.dau) || 1);
        }
        // Enrich revenue_over_time with arpdau
        const enrichedRevenueOverTime = revenueOverTime.map((r) => ({
          ...r,
          dau: dauMap.get(r.period) || 0,
          arpdau: round2(r.revenue / (dauMap.get(r.period) || 1)),
        }));

        // ?? Revenue by country ??
        const countryResult = await optic.rawQuery({
          query: `
            SELECT
              country,
              sum(numeric_properties['${AMOUNT_PROP}']) AS revenue,
              count() AS transactions
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND ${timeWhere} ${segmentWhere}
              AND country != ''
            GROUP BY country
            ORDER BY revenue DESC
            LIMIT 10
          `,
          params,
        });
        const revenueByCountry = ((countryResult.data as any[]) || []).map(
          (r: any) => ({
            country: r.country || 'Unknown',
            revenue: round2(Number(r.revenue) || 0),
            transactions: Number(r.transactions) || 0,
          })
        );

        // ?? Revenue by platform ??
        const platformResult = await optic.rawQuery({
          query: `
            SELECT
              platform,
              sum(numeric_properties['${AMOUNT_PROP}']) AS revenue,
              count() AS transactions
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND ${timeWhere} ${segmentWhere}
              AND platform != ''
            GROUP BY platform
            ORDER BY revenue DESC
          `,
          params,
        });
        const revenueByPlatform = ((platformResult.data as any[]) || []).map(
          (r: any) => ({
            platform: r.platform || 'Unknown',
            revenue: round2(Number(r.revenue) || 0),
            transactions: Number(r.transactions) || 0,
          })
        );

        // ?? Previous period: Revenue by country ??
        const prevCountryResult = await optic.rawQuery({
          query: `
            SELECT
              country,
              sum(numeric_properties['${AMOUNT_PROP}']) AS revenue,
              count() AS transactions
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND ${prevWhere} ${segmentWhere}
              AND country != ''
            GROUP BY country
            ORDER BY revenue DESC
            LIMIT 10
          `,
          params: prevKpiParams,
        });
        const prevRevenueByCountry = (
          (prevCountryResult.data as any[]) || []
        ).map((r: any) => ({
          country: r.country || 'Unknown',
          revenue: round2(Number(r.revenue) || 0),
          transactions: Number(r.transactions) || 0,
        }));

        // ?? Previous period: Revenue by platform ??
        const prevPlatformResult = await optic.rawQuery({
          query: `
            SELECT
              platform,
              sum(numeric_properties['${AMOUNT_PROP}']) AS revenue,
              count() AS transactions
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND ${prevWhere} ${segmentWhere}
              AND platform != ''
            GROUP BY platform
            ORDER BY revenue DESC
          `,
          params: prevKpiParams,
        });
        const prevRevenueByPlatform = (
          (prevPlatformResult.data as any[]) || []
        ).map((r: any) => ({
          platform: r.platform || 'Unknown',
          revenue: round2(Number(r.revenue) || 0),
          transactions: Number(r.transactions) || 0,
        }));

        // ?? Previous period: Revenue over time (for comparison overlay) ??
        const prevRevenueResult = await optic.rawQuery({
          query: `
            SELECT
              ${grain}(timestamp) AS period,
              sum(numeric_properties['${AMOUNT_PROP}']) AS revenue,
              count() AS transactions
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND ${prevWhere} ${segmentWhere}
            GROUP BY period
            ORDER BY period ASC
          `,
          params: prevKpiParams,
        });
        const prevRevenueOverTime = (
          (prevRevenueResult.data as any[]) || []
        ).map((r: any) => ({
          period: r.period,
          revenue: Number(r.revenue) || 0,
          transactions: Number(r.transactions) || 0,
        }));

        // ?? Refund: Current period summary ??
        const refundParams = {
          projectId,
          refundEvent: REFUND_EVENT,
          ...timeParams,
        };
        const refundSummaryResult = await optic.rawQuery({
          query: `
            SELECT
              sum(numeric_properties['${AMOUNT_PROP}']) AS total_refunds,
              count() AS refund_count,
              uniqExact(user_id) AS refund_users
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {refundEvent:String}
              AND ${timeWhere} ${segmentWhere}
          `,
          params: refundParams,
        });
        const refundSummary = (refundSummaryResult.data as any[])?.[0] || {};
        const totalRefunds = round2(Number(refundSummary.total_refunds) || 0);
        const refundCount = Number(refundSummary.refund_count) || 0;
        const refundUsers = Number(refundSummary.refund_users) || 0;
        const totalTransactions = Number(summary.total_transactions) || 0;
        const refundRate =
          totalTransactions > 0
            ? round2((refundCount / totalTransactions) * 100)
            : 0;
        const netRevenue = round2(totalRevenue - totalRefunds);

        // ?? Refund: Over time ??
        const refundTimeResult = await optic.rawQuery({
          query: `
            SELECT
              ${grain}(timestamp) AS period,
              sum(numeric_properties['${AMOUNT_PROP}']) AS refunds,
              count() AS refund_count
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {refundEvent:String}
              AND ${timeWhere} ${segmentWhere}
            GROUP BY period
            ORDER BY period ASC
          `,
          params: refundParams,
        });
        const refundsOverTime = ((refundTimeResult.data as any[]) || []).map(
          (r: any) => ({
            period: r.period,
            refunds: round2(Number(r.refunds) || 0),
            refund_count: Number(r.refund_count) || 0,
          })
        );

        // ?? Refund: Previous period summary ??
        const prevRefundParams = {
          projectId,
          refundEvent: REFUND_EVENT,
          ...prevParams,
        };
        const prevRefundResult = await optic.rawQuery({
          query: `
            SELECT
              sum(numeric_properties['${AMOUNT_PROP}']) AS total_refunds,
              count() AS refund_count
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {refundEvent:String}
              AND ${prevWhere} ${segmentWhere}
          `,
          params: prevRefundParams,
        });
        const prevRefundSummary = (prevRefundResult.data as any[])?.[0] || {};
        const prevTotalRefunds = round2(
          Number(prevRefundSummary.total_refunds) || 0
        );
        const prevRefundCount = Number(prevRefundSummary.refund_count) || 0;
        const prevNetRevenue = round2(prevTotalRevenue - prevTotalRefunds);

        // ?? Refund: Reasons Top 5 ??
        const refundReasonResult = await optic.rawQuery({
          query: `
            SELECT
              coalesce(nullIf(properties['refund_reason'], ''), 'Unspecified') AS reason,
              count() AS cnt,
              sum(numeric_properties['${AMOUNT_PROP}']) AS amount
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {refundEvent:String}
              AND ${timeWhere} ${segmentWhere}
            GROUP BY reason
            ORDER BY amount DESC
            LIMIT 5
          `,
          params: refundParams,
        });
        const refundReasons = ((refundReasonResult.data as any[]) || []).map(
          (r: any) => ({
            reason: r.reason,
            count: Number(r.cnt) || 0,
            amount: round2(Number(r.amount) || 0),
          })
        );

        // ?? Payment Method breakdown ??
        const paymentMethodResult = await optic.rawQuery({
          query: `
            SELECT
              coalesce(nullIf(properties['payment_method'], ''), 'cash') AS payment_method,
              sum(numeric_properties['${AMOUNT_PROP}']) AS revenue,
              count() AS transactions,
              uniqExact(user_id) AS users
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND ${timeWhere} ${segmentWhere}
            GROUP BY payment_method
            ORDER BY revenue DESC
          `,
          params,
        });
        const revenueByPaymentMethod = (
          (paymentMethodResult.data as any[]) || []
        ).map((r: any) => ({
          payment_method: r.payment_method,
          revenue: round2(Number(r.revenue) || 0),
          transactions: Number(r.transactions) || 0,
          users: Number(r.users) || 0,
        }));

        // ?? Grants summary ??
        const grantParams = {
          projectId,
          grantEvent: GRANT_EVENT,
          ...timeParams,
        };
        const grantResult = await optic.rawQuery({
          query: `
            SELECT
              coalesce(nullIf(properties['grant_reason'], ''), 'unspecified') AS reason,
              sum(numeric_properties['${AMOUNT_PROP}']) AS total_granted,
              count() AS grant_count,
              uniqExact(user_id) AS grant_users
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {grantEvent:String}
              AND ${timeWhere} ${segmentWhere}
            GROUP BY reason
            ORDER BY total_granted DESC
          `,
          params: grantParams,
        });
        const grantsByReason = ((grantResult.data as any[]) || []).map(
          (r: any) => ({
            reason: r.reason,
            total_granted: round2(Number(r.total_granted) || 0),
            grant_count: Number(r.grant_count) || 0,
            grant_users: Number(r.grant_users) || 0,
          })
        );
        const totalGranted = round2(
          grantsByReason.reduce((s, g) => s + g.total_granted, 0)
        );
        const grantCount = grantsByReason.reduce(
          (s, g) => s + g.grant_count,
          0
        );
        const grantUsers = grantsByReason.reduce(
          (s, g) => s + g.grant_users,
          0
        );

        // ?? Ad Revenue: Summary (current period) ??
        const adParams = {
          projectId,
          adEvent: AD_IMPRESSION_EVENT,
          adClickEvent: AD_CLICK_EVENT,
          ...timeParams,
        };
        const [
          adSummaryResult,
          prevAdSummaryResult,
          adTimeResult,
          adTypeResult,
          adPlacementResult,
          adSdkResult,
        ] = await Promise.all([
          optic.rawQuery({
            query: `
              SELECT
                sum(numeric_properties['ad_revenue']) AS total_ad_revenue,
                count() AS total_impressions,
                avg(numeric_properties['ad_ecpm']) AS avg_ecpm,
                uniqExact(user_id) AS ad_users
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {adEvent:String}
                AND ${timeWhere} ${segmentWhere}
            `,
            params: adParams,
          }),
          // Ad Revenue: Summary (previous period)
          optic.rawQuery({
            query: `
              SELECT
                sum(numeric_properties['ad_revenue']) AS total_ad_revenue,
                count() AS total_impressions,
                avg(numeric_properties['ad_ecpm']) AS avg_ecpm
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {adEvent:String}
                AND ${prevWhere} ${segmentWhere}
            `,
            params: { projectId, adEvent: AD_IMPRESSION_EVENT, ...prevParams },
          }),
          // Ad Revenue: Time series
          optic.rawQuery({
            query: `
              SELECT
                toDate(timestamp) AS period,
                sum(numeric_properties['ad_revenue']) AS ad_revenue,
                count() AS impressions,
                avg(numeric_properties['ad_ecpm']) AS ecpm
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {adEvent:String}
                AND ${timeWhere} ${segmentWhere}
              GROUP BY period
              ORDER BY period ASC
            `,
            params: adParams,
          }),
          // Ad Revenue: By ad_type
          optic.rawQuery({
            query: `
              SELECT
                properties['ad_type'] AS ad_type,
                sum(numeric_properties['ad_revenue']) AS revenue,
                count() AS impressions,
                avg(numeric_properties['ad_ecpm']) AS ecpm
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {adEvent:String}
                AND ${timeWhere} ${segmentWhere}
              GROUP BY ad_type
              ORDER BY revenue DESC
            `,
            params: adParams,
          }),
          // Ad Revenue: By ad_placement
          optic.rawQuery({
            query: `
              SELECT
                properties['ad_placement'] AS placement,
                sum(numeric_properties['ad_revenue']) AS revenue,
                count() AS impressions,
                avg(numeric_properties['ad_ecpm']) AS ecpm
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {adEvent:String}
                AND ${timeWhere} ${segmentWhere}
              GROUP BY placement
              ORDER BY revenue DESC
            `,
            params: adParams,
          }),
          // Ad Revenue: By ad_sdk_name
          optic.rawQuery({
            query: `
              SELECT
                properties['ad_sdk_name'] AS sdk,
                sum(numeric_properties['ad_revenue']) AS revenue,
                count() AS impressions,
                avg(numeric_properties['ad_ecpm']) AS ecpm
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {adEvent:String}
                AND ${timeWhere} ${segmentWhere}
              GROUP BY sdk
              ORDER BY revenue DESC
            `,
            params: adParams,
          }),
        ]);

        // Ad clicks count
        const adClickResult = await optic.rawQuery({
          query: `
            SELECT count() AS total_clicks
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {adClickEvent:String}
              AND ${timeWhere} ${segmentWhere}
          `,
          params: adParams,
        });

        const adSummary = (adSummaryResult.data as any[])?.[0] || {};
        const prevAdSummary = (prevAdSummaryResult.data as any[])?.[0] || {};
        const totalAdRevenue = round2(Number(adSummary.total_ad_revenue) || 0);
        const prevTotalAdRevenue = round2(
          Number(prevAdSummary.total_ad_revenue) || 0
        );
        const totalImpressions = Number(adSummary.total_impressions) || 0;
        const avgEcpm = round2(Number(adSummary.avg_ecpm) || 0);
        const adUserCount = Number(adSummary.ad_users) || 0;
        const totalAdClicks =
          Number((adClickResult.data as any[])?.[0]?.total_clicks) || 0;

        // Blended metrics
        const blendedRevenue = round2(totalRevenue + totalAdRevenue);
        const prevBlendedRevenue = round2(
          prevTotalRevenue + prevTotalAdRevenue
        );
        const blendedArpu =
          totalUsers > 0 ? round2(blendedRevenue / totalUsers) : 0;
        const adArpu = totalUsers > 0 ? round2(totalAdRevenue / totalUsers) : 0;
        const iapShare =
          blendedRevenue > 0
            ? round2((totalRevenue / blendedRevenue) * 100)
            : 100;
        const adShare =
          blendedRevenue > 0
            ? round2((totalAdRevenue / blendedRevenue) * 100)
            : 0;

        const adRevenueOverTime = ((adTimeResult.data as any[]) || []).map(
          (r: any) => ({
            period: r.period,
            ad_revenue: round2(Number(r.ad_revenue) || 0),
            impressions: Number(r.impressions) || 0,
            ecpm: round2(Number(r.ecpm) || 0),
          })
        );
        const revenueByAdType = ((adTypeResult.data as any[]) || []).map(
          (r: any) => ({
            ad_type: r.ad_type || 'unknown',
            revenue: round2(Number(r.revenue) || 0),
            impressions: Number(r.impressions) || 0,
            ecpm: round2(Number(r.ecpm) || 0),
          })
        );
        const revenueByPlacement = (
          (adPlacementResult.data as any[]) || []
        ).map((r: any) => ({
          placement: r.placement || 'unknown',
          revenue: round2(Number(r.revenue) || 0),
          impressions: Number(r.impressions) || 0,
          ecpm: round2(Number(r.ecpm) || 0),
        }));
        const revenueBySdk = ((adSdkResult.data as any[]) || []).map(
          (r: any) => ({
            sdk: r.sdk || 'unknown',
            revenue: round2(Number(r.revenue) || 0),
            impressions: Number(r.impressions) || 0,
            ecpm: round2(Number(r.ecpm) || 0),
          })
        );

        return reply.send({
          success: true,
          data: {
            revenue_over_time: enrichedRevenueOverTime,
            total_revenue: round2(totalRevenue),
            total_transactions: totalTransactions,
            total_paying_users: realPayingUsers,
            total_users: totalUsers,
            avg_order_value: round2(Number(summary.avg_order_value) || 0),
            arpu: round2(totalRevenue / totalUsers),
            arppu: round2(totalRevenue / payingUsers),
            conversion_rate: round2((realPayingUsers / totalUsers) * 100),
            first_purchasers: firstPurchasers,
            repeat_purchasers: realPayingUsers - firstPurchasers,
            // Previous period comparison
            prev_total_revenue: round2(prevTotalRevenue),
            prev_total_transactions:
              Number(prevSummary.total_transactions) || 0,
            prev_total_paying_users:
              Number(prevSummary.total_paying_users) || 0,
            prev_avg_order_value: round2(
              Number(prevSummary.avg_order_value) || 0
            ),
            prev_arpu: round2(prevTotalRevenue / prevTotalUsers),
            prev_arppu: round2(prevTotalRevenue / prevPayingUsers),
            prev_conversion_rate: round2(
              ((Number(prevSummary.total_paying_users) || 0) / prevTotalUsers) *
                100
            ),
            // Breakdowns
            revenue_by_country: revenueByCountry,
            revenue_by_platform: revenueByPlatform,
            prev_revenue_by_country: prevRevenueByCountry,
            prev_revenue_by_platform: prevRevenueByPlatform,
            // Previous period trend for comparison overlay
            prev_revenue_over_time: prevRevenueOverTime,
            // Refund
            total_refunds: totalRefunds,
            refund_count: refundCount,
            refund_rate: refundRate,
            net_revenue: netRevenue,
            refund_users: refundUsers,
            prev_total_refunds: prevTotalRefunds,
            prev_refund_count: prevRefundCount,
            prev_net_revenue: prevNetRevenue,
            refunds_over_time: refundsOverTime,
            refund_reasons: refundReasons,
            // Payment method
            revenue_by_payment_method: revenueByPaymentMethod,
            // Grants
            total_granted: totalGranted,
            grant_count: grantCount,
            grant_users: grantUsers,
            // Ad Revenue
            total_ad_revenue: totalAdRevenue,
            prev_total_ad_revenue: prevTotalAdRevenue,
            total_impressions: totalImpressions,
            total_ad_clicks: totalAdClicks,
            avg_ecpm: avgEcpm,
            ad_users: adUserCount,
            blended_revenue: blendedRevenue,
            prev_blended_revenue: prevBlendedRevenue,
            blended_arpu: blendedArpu,
            ad_arpu: adArpu,
            iap_share: iapShare,
            ad_share: adShare,
            ad_revenue_over_time: adRevenueOverTime,
            revenue_by_ad_type: revenueByAdType,
            revenue_by_placement: revenueByPlacement,
            revenue_by_sdk: revenueBySdk,
            grants_by_reason: grantsByReason,
            // -- Auto-generated insights --
            insights: generateInsights({
              total_revenue: round2(totalRevenue),
              prev_total_revenue: round2(prevTotalRevenue),
              total_transactions: totalTransactions,
              prev_total_transactions:
                Number(prevSummary.total_transactions) || 0,
              total_paying_users: realPayingUsers,
              total_users: totalUsers,
              arppu: round2(totalRevenue / payingUsers),
              prev_arppu: round2(prevTotalRevenue / prevPayingUsers),
              conversion_rate: round2((realPayingUsers / totalUsers) * 100),
              prev_conversion_rate: round2(
                ((Number(prevSummary.total_paying_users) || 0) /
                  prevTotalUsers) *
                  100
              ),
              avg_order_value: round2(Number(summary.avg_order_value) || 0),
              prev_avg_order_value: round2(
                Number(prevSummary.avg_order_value) || 0
              ),
              first_purchasers: firstPurchasers,
              refund_rate: refundRate,
              refund_count: refundCount,
              total_refunds: totalRefunds,
              prev_refund_count: prevRefundCount,
              prev_total_refunds: prevTotalRefunds,
              total_granted: totalGranted,
              total_ad_revenue: totalAdRevenue,
              prev_total_ad_revenue: prevTotalAdRevenue,
              avg_ecpm: avgEcpm,
              iap_share: iapShare,
              ad_share: adShare,
              revenue_by_country: revenueByCountry,
              prev_revenue_by_country: prevRevenueByCountry,
              revenue_by_platform: revenueByPlatform,
              prev_revenue_by_platform: prevRevenueByPlatform,
              revenue_over_time: enrichedRevenueOverTime,
            }),
            segment_verdicts: {
              by_country: buildSegmentMatrix(
                revenueByCountry,
                prevRevenueByCountry,
                round2(totalRevenue),
                'country'
              ),
              by_platform: buildSegmentMatrix(
                revenueByPlatform,
                prevRevenueByPlatform,
                round2(totalRevenue),
                'platform'
              ),
            },
          },
        });
      } catch (err) {
        logger.error('Revenue query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.code(500).send({ error: 'Revenue query failed' });
      }
    }
  );

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // 2. GET /projects/:projectId/analytics/monetization/products ??Top Products
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization/products',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period, start, end, country, platform, app_version } =
        request.query as {
          period?: string;
          start?: string;
          end?: string;
          country?: string;
          platform?: string;
          app_version?: string;
        };

      try {
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });
        const params = {
          projectId,
          purchaseEvent: PURCHASE_EVENT,
          ...timeParams,
          ...segmentParams,
        };

        const result = await optic.rawQuery({
          query: `
            SELECT
              properties['product_name'] AS product_name,
              any(properties['product_id']) AS product_id,
              sum(numeric_properties['${AMOUNT_PROP}']) AS revenue,
              count() AS transactions,
              uniqExact(user_id) AS buyers
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND ${timeWhere} ${segmentWhere}
              AND properties['product_name'] != ''
            GROUP BY product_name
            ORDER BY revenue DESC
          `,
          params,
        });

        // Calculate total for percentage
        const products = ((result.data as any[]) || []).map((r: any) => ({
          product_name: r.product_name,
          product_id: r.product_id || '',
          revenue: round2(Number(r.revenue) || 0),
          transactions: Number(r.transactions) || 0,
          buyers: Number(r.buyers) || 0,
        }));
        const totalProductRevenue = products.reduce((s, p) => s + p.revenue, 0);

        // ?? First purchase products: which products drive initial conversion ??
        const firstPurchaseResult = await optic.rawQuery({
          query: `
            SELECT
              product_name,
              count() AS first_purchase_count
            FROM (
              SELECT
                user_id,
                argMin(properties['product_name'], timestamp) AS product_name
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {purchaseEvent:String}
                AND user_id != ''
                AND properties['product_name'] != ''
              GROUP BY user_id
            )
            GROUP BY product_name
            ORDER BY first_purchase_count DESC
            LIMIT 10
          `,
          params,
        });
        const firstPurchaseProducts = (
          (firstPurchaseResult.data as any[]) || []
        ).map((r: any) => ({
          product_name: r.product_name,
          first_purchase_count: Number(r.first_purchase_count) || 0,
        }));

        // ?? Category breakdown ??
        const categoryResult = await optic.rawQuery({
          query: `
            SELECT
              if(properties['category'] = '', 'Uncategorized', properties['category']) AS category,
              sum(numeric_properties['${AMOUNT_PROP}']) AS revenue,
              count() AS transactions,
              uniqExact(user_id) AS buyers
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND ${timeWhere} ${segmentWhere}
            GROUP BY category
            ORDER BY revenue DESC
          `,
          params,
        });
        const categoryBreakdown = ((categoryResult.data as any[]) || []).map(
          (r: any) => ({
            category: r.category,
            revenue: round2(Number(r.revenue) || 0),
            transactions: Number(r.transactions) || 0,
            buyers: Number(r.buyers) || 0,
          })
        );

        // ?? Per-product refund data ??
        const refundByProductResult = await optic.rawQuery({
          query: `
            SELECT
              properties['product_name'] AS product_name,
              count() AS refund_count,
              sum(numeric_properties['${AMOUNT_PROP}']) AS refund_amount
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {refundEvent:String}
              AND ${timeWhere} ${segmentWhere}
              AND properties['product_name'] != ''
            GROUP BY product_name
          `,
          params: { projectId, refundEvent: REFUND_EVENT, ...timeParams },
        });
        const refundByProduct = new Map<
          string,
          { refund_count: number; refund_amount: number }
        >();
        for (const r of (refundByProductResult.data as any[]) || []) {
          refundByProduct.set(r.product_name, {
            refund_count: Number(r.refund_count) || 0,
            refund_amount: round2(Number(r.refund_amount) || 0),
          });
        }

        return reply.send({
          success: true,
          data: {
            products: products.map((p) => {
              const refundData = refundByProduct.get(p.product_name);
              const refund_count = refundData?.refund_count || 0;
              const refund_amount = refundData?.refund_amount || 0;
              const refund_rate =
                p.transactions > 0
                  ? round2((refund_count / p.transactions) * 100)
                  : 0;
              return {
                ...p,
                percentage:
                  totalProductRevenue > 0
                    ? round2((p.revenue / totalProductRevenue) * 100)
                    : 0,
                refund_count,
                refund_amount,
                refund_rate,
              };
            }),
            first_purchase_products: firstPurchaseProducts,
            category_breakdown: categoryBreakdown,
          },
        });
      } catch (err) {
        logger.error('Product revenue query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.code(500).send({ error: 'Product revenue query failed' });
      }
    }
  );

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // 2b. GET /projects/:projectId/analytics/monetization/products/trend
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization/products/trend',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period,
        start,
        end,
        granularity,
        country,
        platform,
        app_version,
      } = request.query as {
        period?: string;
        start?: string;
        end?: string;
        granularity?: string;
        country?: string;
        platform?: string;
        app_version?: string;
      };

      try {
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });
        const grain = granularity === 'hour' ? 'toStartOfHour' : 'toDate';
        const params = {
          projectId,
          purchaseEvent: PURCHASE_EVENT,
          ...timeParams,
          ...segmentParams,
        };

        // Get top 5 products by revenue
        const top5Result = await optic.rawQuery({
          query: `
            SELECT properties['product_name'] AS product_name
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND ${timeWhere} ${segmentWhere}
              AND properties['product_name'] != ''
            GROUP BY product_name
            ORDER BY sum(numeric_properties['${AMOUNT_PROP}']) DESC
            LIMIT 5
          `,
          params,
        });
        const topProducts = ((top5Result.data as any[]) || []).map(
          (r: any) => r.product_name
        );
        if (topProducts.length === 0) {
          return reply.send({ success: true, data: [] });
        }

        // Get daily revenue for each top product
        const trendResult = await optic.rawQuery({
          query: `
            SELECT
              ${grain}(timestamp) AS period,
              properties['product_name'] AS product_name,
              sum(numeric_properties['${AMOUNT_PROP}']) AS revenue
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND ${timeWhere} ${segmentWhere}
              AND properties['product_name'] IN (${topProducts.map((_, i) => `{p${i}:String}`).join(',')})
            GROUP BY period, product_name
            ORDER BY period ASC
          `,
          params: {
            ...params,
            ...Object.fromEntries(topProducts.map((p, i) => [`p${i}`, p])),
          },
        });

        // Group by product
        const byProduct: Record<string, { period: string; revenue: number }[]> =
          {};
        for (const p of topProducts) byProduct[p] = [];
        for (const r of (trendResult.data as any[]) || []) {
          const pn = r.product_name;
          if (byProduct[pn]) {
            byProduct[pn].push({
              period: r.period,
              revenue: round2(Number(r.revenue) || 0),
            });
          }
        }

        return reply.send({
          success: true,
          data: topProducts.map((p) => ({
            product_name: p,
            trend: byProduct[p],
          })),
        });
      } catch (err) {
        logger.error('Product trend query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.code(500).send({ error: 'Product trend query failed' });
      }
    }
  );

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // 2c. GET /projects/:projectId/analytics/monetization/products/detail
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization/products/detail',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period,
        start,
        end,
        granularity,
        product_name,
        offset,
        limit,
        country,
        platform,
        app_version,
      } = request.query as {
        period?: string;
        start?: string;
        end?: string;
        granularity?: string;
        product_name?: string;
        offset?: string;
        limit?: string;
        country?: string;
        platform?: string;
        app_version?: string;
      };

      if (!product_name) {
        return reply.code(400).send({ error: 'product_name is required' });
      }

      try {
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });
        const grain = granularity === 'hour' ? 'toStartOfHour' : 'toDate';
        const params = {
          projectId,
          purchaseEvent: PURCHASE_EVENT,
          productName: product_name,
          ...timeParams,
          ...segmentParams,
        };

        // ?? Daily revenue trend for this product ??
        const trendResult = await optic.rawQuery({
          query: `
            SELECT
              ${grain}(timestamp) AS period,
              sum(numeric_properties['${AMOUNT_PROP}']) AS revenue,
              count() AS transactions,
              uniqExact(user_id) AS buyers
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND properties['product_name'] = {productName:String}
              AND ${timeWhere} ${segmentWhere}
            GROUP BY period
            ORDER BY period ASC
          `,
          params,
        });
        const trend = ((trendResult.data as any[]) || []).map((r: any) => ({
          period: r.period,
          revenue: round2(Number(r.revenue) || 0),
          transactions: Number(r.transactions) || 0,
          buyers: Number(r.buyers) || 0,
        }));

        // ?? Summary KPIs ??
        const totalRevenue = trend.reduce((s, d) => s + d.revenue, 0);
        const totalTransactions = trend.reduce((s, d) => s + d.transactions, 0);

        // ?? Buyer list (offset-based "load more") ??
        const off = parseInt(offset || '0', 10) || 0;
        const lim = Math.min(parseInt(limit || '20', 10) || 20, 100);

        const buyersResult = await optic.rawQuery({
          query: `
            SELECT
              user_id,
              sum(numeric_properties['${AMOUNT_PROP}']) AS total_spent,
              count() AS purchase_count,
              max(timestamp) AS last_purchase
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND properties['product_name'] = {productName:String}
              AND user_id != ''
              AND ${timeWhere} ${segmentWhere}
            GROUP BY user_id
            ORDER BY total_spent DESC
            LIMIT {lim:UInt32} OFFSET {off:UInt32}
          `,
          params: { ...params, off, lim: lim + 1 },
        });
        const buyerRows = ((buyersResult.data as any[]) || []).map(
          (r: any) => ({
            user_id: r.user_id,
            total_spent: round2(Number(r.total_spent) || 0),
            purchase_count: Number(r.purchase_count) || 0,
            last_purchase: r.last_purchase,
            avatar_url: null as string | null,
          })
        );
        const hasMore = buyerRows.length > lim;
        const buyers = hasMore ? buyerRows.slice(0, lim) : buyerRows;

        // Fetch avatar_urls from dedicated profiles table (efficient O(1) lookup)
        if (buyers.length > 0) {
          const avatarResult = await optic.rawQuery({
            query: `
              SELECT user_id, avatar_url
              FROM argus.profiles FINAL
              WHERE project_id = {projectId:String}
                AND user_id IN (${buyers.map((_, i) => `{uid${i}:String}`).join(',')})
                AND avatar_url != ''
            `,
            params: {
              projectId,
              ...Object.fromEntries(
                buyers.map((b, i) => [`uid${i}`, b.user_id])
              ),
            },
          });
          const avatarMap = new Map<string, string>();
          for (const r of (avatarResult.data as any[]) || []) {
            if (r.avatar_url) avatarMap.set(r.user_id, r.avatar_url);
          }
          for (const b of buyers) {
            b.avatar_url = avatarMap.get(b.user_id) || null;
          }
        }

        return reply.send({
          success: true,
          data: {
            trend,
            summary: {
              total_revenue: round2(totalRevenue),
              total_transactions: totalTransactions,
            },
            buyers,
            has_more: hasMore,
          },
        });
      } catch (err) {
        logger.error('Product detail query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.code(500).send({ error: 'Product detail query failed' });
      }
    }
  );

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // 3. GET /projects/:projectId/analytics/monetization/economy ??Source/Sink
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization/economy',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period,
        start,
        end,
        granularity,
        currency_type,
        country,
        platform,
        app_version,
      } = request.query as {
        period?: string;
        start?: string;
        end?: string;
        granularity?: string;
        currency_type?: string;
        country?: string;
        platform?: string;
        app_version?: string;
      };

      try {
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });
        const grain = granularity === 'hour' ? 'toStartOfHour' : 'toDate';
        const params = {
          projectId,
          sourceEvent: RESOURCE_SOURCE_EVENT,
          sinkEvent: RESOURCE_SINK_EVENT,
          ...timeParams,
          ...segmentParams,
        };

        // ?? Source/Sink over time (filtered by currency if specified) ??
        const currencyFilter = currency_type
          ? `AND properties['currency_type'] = {currencyType:String}`
          : '';
        const flowParams = currency_type
          ? { ...params, currencyType: currency_type }
          : params;

        const flowResult = await optic.rawQuery({
          query: `
            SELECT
              ${grain}(timestamp) AS period,
              sumIf(numeric_properties['${AMOUNT_PROP}'], event_name = {sourceEvent:String}) AS source_total,
              sumIf(numeric_properties['${AMOUNT_PROP}'], event_name = {sinkEvent:String}) AS sink_total
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name IN ({sourceEvent:String}, {sinkEvent:String})
              AND ${timeWhere} ${segmentWhere}
              ${currencyFilter}
            GROUP BY period
            ORDER BY period ASC
          `,
          params: flowParams,
        });
        const flow_over_time = ((flowResult.data as any[]) || []).map(
          (r: any) => ({
            period: r.period,
            source: round2(Number(r.source_total) || 0),
            sink: round2(Number(r.sink_total) || 0),
          })
        );

        // ?? Summary by currency type ??
        const byCurrencyResult = await optic.rawQuery({
          query: `
            SELECT
              properties['currency_type'] AS currency_type,
              sumIf(numeric_properties['${AMOUNT_PROP}'], event_name = {sourceEvent:String}) AS source_total,
              sumIf(numeric_properties['${AMOUNT_PROP}'], event_name = {sinkEvent:String}) AS sink_total,
              countIf(event_name = {sourceEvent:String}) AS source_count,
              countIf(event_name = {sinkEvent:String}) AS sink_count
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name IN ({sourceEvent:String}, {sinkEvent:String})
              AND ${timeWhere} ${segmentWhere}
            GROUP BY currency_type
            ORDER BY source_total DESC
          `,
          params,
        });
        const by_currency = ((byCurrencyResult.data as any[]) || []).map(
          (r: any) => ({
            currency_type: r.currency_type || 'unknown',
            source: round2(Number(r.source_total) || 0),
            sink: round2(Number(r.sink_total) || 0),
            source_count: Number(r.source_count) || 0,
            sink_count: Number(r.sink_count) || 0,
            net_flow: round2(
              (Number(r.source_total) || 0) - (Number(r.sink_total) || 0)
            ),
          })
        );

        // ?? Top sinks by item ??
        const topSinksResult = await optic.rawQuery({
          query: `
            SELECT
              properties['product_name'] AS item_name,
              properties['currency_type'] AS currency_type,
              sum(numeric_properties['${AMOUNT_PROP}']) AS total_spent,
              count() AS transaction_count
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {sinkEvent:String}
              AND ${timeWhere} ${segmentWhere}
              AND properties['product_name'] != ''
            GROUP BY item_name, currency_type
            ORDER BY total_spent DESC
            LIMIT 20
          `,
          params,
        });
        const top_sinks = ((topSinksResult.data as any[]) || []).map(
          (r: any) => ({
            item_name: r.item_name,
            currency_type: r.currency_type || 'unknown',
            total_spent: round2(Number(r.total_spent) || 0),
            transaction_count: Number(r.transaction_count) || 0,
          })
        );

        // Compute source/sink ratio over time from flow data
        const ratio_trend = flow_over_time.map((f: any) => ({
          period: f.period,
          ratio: f.sink > 0 ? round2(f.source / f.sink) : 0,
          net_flow: round2(f.source - f.sink),
        }));

        return reply.send({
          success: true,
          data: {
            flow_over_time,
            by_currency,
            top_sinks,
            ratio_trend,
          },
        });
      } catch (err) {
        logger.error('Economy query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.code(500).send({ error: 'Economy query failed' });
      }
    }
  );

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // 4. GET /projects/:projectId/analytics/monetization/top-spenders
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization/top-spenders',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period, start, end, country, platform, app_version } =
        request.query as {
          period?: string;
          start?: string;
          end?: string;
          country?: string;
          platform?: string;
          app_version?: string;
        };

      try {
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });
        const params = {
          projectId,
          purchaseEvent: PURCHASE_EVENT,
          ...timeParams,
          ...segmentParams,
        };

        // Per-user spending
        const userSpendResult = await optic.rawQuery({
          query: `
            SELECT
              user_id,
              sum(numeric_properties['${AMOUNT_PROP}']) AS total_spent,
              count() AS purchase_count
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND user_id != ''
              AND ${timeWhere} ${segmentWhere}
            GROUP BY user_id
            ORDER BY total_spent DESC
          `,
          params,
        });
        const allSpenders = ((userSpendResult.data as any[]) || []).map(
          (r: any) => ({
            user_id: r.user_id,
            total_spent: Number(r.total_spent) || 0,
            purchase_count: Number(r.purchase_count) || 0,
          })
        );

        const totalRev = allSpenders.reduce((s, u) => s + u.total_spent, 0);
        const count = allSpenders.length;

        // Calculate segments
        const top1Pct = Math.max(1, Math.ceil(count * 0.01));
        const top10Pct = Math.max(1, Math.ceil(count * 0.1));

        const top1Revenue = allSpenders
          .slice(0, top1Pct)
          .reduce((s, u) => s + u.total_spent, 0);
        const top10Revenue = allSpenders
          .slice(0, top10Pct)
          .reduce((s, u) => s + u.total_spent, 0);

        const segments = [
          {
            segment: 'top_1_pct',
            user_count: top1Pct,
            revenue: round2(top1Revenue),
            percentage:
              totalRev > 0 ? round2((top1Revenue / totalRev) * 100) : 0,
          },
          {
            segment: 'top_10_pct',
            user_count: top10Pct,
            revenue: round2(top10Revenue),
            percentage:
              totalRev > 0 ? round2((top10Revenue / totalRev) * 100) : 0,
          },
          {
            segment: 'bottom_90_pct',
            user_count: count - top10Pct,
            revenue: round2(totalRev - top10Revenue),
            percentage:
              totalRev > 0
                ? round2(((totalRev - top10Revenue) / totalRev) * 100)
                : 0,
          },
        ];

        // Top 10 individual spenders
        const top_users = allSpenders.slice(0, 10).map((u) => ({
          ...u,
          total_spent: round2(u.total_spent),
          percentage:
            totalRev > 0 ? round2((u.total_spent / totalRev) * 100) : 0,
        }));

        // ?? Spending distribution (histogram buckets) ??
        const maxSpend =
          allSpenders.length > 0 ? allSpenders[0].total_spent : 0;
        const bucketSize =
          maxSpend > 0
            ? Math.pow(10, Math.floor(Math.log10(maxSpend / 5)))
            : 10;
        const distributionMap: Record<number, number> = {};
        for (const u of allSpenders) {
          const bucket = Math.floor(u.total_spent / bucketSize) * bucketSize;
          distributionMap[bucket] = (distributionMap[bucket] || 0) + 1;
        }
        const distribution = Object.entries(distributionMap)
          .map(([bucket, userCount]) => ({
            range_start: Number(bucket),
            range_end: Number(bucket) + bucketSize,
            user_count: userCount,
          }))
          .sort((a, b) => a.range_start - b.range_start);

        // ?? Whale dependency over time ??
        const grain = 'toDate';
        const whaleTrendResult = await optic.rawQuery({
          query: `
            WITH daily_user_spend AS (
              SELECT
                ${grain}(timestamp) AS period,
                user_id,
                sum(numeric_properties['${AMOUNT_PROP}']) AS spent
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {purchaseEvent:String}
                AND user_id != ''
                AND ${timeWhere} ${segmentWhere}
              GROUP BY period, user_id
            ),
            daily_ranked AS (
              SELECT
                period,
                spent,
                sum(spent) OVER (PARTITION BY period) AS daily_total,
                row_number() OVER (PARTITION BY period ORDER BY spent DESC) AS rn,
                count() OVER (PARTITION BY period) AS daily_count
              FROM daily_user_spend
            )
            SELECT
              period,
              sum(spent) AS top_revenue,
              any(daily_total) AS total_revenue
            FROM daily_ranked
            WHERE rn <= greatest(1, ceil(daily_count * 0.1))
            GROUP BY period
            ORDER BY period ASC
          `,
          params,
        });
        const whale_trend = ((whaleTrendResult.data as any[]) || []).map(
          (r: any) => {
            const topRev = Number(r.top_revenue) || 0;
            const totRev = Number(r.total_revenue) || 1;
            return {
              period: r.period,
              top10_pct_share: round2((topRev / totRev) * 100),
            };
          }
        );

        return reply.send({
          success: true,
          data: {
            segments,
            top_users,
            total_revenue: round2(totalRev),
            total_spenders: count,
            distribution,
            whale_trend,
          },
        });
      } catch (err) {
        logger.error('Top spenders query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.code(500).send({ error: 'Top spenders query failed' });
      }
    }
  );

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // 5. GET /projects/:projectId/analytics/monetization/ltv ??Revenue LTV
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization/ltv',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period, start, end, country, platform, app_version } =
        request.query as {
          period?: string;
          start?: string;
          end?: string;
          country?: string;
          platform?: string;
          app_version?: string;
        };

      try {
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });
        const params = {
          projectId,
          purchaseEvent: PURCHASE_EVENT,
          ...timeParams,
          ...segmentParams,
        };

        // Cumulative revenue per user by day-since-first-seen
        const ltvResult = await optic.rawQuery({
          query: `
            WITH user_first_seen AS (
              SELECT user_id, min(timestamp) AS first_ts
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND user_id != ''
                AND ${timeWhere} ${segmentWhere}
              GROUP BY user_id
            ),
            user_purchases AS (
              SELECT
                a.user_id,
                dateDiff('day', ufs.first_ts, a.timestamp) AS days_since_signup,
                numeric_properties['${AMOUNT_PROP}'] AS amount
              FROM ${TABLE} a
              JOIN user_first_seen ufs ON a.user_id = ufs.user_id
              WHERE a.project_id = {projectId:String}
                AND a.event_name = {purchaseEvent:String}
                AND ${timeWhere.replace(/timestamp/g, 'a.timestamp')}
            )
            SELECT
              days_since_signup,
              avg(amount) AS avg_revenue,
              count() AS purchase_count,
              uniqExact(user_id) AS user_count
            FROM user_purchases
            WHERE days_since_signup >= 0 AND days_since_signup <= 90
            GROUP BY days_since_signup
            ORDER BY days_since_signup ASC
          `,
          params,
        });

        const dailyData = ((ltvResult.data as any[]) || []).map((r: any) => ({
          day: Number(r.days_since_signup) || 0,
          avg_revenue: round2(Number(r.avg_revenue) || 0),
          purchase_count: Number(r.purchase_count) || 0,
          user_count: Number(r.user_count) || 0,
        }));

        // Calculate cumulative LTV
        let cumulative = 0;
        const ltv_curve = dailyData.map((d) => {
          cumulative += d.avg_revenue;
          return {
            day: d.day,
            cumulative_revenue: round2(cumulative),
            daily_revenue: d.avg_revenue,
            user_count: d.user_count,
          };
        });

        // ?? pLTV: Log-curve fitting (y = a * ln(x+1) + b) ??
        // Uses least-squares regression on transformed data
        let pltv_predictions: { day: number; predicted_ltv: number }[] = [];
        let pltv_confidence = 0;
        let pltv_coefficients = { a: 0, b: 0 };

        if (ltv_curve.length >= 5) {
          // Prepare data points: x_i = ln(day+1), y_i = cumulative_revenue
          const points = ltv_curve.filter((p) => p.day >= 1);
          const n = points.length;

          if (n >= 5) {
            let sumX = 0,
              sumY = 0,
              sumXY = 0,
              sumX2 = 0;
            for (const p of points) {
              const x = Math.log(p.day + 1);
              const y = p.cumulative_revenue;
              sumX += x;
              sumY += y;
              sumXY += x * y;
              sumX2 += x * x;
            }

            const denom = n * sumX2 - sumX * sumX;
            if (Math.abs(denom) > 1e-10) {
              const a = (n * sumXY - sumX * sumY) / denom;
              const b = (sumY - a * sumX) / n;
              pltv_coefficients = { a: round2(a), b: round2(b) };

              // R짼 calculation
              const yMean = sumY / n;
              let ssTot = 0,
                ssRes = 0;
              for (const p of points) {
                const x = Math.log(p.day + 1);
                const yPred = a * x + b;
                ssTot += (p.cumulative_revenue - yMean) ** 2;
                ssRes += (p.cumulative_revenue - yPred) ** 2;
              }
              pltv_confidence = ssTot > 0 ? round2(1 - ssRes / ssTot) : 0;

              // Predict at key milestones
              const predictionDays = [30, 60, 90, 120, 180, 365];
              const maxActualDay = Math.max(...ltv_curve.map((p) => p.day));
              pltv_predictions = predictionDays
                .filter((d) => d > maxActualDay) // Only predict beyond observed data
                .map((day) => ({
                  day,
                  predicted_ltv: round2(Math.max(0, a * Math.log(day + 1) + b)),
                }));

              // Also add predictions that extend the curve (for chart overlay)
              // Generate smooth prediction line from day 1 to day 365
            }
          }
        }

        // Build smooth predicted curve for chart overlay (one point per day, beyond actual data)
        const maxDay =
          ltv_curve.length > 0 ? Math.max(...ltv_curve.map((p) => p.day)) : 0;
        const pltv_curve: { day: number; predicted_ltv: number }[] = [];
        if (pltv_coefficients.a !== 0 && maxDay > 0) {
          for (let d = 0; d <= Math.min(365, maxDay * 4); d++) {
            pltv_curve.push({
              day: d,
              predicted_ltv: round2(
                Math.max(
                  0,
                  pltv_coefficients.a * Math.log(d + 1) + pltv_coefficients.b
                )
              ),
            });
          }
        }

        return reply.send({
          success: true,
          data: {
            ltv_curve,
            pltv_predictions,
            pltv_curve,
            pltv_confidence,
            pltv_coefficients,
          },
        });
      } catch (err) {
        logger.error('LTV query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.code(500).send({ error: 'LTV query failed' });
      }
    }
  );

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // 6. GET /projects/:projectId/analytics/monetization/cohort ??Revenue Cohort
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization/cohort',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period, start, end, country, platform, app_version } =
        request.query as {
          period?: string;
          start?: string;
          end?: string;
          country?: string;
          platform?: string;
          app_version?: string;
        };

      try {
        const { params: timeParams } = buildTimeRangeConditions(
          period,
          start,
          end
        );
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });
        const params = {
          projectId,
          purchaseEvent: PURCHASE_EVENT,
          ...timeParams,
          ...segmentParams,
        };

        // Group users by first-purchase week, track cumulative revenue at Day 0,7,14,30,60,90
        const result = await optic.rawQuery({
          query: `
            WITH user_cohort AS (
              SELECT
                user_id,
                toMonday(min(timestamp)) AS cohort_week
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {purchaseEvent:String}
                AND user_id != ''
                ${segmentWhere}
              GROUP BY user_id
            ),
            user_revenue AS (
              SELECT
                uc.cohort_week AS cohort_week,
                uc.user_id AS user_id,
                dateDiff('day', uc.cohort_week, a.timestamp) AS days_since,
                numeric_properties['${AMOUNT_PROP}'] AS amount
              FROM ${TABLE} a
              JOIN user_cohort uc ON a.user_id = uc.user_id
              WHERE a.project_id = {projectId:String}
                AND a.event_name = {purchaseEvent:String}
                ${segmentWhere}
            )
            SELECT
              cohort_week,
              multiIf(days_since <= 0, 0, days_since <= 7, 7, days_since <= 14, 14,
                      days_since <= 30, 30, days_since <= 60, 60, 90) AS bucket,
              sum(amount) AS revenue,
              uniqExact(user_id) AS users
            FROM user_revenue
            WHERE days_since >= 0 AND days_since <= 90
            GROUP BY cohort_week, bucket
            ORDER BY cohort_week ASC, bucket ASC
          `,
          params,
        });

        // Build cohort matrix
        type CohortRow = {
          cohort_week: string;
          buckets: Record<number, { revenue: number; users: number }>;
        };
        const cohortMap = new Map<string, CohortRow>();
        for (const r of (result.data as any[]) || []) {
          const week = String(r.cohort_week);
          if (!cohortMap.has(week)) {
            cohortMap.set(week, { cohort_week: week, buckets: {} });
          }
          cohortMap.get(week)!.buckets[Number(r.bucket)] = {
            revenue: round2(Number(r.revenue) || 0),
            users: Number(r.users) || 0,
          };
        }

        // Build cumulative cohort data
        const BUCKET_DAYS = [0, 7, 14, 30, 60, 90];
        const cohorts = Array.from(cohortMap.values())
          .slice(-12) // Last 12 weeks
          .map((c) => {
            let cumulative = 0;
            return {
              cohort_week: c.cohort_week,
              data: BUCKET_DAYS.map((d) => {
                const b = c.buckets[d];
                cumulative += b?.revenue || 0;
                return {
                  day: d,
                  cumulative_revenue: round2(cumulative),
                  users: b?.users || 0,
                };
              }),
            };
          });

        return reply.send({
          success: true,
          data: { cohorts, bucket_days: BUCKET_DAYS },
        });
      } catch (err) {
        logger.error('Revenue cohort query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.code(500).send({ error: 'Revenue cohort query failed' });
      }
    }
  );

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // 7. GET /projects/:projectId/analytics/monetization/funnel ??Purchase Funnel
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization/funnel',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period, start, end, country, platform, app_version } =
        request.query as {
          period?: string;
          start?: string;
          end?: string;
          country?: string;
          platform?: string;
          app_version?: string;
        };

      try {
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });
        const params = { projectId, ...timeParams, ...segmentParams };

        // Funnel stages: all_users ??view_shop ??view_product ??add_to_cart ??purchase
        const STAGES = [
          { name: 'all_users', event: null, label: 'All Active Users' },
          { name: 'view_shop', event: 'view_shop', label: 'Viewed Shop' },
          {
            name: 'view_product',
            event: 'view_product',
            label: 'Viewed Product',
          },
          { name: 'add_to_cart', event: 'add_to_cart', label: 'Added to Cart' },
          { name: 'purchase', event: PURCHASE_EVENT, label: 'Purchased' },
          { name: 'repeat_purchase', event: null, label: 'Repeat Purchase' },
        ];

        // Count unique users at each stage
        const stageResults: { name: string; label: string; users: number }[] =
          [];

        // All active users
        const allResult = await optic.rawQuery({
          query: `SELECT uniqExact(user_id) AS users FROM ${TABLE} WHERE project_id = {projectId:String} AND user_id != '' AND ${timeWhere} ${segmentWhere}`,
          params,
        });
        stageResults.push({
          name: 'all_users',
          label: 'All Active Users',
          users: Number((allResult.data as any[])?.[0]?.users) || 0,
        });

        // Event-based stages
        for (const stage of STAGES.filter((s) => s.event)) {
          const r = await optic.rawQuery({
            query: `SELECT uniqExact(user_id) AS users FROM ${TABLE} WHERE project_id = {projectId:String} AND event_name = {eventName:String} AND user_id != '' AND ${timeWhere} ${segmentWhere}`,
            params: { ...params, eventName: stage.event },
          });
          stageResults.push({
            name: stage.name,
            label: stage.label,
            users: Number((r.data as any[])?.[0]?.users) || 0,
          });
        }

        // Repeat purchasers (users with 2+ purchases)
        const repeatResult = await optic.rawQuery({
          query: `SELECT count() AS users FROM (SELECT user_id, count() AS cnt FROM ${TABLE} WHERE project_id = {projectId:String} AND event_name = {purchaseEvent:String} AND user_id != '' AND ${timeWhere} ${segmentWhere} GROUP BY user_id HAVING cnt >= 2)`,
          params: { ...params, purchaseEvent: PURCHASE_EVENT },
        });
        stageResults.push({
          name: 'repeat_purchase',
          label: 'Repeat Purchase',
          users: Number((repeatResult.data as any[])?.[0]?.users) || 0,
        });

        // Filter out stages with 0 users (events not instrumented)
        // Keep all_users and purchase always, filter middle stages only if ALL middle are 0
        const middleStages = stageResults.filter(
          (s) =>
            s.name !== 'all_users' &&
            s.name !== 'purchase' &&
            s.name !== 'repeat_purchase'
        );
        const hasMiddleData = middleStages.some((s) => s.users > 0);

        const funnel = hasMiddleData
          ? stageResults
          : stageResults.filter(
              (s) =>
                s.name === 'all_users' ||
                s.name === 'purchase' ||
                s.name === 'repeat_purchase'
            );

        return reply.send({ success: true, data: { stages: funnel } });
      } catch (err) {
        logger.error('Purchase funnel query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.code(500).send({ error: 'Purchase funnel query failed' });
      }
    }
  );

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // 8. GET /projects/:projectId/analytics/monetization/ltv-cohorts ??Cohort LTV Comparison
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization/ltv-cohorts',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period, start, end, cohort_by, country, platform, app_version } =
        request.query as {
          period?: string;
          start?: string;
          end?: string;
          cohort_by?: string;
          country?: string;
          platform?: string;
          app_version?: string;
        };

      try {
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });
        const params = {
          projectId,
          purchaseEvent: PURCHASE_EVENT,
          ...timeParams,
          ...segmentParams,
        };

        const result = await optic.rawQuery({
          query: `
            WITH user_meta AS (
              SELECT
                user_id,
                min(timestamp) AS first_ts,
                ${cohort_by === 'platform' ? 'any(platform)' : cohort_by === 'country' ? 'any(country)' : 'toMonday(min(timestamp))'} AS cohort_dim
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND user_id != ''
                AND ${timeWhere} ${segmentWhere}
              GROUP BY user_id
            ),
            user_purchases AS (
              SELECT
                um.cohort_dim AS cohort_dim,
                um.user_id AS user_id,
                dateDiff('day', um.first_ts, a.timestamp) AS days_since,
                numeric_properties['${AMOUNT_PROP}'] AS amount
              FROM ${TABLE} a
              JOIN user_meta um ON a.user_id = um.user_id
              WHERE a.project_id = {projectId:String}
                AND a.event_name = {purchaseEvent:String}
            )
            SELECT
              toString(cohort_dim) AS cohort_label,
              days_since,
              avg(amount) AS avg_revenue,
              uniqExact(user_id) AS user_count
            FROM user_purchases
            WHERE days_since >= 0 AND days_since <= 90
            GROUP BY cohort_label, days_since
            ORDER BY cohort_label ASC, days_since ASC
          `,
          params,
        });

        // Group by cohort_label and build LTV curves
        const cohortMap = new Map<
          string,
          { day: number; avg_revenue: number; user_count: number }[]
        >();
        for (const r of (result.data as any[]) || []) {
          const label = String(r.cohort_label);
          if (!cohortMap.has(label)) cohortMap.set(label, []);
          cohortMap.get(label)!.push({
            day: Number(r.days_since) || 0,
            avg_revenue: round2(Number(r.avg_revenue) || 0),
            user_count: Number(r.user_count) || 0,
          });
        }

        // Build cumulative LTV per cohort (top 8 by user count)
        const cohorts = Array.from(cohortMap.entries())
          .map(([label, data]) => {
            let cumulative = 0;
            const totalUsers = Math.max(...data.map((d) => d.user_count), 1);
            return {
              label,
              total_users: totalUsers,
              ltv_curve: data.map((d) => {
                cumulative += d.avg_revenue;
                return {
                  day: d.day,
                  cumulative_revenue: round2(cumulative),
                  user_count: d.user_count,
                };
              }),
            };
          })
          .sort((a, b) => b.total_users - a.total_users)
          .slice(0, 8);

        return reply.send({
          success: true,
          data: { cohorts, cohort_by: cohort_by || 'week' },
        });
      } catch (err) {
        logger.error('Cohort LTV query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.code(500).send({ error: 'Cohort LTV query failed' });
      }
    }
  );

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // 9. GET /projects/:projectId/analytics/monetization/segment-comparison
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization/segment-comparison',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period, start, end, country, platform, app_version } =
        request.query as {
          period?: string;
          start?: string;
          end?: string;
          country?: string;
          platform?: string;
          app_version?: string;
        };

      try {
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });
        const params = {
          projectId,
          purchaseEvent: PURCHASE_EVENT,
          ...timeParams,
          ...segmentParams,
        };

        // First: get per-user spend
        const userSpendResult = await optic.rawQuery({
          query: `
            SELECT
              user_id,
              sum(numeric_properties['${AMOUNT_PROP}']) AS total_spent,
              count() AS purchase_count,
              uniqExact(toDate(timestamp)) AS active_days,
              min(timestamp) AS first_purchase,
              max(timestamp) AS last_purchase
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND user_id != ''
              AND ${timeWhere} ${segmentWhere}
            GROUP BY user_id
            ORDER BY total_spent DESC
          `,
          params,
        });

        const allUsers = ((userSpendResult.data as any[]) || []).map(
          (r: any) => ({
            user_id: r.user_id,
            total_spent: Number(r.total_spent) || 0,
            purchase_count: Number(r.purchase_count) || 0,
            active_days: Number(r.active_days) || 0,
            first_purchase: r.first_purchase,
            last_purchase: r.last_purchase,
          })
        );

        if (allUsers.length === 0) {
          return reply.send({ success: true, data: { segments: [] } });
        }

        // Split into whale (top 10%) vs normal
        const whaleCount = Math.max(1, Math.ceil(allUsers.length * 0.1));
        const whales = allUsers.slice(0, whaleCount);
        const normals = allUsers.slice(whaleCount);

        const buildSegment = (users: typeof allUsers, name: string) => {
          if (users.length === 0) return null;
          const totalSpent = users.reduce((s, u) => s + u.total_spent, 0);
          const totalPurchases = users.reduce(
            (s, u) => s + u.purchase_count,
            0
          );
          const avgActiveDays =
            users.reduce((s, u) => s + u.active_days, 0) / users.length;
          return {
            segment: name,
            user_count: users.length,
            total_revenue: round2(totalSpent),
            avg_spend: round2(totalSpent / users.length),
            avg_purchases: round2(totalPurchases / users.length),
            avg_order_value: round2(
              totalPurchases > 0 ? totalSpent / totalPurchases : 0
            ),
            avg_active_days: round2(avgActiveDays),
          };
        };

        // Get top products per segment
        const getTopProducts = async (userIds: string[], limit: number) => {
          if (userIds.length === 0) return [];
          const r = await optic.rawQuery({
            query: `
              SELECT properties['product_name'] AS product_name, count() AS cnt
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {purchaseEvent:String}
                AND user_id IN (${userIds.map((_, i) => `{u${i}:String}`).join(',')})
                AND properties['product_name'] != ''
                AND ${timeWhere} ${segmentWhere}
              GROUP BY product_name
              ORDER BY cnt DESC
              LIMIT ${limit}
            `,
            params: {
              ...params,
              ...Object.fromEntries(userIds.map((id, i) => [`u${i}`, id])),
            },
          });
          return ((r.data as any[]) || []).map((row: any) => ({
            product_name: row.product_name,
            count: Number(row.cnt) || 0,
          }));
        };

        const [whaleProducts, normalProducts] = await Promise.all([
          getTopProducts(
            whales.slice(0, 50).map((u) => u.user_id),
            5
          ),
          getTopProducts(
            normals.slice(0, 200).map((u) => u.user_id),
            5
          ),
        ]);

        const segments = [
          { ...buildSegment(whales, 'whales')!, top_products: whaleProducts },
          ...(normals.length > 0
            ? [
                {
                  ...buildSegment(normals, 'normal')!,
                  top_products: normalProducts,
                },
              ]
            : []),
        ];

        return reply.send({ success: true, data: { segments } });
      } catch (err) {
        logger.error('Segment comparison query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply
          .code(500)
          .send({ error: 'Segment comparison query failed' });
      }
    }
  );

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // 12. GET /projects/:projectId/analytics/monetization/transactions ??Transaction Ledger
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization/transactions',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period,
        start,
        end,
        type,
        user_id,
        product,
        reason,
        min_amount,
        max_amount,
        sort,
        order,
        offset,
        limit,
        group_by,
        user_ids,
        products,
        reasons,
        payment_methods,
        country,
        platform,
        app_version,
      } = request.query as {
        period?: string;
        start?: string;
        end?: string;
        type?: string;
        user_id?: string;
        product?: string;
        reason?: string;
        min_amount?: string;
        max_amount?: string;
        sort?: string;
        order?: string;
        offset?: string;
        limit?: string;
        group_by?: string;
        user_ids?: string;
        products?: string;
        reasons?: string;
        payment_methods?: string;
        country?: string;
        platform?: string;
        app_version?: string;
      };

      try {
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });
        const params: Record<string, any> = {
          projectId,
          ...timeParams,
          ...segmentParams,
        };

        // Event type filter
        const eventTypes: string[] = [];
        if (!type || type === 'all') {
          eventTypes.push(
            PURCHASE_EVENT,
            REFUND_EVENT,
            GRANT_EVENT,
            AD_IMPRESSION_EVENT
          );
        } else {
          for (const t of type.split(',')) {
            if (t === 'purchase') eventTypes.push(PURCHASE_EVENT);
            else if (t === 'refund') eventTypes.push(REFUND_EVENT);
            else if (t === 'grant') eventTypes.push(GRANT_EVENT);
            else if (t === 'ad_impression')
              eventTypes.push(AD_IMPRESSION_EVENT);
          }
        }
        const eventFilter = eventTypes
          .map((e, i) => {
            params[`evt${i}`] = e;
            return `{evt${i}:String}`;
          })
          .join(',');

        // Build extra conditions
        const extraConds: string[] = [];
        if (user_id) {
          extraConds.push(`user_id = {filterUserId:String}`);
          params.filterUserId = user_id;
        }
        if (user_ids) {
          const uids = user_ids.split(',').filter(Boolean);
          if (uids.length > 0) {
            const uidPh = uids
              .map((u, i) => {
                params[`uid${i}`] = u;
                return `{uid${i}:String}`;
              })
              .join(',');
            extraConds.push(`user_id IN (${uidPh})`);
          }
        }
        if (product) {
          const escapedProduct = product
            .replace(/%/g, '\\%')
            .replace(/_/g, '\\_');
          extraConds.push(
            `properties['product_name'] ILIKE {filterProduct:String}`
          );
          params.filterProduct = `%${escapedProduct}%`;
        }
        if (products) {
          const prods = products.split(',').filter(Boolean);
          if (prods.length > 0) {
            const prodPh = prods
              .map((p, i) => {
                params[`prod${i}`] = p;
                return `{prod${i}:String}`;
              })
              .join(',');
            extraConds.push(`properties['product_name'] IN (${prodPh})`);
          }
        }
        if (reason) {
          extraConds.push(`properties['reason'] = {filterReason:String}`);
          params.filterReason = reason;
        }
        if (reasons) {
          const rsns = reasons.split(',').filter(Boolean);
          if (rsns.length > 0) {
            const rsnPh = rsns
              .map((r, i) => {
                params[`rsn${i}`] = r;
                return `{rsn${i}:String}`;
              })
              .join(',');
            extraConds.push(`properties['reason'] IN (${rsnPh})`);
          }
        }
        if (payment_methods) {
          const pms = payment_methods.split(',').filter(Boolean);
          if (pms.length > 0) {
            const pmPh = pms
              .map((pm, i) => {
                params[`pm${i}`] = pm;
                return `{pm${i}:String}`;
              })
              .join(',');
            extraConds.push(`properties['payment_method'] IN (${pmPh})`);
          }
        }
        if (min_amount) {
          extraConds.push(
            `numeric_properties['${AMOUNT_PROP}'] >= {minAmt:Float64}`
          );
          params.minAmt = parseFloat(min_amount);
        }
        if (max_amount) {
          extraConds.push(
            `numeric_properties['${AMOUNT_PROP}'] <= {maxAmt:Float64}`
          );
          params.maxAmt = parseFloat(max_amount);
        }
        const extraWhere =
          extraConds.length > 0 ? ' AND ' + extraConds.join(' AND ') : '';
        const baseWhere = `project_id = {projectId:String} AND event_name IN (${eventFilter}) AND ${timeWhere} ${segmentWhere}${extraWhere}`;

        // ??? GROUP BY mode ???
        const groupMode = group_by || 'none';
        if (groupMode !== 'none') {
          const groupMap: Record<string, { col: string; sortDefault: string }> =
            {
              product: {
                col: `properties['product_name']`,
                sortDefault: 'total_amount',
              },
              user: { col: 'user_id', sortDefault: 'total_amount' },
              day: { col: 'toDate(timestamp)', sortDefault: 'group_key' },
              hour: {
                col: 'toStartOfHour(timestamp)',
                sortDefault: 'group_key',
              },
              reason: { col: `properties['reason']`, sortDefault: 'cnt' },
            };
          const gm = groupMap[groupMode];
          if (!gm)
            return reply
              .code(400)
              .send({ error: `Invalid group_by: ${groupMode}` });

          const sortField =
            sort === 'amount'
              ? 'total_amount'
              : sort === 'count'
                ? 'cnt'
                : gm.sortDefault;
          const sortDirection = order === 'asc' ? 'ASC' : 'DESC';
          const gOff = parseInt(offset || '0', 10) || 0;
          const gLim = Math.min(parseInt(limit || '50', 10) || 50, 500);

          const countResult = await optic.rawQuery({
            query: `SELECT count(DISTINCT ${gm.col}) AS total FROM ${TABLE} WHERE ${baseWhere}`,
            params,
          });
          const totalGroups =
            Number((countResult.data as any[])?.[0]?.total) || 0;

          const groupResult = await optic.rawQuery({
            query: `
              SELECT
                ${gm.col} AS group_key,
                count() AS cnt,
                sum(numeric_properties['${AMOUNT_PROP}']) AS total_amount,
                avg(numeric_properties['${AMOUNT_PROP}']) AS avg_amount,
                min(timestamp) AS first_at,
                max(timestamp) AS last_at,
                uniqExact(user_id) AS unique_users
              FROM ${TABLE}
              WHERE ${baseWhere}
              GROUP BY group_key
              ORDER BY ${sortField} ${sortDirection}
              LIMIT {gLim:UInt32} OFFSET {gOff:UInt32}
            `,
            params: { ...params, gLim, gOff },
          });

          const groups = ((groupResult.data as any[]) || []).map((r: any) => ({
            group_key: String(r.group_key ?? ''),
            count: Number(r.cnt) || 0,
            total_amount: round2(Number(r.total_amount) || 0),
            avg_amount: round2(Number(r.avg_amount) || 0),
            first_at: r.first_at || '',
            last_at: r.last_at || '',
            unique_users: Number(r.unique_users) || 0,
          }));

          // Summary
          const summaryResult = await optic.rawQuery({
            query: `SELECT event_name, count() AS cnt, sum(numeric_properties['${AMOUNT_PROP}']) AS total_amount FROM ${TABLE} WHERE ${baseWhere} GROUP BY event_name`,
            params,
          });
          const summary: Record<string, { count: number; total: number }> = {};
          for (const r of (summaryResult.data as any[]) || []) {
            summary[r.event_name] = {
              count: Number(r.cnt) || 0,
              total: round2(Number(r.total_amount) || 0),
            };
          }

          return reply.send({
            success: true,
            data: {
              mode: 'grouped',
              group_by: groupMode,
              groups,
              total_groups: totalGroups,
              summary: {
                purchase_total: summary[PURCHASE_EVENT]?.total || 0,
                purchase_count: summary[PURCHASE_EVENT]?.count || 0,
                refund_total: summary[REFUND_EVENT]?.total || 0,
                refund_count: summary[REFUND_EVENT]?.count || 0,
                grant_total: summary[GRANT_EVENT]?.total || 0,
                grant_count: summary[GRANT_EVENT]?.count || 0,
                ad_total: summary[AD_IMPRESSION_EVENT]?.total || 0,
                ad_count: summary[AD_IMPRESSION_EVENT]?.count || 0,
              },
              has_more: groups.length >= gLim,
            },
          });
        }

        // ??? Normal (non-grouped) mode ???
        // Sort
        const sortCol =
          sort === 'amount'
            ? `numeric_properties['${AMOUNT_PROP}']`
            : 'timestamp';
        const sortDir = order === 'asc' ? 'ASC' : 'DESC';

        const off = parseInt(offset || '0', 10) || 0;
        const lim = Math.min(parseInt(limit || '50', 10) || 50, 10000);

        // Count query
        const countResult = await optic.rawQuery({
          query: `SELECT count() AS total FROM ${TABLE} WHERE ${baseWhere}`,
          params,
        });
        const totalCount = Number((countResult.data as any[])?.[0]?.total) || 0;

        // Summary query
        const summaryResult = await optic.rawQuery({
          query: `
            SELECT event_name, count() AS cnt, sum(numeric_properties['${AMOUNT_PROP}']) AS total_amount
            FROM ${TABLE} WHERE ${baseWhere} GROUP BY event_name
          `,
          params,
        });
        const summary: Record<string, { count: number; total: number }> = {};
        for (const r of (summaryResult.data as any[]) || []) {
          summary[r.event_name] = {
            count: Number(r.cnt) || 0,
            total: round2(Number(r.total_amount) || 0),
          };
        }

        // Transaction rows
        const txResult = await optic.rawQuery({
          query: `
            SELECT
              event_id, event_name, timestamp, user_id,
              properties['product_name'] AS product_name,
              numeric_properties['${AMOUNT_PROP}'] AS amount,
              properties['currency'] AS currency,
              properties['reason'] AS reason,
              properties['payment_method'] AS payment_method,
              properties['ad_type'] AS ad_type,
              properties['ad_sdk'] AS ad_sdk,
              numeric_properties['ad_revenue'] AS ad_revenue,
              numeric_properties['ad_ecpm'] AS ad_ecpm
            FROM ${TABLE}
            WHERE ${baseWhere}
            ORDER BY ${sortCol} ${sortDir}
            LIMIT {lim:UInt32} OFFSET {off:UInt32}
          `,
          params: { ...params, lim: lim + 1, off },
        });

        const rows = ((txResult.data as any[]) || [])
          .slice(0, lim)
          .map((r: any) => {
            const evtName = r.event_name;
            const amt =
              evtName === AD_IMPRESSION_EVENT
                ? round2(Number(r.ad_revenue) || 0)
                : round2(Number(r.amount) || 0);
            return {
              event_id: r.event_id || '',
              event_type: evtName,
              timestamp: r.timestamp,
              user_id: r.user_id || '',
              product_name: r.product_name || '',
              amount: amt,
              currency: r.currency || 'USD',
              reason: r.reason || '',
              payment_method: r.payment_method || '',
              ad_type: r.ad_type || '',
              ad_sdk: r.ad_sdk || '',
              ad_ecpm: round2(Number(r.ad_ecpm) || 0),
            };
          });
        const hasMore = ((txResult.data as any[]) || []).length > lim;

        return reply.send({
          success: true,
          data: {
            mode: 'flat',
            transactions: rows,
            total_count: totalCount,
            summary: {
              purchase_total: summary[PURCHASE_EVENT]?.total || 0,
              purchase_count: summary[PURCHASE_EVENT]?.count || 0,
              refund_total: summary[REFUND_EVENT]?.total || 0,
              refund_count: summary[REFUND_EVENT]?.count || 0,
              grant_total: summary[GRANT_EVENT]?.total || 0,
              grant_count: summary[GRANT_EVENT]?.count || 0,
              ad_total: summary[AD_IMPRESSION_EVENT]?.total || 0,
              ad_count: summary[AD_IMPRESSION_EVENT]?.count || 0,
            },
            has_more: hasMore,
          },
        });
      } catch (err) {
        logger.error('Transaction ledger query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply
          .code(500)
          .send({ error: 'Transaction ledger query failed' });
      }
    }
  );

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // 12-B. GET /projects/:projectId/analytics/monetization/transactions/facets
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization/transactions/facets',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period, start, end, facet, country, platform, app_version } =
        request.query as {
          period?: string;
          start?: string;
          end?: string;
          facet?: string;
          country?: string;
          platform?: string;
          app_version?: string;
        };

      if (!facet)
        return reply.code(400).send({ error: 'facet param required' });

      try {
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });
        const params: Record<string, any> = {
          projectId,
          ...timeParams,
          ...segmentParams,
        };

        const colMap: Record<string, string> = {
          product: `properties['product_name']`,
          reason: `properties['reason']`,
          payment_method: `properties['payment_method']`,
          user: 'user_id',
        };
        const col = colMap[facet];
        if (!col)
          return reply.code(400).send({ error: `Invalid facet: ${facet}` });

        const result = await optic.rawQuery({
          query: `
            SELECT ${col} AS val, count() AS cnt
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name IN ('${PURCHASE_EVENT}','${REFUND_EVENT}','${GRANT_EVENT}','${AD_IMPRESSION_EVENT}')
              AND ${timeWhere} ${segmentWhere}
              AND ${col} != ''
            GROUP BY val
            ORDER BY cnt DESC
            LIMIT 200
          `,
          params,
        });

        const values = ((result.data as any[]) || []).map((r: any) => ({
          value: String(r.val || ''),
          count: Number(r.cnt) || 0,
        }));

        return reply.send({ success: true, data: { facet, values } });
      } catch (err) {
        logger.error('Transaction facets query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.code(500).send({ error: 'Facets query failed' });
      }
    }
  );

  // 13. GET /projects/:projectId/analytics/monetization/user-summary
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization/user-summary',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { user_id, period, start, end, country, platform, app_version } =
        request.query as {
          user_id?: string;
          period?: string;
          start?: string;
          end?: string;
          country?: string;
          platform?: string;
          app_version?: string;
        };

      if (!user_id) {
        return reply.code(400).send({ error: 'user_id is required' });
      }

      try {
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });
        const params: Record<string, any> = {
          projectId,
          userId: user_id,
          ...timeParams,
          ...segmentParams,
        };

        // Summary aggregates
        const summaryResult = await optic.rawQuery({
          query: `
            SELECT
              event_name,
              count() AS cnt,
              sum(numeric_properties['${AMOUNT_PROP}']) AS total_amount,
              min(timestamp) AS first_at,
              max(timestamp) AS last_at
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND user_id = {userId:String}
              AND event_name IN ('${PURCHASE_EVENT}','${REFUND_EVENT}','${GRANT_EVENT}')
              AND ${timeWhere} ${segmentWhere}
            GROUP BY event_name
          `,
          params,
        });
        const sums: Record<
          string,
          { count: number; total: number; first: string; last: string }
        > = {};
        for (const r of (summaryResult.data as any[]) || []) {
          sums[r.event_name] = {
            count: Number(r.cnt) || 0,
            total: round2(Number(r.total_amount) || 0),
            first: r.first_at || '',
            last: r.last_at || '',
          };
        }

        const purchaseTotal = sums[PURCHASE_EVENT]?.total || 0;
        const refundTotal = sums[REFUND_EVENT]?.total || 0;
        const grantTotal = sums[GRANT_EVENT]?.total || 0;

        // Individual transactions (last 100 of each type)
        const fetchRows = async (eventName: string, maxRows = 100) => {
          const r = await optic.rawQuery({
            query: `
              SELECT
                event_id, timestamp, 
                properties['product_name'] AS product_name,
                numeric_properties['${AMOUNT_PROP}'] AS amount,
                properties['currency'] AS currency,
                properties['reason'] AS reason,
                properties['payment_method'] AS payment_method
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND user_id = {userId:String}
                AND event_name = {evtName:String}
                AND ${timeWhere} ${segmentWhere}
              ORDER BY timestamp DESC
              LIMIT {maxRows:UInt32}
            `,
            params: { ...params, evtName: eventName, maxRows },
          });
          return ((r.data as any[]) || []).map((row: any) => ({
            event_id: row.event_id || '',
            timestamp: row.timestamp,
            product_name: row.product_name || '',
            amount: round2(Number(row.amount) || 0),
            currency: row.currency || 'USD',
            reason: row.reason || '',
            payment_method: row.payment_method || '',
          }));
        };

        const [purchases, refunds, grants] = await Promise.all([
          fetchRows(PURCHASE_EVENT),
          fetchRows(REFUND_EVENT),
          fetchRows(GRANT_EVENT),
        ]);

        return reply.send({
          success: true,
          data: {
            summary: {
              total_purchases: purchaseTotal,
              purchase_count: sums[PURCHASE_EVENT]?.count || 0,
              total_refunds: refundTotal,
              refund_count: sums[REFUND_EVENT]?.count || 0,
              total_grants: grantTotal,
              grant_count: sums[GRANT_EVENT]?.count || 0,
              net_revenue: round2(purchaseTotal - refundTotal),
              refund_rate:
                purchaseTotal > 0
                  ? round2((refundTotal / purchaseTotal) * 100)
                  : 0,
              first_purchase: sums[PURCHASE_EVENT]?.first || null,
              last_purchase: sums[PURCHASE_EVENT]?.last || null,
            },
            purchases,
            refunds,
            grants,
          },
        });
      } catch (err) {
        logger.error('User financial summary query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply
          .code(500)
          .send({ error: 'User financial summary query failed' });
      }
    }
  );

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // 14. GET /projects/:projectId/analytics/monetization/products/hourly
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization/products/hourly',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        product_name,
        period,
        start,
        end,
        country,
        platform,
        app_version,
      } = request.query as {
        product_name?: string;
        period?: string;
        start?: string;
        end?: string;
        country?: string;
        platform?: string;
        app_version?: string;
      };

      if (!product_name) {
        return reply.code(400).send({ error: 'product_name is required' });
      }

      try {
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });
        const params: Record<string, any> = {
          projectId,
          productName: product_name,
          purchaseEvent: PURCHASE_EVENT,
          tz: (request.query as any).tz || 'UTC',
          ...timeParams,
          ...segmentParams,
        };

        const result = await optic.rawQuery({
          query: `
            SELECT
              toDayOfWeek(timestamp, {tz:String}) AS day_of_week,
              toHour(timestamp, {tz:String}) AS hour,
              sum(numeric_properties['${AMOUNT_PROP}']) AS revenue,
              count() AS cnt
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND properties['product_name'] = {productName:String}
              AND ${timeWhere} ${segmentWhere}
            GROUP BY day_of_week, hour
            ORDER BY day_of_week ASC, hour ASC
          `,
          params,
        });

        const heatmap = ((result.data as any[]) || []).map((r: any) => ({
          day_of_week: Number(r.day_of_week) || 0,
          hour: Number(r.hour) || 0,
          revenue: round2(Number(r.revenue) || 0),
          count: Number(r.cnt) || 0,
        }));

        return reply.send({ success: true, data: { heatmap } });
      } catch (err) {
        logger.error('Product hourly heatmap query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply
          .code(500)
          .send({ error: 'Product hourly heatmap query failed' });
      }
    }
  );

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // 15. GET /projects/:projectId/analytics/monetization/acquisition
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  app.get(
    '/projects/:projectId/analytics/monetization/acquisition',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period,
        start,
        end,
        groupBy,
        country,
        platform,
        app_version,
        attributionModel,
      } = request.query as {
        period?: string;
        start?: string;
        end?: string;
        groupBy?: string;
        country?: string;
        platform?: string;
        app_version?: string;
        attributionModel?: 'last' | 'first' | 'linear';
      };

      const groupMode = groupBy || 'source';
      const model = attributionModel || 'last';
      const dimMap: Record<string, { col: string; fallback: string }> = {
        source: { col: 'utm_source', fallback: '(direct)' },
        medium: { col: 'utm_medium', fallback: '(none)' },
        campaign: { col: 'utm_campaign', fallback: '(not set)' },
        platform: { col: 'platform', fallback: '(unknown)' },
      };
      const dim = dimMap[groupMode] || dimMap.source;

      try {
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const { segmentWhere, segmentParams } = buildSegmentFilter({
          country,
          platform,
          app_version,
        });

        // Get POSIX timestamps for sessions started time constraint
        const isCustom = start && end;
        const { getBucketingConfig } = await import('../utils/timeBucket');
        const bucket = getBucketingConfig(
          period || '30d',
          isCustom ? start : undefined,
          isCustom ? end : undefined,
          'started'
        );

        const params: Record<string, any> = {
          projectId,
          purchaseEvent: PURCHASE_EVENT,
          fallbackVal: dim.fallback,
          fillStart: bucket.queryParams.fillStart,
          fillEnd: bucket.queryParams.fillEnd,
          ...timeParams,
          ...segmentParams,
        };

        // Build dynamically depending on the selected attribution model
        let summaryQuery = '';
        let chartQuery = '';
        let tableQuery = '';

        if (model === 'first') {
          summaryQuery = `
            SELECT
              count(DISTINCT s.session_id) AS total_sessions,
              uniqExact(s.distinct_id) AS total_users,
              sum(a.revenue) AS total_revenue,
              uniqExact(a.user_id) AS total_paying_users
            FROM (
              SELECT distinct_id, session_id
              FROM (
                SELECT distinct_id, session_id, started
                FROM argus.sessions
                WHERE project_id = {projectId:String}
                  AND started >= toDateTime({fillStart:UInt32})
                  AND started <= toDateTime({fillEnd:UInt32})
                ORDER BY started ASC
              )
              LIMIT 1 BY distinct_id
            ) s
            LEFT JOIN (
              SELECT
                user_id,
                sum(amount_usd) AS revenue
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {purchaseEvent:String}
                AND ${timeWhere} ${segmentWhere}
              GROUP BY user_id
            ) a ON s.distinct_id = a.user_id
          `;

          chartQuery = `
            SELECT
              toDate(s.started) AS period,
              count(DISTINCT s.session_id) AS sessions,
              sum(a.revenue) AS revenue
            FROM (
              SELECT distinct_id, session_id, started
              FROM (
                SELECT distinct_id, session_id, started
                FROM argus.sessions
                WHERE project_id = {projectId:String}
                  AND started >= toDateTime({fillStart:UInt32})
                  AND started <= toDateTime({fillEnd:UInt32})
                ORDER BY started ASC
              )
              LIMIT 1 BY distinct_id
            ) s
            LEFT JOIN (
              SELECT
                user_id,
                sum(amount_usd) AS revenue
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {purchaseEvent:String}
                AND ${timeWhere} ${segmentWhere}
              GROUP BY user_id
            ) a ON s.distinct_id = a.user_id
            GROUP BY period
            ORDER BY period ASC
          `;

          tableQuery = `
            SELECT
              multiIf(${dim.col} = '', {fallbackVal:String}, isNull(${dim.col}), {fallbackVal:String}, ${dim.col}) AS dimension,
              count(DISTINCT s.session_id) AS sessions,
              uniqExact(s.distinct_id) AS users,
              sum(a.revenue) AS revenue,
              uniqExact(a.user_id) AS paying_users,
              avg(s.duration) AS avg_duration
            FROM (
              SELECT distinct_id, session_id, duration, utm_source, utm_medium, utm_campaign
              FROM (
                SELECT distinct_id, session_id, duration, utm_source, utm_medium, utm_campaign, started
                FROM argus.sessions
                WHERE project_id = {projectId:String}
                  AND started >= toDateTime({fillStart:UInt32})
                  AND started <= toDateTime({fillEnd:UInt32})
                ORDER BY started ASC
              )
              LIMIT 1 BY distinct_id
            ) s
            LEFT JOIN (
              SELECT
                user_id,
                sum(amount_usd) AS revenue
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {purchaseEvent:String}
                AND ${timeWhere} ${segmentWhere}
              GROUP BY user_id
            ) a ON s.distinct_id = a.user_id
            GROUP BY dimension
            ORDER BY sessions DESC
            LIMIT 200
          `;
        } else if (model === 'linear') {
          summaryQuery = `
            SELECT
              count(DISTINCT s.session_id) AS total_sessions,
              uniqExact(s.distinct_id) AS total_users,
              sum(ifNull(a.total_revenue, 0) / u.total_sessions_count) AS total_revenue,
              uniqExact(a.user_id) AS total_paying_users
            FROM argus.sessions s
            INNER JOIN (
              SELECT
                distinct_id,
                count() AS total_sessions_count
              FROM argus.sessions
              WHERE project_id = {projectId:String}
                AND started >= toDateTime({fillStart:UInt32})
                AND started <= toDateTime({fillEnd:UInt32})
              GROUP BY distinct_id
            ) u ON s.distinct_id = u.distinct_id
            LEFT JOIN (
              SELECT
                user_id,
                sum(amount_usd) AS total_revenue
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {purchaseEvent:String}
                AND ${timeWhere} ${segmentWhere}
              GROUP BY user_id
            ) a ON s.distinct_id = a.user_id
            WHERE s.project_id = {projectId:String}
              AND s.started >= toDateTime({fillStart:UInt32})
              AND s.started <= toDateTime({fillEnd:UInt32})
          `;

          chartQuery = `
            SELECT
              toDate(s.started) AS period,
              count(DISTINCT s.session_id) AS sessions,
              sum(ifNull(a.total_revenue, 0) / u.total_sessions_count) AS revenue
            FROM argus.sessions s
            INNER JOIN (
              SELECT
                distinct_id,
                count() AS total_sessions_count
              FROM argus.sessions
              WHERE project_id = {projectId:String}
                AND started >= toDateTime({fillStart:UInt32})
                AND started <= toDateTime({fillEnd:UInt32})
              GROUP BY distinct_id
            ) u ON s.distinct_id = u.distinct_id
            LEFT JOIN (
              SELECT
                user_id,
                sum(amount_usd) AS total_revenue
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {purchaseEvent:String}
                AND ${timeWhere} ${segmentWhere}
              GROUP BY user_id
            ) a ON s.distinct_id = a.user_id
            WHERE s.project_id = {projectId:String}
              AND s.started >= toDateTime({fillStart:UInt32})
              AND s.started <= toDateTime({fillEnd:UInt32})
            GROUP BY period
            ORDER BY period ASC
          `;

          tableQuery = `
            SELECT
              multiIf(${dim.col} = '', {fallbackVal:String}, isNull(${dim.col}), {fallbackVal:String}, ${dim.col}) AS dimension,
              count(DISTINCT s.session_id) AS sessions,
              uniqExact(s.distinct_id) AS users,
              sum(ifNull(a.total_revenue, 0) / u.total_sessions_count) AS revenue,
              uniqExact(a.user_id) AS paying_users,
              avg(s.duration) AS avg_duration
            FROM argus.sessions s
            INNER JOIN (
              SELECT
                distinct_id,
                count() AS total_sessions_count
              FROM argus.sessions
              WHERE project_id = {projectId:String}
                AND started >= toDateTime({fillStart:UInt32})
                AND started <= toDateTime({fillEnd:UInt32})
              GROUP BY distinct_id
            ) u ON s.distinct_id = u.distinct_id
            LEFT JOIN (
              SELECT
                user_id,
                sum(amount_usd) AS total_revenue
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {purchaseEvent:String}
                AND ${timeWhere} ${segmentWhere}
              GROUP BY user_id
            ) a ON s.distinct_id = a.user_id
            WHERE s.project_id = {projectId:String}
              AND s.started >= toDateTime({fillStart:UInt32})
              AND s.started <= toDateTime({fillEnd:UInt32})
            GROUP BY dimension
            ORDER BY sessions DESC
            LIMIT 200
          `;
        } else {
          // 'last' model (default)
          summaryQuery = `
            SELECT
              count(DISTINCT s.session_id) AS total_sessions,
              uniqExact(s.distinct_id) AS total_users,
              sum(a.revenue) AS total_revenue,
              uniqExact(a.user_id) AS total_paying_users
            FROM argus.sessions s
            LEFT JOIN (
              SELECT
                session_id,
                sum(amount_usd) AS revenue,
                user_id
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {purchaseEvent:String}
                AND ${timeWhere} ${segmentWhere}
              GROUP BY session_id, user_id
            ) a ON s.session_id = a.session_id
            WHERE s.project_id = {projectId:String}
              AND s.started >= toDateTime({fillStart:UInt32})
              AND s.started <= toDateTime({fillEnd:UInt32})
          `;

          chartQuery = `
            SELECT
              toDate(s.started) AS period,
              count(DISTINCT s.session_id) AS sessions,
              sum(a.revenue) AS revenue
            FROM argus.sessions s
            LEFT JOIN (
              SELECT
                session_id,
                sum(amount_usd) AS revenue
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {purchaseEvent:String}
                AND ${timeWhere} ${segmentWhere}
              GROUP BY session_id
            ) a ON s.session_id = a.session_id
            WHERE s.project_id = {projectId:String}
              AND s.started >= toDateTime({fillStart:UInt32})
              AND s.started <= toDateTime({fillEnd:UInt32})
            GROUP BY period
            ORDER BY period ASC
          `;

          tableQuery = `
            SELECT
              multiIf(${dim.col} = '', {fallbackVal:String}, isNull(${dim.col}), {fallbackVal:String}, ${dim.col}) AS dimension,
              count(DISTINCT s.session_id) AS sessions,
              uniqExact(s.distinct_id) AS users,
              sum(a.revenue) AS revenue,
              uniqExact(a.user_id) AS paying_users,
              avg(s.duration) AS avg_duration
            FROM argus.sessions s
            LEFT JOIN (
              SELECT
                session_id,
                sum(amount_usd) AS revenue,
                user_id
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND event_name = {purchaseEvent:String}
                AND ${timeWhere} ${segmentWhere}
              GROUP BY session_id, user_id
            ) a ON s.session_id = a.session_id
            WHERE s.project_id = {projectId:String}
              AND s.started >= toDateTime({fillStart:UInt32})
              AND s.started <= toDateTime({fillEnd:UInt32})
            GROUP BY dimension
            ORDER BY sessions DESC
            LIMIT 200
          `;
        }

        // Build previous-period summary query (mirrors the current summaryQuery but for the previous period)
        const { conditions: prevConds, params: prevParams } =
          buildPreviousPeriodConditions(period, start, end);
        const prevTimeWhere = prevConds.join(' AND ');
        // For previous period we always use 'last touch' style on sessions to keep it simple
        const prevSummaryQuery = `
          SELECT
            count(DISTINCT s.session_id) AS total_sessions,
            uniqExact(s.distinct_id) AS total_users,
            sum(a.revenue) AS total_revenue,
            uniqExact(a.user_id) AS total_paying_users
          FROM argus.sessions s
          LEFT JOIN (
            SELECT
              session_id,
              sum(amount_usd) AS revenue,
              user_id
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {purchaseEvent:String}
              AND ${prevTimeWhere} ${segmentWhere}
            GROUP BY session_id, user_id
          ) a ON s.session_id = a.session_id
          WHERE s.project_id = {projectId:String}
            AND ${prevTimeWhere.replace(/timestamp/g, 's.started')}
        `;

        // 1. Summary Query
        const summaryPromise = optic.rawQuery({
          query: summaryQuery,
          params,
        });

        // 2. Chart Trend Query
        const chartPromise = optic.rawQuery({
          query: chartQuery,
          params,
        });

        // 3. Dimension Table Query
        const tablePromise = optic.rawQuery({
          query: tableQuery,
          params,
        });

        // 4. Previous-period Summary Query (for PoP)
        const prevSummaryPromise = optic
          .rawQuery({
            query: prevSummaryQuery,
            params: { ...params, ...prevParams },
          })
          .catch(() => ({ data: [] }));

        const [summaryRes, chartRes, tableRes, prevSummaryRes] =
          await Promise.all([
            summaryPromise,
            chartPromise,
            tablePromise,
            prevSummaryPromise,
          ]);

        const summary = (summaryRes.data as any[])?.[0] || {
          total_sessions: 0,
          total_users: 0,
          total_revenue: 0,
          total_paying_users: 0,
        };

        const chart = ((chartRes.data as any[]) || []).map((r: any) => ({
          period: String(r.period),
          sessions: Number(r.sessions) || 0,
          revenue: round2(Number(r.revenue) || 0),
        }));

        const table = ((tableRes.data as any[]) || []).map((r: any) => ({
          dimension: String(r.dimension),
          sessions: Number(r.sessions) || 0,
          users: Number(r.users) || 0,
          revenue: round2(Number(r.revenue) || 0),
          paying_users: Number(r.paying_users) || 0,
          avg_duration: round2(Number(r.avg_duration) || 0),
        }));

        const prevSummaryRaw = (prevSummaryRes.data as any[])?.[0] || {};

        return reply.send({
          success: true,
          data: {
            summary: {
              total_sessions: Number(summary.total_sessions) || 0,
              total_users: Number(summary.total_users) || 0,
              total_revenue: round2(Number(summary.total_revenue) || 0),
              total_paying_users: Number(summary.total_paying_users) || 0,
              conversion_rate:
                summary.total_users > 0
                  ? round2(
                      (Number(summary.total_paying_users) /
                        Number(summary.total_users)) *
                        100
                    )
                  : 0,
            },
            summary_prev: {
              total_sessions: Number(prevSummaryRaw.total_sessions) || 0,
              total_users: Number(prevSummaryRaw.total_users) || 0,
              total_revenue: round2(Number(prevSummaryRaw.total_revenue) || 0),
              total_paying_users:
                Number(prevSummaryRaw.total_paying_users) || 0,
              conversion_rate:
                Number(prevSummaryRaw.total_users) > 0
                  ? round2(
                      (Number(prevSummaryRaw.total_paying_users) /
                        Number(prevSummaryRaw.total_users)) *
                        100
                    )
                  : 0,
            },
            chart,
            table,
          },
        });
      } catch (err) {
        logger.error('Acquisition metrics query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply
          .code(500)
          .send({ error: 'Acquisition metrics query failed' });
      }
    }
  );
}
