import api from './api';

export interface Environment {
  environmentId: string; // Primary identifier (environmentId name)
  environmentName: string; // Alias for backward compatibility
  displayName: string;
  environmentType: 'development' | 'staging' | 'production';
  description?: string;
  isSystemDefined: boolean;
  isHidden: boolean;
  isDefault: boolean;
  displayOrder: number;
  color?: string;
  requiresApproval: boolean; // Change Request approval required
  requiredApprovers: number; // Minimum number of approvers for CR
  enableSoftLock?: boolean; // Soft lock for concurrent editing
  enableHardLock?: boolean; // Hard lock warning for pending CRs
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnvironmentData {
  name?: string;
  displayName: string;
  description?: string;
  environmentType: 'development' | 'staging' | 'production';
  color?: string;
  displayOrder?: number;
  baseEnvironment?: string; // If provided, copy data from this environment
  requiresApproval?: boolean; // Change Request approval required
  requiredApprovers?: number; // Minimum number of approvers for CR
}

export interface UpdateEnvironmentData {
  displayName?: string;
  description?: string;
  environmentType?: 'development' | 'staging' | 'production';
  color?: string;
  displayOrder?: number;
  isHidden?: boolean;
  requiresApproval?: boolean; // Change Request approval required
  requiredApprovers?: number; // Minimum number of approvers for CR
  enableSoftLock?: boolean; // Soft lock for concurrent editing
  enableHardLock?: boolean; // Hard lock warning for pending CRs
}

export interface CopyOptions {
  copyTemplates?: boolean;
  copyGameWorlds?: boolean;
  copySegments?: boolean;
  copyBanners?: boolean;
  copyClientVersions?: boolean;
  copyCoupons?: boolean;
  copyIngamePopupNotices?: boolean;
  copyMessageTemplates?: boolean;
  copyRewardTemplates?: boolean;
  copyServiceMaintenance?: boolean;
  copyServiceNotices?: boolean;
  copySurveys?: boolean;
  copyVars?: boolean;
  copyContextFields?: boolean;
  copyCampaigns?: boolean;
  copyAccountWhitelist?: boolean;
  copyIpWhitelist?: boolean;
  copyJobs?: boolean;
  copyPlanningData?: boolean;
  overwriteExisting?: boolean;
}

export interface CopyResultItem {
  copied: number;
  skipped: number;
  errors: string[];
}

export interface CopyResult {
  templates: CopyResultItem;
  gameWorlds: CopyResultItem;
  segments: CopyResultItem;
  banners: CopyResultItem;
  clientVersions: CopyResultItem;
  coupons: CopyResultItem;
  ingamePopupNotices: CopyResultItem;
  messageTemplates: CopyResultItem;
  rewardTemplates: CopyResultItem;
  serviceMaintenance: CopyResultItem;
  serviceNotices: CopyResultItem;
  surveys: CopyResultItem;
  vars: CopyResultItem;
  contextFields: CopyResultItem;
  campaigns: CopyResultItem;
  accountWhitelist: CopyResultItem;
  ipWhitelist: CopyResultItem;
  jobs: CopyResultItem;
  planningData: CopyResultItem;
}

export interface CopyPreviewItem {
  hasConflict: boolean;
  [key: string]: unknown;
}

export interface CopyPreviewSummary {
  total: number;
  conflicts: number;
}

export interface CopyPreview {
  source: {
    environmentId: string;
    name: string;
  };
  target: {
    environmentId: string;
    name: string;
  };
  summary: {
    templates: CopyPreviewSummary;
    gameWorlds: CopyPreviewSummary;
    segments: CopyPreviewSummary;
    banners: CopyPreviewSummary;
    clientVersions: CopyPreviewSummary;
    coupons: CopyPreviewSummary;
    ingamePopupNotices: CopyPreviewSummary;
    messageTemplates: CopyPreviewSummary;
    rewardTemplates: CopyPreviewSummary;
    serviceMaintenance: CopyPreviewSummary;
    serviceNotices: CopyPreviewSummary;
    surveys: CopyPreviewSummary;
    vars: CopyPreviewSummary;
    contextFields: CopyPreviewSummary;
    campaigns: CopyPreviewSummary;
    accountWhitelist: CopyPreviewSummary;
    ipWhitelist: CopyPreviewSummary;
    jobs: CopyPreviewSummary;
    planningData: CopyPreviewSummary;
  };
}

export interface RelatedDataItem {
  id: string;
  name?: string;
  title?: string;
  worldId?: string;
  varKey?: string;
  jobName?: string;
  version?: string;
  platform?: string;
}

export interface RelatedDataCategory {
  count: number;
  items: RelatedDataItem[];
}

export interface RelatedDataDetails {
  templates: RelatedDataCategory;
  gameWorlds: RelatedDataCategory;
  segments: RelatedDataCategory;
  tags: RelatedDataCategory;
  vars: RelatedDataCategory;
  messageTemplates: RelatedDataCategory;
  serviceNotices: RelatedDataCategory;
  ingamePopups: RelatedDataCategory;
  surveys: RelatedDataCategory;
  coupons: RelatedDataCategory;
  banners: RelatedDataCategory;
  jobs: RelatedDataCategory;
  clientVersions: RelatedDataCategory;
  apiTokens: RelatedDataCategory;
  storeProducts: RelatedDataCategory;
  total: number;
}

export interface EnvironmentRelatedData {
  environmentId: {
    environmentId: string;
    displayName: string;
    isSystemDefined: boolean;
    isDefault: boolean;
  };
  relatedData: RelatedDataDetails;
  canDelete: boolean;
  hasData: boolean;
}

/**
 * Build base path for environment API calls.
 * All environment endpoints are project-scoped:
 *   /admin/orgs/:orgId/projects/:projectId/environments
 */
function envBasePath(projectApiPath: string): string {
  return `${projectApiPath}/environments`;
}

/**
 * Map backend response (uses 'id') to frontend Environment (uses 'environmentId').
 * Backend's g_environments table has 'id' as primary key,
 * but the frontend references it as 'environmentId' throughout 20+ files.
 */
function mapEnvironment(raw: any): Environment {
  if (!raw) return raw;
  return {
    ...raw,
    environmentId: raw.environmentId || raw.id,
  };
}

class EnvironmentService {
  /**
   * Get all environments
   */
  async getEnvironments(
    projectApiPath: string,
    includeHidden: boolean = false
  ): Promise<Environment[]> {
    try {
      const response = await api.get(envBasePath(projectApiPath), {
        params: includeHidden ? { includeHidden: 'true' } : undefined,
      });
      return (response.data || []).map(mapEnvironment);
    } catch (error) {
      console.error('Error fetching environments:', error);
      throw error;
    }
  }

