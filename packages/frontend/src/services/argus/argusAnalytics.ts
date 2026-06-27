/**
 * Argus Product Analytics and Lexicon API.
 */
import { argusApi, ARGUS_BASE } from './argusApi';
import type {
  AnalyticsEventNameEntry,
  ArgusLexiconEvent,
  ArgusLexiconProperty,
  ArgusUserProfile,
  ArgusUserEvent,
  ArgusUserSession,
  ArgusUserProperty,
  ArgusCohort,
  ArgusCohortDefinition,
} from './argusTypes';

// --- Analytics (Product Analytics) ---

export async function getAnalyticsEventNames(
  projectId: number | string,
  period?: string,
  start?: string,
  end?: string
): Promise<AnalyticsEventNameEntry[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/event-names`,
    { params: { period, start, end } }
  );
  return response.data?.data || response.data || [];
}

export async function getAnalyticsSummary(
  projectId: number | string,
  period?: string,
  start?: string,
  end?: string
): Promise<{
  total_events: number;
  unique_users: number;
  total_sessions: number;
  dau_today: number;
  dau_yesterday: number;
  daily_trend: Array<{ date: string; events: number; users: number }>;
  hourly_heatmap: Array<{ dow: number; hour: number; count: number }>;
}> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/summary`,
    { params: { period, start, end } }
  );
  return (
    response.data?.data ||
    response.data || {
      total_events: 0,
      unique_users: 0,
      total_sessions: 0,
      dau_today: 0,
      dau_yesterday: 0,
      daily_trend: [],
      hourly_heatmap: [],
    }
  );
}

export async function getAnalyticsEventProperties(
  projectId: number | string,
  eventName?: string,
  period?: string,
  start?: string,
  end?: string
): Promise<{
  string_keys: string[];
  numeric_keys: string[];
  builtin_columns: string[];
}> {
  const queryParams: Record<string, string | undefined> = {
    period,
    start,
    end,
  };
  if (eventName) {
    queryParams.event_name = eventName;
  }
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/event-properties`,
    { params: queryParams }
  );
  return (
    response.data?.data || {
      string_keys: [],
      numeric_keys: [],
      builtin_columns: [],
    }
  );
}

export async function getAnalyticsPropertyValues(
  projectId: number | string,
  property: string,
  params?: { period?: string; start?: string; end?: string; search?: string },
  signal?: AbortSignal
): Promise<{ value: string; count: number }[]> {
  try {
    const response = await argusApi.get(
      `${ARGUS_BASE}/projects/${projectId}/analytics/property-values`,
      { params: { property, ...params }, signal }
    );
    return response.data?.data || response.data || [];
  } catch {
    return [];
  }
}

export async function getAnalyticsInsights(
  projectId: number | string,
  body: {
    events: {
      name: string;
      aggregation?: string;
      property?: string;
      conditions?: {
        property: string;
        operator: string;
        value: string | number;
      }[];
    }[];
    breakdown?: { properties: string[] };
    interval?: string;
    period?: string;
    start?: string;
    end?: string;
    compare_period?: string;
    global_filters?: { property: string; operator: string; value: string }[];
  }
): Promise<{
  series: {
    event: string;
    breakdown_value?: string;
    data: { bucket: string; value: number }[];
  }[];
  compare_series?: {
    event: string;
    data: { bucket: string; value: number }[];
  }[];
}> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/analytics/insights`,
    body
  );
  return response.data?.data || { series: [] };
}

export async function getAnalyticsFunnels(
  projectId: number | string,
  body: {
    steps: {
      event_name: string;
      conditions?: {
        property: string;
        operator: string;
        value: string | number;
      }[];
    }[];
    conversion_window?: number;
    ordering?: 'specific' | 'any';
    hold_constant?: string[];
    counting?: 'uniques' | 'totals';
    breakdown?: { properties: string[] };
    exclusion_steps?: {
      event_name: string;
      between: [number, number];
    }[];
    mode?: 'steps' | 'trending' | 'time_to_convert';
    period?: string;
    start?: string;
    end?: string;
    global_filters?: { property: string; operator: string; value: string }[];
    segments?: {
      id: string;
      name: string;
      filters: { property: string; operator: string; value: string }[];
      color: string;
    }[];
  }
): Promise<{
  steps: { name: string; count: number; conversion_rate: number }[];
  overall_conversion: number;
  breakdowns?: Record<
    string,
    {
      steps: { name: string; count: number; conversion_rate: number }[];
      overall_conversion: number;
    }
  >;
  trending?: {
    date: string;
    conversion_rate: number;
    step_counts: number[];
  }[];
  time_to_convert?: {
    distribution: { bucket: string; count: number }[];
    median_seconds: number;
    avg_seconds: number;
    p25_seconds: number;
    p75_seconds: number;
  };
  segments?: {
    id: string;
    name: string;
    color: string;
    steps: { name: string; count: number; conversion_rate: number }[];
    overall_conversion: number;
  }[];
}> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/analytics/funnels`,
    body
  );
  return response.data?.data || { steps: [], overall_conversion: 0 };
}

export async function getAnalyticsRetention(
  projectId: number | string,
  body: {
    first_event: {
      name: string;
      conditions?: {
        property: string;
        operator: string;
        value: string | number;
      }[];
    };
    return_event: {
      name: string;
      conditions?: {
        property: string;
        operator: string;
        value: string | number;
      }[];
    };
    retention_type?: 'day' | 'week' | 'month';
    num_periods?: number;
    criteria?: 'on' | 'on_or_after';
    measurement?:
      | 'retention_rate'
      | 'unique_users'
      | 'property_sum'
      | 'property_avg';
    measurement_property?: string;
    breakdown?: { properties: string[] };
    min_frequency?: number;
    period?: string;
    start?: string;
    end?: string;
    global_filters?: { property: string; operator: string; value: string }[];
  }
): Promise<{
  cohorts: {
    cohort_date: string;
    cohort_size: number;
    retention: number[];
  }[];
  breakdowns?: Record<
    string,
    {
      cohort_date: string;
      cohort_size: number;
      retention: number[];
    }[]
  >;
}> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/analytics/retention`,
    body
  );
  return response.data?.data || { cohorts: [] };
}

