/**
 * Monetization Auto-Insights -- Server-side insight generation.
 *
 * Ported from frontend revenueInsights.ts to eliminate client-side computation
 * and enable segment-filtered insights.
 */

// -- Types --

export type InsightSeverity = 'positive' | 'warning' | 'critical' | 'info';

export interface InsightDrilldown {
  type: 'scroll' | 'ledger';
  target?: string;
  ledgerFilter?: { type?: string; reason?: string };
}

export interface Insight {
  severity: InsightSeverity;
  icon: string;
  title: string;
  detail: string;
  action?: string;
  drilldown?: InsightDrilldown;
}

export interface SegmentVerdict {
  name: string;
  revenue: number;
  prevRevenue: number;
  change: number;
  changePct: number;
  verdict: 'invest' | 'maintain' | 'opportunity' | 'review';
  verdictLabel: string;
  verdictIcon: string;
}

export interface MonetizationInsightData {
  total_revenue: number;
  prev_total_revenue: number;
  total_paying_users: number;
  total_users: number;
  first_purchasers: number;
  arppu: number;
  prev_arppu: number;
  total_transactions: number;
  prev_total_transactions: number;
  conversion_rate: number;
  prev_conversion_rate: number;
  avg_order_value: number;
  prev_avg_order_value: number;
  refund_rate: number;
  refund_count: number;
  prev_refund_count: number;
  total_refunds: number;
  prev_total_refunds: number;
  total_granted: number;
  total_ad_revenue: number;
  prev_total_ad_revenue: number;
  avg_ecpm: number;
  iap_share: number;
  ad_share: number;
  revenue_by_country: { country: string; revenue: number; transactions: number }[];
  prev_revenue_by_country: { country: string; revenue: number; transactions: number }[];
  revenue_by_platform: { platform: string; revenue: number; transactions: number }[];
  prev_revenue_by_platform: { platform: string; revenue: number; transactions: number }[];
  revenue_over_time: { period: string; revenue: number; arpdau?: number }[];
}

// -- Helpers --

