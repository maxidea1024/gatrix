/**
 * Argus Settings: Dashboards, Integrations, Notifications, Commits,
 * Ownership Rules, and Issue Trackers API.
 */
import { argusApi, ARGUS_BASE } from './argusApi';
import type {
  ArgusIntegration,
  ArgusIssueTracker,
  ArgusCommit,
  ArgusOwnershipRule,
} from './argusTypes';

// === Dashboards ===

export async function listDashboards(
  projectId: number | string
): Promise<any[]> {
  try {
    const response = await argusApi.get(
      `${ARGUS_BASE}/${projectId}/dashboards`
    );
    return response.data?.data || [];
  } catch {
    return [];
  }
}

export async function listDashboardPresets(
  projectId: number | string
): Promise<any[]> {
  try {
    const response = await argusApi.get(
      `${ARGUS_BASE}/${projectId}/dashboards/presets`
    );
    return response.data?.data || [];
  } catch {
    return [];
  }
}

export async function createDashboard(
  projectId: number | string,
  data: { title: string; description?: string; preset_id?: string }
): Promise<any> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/dashboards`,
    data
  );
  return response.data?.data || response.data;
}

export async function getDashboard(
  projectId: number | string,
  dashboardId: number
): Promise<any> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/dashboards/${dashboardId}`
  );
  return response.data?.data || response.data;
}

export async function updateDashboard(
  projectId: number | string,
  dashboardId: number,
  data: any
): Promise<void> {
  await argusApi.put(
    `${ARGUS_BASE}/${projectId}/dashboards/${dashboardId}`,
    data
  );
}

export async function deleteDashboard(
  projectId: number | string,
  dashboardId: number
): Promise<void> {
  await argusApi.delete(`${ARGUS_BASE}/${projectId}/dashboards/${dashboardId}`);
}

export async function toggleDashboardFavorite(
  projectId: number | string,
  dashboardId: number,
  isFavorite: boolean
): Promise<void> {
  await argusApi.patch(
    `${ARGUS_BASE}/${projectId}/dashboards/${dashboardId}/favorite`,
    { is_favorite: isFavorite }
  );
}

export async function queryDashboardWidget(
  projectId: number | string,
  query: any
): Promise<any[]> {
  try {
    const response = await argusApi.post(
      `${ARGUS_BASE}/${projectId}/dashboards/widget-query`,
      { query }
    );
    return response.data?.data || [];
  } catch {
    return [];
  }
}

export async function updateDashboardSharing(
  projectId: number | string,
  dashboardId: number,
  data: {
    visibility?: 'personal' | 'team' | 'project';
    shared_with?: string[];
  }
): Promise<void> {
  await argusApi.patch(
    `${ARGUS_BASE}/${projectId}/dashboards/${dashboardId}/sharing`,
    data
  );
}

// === Integrations ===

export async function listIntegrations(
  projectId: number | string
): Promise<ArgusIntegration[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/integrations`
  );
  return response.data?.data || [];
}

export async function createIntegration(
  projectId: number | string,
  data: {
    provider: string;
    repo_url: string;
    default_branch?: string;
    access_token?: string;
  }
): Promise<{ id: number }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/integrations`,
    data
  );
  return response.data?.data || response.data;
}

export async function updateIntegration(
  projectId: number | string,
  integrationId: number,
  data: Partial<ArgusIntegration>
): Promise<void> {
  await argusApi.patch(
    `${ARGUS_BASE}/${projectId}/integrations/${integrationId}`,
    data
  );
}

export async function deleteIntegration(
  projectId: number | string,
  integrationId: number
): Promise<void> {
  await argusApi.delete(
    `${ARGUS_BASE}/${projectId}/integrations/${integrationId}`
  );
}

// === Global Integrations ===

export async function getGlobalIntegrationConfig(
  provider: string
): Promise<{ configured: boolean; config: any }> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/global-integrations/${provider}/config`
  );
  return response.data?.data || response.data;
}

export async function saveGlobalIntegrationConfig(
  provider: string,
  data: { name?: string; url?: string; credentials: any }
): Promise<void> {
  await argusApi.post(
    `${ARGUS_BASE}/global-integrations/${provider}/config`,
    data
  );
}

export async function deleteGlobalIntegrationConfig(
  provider: string
): Promise<void> {
  await argusApi.delete(`${ARGUS_BASE}/global-integrations/${provider}/config`);
}

export async function testSlackConnection(botToken: string): Promise<{
  ok: boolean;
  team?: string;
  user?: string;
  bot_id?: string;
  error?: string;
}> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/global-integrations/slack/test`,
    { bot_token: botToken }
  );
  return response.data?.data || response.data;
}

export async function testGithubConnection(
  appId: string,
  privateKey: string
): Promise<{
  ok: boolean;
  name?: string;
  html_url?: string;
  error?: string;
}> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/global-integrations/github/test`,
    { app_id: appId, private_key: privateKey }
  );
  return response.data?.data || response.data;
}

export async function testBitbucketConnection(
  username: string,
  appPassword: string
): Promise<{
  ok: boolean;
  display_name?: string;
  account_id?: string;
  error?: string;
}> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/global-integrations/bitbucket/test`,
    { username, app_password: appPassword }
  );
  return response.data?.data || response.data;
}