export async function getAnalyticsFlows(
  projectId: number | string,
  body: {
    anchor_event?: { name: string };
    anchor_events?: { name: string }[];
    direction?: string;
    steps_before?: number;
    steps_after?: number;
    depth?: number;
    view?: 'sankey' | 'top_paths';
    breakdown?: { properties: string[] };
    exclude_events?: string[];
    period?: string;
    start?: string;
    end?: string;
    min_frequency?: number;
    global_filters?: { property: string; operator: string; value: string }[];
  }
): Promise<{
  nodes: { id: string; count: number }[];
  links: { source: string; target: string; value: number }[];
  top_paths?: { path: string[]; count: number; percentage: number }[];
}> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/analytics/flows`,
    body
  );
  return response.data?.data || { nodes: [], links: [] };
}

// === Lexicon ===

export async function getLexiconEvents(
  projectId: number | string
): Promise<ArgusLexiconEvent[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/lexicon/events`
  );
  return response.data?.data || [];
}

export async function updateLexiconEvent(
  projectId: number | string,
  eventName: string,
  data: Partial<
    Omit<
      ArgusLexiconEvent,
      | 'id'
      | 'project_id'
      | 'event_name'
      | 'is_reserved'
      | 'created_at'
      | 'updated_at'
    >
  >
): Promise<void> {
  await argusApi.patch(
    `${ARGUS_BASE}/projects/${projectId}/lexicon/events/${eventName}`,
    data
  );
}

export async function getLexiconProperties(
  projectId: number | string
): Promise<ArgusLexiconProperty[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/lexicon/properties`
  );
  return response.data?.data || [];
}

export async function updateLexiconProperty(
  projectId: number | string,
  propertyName: string,
  data: Partial<
    Omit<
      ArgusLexiconProperty,
      | 'id'
      | 'project_id'
      | 'property_name'
      | 'is_reserved'
      | 'created_at'
      | 'updated_at'
    >
  >
): Promise<void> {
  await argusApi.patch(
    `${ARGUS_BASE}/projects/${projectId}/lexicon/properties/${propertyName}`,
    data
  );
}

export async function seedLexicon(projectId: number | string): Promise<void> {
  await argusApi.post(`${ARGUS_BASE}/projects/${projectId}/lexicon/seed`);
}

export async function createLexiconEvent(
  projectId: number | string,
  data: {
    event_name: string;
    display_name?: string;
    icon?: string;
    icon_color?: string;
    description?: string;
    category?: string;
    status?: string;
    owner?: string;
  }
): Promise<void> {
  await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/lexicon/events`,
    data
  );
}

export async function deleteLexiconEvent(
  projectId: number | string,
  eventName: string
): Promise<void> {
  await argusApi.delete(
    `${ARGUS_BASE}/projects/${projectId}/lexicon/events/${encodeURIComponent(eventName)}`
  );
}

export async function createLexiconProperty(
  projectId: number | string,
  data: {
    property_name: string;
    display_name?: string;
    description?: string;
    data_type?: string;
    status?: string;
  }
): Promise<void> {
  await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/lexicon/properties`,
    data
  );
}

export async function deleteLexiconProperty(
  projectId: number | string,
  propertyName: string
): Promise<void> {
  await argusApi.delete(
    `${ARGUS_BASE}/projects/${projectId}/lexicon/properties/${encodeURIComponent(propertyName)}`
  );
}

// === User Profiles ===

export async function getUserProfiles(
  projectId: number | string,
  params?: {
    limit?: number;
    offset?: number;
    sort?: string;
    search?: string;
    period?: string;
    start?: string;
    end?: string;
    platform?: string;
    country?: string;
    churn_risk?: string;
    aql?: string;
  }
): Promise<{ data: ArgusUserProfile[]; total: number }> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/users`,
    { params }
  );
  return {
    data: response.data?.data || [],
    total: response.data?.total || 0,
  };
}

