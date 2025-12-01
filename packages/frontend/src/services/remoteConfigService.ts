import api from './api';

export interface DeploymentHistoryItem {
  id: string;
  version: number;
  environmentId: number;
  deployedBy: {
    name: string;
    email: string;
  };
  deployedAt: string;
  status: 'success' | 'failed' | 'in_progress';
  message: string;
  changes: DeploymentChange[];
  rollbackAvailable: boolean;
}

export interface DeploymentChange {
  type: 'parameter' | 'campaign' | 'segment' | 'context_field' | 'variant';
  action: 'created' | 'updated' | 'deleted';
  itemName: string;
  oldValue?: any;
  newValue?: any;
}

export interface DeploymentHistoryResponse {
  deployments: DeploymentHistoryItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RollbackRequest {
  deploymentId: string;
  description?: string;
}

export interface DeployRequest {
  templateId?: number;
  environmentId?: number;
  changeDescription?: string;
  changes?: any[];
}

class RemoteConfigService {
  /**
   * Get deployment history from template versions
   */
  async getDeploymentHistory(page: number = 1, limit: number = 25): Promise<DeploymentHistoryResponse> {
    try {
      // Get template versions from the updated API
      const response = await api.get('/admin/remote-config/versions', {
        params: { page, limit }
      });

      // Transform template version data to deployment history format
      const deployments = response.data.versions.map((version: any) => ({
        id: version.id.toString(),
        version: version.version,
        environmentId: 1, // Default environment for now
        deployedBy: {
          name: version.createdByName || 'Unknown User',
          email: version.createdByEmail || 'unknown@example.com'
        },
        deployedAt: version.createdAt,
        status: version.status === 'published' ? 'success' as const : 'in_progress' as const,
        message: version.changeDescription || `Template version ${version.version}`,
        changes: this.parseTemplateData(version.templateData),
        rollbackAvailable: version.status === 'published' // Can rollback published versions
      }));

      return {
        deployments,
        totalCount: response.data.total || deployments.length,
        page: response.data.page || page,
        limit: response.data.limit || limit,
        totalPages: response.data.totalPages || Math.ceil((response.data.total || deployments.length) / limit)
      };
    } catch (error) {
      console.error('Failed to fetch deployment history from template versions:', error);
      throw error;
    }
  }

  /**
   * Parse template data to deployment changes
   */
  private parseTemplateData(templateData: any): DeploymentChange[] {
    try {
      if (!templateData) return [];

      const changes: DeploymentChange[] = [];

      // Handle different template data structures
      if (typeof templateData === 'string') {
        templateData = JSON.parse(templateData);
      }

      // Parse parameters
      if (templateData.parameters) {
        Object.entries(templateData.parameters).forEach(([key, param]: [string, any]) => {
          changes.push({
            type: 'parameter',
            action: 'updated',
            itemName: key,
            newValue: param.defaultValue || param.value
          });
        });
      }

      // Parse campaigns
      if (templateData.campaigns) {
        Object.entries(templateData.campaigns).forEach(([key, campaign]: [string, any]) => {
          changes.push({
            type: 'campaign',
            action: 'updated',
            itemName: key,
            newValue: campaign
          });
        });
      }

      // Parse segments
      if (templateData.segments) {
        Object.entries(templateData.segments).forEach(([key, segment]: [string, any]) => {
          changes.push({
            type: 'segment',
            action: 'updated',
            itemName: key,
            newValue: segment
          });
        });
      }

      // Parse context fields
      if (templateData.contextFields) {
        Object.entries(templateData.contextFields).forEach(([key, field]: [string, any]) => {
          changes.push({
            type: 'context_field',
            action: 'updated',
            itemName: key,
            newValue: field
          });
        });
      }

      // Parse variants
      if (templateData.variants) {
        Object.entries(templateData.variants).forEach(([key, variant]: [string, any]) => {
          changes.push({
            type: 'variant',
            action: 'updated',
            itemName: key,
            newValue: variant
          });
        });
      }

      return changes;
    } catch (error) {
      console.error('Failed to parse template data:', error);
      return [];
    }
  }

  /**
   * Parse configs snapshot to deployment changes (fallback)
   */
  private parseConfigsSnapshot(configsSnapshot: string): DeploymentChange[] {
    try {
      if (!configsSnapshot) return [];

      const configs = JSON.parse(configsSnapshot);
      const changes: DeploymentChange[] = [];

      Object.entries(configs).forEach(([keyName, config]: [string, any]) => {
        changes.push({
          type: 'parameter',
          action: 'updated',
          itemName: keyName,
          newValue: config.value
        });
      });

      return changes;
    } catch (error) {
      console.error('Failed to parse configs snapshot:', error);
      return [];
    }
  }

