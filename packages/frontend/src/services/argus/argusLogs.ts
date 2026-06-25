/**
 * Argus Structured Logs, Live Tail, and Source Maps API.
 */
import { argusApi, ARGUS_BASE } from './argusApi';
import type {
  ArgusLogEntry,
  ArgusSourcemapRelease,
  ArgusSourcemapFile,
} from './argusTypes';

// --- Structured Logs ---

export async function getLogs(
  projectId: number | string,
  params: {
    trace_id?: string;
    issue_id?: string | number;
    level?: string;
    search?: string;
    limit?: number;
    order?: string;
    cursor?: string;
  }
): Promise<{
  data: ArgusLogEntry[];
  meta: { count: number; hasMore: boolean };
}> {
  const response = await argusApi.get(`${ARGUS_BASE}/${projectId}/logs`, {
    params,
  });
  const result = response.data?.data
    ? response.data
    : { data: response.data || [], meta: { count: 0, hasMore: false } };
  // Backward compat: if result.data is directly the array (old format)
  if (Array.isArray(result)) {
    return { data: result, meta: { count: result.length, hasMore: false } };
  }
  return {
    data: result.data || [],
    meta: result.meta || { count: 0, hasMore: false },
  };
}

export async function browseLogs(
  projectId: number | string,
  params: {
    period?: string;
    level?: string;
    search?: string;
    service?: string;
    environment?: string;
    limit?: number;
    order?: string;
    cursor?: string;
  }
): Promise<{
  data: ArgusLogEntry[];
  meta: { count: number; hasMore: boolean };
}> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/logs/browse`,
    { params }
  );
  return response.data || { data: [], meta: { count: 0, hasMore: false } };
}

export async function getLogDetail(
  projectId: number | string,
  logId: string,
  signal?: AbortSignal
): Promise<ArgusLogEntry | null> {
  try {
    const response = await argusApi.get(
      `${ARGUS_BASE}/${projectId}/logs/detail/${logId}`,
      { signal }
    );
    return response.data?.data || response.data || null;
  } catch {
    return null;
  }
}

export async function getLogFacets(
  projectId: number | string,
  period?: string,
  start?: string,
  end?: string
): Promise<{
  levels: { level: string; count: number }[];
  services: { service: string; count: number }[];
  environments: { environment: string; count: number }[];
  loggers: { logger_name: string; count: number }[];
  releases: { release: string; count: number }[];
}> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/logs/facets`,
    { params: { period, start, end } }
  );
  return (
    response.data?.data || {
      levels: [],
      services: [],
      environments: [],
      loggers: [],
      releases: [],
    }
  );
}

export async function getLogVolume(
  projectId: number | string,
  params?: {
    period?: string;
    level?: string;
    start?: string;
    end?: string;
    search?: string;
  }
): Promise<{ bucket: string; level: string; count: number }[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/logs/volume`,
    { params }
  );
  return response.data?.data || [];
}

export async function getLogAggregate(
  projectId: number | string,
  params: {
    period?: string;
    start?: string;
    end?: string;
    groupBy?: string;
    search?: string;
    service?: string;
    environment?: string;
  }
): Promise<{
  groupBy: string;
  topValues: { group_value: string; count: number }[];
  timeSeries: { bucket: string; group_value: string; count: number }[];
}> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/logs/aggregate`,
    { params }
  );
  return (
    response.data?.data || { groupBy: 'level', topValues: [], timeSeries: [] }
  );
}

export async function getLogPatterns(
  projectId: number | string,
  params: {
    period?: string;
    start?: string;
    end?: string;
    level?: string;
    service?: string;
    environment?: string;
    search?: string;
    limit?: number;
  }
): Promise<
  {
    pattern: string;
    count: number;
    level: string;
    service: string;
    first_seen: string;
    last_seen: string;
    sample_message: string;
  }[]
> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/logs/patterns`,
    { params }
  );
  return response.data?.data || [];
}

/**
 * Get attribute distribution for a specific log pattern.
 * Returns top values per attribute (service, environment, host, etc.)
 */
export async function getPatternAttributes(
  projectId: number | string,
  params: {
    pattern: string;
    period?: string;
    start?: string;
    end?: string;
    attributes?: string;
    level?: string;
    service?: string;
  }
): Promise<Record<string, { value: string; count: number }[]>> {
  try {
    const response = await argusApi.get(
      `${ARGUS_BASE}/${projectId}/logs/pattern-attributes`,
      { params }
    );
    return response.data?.data || {};
  } catch {
    return {};
  }
}

export async function getAttributeFacet(
  projectId: number | string,
  key: string,
  params?: { period?: string; start?: string; end?: string }
): Promise<{ attr_value: string; count: number }[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/logs/attribute-facet`,
    {
      params: { key, ...params },
    }
  );
  return response.data?.data || [];
}

/**
 * Discover all attribute keys and their top values within a time period.
 * Returns data filtered only by time period — no search conditions.
 */
export async function getAttributeKeys(
  projectId: number | string,
  params?: { period?: string; start?: string; end?: string; limit?: number }
): Promise<
  {
    key: string;
    count: number;
    values: { attr_value: string; count: string }[];
  }[]
> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/logs/attribute-keys`,
    { params }
  );
  return response.data?.data || [];
}

export function createLiveTailConnection(
  projectId: number | string,
  params: {
    level?: string;
    service?: string;
    environment?: string;
    search?: string;
  },
  onData: (logs: ArgusLogEntry[]) => void,
  onError?: (error: Event) => void
): EventSource {
  const searchParams = new URLSearchParams();
  if (params.level) searchParams.set('level', params.level);
  if (params.service) searchParams.set('service', params.service);
  if (params.environment) searchParams.set('environment', params.environment);
  if (params.search) searchParams.set('search', params.search);

  const url = `${ARGUS_BASE}/${projectId}/logs/live-tail?${searchParams.toString()}`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const logs = JSON.parse(event.data) as ArgusLogEntry[];
      onData(logs);
    } catch {
      /* ignore parse errors */
    }
  };

  if (onError) {
    eventSource.onerror = onError;
  }

  return eventSource;
}

// --- Source Maps ---

export async function listSourcemapReleases(
  projectId: number | string
): Promise<ArgusSourcemapRelease[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/sourcemaps`
  );
  return response.data?.data || response.data || [];
}

export async function uploadSourcemaps(
  projectId: number | string,
  release: string,
  files: File[],
  dist?: string
): Promise<{ release_id: number; file_count: number }> {
  const formData = new FormData();
  formData.append('release', release);
  if (dist) formData.append('dist', dist);
  files.forEach((f) => formData.append('files', f));
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/sourcemaps`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return response.data?.data || response.data;
}

export async function deleteSourcemapRelease(
  projectId: number | string,
  releaseId: number
): Promise<void> {
  await argusApi.delete(`${ARGUS_BASE}/${projectId}/sourcemaps/${releaseId}`);
}

export async function listSourcemapFiles(
  projectId: number | string,
  releaseId: number
): Promise<ArgusSourcemapFile[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/${projectId}/sourcemaps/${releaseId}/files`
  );
  return response.data?.data || response.data || [];
}