export async function getUserProfileFacets(
  projectId: number | string,
  params?: {
    period?: string;
    start?: string;
    end?: string;
  }
): Promise<Record<string, { value: string; count: number }[]>> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/users/facets`,
    { params }
  );
  return response.data?.data || {};
}

export async function getUserProfile(
  projectId: number | string,
  userId: string
): Promise<ArgusUserProfile | null> {
  try {
    const response = await argusApi.get(
      `${ARGUS_BASE}/projects/${projectId}/analytics/users/${encodeURIComponent(userId)}`
    );
    return response.data?.data || response.data || null;
  } catch {
    return null;
  }
}

export async function getUserEvents(
  projectId: number | string,
  userId: string,
  params?: {
    limit?: number;
    offset?: number;
    period?: string;
    start?: string;
    end?: string;
    search?: string;
  }
): Promise<{ data: ArgusUserEvent[]; total: number; hasMore: boolean }> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/users/${encodeURIComponent(userId)}/events`,
    { params }
  );
  return {
    data: response.data?.data || [],
    total: response.data?.total || 0,
    hasMore: response.data?.hasMore ?? false,
  };
}

export async function getUserEventVolume(
  projectId: number | string,
  userId: string,
  params?: {
    period?: string;
    start?: string;
    end?: string;
    search?: string;
  }
): Promise<{ buckets: string[]; counts: number[] }> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/users/${encodeURIComponent(userId)}/events/volume`,
    { params }
  );
  return response.data?.data || { buckets: [], counts: [] };
}

export async function getUserSessions(
  projectId: number | string,
  userId: string,
  params?: { limit?: number; offset?: number }
): Promise<{ data: ArgusUserSession[]; total: number }> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/users/${encodeURIComponent(userId)}/sessions`,
    { params }
  );
  return {
    data: response.data?.data || [],
    total: response.data?.total || 0,
  };
}

export async function getUserProperties(
  projectId: number | string,
  userId: string
): Promise<ArgusUserProperty[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/users/${encodeURIComponent(userId)}/properties`
  );
  return response.data?.data || [];
}

export async function getUserCohortMemberships(
  projectId: number | string,
  userIds: string[]
): Promise<
  Record<string, { id: number; name: string; description: string | null }[]>
> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/analytics/users/cohort-memberships`,
    { userIds }
  );
  return response.data?.data || {};
}

// === Cohorts ===

export async function getCohorts(
  projectId: number | string
): Promise<ArgusCohort[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/cohorts`
  );
  return response.data?.data || [];
}

export async function createCohort(
  projectId: number | string,
  data: {
    name: string;
    description?: string;
    definition: ArgusCohortDefinition;
  }
): Promise<ArgusCohort> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/analytics/cohorts`,
    data
  );
  return response.data?.data || response.data;
}

export async function updateCohort(
  projectId: number | string,
  cohortId: number,
  data: {
    name?: string;
    description?: string;
    definition?: ArgusCohortDefinition;
  }
): Promise<void> {
  await argusApi.put(
    `${ARGUS_BASE}/projects/${projectId}/analytics/cohorts/${cohortId}`,
    data
  );
}

export async function deleteCohort(
  projectId: number | string,
  cohortId: number
): Promise<void> {
  await argusApi.delete(
    `${ARGUS_BASE}/projects/${projectId}/analytics/cohorts/${cohortId}`
  );
}

export async function computeCohort(
  projectId: number | string,
  cohortId: number
): Promise<{ user_count: number }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/analytics/cohorts/${cohortId}/compute`
  );
  return response.data?.data || { user_count: 0 };
}

export async function getCohortUsers(
  projectId: number | string,
  cohortId: number,
  params?: { limit?: number; offset?: number }
): Promise<string[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/cohorts/${cohortId}/users`,
    { params }
  );
  return response.data?.data || [];
}