  async getEnvironment(
    projectApiPath: string,
    environmentId: string
  ): Promise<Environment> {
    try {
      const response = await api.get(
        `${envBasePath(projectApiPath)}/${environmentId}`
      );
      return mapEnvironment(response.data);
    } catch (error) {
      console.error('Error fetching environment:', error);
      throw error;
    }
  }

  async createEnvironment(
    projectApiPath: string,
    data: CreateEnvironmentData
  ): Promise<Environment> {
    try {
      const response = await api.post(envBasePath(projectApiPath), data);
      return mapEnvironment(response.data);
    } catch (error) {
      console.error('Error creating environment:', error);
      throw error;
    }
  }
  async updateEnvironment(
    projectApiPath: string,
    environmentId: string,
    data: UpdateEnvironmentData
  ): Promise<Environment> {
    try {
      const response = await api.put(
        `${envBasePath(projectApiPath)}/${environmentId}`,
        data
      );
      return mapEnvironment(response.data);
    } catch (error) {
      console.error('Error updating environment:', error);
      throw error;
    }
  }

  async getCopyPreview(
    projectApiPath: string,
    sourceEnvironment: string,
    targetEnvironment: string
  ): Promise<CopyPreview> {
    try {
      const response = await api.get(
        `${envBasePath(projectApiPath)}/${sourceEnvironment}/copy/${targetEnvironment}/preview`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching copy preview:', error);
      throw error;
    }
  }

  async copyEnvironmentData(
    projectApiPath: string,
    sourceEnvironment: string,
    targetEnvironment: string,
    options: CopyOptions
  ): Promise<CopyResult> {
    try {
      const response = await api.post(
        `${envBasePath(projectApiPath)}/${sourceEnvironment}/copy/${targetEnvironment}`,
        options
      );
      return response.data;
    } catch (error) {
      console.error('Error copying environment data:', error);
      throw error;
    }
  }

  async getRelatedData(
    projectApiPath: string,
    environmentId: string
  ): Promise<EnvironmentRelatedData> {
    try {
      const response = await api.get(
        `${envBasePath(projectApiPath)}/${environmentId}/related-data`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching related data:', error);
      throw error;
    }
  }

  async deleteEnvironment(
    projectApiPath: string,
    environmentId: string,
    force: boolean = false
  ): Promise<void> {
    try {
      await api.delete(`${envBasePath(projectApiPath)}/${environmentId}`, {
        data: { force },
      });
    } catch (error) {
      console.error('Error deleting environment:', error);
      throw error;
    }
  }
}

export const environmentService = new EnvironmentService();
export default environmentService;