const fmt = (n: number) =>
  n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M`
    : n >= 1000 ? `$${(n / 1000).toFixed(1)}K`
    : `$${n.toFixed(2)}`;

function pctChange(current: number, previous: number): number | undefined {
  if (!previous || previous === 0) return undefined;
  return ((current - previous) / previous) * 100;
}

function findBiggestContributor(
  current: { country?: string; platform?: string; revenue: number }[],
  previous: { country?: string; platform?: string; revenue: number }[],
  key: 'country' | 'platform',
): { name: string; change: number } | null {
  if (current.length === 0) return null;
  let maxChange = 0;
  let maxName = '';
  for (const c of current) {
    const name = (c as Record<string, unknown>)[key] as string || 'Unknown';
    const prev = previous.find(p => (p as Record<string, unknown>)[key] === name);
    const change = c.revenue - (prev?.revenue || 0);
    if (Math.abs(change) > Math.abs(maxChange)) { maxChange = change; maxName = name; }
  }
  for (const p of previous) {
    const name = (p as Record<string, unknown>)[key] as string || 'Unknown';
    if (!current.find(c => (c as Record<string, unknown>)[key] === name)) {
      if (Math.abs(-p.revenue) > Math.abs(maxChange)) { maxChange = -p.revenue; maxName = name; }
    }
  }
  return maxName ? { name: maxName, change: maxChange } : null;
}

// -- generateInsights --

export function generateInsights(
  data: MonetizationInsightData,
): Insight[] {
  const insights: Insight[] = [];

  const revChange = pctChange(data.total_revenue, data.prev_total_revenue);
  if (revChange !== undefined) {
    if (Math.abs(revChange) >= 5) {
      const isUp = revChange > 0;
      const countryContrib = findBiggestContributor(
        data.revenue_by_country, data.prev_revenue_by_country || [], 'country',
      );
      insights.push({
        severity: isUp ? 'positive' : 'critical',
        icon: isUp ? 'up' : 'down',
        title: `Revenue ${fmt(data.total_revenue)} (${isUp ? '+' : ''}${revChange.toFixed(1)}%)`,
        detail: countryContrib
          ? `Main driver: ${countryContrib.name} ${countryContrib.change > 0 ? '+' : ''}${fmt(countryContrib.change)}`
          : `${isUp ? 'Upward' : 'Downward'} trend vs previous period`,
        action: isUp ? undefined : 'Check revenue drop causes by segment',
        drilldown: { type: 'scroll', target: 'revenue-trend' },
      });
    } else {
      insights.push({
        severity: 'info',
        icon: 'stable',
        title: `Revenue ${fmt(data.total_revenue)} (${revChange >= 0 ? '+' : ''}${revChange.toFixed(1)}%)`,
        detail: 'Stable level vs previous period',
      });
    }
  }

  const arppuChange = pctChange(data.arppu, data.prev_arppu);
  const txnChange = pctChange(data.total_transactions, data.prev_total_transactions);
  if (arppuChange !== undefined && txnChange !== undefined) {
    if (arppuChange < -5 && txnChange > 5) {
      insights.push({
        severity: 'warning',
        icon: 'tag',
        title: `ARPPU ${fmt(data.arppu)} (${arppuChange.toFixed(1)}%) -- Avg. spend declining`,
        detail: `Transactions up +${txnChange.toFixed(1)}% but per-transaction value decreased`,
        action: 'Check low-price product ratio',
      });
    } else if (arppuChange > 10) {
      insights.push({
        severity: 'positive',
        icon: 'diamond',
        title: `ARPPU ${fmt(data.arppu)} (+${arppuChange.toFixed(1)}%) -- Avg. spend rising`,
        detail: 'High-value product purchases are increasing',
      });
    }
  }

  if (data.refund_rate > 5) {
    insights.push({
      severity: data.refund_rate > 10 ? 'critical' : 'warning',
      icon: 'refund',
      title: `Refund rate ${data.refund_rate.toFixed(1)}%`,
      detail: `${data.refund_count.toLocaleString()} refunds totaling ${fmt(data.total_refunds)}`,
      drilldown: { type: 'ledger', ledgerFilter: { type: 'refund' } },
    });
  }

  if (data.total_ad_revenue > 0) {
    const adRevChange = pctChange(data.total_ad_revenue, data.prev_total_ad_revenue);
    if (adRevChange !== undefined && Math.abs(adRevChange) >= 30) {
      const isUp = adRevChange > 0;
      insights.push({
        severity: isUp ? 'positive' : 'critical',
        icon: isUp ? 'tv' : 'down',
        title: `Ad Revenue ${fmt(data.total_ad_revenue)} (${isUp ? '+' : ''}${adRevChange.toFixed(1)}%)`,
        detail: isUp
          ? `Ad monetization performing well -- eCPM $${data.avg_ecpm.toFixed(2)}`
          : 'Ad revenue dropped -- check ad fill rate and eCPM trends',
      });
    }
  }


  return insights.slice(0, 8);
}

// -- buildSegmentMatrix --

export function buildSegmentMatrix(
  current: { country?: string; platform?: string; revenue: number; transactions: number }[],
  previous: { country?: string; platform?: string; revenue: number; transactions: number }[],
  totalRevenue: number,
  key: 'country' | 'platform',
): SegmentVerdict[] {
  return current.map((c) => {
    const name = (c as Record<string, unknown>)[key] as string || 'Unknown';
    const prev = previous.find(p => (p as Record<string, unknown>)[key] === name);
    const prevRev = prev?.revenue || 0;
    const change = c.revenue - prevRev;
    const changePct = prevRev > 0 ? ((change / prevRev) * 100) : (c.revenue > 0 ? 100 : 0);
    const share = totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0;

    let verdict: SegmentVerdict['verdict'];
    let verdictLabel: string;
    let verdictIcon: string;

    if (share >= 15 && changePct > 10) {
      verdict = 'invest'; verdictLabel = 'Invest'; verdictIcon = 'rocket';
    } else if (share >= 15 && changePct >= -5) {
      verdict = 'maintain'; verdictLabel = 'Maintain'; verdictIcon = 'check';
    } else if (share < 15 && changePct > 15) {
      verdict = 'opportunity'; verdictLabel = 'Opportunity'; verdictIcon = 'star';
    } else {
      verdict = 'review'; verdictLabel = 'Review'; verdictIcon = 'warning';
    }

    return { name, revenue: c.revenue, prevRevenue: prevRev, change, changePct, verdict, verdictLabel, verdictIcon };
  });
}