import { apiService } from './api';

export interface UnknownFlag {
  id: number;
  flagName: string;
  environmentId: string;
  environmentName: string | null;
  projectName: string | null;
  orgName: string | null;
  appName: string | null;
  sdkVersion: string | null;
  accessCount: number;
  firstReportedAt: string;
  lastReportedAt: string;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

/** Build unknown-flags base path from project-scoped path or fallback */
function basePath(projectApiPath: string | null): string {
  return projectApiPath
    ? `${projectApiPath}/unknown-flags`
    : '/admin/unknown-flags';
}

export const unknownFlagService = {
  async getUnknownFlags(
    options?: {
      includeResolved?: boolean;
      environmentId?: string;
    },
    projectApiPath: string | null = null
  ): Promise<{ flags: UnknownFlag[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.includeResolved) {
      params.append('includeResolved', 'true');
    }
    if (options?.environmentId) {
      params.append('environmentId', options.environmentId);
    }
    const queryString = params.toString();
    const base = basePath(projectApiPath);
    const url = `${base}${queryString ? `?${queryString}` : ''}`;
    const response = await apiService.get<any>(url);
    return response.data;
  },

  async getUnresolvedCount(
    projectApiPath: string | null = null
  ): Promise<number> {
    const response = await apiService.get<any>(
      `${basePath(projectApiPath)}/count`
    );
    return response.data?.count || 0;
  },

  async resolveUnknownFlag(
    id: number,
    projectApiPath: string | null = null
  ): Promise<void> {
    await apiService.post(`${basePath(projectApiPath)}/${id}/resolve`);
  },

  async unresolveUnknownFlag(
    id: number,
    projectApiPath: string | null = null
  ): Promise<void> {
    await apiService.post(`${basePath(projectApiPath)}/${id}/unresolve`);
  },

  async deleteUnknownFlag(
    id: number,
    projectApiPath: string | null = null
  ): Promise<void> {
    await apiService.delete(`${basePath(projectApiPath)}/${id}`);
  },
};
