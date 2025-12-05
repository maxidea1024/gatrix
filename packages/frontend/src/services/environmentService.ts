import api from './api';

export interface Environment {
  id: string;
  environmentName: string;
  displayName: string;
  environmentType: 'development' | 'staging' | 'production';
  description?: string;
  isSystemDefined: boolean;
  displayOrder: number;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnvironmentData {
  environmentName: string;
  displayName: string;
  description?: string;
  environmentType: 'development' | 'staging' | 'production';
  color?: string;
  displayOrder?: number;
  baseEnvironmentId?: string; // If provided, copy data from this environment
}

export interface UpdateEnvironmentData {
  displayName?: string;
  description?: string;
  environmentType?: 'development' | 'staging' | 'production';
  color?: string;
  displayOrder?: number;
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
    id: string;
    name: string;
    environmentName: string;
  };
  target: {
    id: string;
    name: string;
    environmentName: string;
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
  total: number;
}

export interface EnvironmentRelatedData {
  environment: {
    id: string;
    environmentName: string;
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
  async getEnvironments(): Promise<Environment[]> {
    try {
      const response = await api.get('/admin/environments');
      return response.data || [];
    } catch (error) {
      console.error('Error fetching environments:', error);
      throw error;
    }
  }

  /**
   * Get environment by ID
   */
  async getEnvironment(id: string): Promise<Environment> {
    try {
      const response = await api.get(`/admin/environments/${id}`);
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
   */
  async updateEnvironment(id: string, data: UpdateEnvironmentData): Promise<Environment> {
    try {
      const response = await api.put(`/admin/environments/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating environment:', error);
      throw error;
    }
  }

  /**
   * Get copy preview between two environments
   */
  async getCopyPreview(sourceId: string, targetId: string): Promise<CopyPreview> {
    try {
      const response = await api.get(`/admin/environments/${sourceId}/copy/${targetId}/preview`);
      return response.data;
    } catch (error) {
      console.error('Error fetching copy preview:', error);
      throw error;
    }
  }

  /**
   * Copy data from one environment to another
   */
  async copyEnvironmentData(sourceId: string, targetId: string, options: CopyOptions): Promise<CopyResult> {
    try {
      const response = await api.post(`/admin/environments/${sourceId}/copy/${targetId}`, options);
      return response.data;
    } catch (error) {
      console.error('Error copying environment data:', error);
      throw error;
    }
  }

  /**
   * Get related data counts for an environment (for delete confirmation)
   */
  async getRelatedData(id: string): Promise<EnvironmentRelatedData> {
    try {
      const response = await api.get(`/admin/environments/${id}/related-data`);
      return response.data;
    } catch (error) {
      console.error('Error fetching related data:', error);
      throw error;
    }
  }

  /**
   * Delete an environment
   * @param id Environment ID
   * @param force If true, delete all related data as well
   */
  async deleteEnvironment(id: string, force: boolean = false): Promise<void> {
    try {
      await api.delete(`/admin/environments/${id}`, { data: { force } });
    } catch (error) {
      console.error('Error deleting environment:', error);
      throw error;
    }
  }
}

export const environmentService = new EnvironmentService();
export default environmentService;

