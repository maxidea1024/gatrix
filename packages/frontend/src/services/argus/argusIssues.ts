/**
 * Argus Issues, Discover, and Saved Queries API.
 */
import { argusApi, ARGUS_BASE } from './argusApi';
import type {
  ArgusIssue,
  ArgusIssueDetail,
  ArgusErrorEvent,
  ArgusIssueActivity,
  ArgusIssueTagGroup,
  ArgusIssueListParams,
  ArgusSavedQuery,
  SavedQueryType,
} from './argusTypes';

// --- Issues ---

export async function listIssues(
  projectId: number | string,
  params?: ArgusIssueListParams
): Promise<{ data: ArgusIssue[]; total: number }> {
  const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/issues`, {
    params,
  });
  const result = response.data;
  return {
    data: result?.data || [],
    total: result?.total || 0,
  };
}

export async function getIssueVolume(
  projectId: number | string,
  params?: {
    period?: string;
    start?: string;
    end?: string;
    status?: string;
    level?: string;
    query?: string;
    environment?: string;
    browser?: string;
    os?: string;
  }
): Promise<{ day: string; count: number; issue_count: number }[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/issues/volume`,
    { params }
  );
  return response.data?.data || [];
}

export async function getIssueDetail(
  projectId: number | string,
  issueId: number | string
): Promise<ArgusIssueDetail> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/issues/${issueId}`
  );
  return response.data?.data || response.data;
}

export async function updateIssueStatus(
  projectId: number | string,
  issueId: number | string,
  status: string
): Promise<void> {
  await argusApi.patch(`${ARGUS_BASE}/${projectId}/issues/${issueId}`, {
    status,
  });
}

export async function assignIssue(
  projectId: number | string,
  issueId: number | string,
  assignee: string | null
): Promise<void> {
  await argusApi.patch(`${ARGUS_BASE}/${projectId}/issues/${issueId}`, {
    assigned_to: assignee,
  });
}

export async function createIssueExternalLink(
  projectId: number | string,
  issueId: number | string,
  provider: string,
  data: Record<string, any>
): Promise<{ url: string; key: string }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/issues/${issueId}/external-issue`,
    {
      provider,
      ...data,
    }
  );
  return response.data?.data || response.data;
}

export async function updateIssueExternalLink(
  projectId: number | string,
  issueId: number | string,
  externalUrl: string | null,
  externalKey: string | null
): Promise<void> {
  await argusApi.patch(`${ARGUS_BASE}/${projectId}/issues/${issueId}`, {
    external_url: externalUrl,
    external_key: externalKey,
  });
}

export async function bulkUpdateIssues(
  projectId: number | string,
  issueIds: number[],
  update: { status?: string; assigned_to?: string | null }
): Promise<{ updated: number }> {
  const response = await argusApi.put(
    `${ARGUS_BASE}/${projectId}/issues/bulk`,
    {
      issue_ids: issueIds,
      ...update,
    }
  );
  return response.data?.data || response.data;
}

export async function mergeIssues(
  projectId: number | string,
  issueIds: number[]
): Promise<{ primary_id: number; merged_count: number }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/issues/merge`,
    {
      issue_ids: issueIds,
    }
  );
  return response.data?.data || response.data;
}

export async function getIssueActivity(
  projectId: number | string,
  issueId: number | string,
  limit?: number,
  offset?: number
): Promise<ArgusIssueActivity[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/issues/${issueId}/activity`,
    {
      params: { limit, offset },
    }
  );
  return response.data?.data || [];
}

export async function subscribeIssue(
  projectId: number | string,
  issueId: number | string,
  subscribe: boolean
): Promise<void> {
  await argusApi.put(`${ARGUS_BASE}/${projectId}/issues/${issueId}/subscribe`, {
    is_subscribed: subscribe,
  });
}

export async function bookmarkIssue(
  projectId: number | string,
  issueId: number | string,
  bookmark: boolean
): Promise<void> {
  await argusApi.put(`${ARGUS_BASE}/${projectId}/issues/${issueId}/bookmark`, {
    is_bookmarked: bookmark,
  });
}

export async function deleteIssue(
  projectId: number | string,
  issueId: number | string
): Promise<void> {
  await argusApi.delete(`${ARGUS_BASE}/${projectId}/issues/${issueId}`);
}

export async function discardIssue(
  projectId: number | string,
  issueId: number | string
): Promise<void> {
  await argusApi.post(`${ARGUS_BASE}/${projectId}/issues/${issueId}/discard`);
}

export async function addIssueComment(
  projectId: number | string,
  issueId: number | string,
  text: string
): Promise<void> {
  await argusApi.post(`${ARGUS_BASE}/${projectId}/issues/${issueId}/comments`, {
    text,
  });
}

