import api from './api';

export interface ContextFieldUsageRecord {
  id: string;
  projectId: string;
  environmentId: string;
  environmentName?: string;
  fieldName: string;
  appName: string | null;
  sdkVersion: string | null;
  accessCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  description: string | null;
  tags: string[];
  isIgnored: boolean;
}

export interface ContextFieldUsageQueryParams {
  search?: string;
  environmentId?: string;
  appName?: string;
  includeIgnored?: boolean;
}

class ContextFieldUsageService {
  private basePath(projectApiPath: string): string {
    return `${projectApiPath}/features/context-field-usage`;
  }

  /**
   * Get discovered context fields
   */
  async getDiscoveredFields(
    projectApiPath: string,
    params: ContextFieldUsageQueryParams = {}
  ): Promise<ContextFieldUsageRecord[]> {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.set('search', params.search);
    if (params.environmentId)
      queryParams.set('environmentId', params.environmentId);
    if (params.appName) queryParams.set('appName', params.appName);
    if (params.includeIgnored)
      queryParams.set('includeIgnored', 'true');

    const qs = queryParams.toString();
    const url = `${this.basePath(projectApiPath)}${qs ? `?${qs}` : ''}`;
    const response = await api.get(url);
    return response.data?.fields || [];
  }

  /**
   * Get distinct app names for filtering
   */
  async getAppNames(projectApiPath: string): Promise<string[]> {
    const response = await api.get(
      `${this.basePath(projectApiPath)}/app-names`
    );
    return response.data?.appNames || [];
  }

  /**
   * Get distinct environment IDs for filtering
   */
  async getEnvironmentIds(projectApiPath: string): Promise<string[]> {
    const response = await api.get(
      `${this.basePath(projectApiPath)}/environments`
    );
    return response.data?.environmentIds || [];
  }

  /**
   * Update field metadata (description, tags, isIgnored)
   */
  async updateFieldMeta(
    projectApiPath: string,
    id: string,
    data: {
      description?: string;
      tags?: string[];
      isIgnored?: boolean;
    }
  ): Promise<void> {
    await api.put(`${this.basePath(projectApiPath)}/${id}`, data);
  }

  /**
   * Delete a discovered field record
   */
  async deleteField(projectApiPath: string, id: string): Promise<void> {
    await api.delete(`${this.basePath(projectApiPath)}/${id}`);
  }

  /**
   * Get inferred type for a discovered field
   */
  async inferType(
    projectApiPath: string,
    id: string
  ): Promise<{ fieldName: string; inferredType: string }> {
    const response = await api.get(
      `${this.basePath(projectApiPath)}/${id}/infer-type`
    );
    return response.data;
  }
}

export const contextFieldUsageService = new ContextFieldUsageService();
