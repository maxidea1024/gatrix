/**
 * Argus Performance, Trace Explorer, and Metrics Explorer API.
 */
import { argusApi, ARGUS_BASE } from './argusApi';
import type {
  ArgusTransaction,
  ArgusTransactionDetail,
  ArgusTraceDetail,
} from './argusTypes';

// --- Performance ---

export async function getTransactions(
  projectId: number | string,
  params?: {
    period?: string;
    sort?: string;
    limit?: number;
    start?: string;
    end?: string;
  }
): Promise<ArgusTransaction[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/performance/${projectId}/transactions`,
    {
      params,
    }
  );
  return response.data?.data || response.data || [];
}

export async function getTransactionDetail(
  projectId: number | string,
  txnName: string,
  period?: string,
  start?: string,
  end?: string
): Promise<ArgusTransactionDetail> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/performance/${projectId}/transactions/${encodeURIComponent(txnName)}`,
    { params: { period, start, end } }
  );
  return response.data?.data || response.data;
}

export async function getTraceDetail(
  projectId: number | string,
  traceId: string
): Promise<ArgusTraceDetail> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/performance/${projectId}/traces/${traceId}`
  );
  return response.data?.data || response.data;
}

// --- Trace Explorer ---

export async function searchSpans(
  projectId: number | string,
  params?: {
    period?: string;
    search?: string;
    op?: string;
    status?: string;
    limit?: number;
    orderBy?: string;
    start?: string;
    end?: string;
    offset?: number;
  }
): Promise<{ data: any[]; hasMore: boolean }> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/traces/${projectId}/spans`,
    { params }
  );
  const raw = response.data;
  return {
    data: raw?.data || [],
    hasMore: raw?.hasMore ?? false,
  };
}

export async function getTraceSamples(
  projectId: number | string,
  params?: {
    period?: string;
    search?: string;
    limit?: number;
    start?: string;
    end?: string;
    offset?: number;
  }
): Promise<{ data: any[]; hasMore: boolean }> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/traces/${projectId}/samples`,
    { params }
  );
  const raw = response.data;
  return {
    data: raw?.data || [],
    hasMore: raw?.hasMore ?? false,
  };
}

export async function getSpanAggregates(
  projectId: number | string,
  params?: { period?: string; groupBy?: string; start?: string; end?: string }
): Promise<{ groupBy: string; topValues: any[]; timeSeries: any[] }> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/traces/${projectId}/aggregate`,
    { params }
  );
  return response.data?.data || response.data;
}

export async function getSpanTags(
  projectId: number | string,
  period?: string,
  start?: string,
  end?: string
): Promise<{
  op: any[];
  status: any[];
  domain: any[];
  discovered?: Record<string, { value: string; count: number }[]>;
}> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/traces/${projectId}/tags`,
    {
      params: { period, start, end },
    }
  );
  return (
    response.data?.data || response.data || { op: [], status: [], domain: [] }
  );
}

export async function getSpanVolume(
  projectId: number | string,
  params?: { period?: string; search?: string; start?: string; end?: string }
): Promise<any[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/traces/${projectId}/volume`,
    { params }
  );
  return response.data?.data || response.data || [];
}

// --- Metrics Explorer ---

export async function getMetricNames(
  projectId: number | string,
  period?: string
): Promise<any[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/metrics/${projectId}/names`,
    {
      params: { period },
    }
  );
  return response.data?.data || response.data || [];
}

export async function queryMetric(
  projectId: number | string,
  params: {
    name: string;
    period?: string;
    groupBy?: string;
    agg?: string;
    start?: string;
    end?: string;
    filter?: string;
    groupLimit?: number;
    interval?: string;
  }
): Promise<{
  timeSeries: any[];
  summary: any;
  metricType?: string;
  unit?: string;
}> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/metrics/${projectId}/query`,
    { params }
  );
  return response.data?.data || response.data;
}

export async function getMetricTags(
  projectId: number | string,
  params?: { period?: string; name?: string }
): Promise<{ environment: any[]; release: any[]; metric_type: any[] }> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/metrics/${projectId}/tags`,
    { params }
  );
  return (
    response.data?.data ||
    response.data || { environment: [], release: [], metric_type: [] }
  );
}

export async function getMetricGroupByOptions(
  projectId: number | string,
  name?: string
): Promise<{ key: string; source: string }[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/metrics/${projectId}/groupby-options`,
    { params: { name } }
  );
  return response.data?.data || response.data || [];
}

export async function getMetricSamples(
  projectId: number | string,
  params: {
    name: string;
    period?: string;
    start?: string;
    end?: string;
    limit?: number;
    offset?: number;
    filter?: string;
  }
): Promise<{ data: any[]; metricType?: string }> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/metrics/${projectId}/samples`,
    { params }
  );
  return response.data || { data: [] };
}

export async function getMetricVolume(
  projectId: number | string,
  params?: { period?: string; start?: string; end?: string }
): Promise<any[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/metrics/${projectId}/volume`,
    { params }
  );
  return response.data?.data || response.data || [];
}