  /**
   * Get version history
   */
  async getVersionHistory(page: number = 1, limit: number = 25) {
    try {
      const response = await api.get('/admin/remote-config/versions', {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch version history:', error);
      throw error;
    }
  }

  /**
   * Rollback to a specific deployment
   */
  async rollbackToDeployment(request: RollbackRequest): Promise<void> {
    try {
      await api.post('/admin/remote-config/rollback', request);
    } catch (error) {
      console.error('Failed to rollback deployment:', error);
      throw error;
    }
  }

  /**
   * Get current template data
   */
  async getTemplate(): Promise<any> {
    try {
      const response = await api.get('/admin/remote-config/template');

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get template');
      }

      return response.data.templateData;
    } catch (error) {
      console.error('Error getting template:', error);
      throw error;
    }
  }

  /**
   * Update template data directly (for real-time changes)
   */
  async updateTemplate(templateData: any): Promise<void> {
    try {
      const response = await api.put('/admin/remote-config/template', {
        templateData
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update template');
      }
    } catch (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  }

  /**
   * Add a new parameter
   */
  async addParameter(key: string, type: string, defaultValue: any, description?: string): Promise<any> {
    try {
      const response = await api.post('/admin/remote-config/parameter', {
        key,
        type,
        defaultValue,
        description
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to add parameter');
      }

      return response.data.parameter;
    } catch (error) {
      console.error('Error adding parameter:', error);
      throw error;
    }
  }

  /**
   * Update an existing parameter
   */
  async updateParameter(key: string, type: string, defaultValue: any, description?: string): Promise<any> {
    try {
      const response = await api.put(`/admin/remote-config/parameter/${key}`, {
        type,
        defaultValue,
        description
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update parameter');
      }

      return response.data.parameter;
    } catch (error) {
      console.error('Error updating parameter:', error);
      throw error;
    }
  }

  /**
   * Delete a parameter
   */
  async deleteParameter(key: string): Promise<void> {
    try {
      const response = await api.delete(`/admin/remote-config/parameter/${key}`);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete parameter');
      }
    } catch (error) {
      console.error('Error deleting parameter:', error);
      throw error;
    }
  }

  // ==================== Campaigns ====================

  /**
   * Get all campaigns from template
   */
  async getCampaigns(): Promise<any[]> {
    try {
      const templateData = await this.getTemplate();
      return Object.values(templateData.campaigns || {});
    } catch (error) {
      console.error('Error getting campaigns:', error);
      return [];
    }
  }

  /**
   * Add a new campaign
   */
  async addCampaign(campaign: any): Promise<any> {
    try {
      const templateData = await this.getTemplate();
      const campaigns = templateData.campaigns || {};

      const id = `campaign_${Date.now()}`;
      campaigns[id] = {
        ...campaign,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.updateTemplate({ ...templateData, campaigns });
      return campaigns[id];
    } catch (error) {
      console.error('Error adding campaign:', error);
      throw error;
    }
  }

  /**
   * Update an existing campaign
   */
  async updateCampaign(id: string, campaign: any): Promise<any> {
    try {
      const templateData = await this.getTemplate();
      const campaigns = templateData.campaigns || {};

      if (!campaigns[id]) {
        throw new Error('Campaign not found');
      }

      campaigns[id] = {
        ...campaigns[id],
        ...campaign,
        updatedAt: new Date().toISOString()
      };

      await this.updateTemplate({ ...templateData, campaigns });
      return campaigns[id];
    } catch (error) {
      console.error('Error updating campaign:', error);
      throw error;
    }
  }

  /**
   * Delete a campaign
   */
  async deleteCampaign(id: string): Promise<void> {
    try {
      const templateData = await this.getTemplate();
      const campaigns = templateData.campaigns || {};

      delete campaigns[id];
      await this.updateTemplate({ ...templateData, campaigns });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      throw error;
    }
  }

  // ==================== Context Fields ====================

  /**
   * Get all context fields from template
   */
  async getContextFields(): Promise<any[]> {
    try {
      const templateData = await this.getTemplate();
      return Object.values(templateData.contextFields || {});
    } catch (error) {
      console.error('Error getting context fields:', error);
      return [];
    }
  }

  /**
   * Add a new context field
   */
  async addContextField(field: any): Promise<any> {
    try {
      const templateData = await this.getTemplate();
      const contextFields = templateData.contextFields || {};

      const id = `field_${Date.now()}`;
      contextFields[id] = {
        ...field,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.updateTemplate({ ...templateData, contextFields });
      return contextFields[id];
    } catch (error) {
      console.error('Error adding context field:', error);
      throw error;
    }
  }

  /**
   * Update an existing context field
   */
  async updateContextField(id: string, field: any): Promise<any> {
    try {
      const templateData = await this.getTemplate();
      const contextFields = templateData.contextFields || {};

      if (!contextFields[id]) {
        throw new Error('Context field not found');
      }

      contextFields[id] = {
        ...contextFields[id],
        ...field,
        updatedAt: new Date().toISOString()
      };

      await this.updateTemplate({ ...templateData, contextFields });
      return contextFields[id];
    } catch (error) {
      console.error('Error updating context field:', error);
      throw error;
    }
  }

  /**
   * Delete a context field
   */
  async deleteContextField(id: string): Promise<void> {
    try {
      const templateData = await this.getTemplate();
      const contextFields = templateData.contextFields || {};

      delete contextFields[id];
      await this.updateTemplate({ ...templateData, contextFields });
    } catch (error) {
      console.error('Error deleting context field:', error);
      throw error;
    }
  }

  // ==================== Segments ====================

  /**
   * Get all segments from template
   */
  async getSegments(): Promise<any[]> {
    try {
      const templateData = await this.getTemplate();
      return Object.values(templateData.segments || {});
    } catch (error) {
      console.error('Error getting segments:', error);
      return [];
    }
  }

  /**
   * Add a new segment
   */
  async addSegment(segment: any): Promise<any> {
    try {
      const templateData = await this.getTemplate();
      const segments = templateData.segments || {};

      const id = `segment_${Date.now()}`;
      segments[id] = {
        ...segment,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.updateTemplate({ ...templateData, segments });
      return segments[id];
    } catch (error) {
      console.error('Error adding segment:', error);
      throw error;
    }
  }

  /**
   * Update an existing segment
   */
  async updateSegment(id: string, segment: any): Promise<any> {
    try {
      const templateData = await this.getTemplate();
      const segments = templateData.segments || {};

      if (!segments[id]) {
        throw new Error('Segment not found');
      }

      segments[id] = {
        ...segments[id],
        ...segment,
        updatedAt: new Date().toISOString()
      };

      await this.updateTemplate({ ...templateData, segments });
      return segments[id];
    } catch (error) {
      console.error('Error updating segment:', error);
      throw error;
    }
  }

  /**
   * Delete a segment
   */
  async deleteSegment(id: string): Promise<void> {
    try {
      const templateData = await this.getTemplate();
      const segments = templateData.segments || {};

      delete segments[id];
      await this.updateTemplate({ ...templateData, segments });
    } catch (error) {
      console.error('Error deleting segment:', error);
      throw error;
    }
  }

  // ==================== Variants ====================

  /**
   * Get all variants from template
   */
  async getVariants(): Promise<any[]> {
    try {
      const templateData = await this.getTemplate();
      return Object.values(templateData.variants || {});
    } catch (error) {
      console.error('Error getting variants:', error);
      return [];
    }
  }

  /**
   * Add a new variant
   */
  async addVariant(variant: any): Promise<any> {
    try {
      const templateData = await this.getTemplate();
      const variants = templateData.variants || {};

      const id = `variant_${Date.now()}`;
      variants[id] = {
        ...variant,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.updateTemplate({ ...templateData, variants });
      return variants[id];
    } catch (error) {
      console.error('Error adding variant:', error);
      throw error;
    }
  }

  /**
   * Update an existing variant
   */
  async updateVariant(id: string, variant: any): Promise<any> {
    try {
      const templateData = await this.getTemplate();
      const variants = templateData.variants || {};

      if (!variants[id]) {
        throw new Error('Variant not found');
      }

      variants[id] = {
        ...variants[id],
        ...variant,
        updatedAt: new Date().toISOString()
      };

      await this.updateTemplate({ ...templateData, variants });
      return variants[id];
    } catch (error) {
      console.error('Error updating variant:', error);
      throw error;
    }
  }

  /**
   * Delete a variant
   */
  async deleteVariant(id: string): Promise<void> {
    try {
      const templateData = await this.getTemplate();
      const variants = templateData.variants || {};

      delete variants[id];
      await this.updateTemplate({ ...templateData, variants });
    } catch (error) {
      console.error('Error deleting variant:', error);
      throw error;
    }
  }

  /**
   * Deploy changes (create new template version)
   */
  async deployChanges(request: DeployRequest): Promise<void> {
    try {
      // Skip staging and go directly to publish
      // The backend will handle including all current configs in the template version
      await api.post('/admin/remote-config/publish', {
        deploymentName: `Deployment ${new Date().toISOString()}`,
        description: request.changeDescription || 'Deploy pending changes'
      });
    } catch (error) {
      console.error('Failed to deploy changes:', error);
      throw error;
    }
  }

  /**
   * Get deployment details
   */
  async getDeploymentDetails(deploymentId: string) {
    try {
      const response = await api.get(`/admin/remote-config/deployments/${deploymentId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch deployment details:', error);
      throw error;
    }
  }
}

export default new RemoteConfigService();
