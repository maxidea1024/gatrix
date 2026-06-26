import type {
  RevenueData,
  TopSpendersData,
  ProductRevenue,
} from '../../services/argus/argusAnalytics';

// ─── Types ───────────────────────────────────────────────────────────────────

export type InsightSeverity = 'positive' | 'warning' | 'critical' | 'info';

export interface InsightDrilldown {
  type: 'scroll' | 'ledger';
  target?: string; // scroll: element ID
  ledgerFilter?: {
    // ledger: transaction filter
    type?: string;
    reason?: string;
  };
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TFunc = (
  key: string,
  defaultValue: string,
  opts?: Record<string, any>
) => string;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 1000000
    ? `$${(n / 1000000).toFixed(1)}M`
    : n >= 1000
      ? `$${(n / 1000).toFixed(1)}K`
      : `$${n.toFixed(2)}`;

function pctChange(current: number, previous: number): number | undefined {
  if (!previous || previous === 0) return undefined;
  return ((current - previous) / previous) * 100;
}

// ─── Executive Summary Insights ──────────────────────────────────────────────

export function generateInsights(
  data: RevenueData,
  products: ProductRevenue[],
  spenders: TopSpendersData | null,
  t: TFunc
): Insight[] {
  const insights: Insight[] = [];

  // 1. Revenue trend
  const revChange = pctChange(data.total_revenue, data.prev_total_revenue);
  if (revChange !== undefined) {
    if (Math.abs(revChange) >= 5) {
      const isUp = revChange > 0;
      const countryContrib = findBiggestContributor(
        data.revenue_by_country,
        data.prev_revenue_by_country || [],
        'country'
      );

      insights.push({
        severity: isUp ? 'positive' : 'critical',
        icon: isUp ? '📈' : '📉',
        title: t(
          'argus.monetization.insight.revenueChange',
          'Revenue {{amount}} ({{change}}%)',
          {
            amount: fmt(data.total_revenue),
            change: `${isUp ? '+' : ''}${revChange.toFixed(1)}`,
          }
        ),
        detail: countryContrib
          ? t(
              'argus.monetization.insight.revenueDriver',
              '→ {{country}}: {{change}} is the main driver',
              {
                country: countryContrib.name,
                change: `${countryContrib.change > 0 ? '+' : ''}${fmt(countryContrib.change)}`,
              }
            )
          : t(
              'argus.monetization.insight.revenueTrend',
              '→ {{direction}} trend vs previous period',
              {
                direction: isUp
                  ? t('argus.monetization.insight.upward', 'Upward')
                  : t('argus.monetization.insight.downward', 'Downward'),
              }
            ),
        action: isUp
          ? undefined
          : t(
              'argus.monetization.insight.revenueDropAction',
              'Check revenue drop causes by segment'
            ),
        drilldown: { type: 'scroll', target: 'revenue-trend' },
      });
    } else {
      insights.push({
        severity: 'info',
        icon: '📊',
        title: t(
          'argus.monetization.insight.revenueStable',
          'Revenue {{amount}} ({{change}}%)',
          {
            amount: fmt(data.total_revenue),
            change: `${revChange >= 0 ? '+' : ''}${revChange.toFixed(1)}`,
          }
        ),
        detail: t(
          'argus.monetization.insight.stableDetail',
          '→ Stable level vs previous period'
        ),
      });
    }
  }

  // 2. ARPPU vs Transaction volume
  const arppuChange = pctChange(data.arppu, data.prev_arppu);
  const txnChange = pctChange(
    data.total_transactions,
    data.prev_total_transactions
  );
  if (arppuChange !== undefined && txnChange !== undefined) {
    if (arppuChange < -5 && txnChange > 5) {
      insights.push({
        severity: 'warning',
        icon: '🏷️',
        title: t(
          'argus.monetization.insight.arppuDrop',
          'ARPPU {{amount}} ({{change}}%) — Avg. spend declining',
          { amount: fmt(data.arppu), change: arppuChange.toFixed(1) }
        ),
        detail: t(
          'argus.monetization.insight.arppuDropDetail',
          '→ Transactions up +{{txnChange}}% but per-transaction value decreased',
          { txnChange: txnChange.toFixed(1) }
        ),
        action: t(
          'argus.monetization.insight.arppuDropAction',
          'Check low-price product ratio — Analyze in Products tab'
        ),
      });
    } else if (arppuChange > 10) {
      insights.push({
        severity: 'positive',
        icon: '💎',
        title: t(
          'argus.monetization.insight.arppuUp',
          'ARPPU {{amount}} (+{{change}}%) — Avg. spend rising',
          { amount: fmt(data.arppu), change: arppuChange.toFixed(1) }
        ),
        detail: t(
          'argus.monetization.insight.arppuUpDetail',
          '→ High-value product purchases are increasing'
        ),
      });
    }
  }

  // 3. Conversion Rate
  const convChange = data.conversion_rate - data.prev_conversion_rate;
  if (Math.abs(convChange) >= 0.3) {
    const isUp = convChange > 0;
    insights.push({
      severity: isUp ? 'positive' : 'warning',
      icon: isUp ? '🎯' : '⚠️',
      title: t(
        'argus.monetization.insight.convRate',
        'Conversion {{rate}}% ({{change}}%p)',
        {
          rate: data.conversion_rate.toFixed(2),
          change: `${isUp ? '+' : ''}${convChange.toFixed(2)}`,
        }
      ),
      detail: isUp
        ? t(
            'argus.monetization.insight.convUpDetail',
            '→ Purchase conversion improving — Maintain current strategy'
          )
        : t(
            'argus.monetization.insight.convDownDetail',
            '→ Conversion declining despite new user growth ({{paying}} / {{total}})',
            {
              paying: data.total_paying_users.toLocaleString(),
              total: data.total_users.toLocaleString(),
            }
          ),
      action: isUp
        ? undefined
        : t(
            'argus.monetization.insight.convDownAction',
            'Review first-purchase promotion or onboarding optimization'
          ),
    });
  }

  // 4. Market concentration risk
  if (data.revenue_by_country.length > 0) {
    const topCountry = data.revenue_by_country[0];
    const topPct =
      data.total_revenue > 0
        ? (topCountry.revenue / data.total_revenue) * 100
        : 0;
    if (topPct > 40) {
      insights.push({
        severity: 'warning',
        icon: '🌍',
        title: t(
          'argus.monetization.insight.marketConcentration',
          'Market concentration risk: {{country}} {{pct}}%',
          { country: topCountry.country, pct: topPct.toFixed(0) }
        ),
        detail: t(
          'argus.monetization.insight.marketConcentrationDetail',
          '→ High single-market dependency — Revenue crash risk if {{country}} market has issues',
          { country: topCountry.country }
        ),
        action: t(
          'argus.monetization.insight.marketConcentrationAction',
          'Review market expansion strategy'
        ),
      });
    }
  }

  // 5. Whale dependency
  if (spenders) {
    const top10 = spenders.segments.find((s) => s.segment === 'top_10pct');
    if (top10 && top10.percentage > 65) {
      insights.push({
        severity: top10.percentage > 80 ? 'critical' : 'warning',
        icon: '🐋',
        title: t(
          'argus.monetization.insight.whaleDependency',
          'Whale dependency: Top 10% → {{pct}}% of revenue',
          { pct: top10.percentage.toFixed(0) }
        ),
        detail: t(
          'argus.monetization.insight.whaleDependencyDetail',
          '→ Revenue concentrated in a few high-value spenders'
        ),
        action: t(
          'argus.monetization.insight.whaleDependencyAction',
          'Review mid-tier spender growth program & whale retention'
        ),
      });
    }
  }

  // 6. Platform opportunity
  if (
    data.revenue_by_platform.length > 1 &&
    data.prev_revenue_by_platform?.length > 0
  ) {
    for (const plat of data.revenue_by_platform) {
      const prev = data.prev_revenue_by_platform.find(
        (p) => p.platform === plat.platform
      );
      if (prev) {
        const chg = pctChange(plat.revenue, prev.revenue);
        if (chg !== undefined && chg > 20) {
          insights.push({
            severity: 'positive',
            icon: '🚀',
            title: t(
              'argus.monetization.insight.platformGrowth',
              '{{platform}} rapid growth: +{{pct}}%',
              { platform: plat.platform, pct: chg.toFixed(0) }
            ),
            detail: t(
              'argus.monetization.insight.platformGrowthDetail',
              '→ {{platform}} revenue surged from {{from}} to {{to}}',
              {
                platform: plat.platform,
                from: fmt(prev.revenue),
                to: fmt(plat.revenue),
              }
            ),
            action: t(
              'argus.monetization.insight.platformGrowthAction',
              'Consider increasing {{platform}} marketing budget',
              { platform: plat.platform }
            ),
          });
          break;
        }
      }
    }
  }

  // 7. New purchaser ratio
  if (data.total_paying_users > 0) {
    const newRatio = (data.first_purchasers / data.total_paying_users) * 100;
    if (newRatio > 60) {
      insights.push({
        severity: 'info',
        icon: '🆕',
        title: t(
          'argus.monetization.insight.newPurchaserHigh',
          'New purchaser ratio {{pct}}%',
          { pct: newRatio.toFixed(0) }
        ),
        detail: t(
          'argus.monetization.insight.newPurchaserHighDetail',
          '→ Active new user acquisition — Focus on retention to increase repeat purchases'
        ),
      });
    } else if (newRatio < 20) {
      insights.push({
        severity: 'warning',
        icon: '🔄',
        title: t(
          'argus.monetization.insight.newPurchaserLow',
          'New purchaser ratio {{pct}}% — Low new user acquisition',
          { pct: newRatio.toFixed(0) }
        ),
        detail: t(
          'argus.monetization.insight.newPurchaserLowDetail',
          '→ Most purchases from existing users — Consider expanding UA campaigns'
        ),
        action: t(
          'argus.monetization.insight.newPurchaserLowAction',
          'Review user acquisition (UA) campaign expansion'
        ),
      });
    }
  }

  // 8. Refund rate alert
  if (data.refund_rate > 0) {
    if (data.refund_rate > 5) {
      insights.push({
        severity: data.refund_rate > 10 ? 'critical' : 'warning',
        icon: '↩',
        title: t(
          'argus.monetization.insight.highRefundRate',
          'Refund rate {{rate}}% — Check product quality or payment issues',
          { rate: data.refund_rate.toFixed(1) }
        ),
        detail: t(
          'argus.monetization.insight.highRefundRateDetail',
          '→ {{count}} refunds totaling {{amount}}',
          {
            count: data.refund_count.toLocaleString(),
            amount: fmt(data.total_refunds),
          }
        ),
        action: t(
          'argus.monetization.insight.highRefundRateAction',
          'Review refund reasons in the Refund section below'
        ),
        drilldown: { type: 'ledger', ledgerFilter: { type: 'refund' } },
      });
    }
  }

  // 9. Refund rate spike vs previous period
  if (data.prev_refund_count > 0 && data.refund_count > 0) {
    const prevRefundRate =
      data.prev_total_refunds > 0
        ? (data.prev_refund_count / data.prev_total_transactions) * 100
        : 0;
    const refundRateChange = data.refund_rate - prevRefundRate;
    if (refundRateChange > 2) {
      insights.push({
        severity: 'critical',
        icon: '📈',
        title: t(
          'argus.monetization.insight.refundSpike',
          'Refund rate surged +{{change}}%p vs previous period',
          { change: refundRateChange.toFixed(1) }
        ),
        detail: t(
          'argus.monetization.insight.refundSpikeDetail',
          '→ Check for post-update issues or payment problems'
        ),
      });
    }
  }

  // 10. Grant inflation risk
  if (data.total_granted > 0 && data.total_revenue > 0) {
    const grantRatio =
      (data.total_granted / (data.total_revenue + data.total_granted)) * 100;
    if (grantRatio > 30) {
      insights.push({
        severity: 'warning',
        icon: '🎁',
        title: t(
          'argus.monetization.insight.grantInflation',
          'Free grants are {{pct}}% of total economy',
          { pct: grantRatio.toFixed(0) }
        ),
        detail: t(
          'argus.monetization.insight.grantInflationDetail',
          '→ High grant ratio may cause virtual economy inflation'
        ),
        action: t(
          'argus.monetization.insight.grantInflationAction',
          'Review grant distribution policy and pricing strategy'
        ),
        drilldown: { type: 'ledger', ledgerFilter: { type: 'grant' } },
      });
    }
  }

  // 11. AOV change
  const aovChange = pctChange(data.avg_order_value, data.prev_avg_order_value);
  if (aovChange !== undefined && Math.abs(aovChange) >= 15) {
    const isUp = aovChange > 0;
    insights.push({
      severity: isUp ? 'positive' : 'warning',
      icon: isUp ? '💰' : '📉',
      title: t(
        'argus.monetization.insight.aovChange',
        'AOV {{amount}} ({{change}}%)',
        {
          amount: fmt(data.avg_order_value),
          change: `${isUp ? '+' : ''}${aovChange.toFixed(1)}`,
        }
      ),
      detail: isUp
        ? t(
            'argus.monetization.insight.aovUpDetail',
            '→ Average order value increasing — users are purchasing higher-value items'
          )
        : t(
            'argus.monetization.insight.aovDownDetail',
            '→ Average order value declining — check if low-price promotions are too aggressive'
          ),
      action: isUp
        ? undefined
        : t(
            'argus.monetization.insight.aovDownAction',
            'Review pricing strategy and bundle offers'
          ),
    });
  }

  // 12. Platform revenue decline
  if (
    data.revenue_by_platform.length > 1 &&
    data.prev_revenue_by_platform?.length > 0
  ) {
    for (const plat of data.revenue_by_platform) {
      const prev = data.prev_revenue_by_platform.find(
        (p) => p.platform === plat.platform
      );
      if (prev) {
        const chg = pctChange(plat.revenue, prev.revenue);
        if (chg !== undefined && chg < -30) {
          insights.push({
            severity: 'critical',
            icon: '📱',
            title: t(
              'argus.monetization.insight.platformDecline',
              '{{platform}} revenue dropped {{pct}}%',
              { platform: plat.platform, pct: chg.toFixed(0) }
            ),
            detail: t(
              'argus.monetization.insight.platformDeclineDetail',
              '→ {{platform}} revenue fell from {{from}} to {{to}}',
              {
                platform: plat.platform,
                from: fmt(prev.revenue),
                to: fmt(plat.revenue),
              }
            ),
            action: t(
              'argus.monetization.insight.platformDeclineAction',
              'Investigate {{platform}} user engagement and store listing issues',
              { platform: plat.platform }
            ),
          });
          break;
        }
      }
    }
  }

  // 13. Product concentration risk
  if (products.length > 1 && data.total_revenue > 0) {
    const topProduct = products[0];
    const topPct = (topProduct.revenue / data.total_revenue) * 100;
    if (topPct > 50) {
      insights.push({
        severity: 'warning',
        icon: '📦',
        title: t(
          'argus.monetization.insight.productConcentration',
          '"{{product}}" is {{pct}}% of total revenue',
          { product: topProduct.product_name, pct: topPct.toFixed(0) }
        ),
        detail: t(
          'argus.monetization.insight.productConcentrationDetail',
          '→ Revenue heavily dependent on a single product — diversification needed'
        ),
        action: t(
          'argus.monetization.insight.productConcentrationAction',
          'Review product portfolio and consider new product launches'
        ),
      });
    }
  }

  // 14. ARPDAU anomaly (compare first half vs second half of current period)
  if (data.revenue_over_time.length >= 14) {
    const half = Math.floor(data.revenue_over_time.length / 2);
    const firstHalf = data.revenue_over_time.slice(0, half);
    const secondHalf = data.revenue_over_time.slice(half);
    const firstAvg =
      firstHalf.reduce((s, d) => s + (d.arpdau || 0), 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((s, d) => s + (d.arpdau || 0), 0) / secondHalf.length;
    const arpdauChange = pctChange(secondAvg, firstAvg);
    if (arpdauChange !== undefined && Math.abs(arpdauChange) >= 20) {
      const isUp = arpdauChange > 0;
      insights.push({
        severity: isUp ? 'positive' : 'warning',
        icon: isUp ? '📈' : '⚠️',
        title: t(
          'argus.monetization.insight.arpdauChange',
          'ARPDAU ${{amount}} ({{change}}%)',
          {
            amount: secondAvg.toFixed(4),
            change: `${isUp ? '+' : ''}${arpdauChange.toFixed(1)}`,
          }
        ),
        detail: isUp
          ? t(
              'argus.monetization.insight.arpdauUpDetail',
              '→ Revenue per daily active user is growing'
            )
          : t(
              'argus.monetization.insight.arpdauDownDetail',
              '→ Revenue per daily active user is declining — check monetization engagement'
            ),
      });
    }
  }

  // 15. Ad revenue surge/decline
  if (data.total_ad_revenue > 0) {
    const adRevChange = pctChange(
      data.total_ad_revenue,
      data.prev_total_ad_revenue
    );
    if (adRevChange !== undefined && Math.abs(adRevChange) >= 30) {
      const isUp = adRevChange > 0;
      insights.push({
        severity: isUp ? 'positive' : 'critical',
        icon: isUp ? '📺' : '📉',
        title: t(
          'argus.monetization.insight.adRevenueChange',
          'Ad Revenue {{amount}} ({{change}}%)',
          {
            amount: fmt(data.total_ad_revenue),
            change: `${isUp ? '+' : ''}${adRevChange.toFixed(1)}`,
          }
        ),
        detail: isUp
          ? t(
              'argus.monetization.insight.adRevenueUpDetail',
              '→ Ad monetization performing well — eCPM {{ecpm}}',
              { ecpm: `$${data.avg_ecpm.toFixed(2)}` }
            )
          : t(
              'argus.monetization.insight.adRevenueDownDetail',
              '→ Ad revenue dropped — check ad fill rate and eCPM trends'
            ),
        action: isUp
          ? undefined
          : t(
              'argus.monetization.insight.adRevenueDownAction',
              'Review ad placement performance and SDK configuration'
            ),
      });
    }
  }

  // 16. IAP/Ad ratio shift
  if (
    data.total_ad_revenue > 0 &&
    data.prev_total_ad_revenue > 0 &&
    data.total_revenue > 0
  ) {
    const prevBlended = data.prev_total_revenue + data.prev_total_ad_revenue;
    const prevIapShare =
      prevBlended > 0 ? (data.prev_total_revenue / prevBlended) * 100 : 100;
    const iapShareChange = data.iap_share - prevIapShare;
    if (Math.abs(iapShareChange) >= 10) {
      insights.push({
        severity: 'info',
        icon: '⚖️',
        title: t(
          'argus.monetization.insight.revenueMixShift',
          'Revenue mix shifted: IAP {{iap}}% / Ad {{ad}}%',
          { iap: data.iap_share.toFixed(0), ad: data.ad_share.toFixed(0) }
        ),
        detail:
          iapShareChange > 0
            ? t(
                'argus.monetization.insight.revenueIapUp',
                '→ IAP share increased by {{change}}%p — in-app purchases growing faster than ads',
                { change: iapShareChange.toFixed(1) }
              )
            : t(
                'argus.monetization.insight.revenueAdUp',
                '→ Ad share increased by {{change}}%p — ad monetization is growing',
                { change: Math.abs(iapShareChange).toFixed(1) }
              ),
      });
    }
  }

  return insights.slice(0, 8); // Max 8 insights
}

// ─── Country/Platform Contribution Finder ────────────────────────────────────

function findBiggestContributor(
  current: { country?: string; platform?: string; revenue: number }[],
  previous: { country?: string; platform?: string; revenue: number }[],
  key: 'country' | 'platform'
): { name: string; change: number } | null {
  if (current.length === 0) return null;

  let maxChange = 0;
  let maxName = '';

  for (const c of current) {
    const name = (c as any)[key] || 'Unknown';
    const prev = previous.find((p) => (p as any)[key] === name);
    const change = c.revenue - (prev?.revenue || 0);
    if (Math.abs(change) > Math.abs(maxChange)) {
      maxChange = change;
      maxName = name;
    }
  }

  for (const p of previous) {
    const name = (p as any)[key] || 'Unknown';
    if (!current.find((c) => (c as any)[key] === name)) {
      if (Math.abs(-p.revenue) > Math.abs(maxChange)) {
        maxChange = -p.revenue;
        maxName = name;
      }
    }
  }

  return maxName ? { name: maxName, change: maxChange } : null;
}

// ─── Segment Performance Matrix ──────────────────────────────────────────────

export function buildSegmentMatrix(
  current: {
    country?: string;
    platform?: string;
    revenue: number;
    transactions: number;
  }[],
  previous: {
    country?: string;
    platform?: string;
    revenue: number;
    transactions: number;
  }[],
  totalRevenue: number,
  key: 'country' | 'platform',
  t: TFunc
): SegmentVerdict[] {
  return current.map((c) => {
    const name = (c as any)[key] || 'Unknown';
    const prev = previous.find((p) => (p as any)[key] === name);
    const prevRev = prev?.revenue || 0;
    const change = c.revenue - prevRev;
    const changePct =
      prevRev > 0 ? (change / prevRev) * 100 : c.revenue > 0 ? 100 : 0;
    const share = totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0;

    let verdict: SegmentVerdict['verdict'];
    let verdictLabel: string;
    let verdictIcon: string;

    if (share >= 15 && changePct > 10) {
      verdict = 'invest';
      verdictLabel = t('argus.monetization.verdictInvest', 'Invest');
      verdictIcon = '';
    } else if (share >= 15 && changePct >= -5) {
      verdict = 'maintain';
      verdictLabel = t('argus.monetization.verdictMaintain', 'Maintain');
      verdictIcon = '';
    } else if (share < 15 && changePct > 15) {
      verdict = 'opportunity';
      verdictLabel = t('argus.monetization.verdictOpportunity', 'Opportunity');
      verdictIcon = '';
    } else {
      verdict = 'review';
      verdictLabel = t('argus.monetization.verdictReview', 'Review');
      verdictIcon = '';
    }

    return {
      name,
      revenue: c.revenue,
      prevRevenue: prevRev,
      change,
      changePct,
      verdict,
      verdictLabel,
      verdictIcon,
    };
  });
}