export async function previewCohort(
  projectId: number | string,
  definition: ArgusCohortDefinition
): Promise<{ user_count: number }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/analytics/cohorts/preview`,
    { definition }
  );
  return response.data?.data || { user_count: 0 };
}

// === Realtime Analytics ===

export interface RealtimeData {
  active_users: number;
  total_events: number;
  events_per_minute: { minute: string; count: number }[];
  top_events: { name: string; count: number }[];
  top_countries: { country: string; count: number }[];
  recent_events: {
    event_name: string;
    user_id: string | null;
    timestamp: string;
    country: string | null;
    platform: string | null;
  }[];
  // Comparison & insight fields
  prev_active_users: number;
  prev_total_events: number;
  prev_events_per_minute: { minute: string; count: number }[];
  error_rate: number;
  error_count: number;
  anomalies: {
    active_users: 'normal' | 'low' | 'high';
    error_rate: 'normal' | 'warning' | 'critical';
    event_volume: 'normal' | 'low' | 'high';
  };
}

export async function getRealtimeAnalytics(
  projectId: number | string
): Promise<RealtimeData> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/realtime`
  );
  return (
    response.data?.data || {
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
      anomalies: { active_users: 'normal', error_rate: 'normal', event_volume: 'normal' },
    }
  );
}

// === Tracking Realtime ===

export interface TrackingRealtimeData {
  error_count: number;
  prev_error_count: number;
  errors_per_minute: { minute: string; count: number }[];
  prev_errors_per_minute: { minute: string; count: number }[];
  p50: number;
  p95: number;
  txn_count: number;
  prev_p50: number;
  prev_p95: number;
  perf_timeseries: { minute: string; p50: number; p95: number; cnt: number }[];
  error_types: { type: string; count: number }[];
  log_levels: { level: string; count: number }[];
  recent_errors: {
    type: string;
    value: string;
    timestamp: string;
    platform: string | null;
    release: string | null;
    environment: string | null;
  }[];
  slow_transactions: { transaction: string; p95: number; count: number }[];
  log_count: number;
  prev_log_count: number;
  anomalies: {
    errors: 'normal' | 'low' | 'high';
    p95: 'normal' | 'low' | 'high';
  };
  errors_by_release: { release: string; minute: string; count: number }[];
  feedback_summary: {
    total: number;
    negative: number;
    positive: number;
    neutral: number;
    bugs: number;
  };
  recent_feedback: {
    message: string;
    sentiment: string;
    category: string;
    email: string;
    timestamp: string;
    release: string;
  }[];
}

export async function getTrackingRealtimeData(
  projectId: number | string
): Promise<TrackingRealtimeData> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/tracking/realtime`
  );
  return (
    response.data?.data || {
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
    }
  );
}

// === Impact Analysis ===

export interface ImpactAnalysisResult {
  cause_event: string;
  effect_event: string;
  window_days: number;
  cause_users: number;
  converted_users: number;
  conversion_rate: number;
  baseline_users: number;
  baseline_converted: number;
  baseline_rate: number;
  lift: number;
}

export async function analyzeImpact(
  projectId: number | string,
  data: {
    causeEvent: string;
    effectEvent: string;
    period?: string;
    start?: string;
    end?: string;
    windowDays?: number;
  }
): Promise<ImpactAnalysisResult> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/analytics/impact`,
    data
  );
  return response.data?.data || response.data;
}

// === Revenue Analytics ===

export interface RevenueData {
  revenue_over_time: {
    period: string;
    revenue: number;
    transactions: number;
    paying_users: number;
    dau: number;
    arpdau: number;
  }[];
  total_revenue: number;
  total_transactions: number;
  total_paying_users: number;
  total_users: number;
  avg_order_value: number;
  arpu: number;
  arppu: number;
  conversion_rate: number;
  first_purchasers: number;
  repeat_purchasers: number;
  // Previous period comparison
  prev_total_revenue: number;
  prev_total_transactions: number;
  prev_total_paying_users: number;
  prev_avg_order_value: number;
  prev_arpu: number;
  prev_arppu: number;
  prev_conversion_rate: number;
  // Breakdowns
  revenue_by_country: {
    country: string;
    revenue: number;
    transactions: number;
  }[];
  revenue_by_platform: {
    platform: string;
    revenue: number;
    transactions: number;
  }[];
  prev_revenue_by_country: {
    country: string;
    revenue: number;
    transactions: number;
  }[];
  prev_revenue_by_platform: {
    platform: string;
    revenue: number;
    transactions: number;
  }[];
  // Previous period trend for overlay
  prev_revenue_over_time: {
    period: string;
    revenue: number;
    transactions: number;
  }[];
  // Refund
  total_refunds: number;
  refund_count: number;
  refund_rate: number;
  net_revenue: number;
  refund_users: number;
  prev_total_refunds: number;
  prev_refund_count: number;
  prev_net_revenue: number;
  refunds_over_time: {
    period: string;
    refunds: number;
    refund_count: number;
  }[];
  refund_reasons: { reason: string; count: number; amount: number }[];
  // Payment method
  revenue_by_payment_method: {
    payment_method: string;
    revenue: number;
    transactions: number;
    users: number;
  }[];
  // Grants
  total_granted: number;
  grant_count: number;
  grant_users: number;
  grants_by_reason: {
    reason: string;
    total_granted: number;
    grant_count: number;
    grant_users: number;
  }[];
  grants_over_time: { period: string; grants: number; grant_count: number }[];
  // Ad Revenue
  total_ad_revenue: number;
  prev_total_ad_revenue: number;
  total_impressions: number;
  total_ad_clicks: number;
  avg_ecpm: number;
  ad_users: number;
  blended_revenue: number;
  prev_blended_revenue: number;
  blended_arpu: number;
  ad_arpu: number;
  iap_share: number;
  ad_share: number;
  ad_revenue_over_time: {
    period: string;
    ad_revenue: number;
    impressions: number;
    ecpm: number;
  }[];
  revenue_by_ad_type: {
    ad_type: string;
    revenue: number;
    impressions: number;
    ecpm: number;
  }[];
  revenue_by_placement: {
    placement: string;
    revenue: number;
    impressions: number;
    ecpm: number;
  }[];
  revenue_by_sdk: {
    sdk: string;
    revenue: number;
    impressions: number;
    ecpm: number;
  }[];
  // Auto-generated insights (from backend)
  insights?: {
    severity: 'positive' | 'warning' | 'critical' | 'info';
    icon: string;
    title: string;
    detail: string;
    action?: string;
    drilldown?: {
      type: 'scroll' | 'ledger';
      target?: string;
      ledgerFilter?: { type?: string; reason?: string };
    };
  }[];
  segment_verdicts?: {
    by_country: {
      name: string;
      revenue: number;
      prevRevenue: number;
      change: number;
      changePct: number;
      verdict: 'invest' | 'maintain' | 'opportunity' | 'review';
      verdictLabel: string;
      verdictIcon: string;
    }[];
    by_platform: {
      name: string;
      revenue: number;
      prevRevenue: number;
      change: number;
      changePct: number;
      verdict: 'invest' | 'maintain' | 'opportunity' | 'review';
      verdictLabel: string;
      verdictIcon: string;
    }[];
  };
}

