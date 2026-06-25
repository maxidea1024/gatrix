/**
 * Argus Alerts, Crons, Uptime, Sessions, and Releases API.
 */
import { argusApi, ARGUS_BASE } from './argusApi';
import type {
  ArgusAlertRule,
  ArgusAlertHistory,
  ArgusSessionHealth,
  ArgusRelease,
} from './argusTypes';

// --- Alert Rules ---

export async function listAlertRules(projectId: number | string): Promise<ArgusAlertRule[]> {
  const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/alerts`);
  return response.data?.data || response.data || [];
}

export async function createAlertRule(
  projectId: number | string,
  rule: Omit<
    ArgusAlertRule,
    'id' | 'created_at' | 'updated_at' | 'last_triggered_at'
  >
): Promise<{ id: number }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/alerts`,
    rule
  );
  return response.data?.data || response.data;
}

export async function updateAlertRule(
  projectId: number | string,
  ruleId: number | string,
  updates: Partial<ArgusAlertRule>
): Promise<void> {
  await argusApi.put(`${ARGUS_BASE}/${projectId}/alerts/${ruleId}`, updates);
}

export async function deleteAlertRule(
  projectId: number | string,
  ruleId: number | string
): Promise<void> {
  await argusApi.delete(`${ARGUS_BASE}/${projectId}/alerts/${ruleId}`);
}

export async function testAlertRule(
  projectId: number | string,
  ruleId: number | string
): Promise<void> {
  await argusApi.post(`${ARGUS_BASE}/${projectId}/alerts/${ruleId}/test`);
}

export async function getAlertHistory(
  projectId: number | string,
  params?: { limit?: number; ruleId?: number }
): Promise<ArgusAlertHistory[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/alerts/history`,
    { params }
  );
  return response.data?.data || response.data || [];
}

export async function getAlertStats(
  projectId: string | number,
  days: number = 7
): Promise<{ rule_id: number; bucket: string; count: number }[]> {
  const params = new URLSearchParams({ days: days.toString() });
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/alerts/stats`,
    { params }
  );
  return response.data?.data || [];
}

// --- Sessions ---

export async function getSessionHealth(
  projectId: number | string,
  period?: string,
  start?: string,
  end?: string
): Promise<ArgusSessionHealth> {
  const response = await argusApi.get(`${ARGUS_BASE}/sessions/${projectId}`, {
    params: { period, start, end },
  });
  return response.data?.data || response.data;
}

// --- Releases ---

export async function getReleases(
  projectId: number | string,
  period?: string,
  start?: string,
  end?: string
): Promise<ArgusRelease[]> {
  const response = await argusApi.get(`${ARGUS_BASE}/releases/${projectId}`, {
    params: { period, start, end },
  });
  return response.data?.data || response.data || [];
}

export async function getReleaseHealth(
  projectId: number | string,
  release: string,
  period?: string
): Promise<
  {
    timestamp: string;
    crash_free_rate: number;
    crash_free_users: number;
    total_sessions: number;
    crashed_sessions: number;
    errored_sessions: number;
    healthy_sessions: number;
    abnormal_sessions: number;
  }[]
> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/releases/${projectId}/health`,
    {
      params: { release, period },
    }
  );
  return response.data?.data || response.data || [];
}

// --- Crons ---

export async function getCrons(projectId: number | string): Promise<any[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/crons`
  );
  return response.data?.data || response.data || [];
}

export async function createCron(projectId: number | string, data: any): Promise<any> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/crons`,
    data
  );
  return response.data?.data || response.data;
}

export async function updateCron(
  projectId: number | string,
  monitorId: string,
  data: any
): Promise<void> {
  await argusApi.put(
    `${ARGUS_BASE}/projects/${projectId}/crons/${monitorId}`,
    data
  );
}

export async function deleteCron(
  projectId: number | string,
  monitorId: string
): Promise<void> {
  await argusApi.delete(
    `${ARGUS_BASE}/projects/${projectId}/crons/${monitorId}`
  );
}

export async function getCronCheckins(
  projectId: number | string,
  monitorId: string,
  params?: { limit?: number; offset?: number }
): Promise<{ data: any[]; total: number }> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/crons/${monitorId}/checkins`,
    { params }
  );
  return {
    data: response.data?.data || [],
    total: response.data?.total || 0,
  };
}

export async function sendCronTestCheckin(
  projectId: number | string,
  monitorId: string,
  status: 'ok' | 'error' = 'ok'
): Promise<{ checkin_id: string; status: string }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/crons/${monitorId}/test-checkin`,
    { status }
  );
  return response.data?.data || response.data;
}

export async function getUptimeCheckins(
  projectId: number | string,
  monitorId: string,
  params?: { limit?: number; offset?: number }
): Promise<{ data: any[]; total: number }> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/uptime/${monitorId}/checkins`,
    { params }
  );
  return {
    data: response.data?.data || [],
    total: response.data?.total || 0,
  };
}

// --- Uptime ---

export async function getUptimes(projectId: number | string): Promise<any[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/projects/${projectId}/uptime`
  );
  return response.data?.data || response.data || [];
}

export async function createUptime(projectId: number | string, data: any): Promise<any> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/projects/${projectId}/uptime`,
    data
  );
  return response.data?.data || response.data;
}

export async function updateUptime(
  projectId: number | string,
  monitorId: string,
  data: any
): Promise<void> {
  await argusApi.put(
    `${ARGUS_BASE}/projects/${projectId}/uptime/${monitorId}`,
    data
  );
}

export async function deleteUptime(
  projectId: number | string,
  monitorId: string
): Promise<void> {
  await argusApi.delete(
    `${ARGUS_BASE}/projects/${projectId}/uptime/${monitorId}`
  );
}
