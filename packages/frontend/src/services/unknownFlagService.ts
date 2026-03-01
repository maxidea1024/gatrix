import { apiService } from './api';

export interface UnknownFlag {
  id: number;
  flagName: string;
  environmentId: string;
  appName: string | null;
  sdkVersion: string | null;
  accessCount: number;
  firstReportedAt: string;
  lastReportedAt: string;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export const unknownFlagService = {
  async getUnknownFlags(options?: {
    includeResolved?: boolean;
    environmentId?: string;
  }): Promise<{ flags: UnknownFlag[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.includeResolved) {
      params.append('includeResolved', 'true');
    }
    if (options?.environmentId) {
      params.append('environment', options.environmentId);
    }
    const queryString = params.toString();
    const url = `/admin/unknown-flags${queryString ? `?${queryString}` : ''}`;
    const response = await apiService.get<any>(url);
    return response.data;
  },

  async getUnresolvedCount(): Promise<number> {
    const response = await apiService.get<any>('/admin/unknown-flags/count');
    return response.data?.count || 0;
  },

  async resolveUnknownFlag(id: number): Promise<void> {
    await apiService.post(`/admin/unknown-flags/${id}/resolve`);
  },

  async unresolveUnknownFlag(id: number): Promise<void> {
    await apiService.post(`/admin/unknown-flags/${id}/unresolve`);
  },

  async deleteUnknownFlag(id: number): Promise<void> {
    await apiService.delete(`/admin/unknown-flags/${id}`);
  },
};