export interface ProductRevenue {
  product_name: string;
  product_id: string;
  revenue: number;
  transactions: number;
  buyers: number;
  percentage: number;
  refund_count: number;
  refund_amount: number;
  refund_rate: number;
}

export interface EconomyData {
  flow_over_time: { period: string; source: number; sink: number }[];
  by_currency: {
    currency_type: string;
    source: number;
    sink: number;
    source_count: number;
    sink_count: number;
    net_flow: number;
  }[];
  top_sinks: {
    item_name: string;
    currency_type: string;
    total_spent: number;
    transaction_count: number;
  }[];
  ratio_trend: { period: string; ratio: number; net_flow: number }[];
}

export interface TopSpendersData {
  segments: {
    segment: string;
    user_count: number;
    revenue: number;
    percentage: number;
  }[];
  top_users: {
    user_id: string;
    total_spent: number;
    purchase_count: number;
    percentage: number;
  }[];
  total_revenue: number;
  total_spenders: number;
  distribution: {
    range_start: number;
    range_end: number;
    user_count: number;
  }[];
  whale_trend: {
    period: string;
    top10_pct_share: number;
  }[];
}

export interface ProductTrendData {
  product_name: string;
  trend: { period: string; revenue: number }[];
}

export interface LtvData {
  ltv_curve: {
    day: number;
    cumulative_revenue: number;
    daily_revenue: number;
    user_count: number;
  }[];
  // pLTV predictions
  pltv_predictions: { day: number; predicted_ltv: number }[];
  pltv_curve: { day: number; predicted_ltv: number }[];
  pltv_confidence: number;
  pltv_coefficients: { a: number; b: number };
}

type RevenueParams = {
  period?: string;
  start?: string;
  end?: string;
  granularity?: string;
  // Segment filters
  country?: string;
  platform?: string;
  app_version?: string;
};

const defaultRevenueData: RevenueData = {
  revenue_over_time: [],
  total_revenue: 0,
  total_transactions: 0,
  total_paying_users: 0,
  total_users: 0,
  avg_order_value: 0,
  arpu: 0,
  arppu: 0,
  conversion_rate: 0,
  first_purchasers: 0,
  repeat_purchasers: 0,
  prev_total_revenue: 0,
  prev_total_transactions: 0,
  prev_total_paying_users: 0,
  prev_avg_order_value: 0,
  prev_arpu: 0,
  prev_arppu: 0,
  prev_conversion_rate: 0,
  revenue_by_country: [],
  revenue_by_platform: [],
  prev_revenue_by_country: [],
  prev_revenue_by_platform: [],
  prev_revenue_over_time: [],
  // Refund
  total_refunds: 0,
  refund_count: 0,
  refund_rate: 0,
  net_revenue: 0,
  refund_users: 0,
  prev_total_refunds: 0,
  prev_refund_count: 0,
  prev_net_revenue: 0,
  refunds_over_time: [],
  refund_reasons: [],
  // Payment method
  revenue_by_payment_method: [],
  // Grants
  total_granted: 0,
  grant_count: 0,
  grant_users: 0,
  grants_by_reason: [],
  grants_over_time: [],
  // Ad Revenue
  total_ad_revenue: 0,
  prev_total_ad_revenue: 0,
  total_impressions: 0,
  total_ad_clicks: 0,
  avg_ecpm: 0,
  ad_users: 0,
  blended_revenue: 0,
  prev_blended_revenue: 0,
  blended_arpu: 0,
  ad_arpu: 0,
  iap_share: 100,
  ad_share: 0,
  ad_revenue_over_time: [],
  revenue_by_ad_type: [],
  revenue_by_placement: [],
  revenue_by_sdk: [],
};

