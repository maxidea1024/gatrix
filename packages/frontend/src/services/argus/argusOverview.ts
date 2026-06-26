/**
 * Argus Overview, Filter Options, Projects, and DSN Keys API.
 */
import { argusApi, ARGUS_BASE } from './argusApi';
import type {
  ArgusProject,
  ArgusDsnKey,
  ArgusDsnKeyStatsResponse,
  ArgusOverviewData,
  ArgusProjectStats,
} from './argusTypes';

// --- Overview ---

export async function getOverview(
  projectId: number | string,
  period?: string,
  start?: string,
  end?: string,
  segmentFilter?: { country?: string; platform?: string; app_version?: string },
): Promise<ArgusOverviewData> {
  const response = await argusApi.get(`${ARGUS_BASE}/overview/${projectId}`, {
    params: { period, start, end, ...segmentFilter },
  });
  return response.data?.data || response.data;
}

// --- Filter Options ---

export async function getFilterOptions(
  projectId: number | string,
  period?: string
): Promise<{ environments: string[]; browsers: string[]; os: string[] }> {
  const response = await argusApi.get(`${ARGUS_BASE}/filters/${projectId}`, {
    params: { period },
  });
  return (
    response.data?.data ||
    response.data || { environments: [], browsers: [], os: [] }
  );
}

// --- Projects ---

export async function listProjects(): Promise<ArgusProject[]> {
  const response = await argusApi.get(`${ARGUS_BASE}/projects`);
  return response.data?.data || response.data || [];
}

export async function getProject(projectId: number | string): Promise<ArgusProject> {
  const response = await argusApi.get(`${ARGUS_BASE}/projects/${projectId}`);
  return response.data?.data || response.data;
}

export async function createProject(data: {
  gatrix_project_id: string;
  name: string;
  slug: string;
  platform?: string;
}): Promise<ArgusProject & { dsn: string }> {
  const response = await argusApi.post(`${ARGUS_BASE}/projects`, data);
  return response.data?.data || response.data;
}

export async function updateProject(
  projectId: number | string,
  data: Partial<
    Pick<
      ArgusProject,
      | 'name'
      | 'platform'
      | 'error_quota_daily'
      | 'transaction_sample_rate'
      | 'session_sample_rate'
      | 'retention_days'
      | 'metrics_group_limit'
      | 'analytics_breakdown_limit'
    >
  >
): Promise<void> {
  await argusApi.patch(`${ARGUS_BASE}/projects/${projectId}`, data);
}

export async function getProjectStats(
  projectId: number | string,
  period?: string
): Promise<ArgusProjectStats[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/stats`,
    {
      params: { period },
    }
  );
  return response.data?.data || response.data || [];
}

// --- DSN Keys ---

export async function createDsnKey(
  projectId: number | string,
  label?: string,
  rateLimit?: { rate_limit_count?: number; rate_limit_window?: number }
): Promise<ArgusDsnKey> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/dsn-keys`,
    {
      label,
      ...rateLimit,
    }
  );
  return response.data?.data || response.data;
}

export async function updateDsnKey(
  projectId: number | string,
  keyId: number | string,
  data: {
    label?: string;
    rate_limit_window?: number;
    rate_limit_count?: number;
  }
): Promise<void> {
  await argusApi.patch(
    `${ARGUS_BASE}/projects/${projectId}/dsn-keys/${keyId}`,
    data
  );
}

export async function revokeDsnKey(
  projectId: number | string,
  keyId: number | string
): Promise<void> {
  await argusApi.delete(
    `${ARGUS_BASE}/projects/${projectId}/dsn-keys/${keyId}`
  );
}

export async function deleteDsnKey(
  projectId: number | string,
  keyId: number | string
): Promise<void> {
  await argusApi.delete(
    `${ARGUS_BASE}/projects/${projectId}/dsn-keys/${keyId}/hard`
  );
}

export async function getDsnKeyStats(
  projectId: number | string,
  keyId: number | string,
  period: '24h' | '7d' | '30d' = '7d'
): Promise<ArgusDsnKeyStatsResponse> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/dsn-keys/${keyId}/stats`,
    { params: { period } }
  );
  return response.data?.data
    ? { data: response.data.data, totals: response.data.totals }
    : response.data;
}