export async function getIssueTags(
  projectId: number | string,
  issueId: number | string
): Promise<ArgusIssueTagGroup[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/issues/${issueId}/tags`
  );
  return response.data?.data || [];
}

/**
 * Get aggregated facet counts from the ClickHouse errors table.
 * Returns release, environment, browser_name, os_name distributions.
 */
export async function getIssueFacets(
  projectId: number | string,
  params?: { period?: string; start?: string; end?: string }
): Promise<Record<string, { value: string; count: number }[]>> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/issues/facets`,
    { params }
  );
  return response.data?.data || {};
}

/**
 * Get top values for a single field from the errors table.
 * Used by the AQL editor to suggest values for issue-domain fields.
 */
export async function getIssueAttributeFacet(
  projectId: number | string,
  key: string,
  params?: { period?: string; start?: string; end?: string }
): Promise<{ attr_value: string; count: number }[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/issues/attribute-facet`,
    { params: { key, ...params } }
  );
  return response.data?.data || [];
}

export async function getIssueStats(
  projectId: number | string,
  issueId: number | string,
  period: string = '14d'
): Promise<{ timestamp: string; event_count: number; user_count: number }[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/issues/${issueId}/stats`,
    { params: { period } }
  );
  return response.data?.data || [];
}

export async function listIssueEvents(
  projectId: number | string,
  issueId: number | string,
  params?: { limit?: number; offset?: number }
): Promise<{ data: ArgusErrorEvent[] }> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/issues/${issueId}/events`,
    { params }
  );
  return { data: response.data?.data || response.data || [] };
}

// --- Discover ---

export async function discoverQuery(
  projectId: number | string,
  query: {
    fields: string[];
    conditions?: string;
    groupBy?: string[];
    orderBy?: string;
    limit?: number;
    offset?: number;
    period?: string;
    start?: string;
    end?: string;
    dataset?: string;
  }
): Promise<{
  data: Record<string, any>[];
  meta: { fields: { name: string; type: string }[] };
}> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/discover`,
    query
  );
  return response.data?.data
    ? response.data
    : { data: [], meta: { fields: [] } };
}

export async function discoverTags(
  projectId: number | string,
  dataset?: string,
  timeRange?: { period?: string; start?: string; end?: string }
): Promise<{
  columns: string[];
  aggregates: string[];
  stats: Record<string, any>;
  tags: Record<string, { value: string; count: number }[]>;
}> {
  const params: Record<string, string> = {};
  if (dataset) params.dataset = dataset;
  if (timeRange?.period) params.period = timeRange.period;
  if (timeRange?.start) params.start = timeRange.start;
  if (timeRange?.end) params.end = timeRange.end;
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/discover/tags`,
    { params }
  );
  return (
    response.data?.data || {
      columns: [],
      aggregates: [],
      stats: {},
      tags: {},
    }
  );
}

export async function getDiscoverVolume(
  projectId: number | string,
  params: {
    period?: string;
    start?: string;
    end?: string;
    search?: string;
    dataset?: string;
  }
): Promise<{ bucket: string; level: string; count: number }[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/discover/volume`,
    { params }
  );
  return response.data?.data || [];
}

// --- Saved Queries ---

export async function listSavedQueries(
  projectId: number | string,
  queryType?: SavedQueryType
): Promise<ArgusSavedQuery[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/discover/saved`,
    {
      params: queryType ? { query_type: queryType } : undefined,
    }
  );
  return response.data?.data || [];
}

export async function createSavedQuery(
  projectId: number | string,
  data: {
    name: string;
    description?: string;
    query_config: Record<string, any>;
    display_type?: string;
    is_global?: boolean;
    query_type?: SavedQueryType;
  }
): Promise<{ id: number; name: string }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/discover/saved`,
    data
  );
  return response.data?.data || response.data;
}

export async function updateSavedQuery(
  projectId: number | string,
  queryId: number,
  data: {
    name?: string;
    description?: string;
    query_config?: Record<string, any>;
    display_type?: string;
    is_favorite?: boolean;
  }
): Promise<void> {
  await argusApi.put(
    `${ARGUS_BASE}/${projectId}/discover/saved/${queryId}`,
    data
  );
}

export async function toggleSavedQueryFavorite(
  projectId: number | string,
  queryId: number,
  isFavorite: boolean
): Promise<void> {
  await argusApi.patch(
    `${ARGUS_BASE}/${projectId}/discover/saved/${queryId}/favorite`,
    { is_favorite: isFavorite }
  );
}

export async function deleteSavedQuery(
  projectId: number | string,
  queryId: number
): Promise<void> {
  await argusApi.delete(`${ARGUS_BASE}/${projectId}/discover/saved/${queryId}`);
}