export async function getRevenueAnalytics(
  projectId: number | string,
  params?: RevenueParams
): Promise<RevenueData> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization`,
    { params }
  );
  return response.data?.data || defaultRevenueData;
}

export interface AcquisitionSummary {
  total_sessions: number;
  total_users: number;
  total_revenue: number;
  total_paying_users: number;
  conversion_rate: number;
}

export interface AcquisitionChartPoint {
  period: string;
  sessions: number;
  revenue: number;
}

export interface AcquisitionTableRow {
  dimension: string;
  sessions: number;
  users: number;
  revenue: number;
  paying_users: number;
  avg_duration: number;
}

export interface AcquisitionResponse {
  summary: AcquisitionSummary;
  summary_prev?: AcquisitionSummary;
  chart: AcquisitionChartPoint[];
  table: AcquisitionTableRow[];
}

export async function getRevenueAcquisition(
  projectId: number | string,
  params?: RevenueParams & {
    groupBy?: 'source' | 'medium' | 'campaign' | 'platform';
    attributionModel?: 'last' | 'first' | 'linear';
  }
): Promise<AcquisitionResponse> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization/acquisition`,
    { params }
  );
  const empty: AcquisitionSummary = {
    total_sessions: 0,
    total_users: 0,
    total_revenue: 0,
    total_paying_users: 0,
    conversion_rate: 0,
  };
  return (
    response.data?.data || {
      summary: empty,
      summary_prev: empty,
      chart: [],
      table: [],
    }
  );
}

export interface ProductsResponse {
  products: ProductRevenue[];
  first_purchase_products: {
    product_name: string;
    first_purchase_count: number;
  }[];
  category_breakdown: {
    category: string;
    revenue: number;
    transactions: number;
    buyers: number;
  }[];
}

export async function getRevenueProducts(
  projectId: number | string,
  params?: RevenueParams
): Promise<ProductsResponse> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization/products`,
    { params }
  );
  const data = response.data?.data;
  // Support both old (array) and new ({products, first_purchase_products}) response shapes
  if (Array.isArray(data))
    return {
      products: data,
      first_purchase_products: [],
      category_breakdown: [],
    };
  return (
    data || {
      products: [],
      first_purchase_products: [],
      category_breakdown: [],
    }
  );
}

export async function getRevenueProductsTrend(
  projectId: number | string,
  params?: RevenueParams
): Promise<ProductTrendData[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization/products/trend`,
    { params }
  );
  return response.data?.data || [];
}

export interface ProductDetailData {
  trend: {
    period: string;
    revenue: number;
    transactions: number;
    buyers: number;
  }[];
  summary: { total_revenue: number; total_transactions: number };
  buyers: {
    user_id: string;
    total_spent: number;
    purchase_count: number;
    last_purchase: string;
    avatar_url: string | null;
  }[];
  has_more: boolean;
}

export async function getRevenueProductDetail(
  projectId: number | string,
  params: RevenueParams & {
    product_name: string;
    offset?: number;
    limit?: number;
  }
): Promise<ProductDetailData> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization/products/detail`,
    { params }
  );
  return (
    response.data?.data || {
      trend: [],
      summary: { total_revenue: 0, total_transactions: 0 },
      buyers: [],
      has_more: false,
    }
  );
}

export async function getRevenueEconomy(
  projectId: number | string,
  params?: RevenueParams & { currency_type?: string }
): Promise<EconomyData> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization/economy`,
    { params }
  );
  return (
    response.data?.data || {
      flow_over_time: [],
      by_currency: [],
      top_sinks: [],
    }
  );
}

export async function getRevenueTopSpenders(
  projectId: number | string,
  params?: RevenueParams
): Promise<TopSpendersData> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization/top-spenders`,
    { params }
  );
  return (
    response.data?.data || {
      segments: [],
      top_users: [],
      total_revenue: 0,
      total_spenders: 0,
      distribution: [],
      whale_trend: [],
    }
  );
}

export async function getRevenueLtv(
  projectId: number | string,
  params?: RevenueParams
): Promise<LtvData> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization/ltv`,
    { params }
  );
  return (
    response.data?.data || {
      ltv_curve: [],
      pltv_predictions: [],
      pltv_curve: [],
      pltv_confidence: 0,
      pltv_coefficients: { a: 0, b: 0 },
    }
  );
}