export async function testGitlabConnection(
  instanceUrl: string,
  applicationId: string,
  applicationSecret: string
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/global-integrations/gitlab/test`,
    {
      instance_url: instanceUrl,
      application_id: applicationId,
      application_secret: applicationSecret,
    }
  );
  return response.data?.data || response.data;
}

export async function getGithubRepositories(): Promise<any[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/integrations/github/repositories`
  );
  return response.data?.data || [];
}

// === Notification Channels ===

export async function listNotificationChannels(
  projectId: number | string
): Promise<any[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/notification-channels`
  );
  return response.data?.data || [];
}

export async function createNotificationChannel(
  projectId: number | string,
  data: { provider: string; name?: string; config: Record<string, any> }
): Promise<{ id: number }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/notification-channels`,
    data
  );
  return response.data?.data || response.data;
}

export async function updateNotificationChannel(
  projectId: number | string,
  channelId: number,
  data: Record<string, any>
): Promise<void> {
  await argusApi.patch(
    `${ARGUS_BASE}/${projectId}/notification-channels/${channelId}`,
    data
  );
}

export async function deleteNotificationChannel(
  projectId: number | string,
  channelId: number
): Promise<void> {
  await argusApi.delete(
    `${ARGUS_BASE}/${projectId}/notification-channels/${channelId}`
  );
}

// === Commits ===

export async function listCommits(
  projectId: number | string,
  release?: string
): Promise<ArgusCommit[]> {
  const params: Record<string, string> = {};
  if (release) params.release = release;
  const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/commits`, {
    params,
  });
  return response.data?.data || [];
}

export async function getSuspectCommits(
  projectId: number | string,
  issueId: number | string
): Promise<ArgusCommit[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/issues/${issueId}/suspect-commits`
  );
  return response.data?.data || [];
}

// === Ownership Rules ===

export async function listOwnershipRules(
  projectId: number | string
): Promise<ArgusOwnershipRule[]> {
  const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/ownership`);
  return response.data?.data || [];
}

export async function createOwnershipRule(
  projectId: number | string,
  data: {
    name: string;
    match_type: string;
    match_pattern: string;
    owners: string[];
    priority?: number;
    auto_assign?: boolean;
  }
): Promise<{ id: number }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/ownership`,
    data
  );
  return response.data?.data || response.data;
}

export async function updateOwnershipRule(
  projectId: number | string,
  ruleId: number,
  data: Partial<ArgusOwnershipRule>
): Promise<void> {
  await argusApi.patch(`${ARGUS_BASE}/${projectId}/ownership/${ruleId}`, data);
}

export async function deleteOwnershipRule(
  projectId: number | string,
  ruleId: number
): Promise<void> {
  await argusApi.delete(`${ARGUS_BASE}/${projectId}/ownership/${ruleId}`);
}

// === Issue Trackers ===

export async function listIssueTrackers(
  projectId: number | string
): Promise<ArgusIssueTracker[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/issue-trackers`
  );
  return response.data?.data || [];
}

export async function createIssueTracker(
  projectId: number | string,
  data: {
    provider: ArgusIssueTracker['provider'];
    name: string;
    api_url: string;
    api_token: string;
    config?: Record<string, any>;
  }
): Promise<{ id: number }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/issue-trackers`,
    data
  );
  return response.data?.data || response.data;
}

export async function updateIssueTracker(
  projectId: number | string,
  trackerId: number | string,
  data: {
    name?: string;
    api_url?: string;
    api_token?: string;
    config?: Record<string, any>;
    enabled?: boolean;
  }
): Promise<void> {
  await argusApi.put(
    `${ARGUS_BASE}/${projectId}/issue-trackers/${trackerId}`,
    data
  );
}

export async function deleteIssueTracker(
  projectId: number | string,
  trackerId: number | string
): Promise<void> {
  await argusApi.delete(
    `${ARGUS_BASE}/${projectId}/issue-trackers/${trackerId}`
  );
}

export async function testIssueTracker(
  projectId: number | string,
  trackerId: number | string
): Promise<{ ok: boolean; message: string }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/issue-trackers/${trackerId}/test`
  );
  return response.data?.data || response.data;
}

export async function testTrackerConnection(
  projectId: number | string,
  data: {
    provider: string;
    api_url: string;
    api_token: string;
    config?: Record<string, any>;
  }
): Promise<{ ok: boolean; message: string }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/issue-trackers/test-connection`,
    data
  );
  return response.data?.data || response.data;
}

export async function createExternalIssue(
  projectId: number | string,
  trackerId: number | string,
  payload: {
    title: string;
    description?: string;
    priority?: string;
    url?: string;
  }
): Promise<{ url: string; key: string }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/issue-trackers/${trackerId}/create-issue`,
    payload
  );
  return response.data?.data || response.data;
}
