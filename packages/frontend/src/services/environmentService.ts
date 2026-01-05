import api from './api';

export interface Environment {
  environment: string; // Primary identifier (environment name)
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnvironmentData {
  environment: string; // Environment name (primary key)
  displayName: string;
  description?: string;
  environmentType: 'development' | 'staging' | 'production';
  color?: string;
  displayOrder?: number;
  baseEnvironment?: string; // If provided, copy data from this environment
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
    environment: string;
    name: string;
  };
  target: {
    environment: string;
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
  environment: {
    environment: string;
    displayName: string;
    isSystemDefined: boolean;
    isDefault: boolean;
  };
  relatedData: RelatedDataDetails;
  canDelete: boolean;
  hasData: boolean;
}

class EnvironmentService {
  /**
   * Get all environments
   */
  async getEnvironments(includeHidden: boolean = false): Promise<Environment[]> {
    try {
      const response = await api.get('/admin/environments', {
        params: includeHidden ? { includeHidden: 'true' } : undefined
      });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching environments:', error);
      throw error;
    }
  }

  /**
   * Get environment by name
   * @param environment Environment name (primary key)
   */
  async getEnvironment(environment: string): Promise<Environment> {
    try {
      const response = await api.get(`/admin/environments/${environment}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching environment:', error);
      throw error;
    }
  }

  /**
   * Create new environment
   */
  async createEnvironment(data: CreateEnvironmentData): Promise<Environment> {
    try {
      const response = await api.post('/admin/environments', data);
      return response.data;
    } catch (error) {
      console.error('Error creating environment:', error);
      throw error;
    }
  }

  /**
   * Update an existing environment
   * @param environment Environment name (primary key)
   */
  async updateEnvironment(environment: string, data: UpdateEnvironmentData): Promise<Environment> {
    try {
      const response = await api.put(`/admin/environments/${environment}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating environment:', error);
      throw error;
    }
  }

  /**
   * Get copy preview between two environments
   * @param sourceEnvironment Source environment name
   * @param targetEnvironment Target environment name
   */
  async getCopyPreview(sourceEnvironment: string, targetEnvironment: string): Promise<CopyPreview> {
    try {
      const response = await api.get(`/admin/environments/${sourceEnvironment}/copy/${targetEnvironment}/preview`);
      return response.data;
    } catch (error) {
      console.error('Error fetching copy preview:', error);
      throw error;
    }
  }

  /**
   * Copy data from one environment to another
   * @param sourceEnvironment Source environment name
   * @param targetEnvironment Target environment name
   */
  async copyEnvironmentData(sourceEnvironment: string, targetEnvironment: string, options: CopyOptions): Promise<CopyResult> {
    try {
      const response = await api.post(`/admin/environments/${sourceEnvironment}/copy/${targetEnvironment}`, options);
      return response.data;
    } catch (error) {
      console.error('Error copying environment data:', error);
      throw error;
    }
  }

  /**
   * Get related data counts for an environment (for delete confirmation)
   * @param environment Environment name (primary key)
   */
  async getRelatedData(environment: string): Promise<EnvironmentRelatedData> {
    try {
      const response = await api.get(`/admin/environments/${environment}/related-data`);
      return response.data;
    } catch (error) {
      console.error('Error fetching related data:', error);
      throw error;
    }
  }

  /**
   * Delete an environment
   * @param environment Environment name (primary key)
   * @param force If true, delete all related data as well
   */
  async deleteEnvironment(environment: string, force: boolean = false): Promise<void> {
    try {
      await api.delete(`/admin/environments/${environment}`, { data: { force } });
    } catch (error) {
      console.error('Error deleting environment:', error);
      throw error;
    }
  }
}

export const environmentService = new EnvironmentService();
export default environmentService;