// --- Revenue Cohort ---

export interface CohortData {
  cohorts: {
    cohort_week: string;
    data: { day: number; cumulative_revenue: number; users: number }[];
  }[];
  bucket_days: number[];
}

export async function getRevenueCohort(
  projectId: number | string,
  params?: RevenueParams
): Promise<CohortData> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization/cohort`,
    { params }
  );
  return response.data?.data || { cohorts: [], bucket_days: [] };
}

// --- Purchase Funnel ---

export interface FunnelData {
  stages: { name: string; label: string; users: number }[];
}

export async function getRevenueFunnel(
  projectId: number | string,
  params?: RevenueParams
): Promise<FunnelData> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization/funnel`,
    { params }
  );
  return response.data?.data || { stages: [] };
}

// --- Cohort LTV Comparison ---

export interface CohortLtvData {
  cohorts: {
    label: string;
    total_users: number;
    ltv_curve: {
      day: number;
      cumulative_revenue: number;
      user_count: number;
    }[];
  }[];
  cohort_by: string;
}

export async function getRevenueLtvCohorts(
  projectId: number | string,
  params?: RevenueParams & { cohort_by?: string }
): Promise<CohortLtvData> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization/ltv-cohorts`,
    { params }
  );
  return response.data?.data || { cohorts: [], cohort_by: 'week' };
}

// --- Segment Comparison ---

export interface SegmentComparisonData {
  segments: {
    segment: string;
    user_count: number;
    total_revenue: number;
    avg_spend: number;
    avg_purchases: number;
    avg_order_value: number;
    avg_active_days: number;
    top_products: { product_name: string; count: number }[];
  }[];
}

export async function getRevenueSegmentComparison(
  projectId: number | string,
  params?: RevenueParams
): Promise<SegmentComparisonData> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization/segment-comparison`,
    { params }
  );
  return response.data?.data || { segments: [] };
}

// === Transaction Ledger ===

export interface TransactionRow {
  event_id: string;
  event_type: string;
  timestamp: string;
  user_id: string;
  product_name: string;
  amount: number;
  currency: string;
  reason: string;
  payment_method: string;
  ad_type: string;
  ad_sdk: string;
  ad_ecpm: number;
}

export interface TransactionSummary {
  purchase_total: number;
  purchase_count: number;
  refund_total: number;
  refund_count: number;
  grant_total: number;
  grant_count: number;
  ad_total: number;
  ad_count: number;
}

export interface TransactionResponse {
  mode?: 'flat';
  transactions: TransactionRow[];
  total_count: number;
  summary: TransactionSummary;
  has_more: boolean;
}

export interface TransactionGroupedRow {
  group_key: string;
  count: number;
  total_amount: number;
  avg_amount: number;
  first_at: string;
  last_at: string;
  unique_users: number;
}

export interface TransactionGroupedResponse {
  mode: 'grouped';
  group_by: string;
  groups: TransactionGroupedRow[];
  total_groups: number;
  summary: TransactionSummary;
  has_more: boolean;
}

export type LedgerGroupBy =
  | 'none'
  | 'product'
  | 'user'
  | 'day'
  | 'hour'
  | 'reason';

export interface TransactionQueryParams extends RevenueParams {
  type?: string;
  user_id?: string;
  product?: string;
  reason?: string;
  min_amount?: number;
  max_amount?: number;
  sort?: string;
  order?: string;
  offset?: number;
  limit?: number;
  group_by?: LedgerGroupBy;
  user_ids?: string;
  products?: string;
  reasons?: string;
  payment_methods?: string;
  search?: string;
}

export async function getRevenueTransactions(
  projectId: number | string,
  params: TransactionQueryParams
): Promise<TransactionResponse | TransactionGroupedResponse> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization/transactions`,
    { params }
  );
  return (
    response.data?.data || {
      mode: 'flat',
      transactions: [],
      total_count: 0,
      summary: {
        purchase_total: 0,
        purchase_count: 0,
        refund_total: 0,
        refund_count: 0,
        grant_total: 0,
        grant_count: 0,
        ad_total: 0,
        ad_count: 0,
      },
      has_more: false,
    }
  );
}

export interface FacetValue {
  value: string;
  count: number;
}

export async function getTransactionFacets(
  projectId: number | string,
  params: RevenueParams & { facet: string }
): Promise<FacetValue[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization/transactions/facets`,
    { params }
  );
  return response.data?.data?.values || [];
}

// === User Financial Summary ===

export interface UserFinancialTransaction {
  event_id: string;
  timestamp: string;
  product_name: string;
  amount: number;
  currency: string;
  reason: string;
  payment_method: string;
}

export interface UserFinancialSummary {
  total_purchases: number;
  purchase_count: number;
  total_refunds: number;
  refund_count: number;
  total_grants: number;
  grant_count: number;
  net_revenue: number;
  refund_rate: number;
  first_purchase: string | null;
  last_purchase: string | null;
}

export interface UserFinancialResponse {
  summary: UserFinancialSummary;
  purchases: UserFinancialTransaction[];
  refunds: UserFinancialTransaction[];
  grants: UserFinancialTransaction[];
}

export async function getRevenueUserSummary(
  projectId: number | string,
  params: RevenueParams & { user_id: string }
): Promise<UserFinancialResponse> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization/user-summary`,
    { params }
  );
  return (
    response.data?.data || {
      summary: {
        total_purchases: 0,
        purchase_count: 0,
        total_refunds: 0,
        refund_count: 0,
        total_grants: 0,
        grant_count: 0,
        net_revenue: 0,
        refund_rate: 0,
        first_purchase: null,
        last_purchase: null,
      },
      purchases: [],
      refunds: [],
      grants: [],
    }
  );
}

// === Product Hourly Heatmap ===

export interface HourlyHeatmapCell {
  day_of_week: number;
  hour: number;
  revenue: number;
  count: number;
}

export interface HourlyHeatmapResponse {
  heatmap: HourlyHeatmapCell[];
}

export async function getRevenueProductHourly(
  projectId: number | string,
  params: RevenueParams & { product_name: string; tz?: string }
): Promise<HourlyHeatmapResponse> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/monetization/products/hourly`,
    { params }
  );
  return response.data?.data || { heatmap: [] };
}

// === Lifecycle Analysis ===

export interface LifecycleStage {
  stage: string;
  user_count: number;
  avg_events: number;
}

export interface LifecycleData {
  stages: LifecycleStage[];
  new_users_over_time: { period: string; new_users: number }[];
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
}

export async function getLifecycleAnalytics(
  projectId: number | string,
  params?: {
    period?: string;
    start?: string;
    end?: string;
    granularity?: string;
  }
): Promise<LifecycleData> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/lifecycle`,
    { params }
  );
  return (
    response.data?.data || {
      stages: [],
      new_users_over_time: [],
      dau: 0,
      wau: 0,
      mau: 0,
      stickiness: 0,
    }
  );
}

// === KPI Alerts ===

export interface KpiAlertMetricConfig {
  type: 'event_count' | 'unique_users' | 'dau' | 'revenue';
  event_name?: string;
  interval_seconds: number;
}

export interface KpiAlert {
  id: number;
  project_id: string;
  name: string;
  metric_config: KpiAlertMetricConfig;
  operator: 'less_than' | 'greater_than' | 'equals';
  threshold: number;
  check_interval: number;
  notification_channels: { type: string; target: string }[];
  status: string;
  last_checked: string | null;
  last_value: number | null;
  enabled: number;
  created_at: string;
}

export async function getKpiAlerts(
  projectId: number | string
): Promise<KpiAlert[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/kpi-alerts`
  );
  return response.data?.data || [];
}

export async function createKpiAlert(
  projectId: number | string,
  data: {
    name: string;
    metric_config: KpiAlertMetricConfig;
    operator: 'less_than' | 'greater_than' | 'equals';
    threshold: number;
    check_interval?: number;
    notification_channels?: { type: string; target: string }[];
  }
): Promise<{ id: number }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/analytics/kpi-alerts`,
    data
  );
  return response.data?.data || response.data;
}

export async function deleteKpiAlert(
  projectId: number | string,
  alertId: number
): Promise<void> {
  await argusApi.delete(
    `${ARGUS_BASE}/projects/${projectId}/analytics/kpi-alerts/${alertId}`
  );
}

export async function checkKpiAlert(
  projectId: number | string,
  alertId: number
): Promise<{
  metric_value: number;
  threshold: number;
  operator: string;
  triggered: boolean;
  status: string;
}> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/analytics/kpi-alerts/${alertId}/check`
  );
  return response.data?.data || response.data;
}

// === Data Governance ===

export interface DataGovernanceEvent {
  name: string;
  total_count: number;
  unique_users: number;
  first_seen: string;
  last_seen: string;
  active_days: number;
}

export interface DataGovernanceData {
  events: DataGovernanceEvent[];
  volume_trends: Record<string, { day: string; count: number }[]>;
  property_coverage: Record<string, { property: string; coverage: number }[]>;
  duplicates: { group: string[]; suggestion: string }[];
  quality_score: number;
  total_events: number;
  active_events: number;
}

export async function getDataGovernance(
  projectId: number | string
): Promise<DataGovernanceData> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/analytics/data-governance`
  );
  return (
    response.data?.data || {
      events: [],
      volume_trends: {},
      property_coverage: {},
      duplicates: [],
      quality_score: 0,
      total_events: 0,
      active_events: 0,
    }
  );
}
