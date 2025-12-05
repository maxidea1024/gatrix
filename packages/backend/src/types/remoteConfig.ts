/**
 * Remote Config System Type Definitions
 * Firebase Remote Config-like functionality types
 */

// Base types
export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json' | 'yaml';
export type ConfigVersionStatus = 'draft' | 'staged' | 'published' | 'archived';
export type ContextFieldType = 'string' | 'number' | 'boolean' | 'array';

// Main Remote Config
export interface RemoteConfig {
  id: number;
  keyName: string;
  defaultValue?: string;
  valueType: ConfigValueType;
  description?: string;
  isActive: boolean;
  status?: ConfigVersionStatus; // Status from latest version
  createdBy?: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;

  // Relations
  createdByName?: string;
  createdByEmail?: string;
  updatedByName?: string;
  updatedByEmail?: string;
  currentVersion?: ConfigVersion;
  versions?: ConfigVersion[];
  rules?: ConfigRule[];
  variants?: ConfigVariant[];
}

export interface CreateRemoteConfigData {
  keyName: string;
  defaultValue?: string;
  valueType: ConfigValueType;
  description?: string;
  isActive?: boolean;
  createdBy?: number;
}

export interface UpdateRemoteConfigData {
  keyName?: string;
  defaultValue?: string;
  valueType?: ConfigValueType;
  description?: string;
  isActive?: boolean;
  updatedBy?: number;
}

// Config Versions (Git-like)
export interface ConfigVersion {
  id: number;
  configId: number;
  versionNumber: number;
  value?: string;
  status: ConfigVersionStatus;
  changeDescription?: string;
  publishedAt?: string;
  createdBy?: number;
  createdAt: string;
  
  // Relations
  createdByName?: string;
  config?: RemoteConfig;
}

export interface CreateConfigVersionData {
  configId: number;
  value?: string;
  status?: ConfigVersionStatus;
  changeDescription?: string;
  createdBy?: number;
}

// Context Fields
export interface ContextField {
  id: number;
  fieldName: string;
  fieldType: ContextFieldType;
  description?: string;
  isRequired: boolean;
  defaultValue?: string;
  validationRules?: any;
  createdBy?: number;
  createdAt: string;
  
  // Relations
  createdByName?: string;
}

export interface CreateContextFieldData {
  fieldName: string;
  fieldType: ContextFieldType;
  description?: string;
  isRequired?: boolean;
  defaultValue?: string;
  validationRules?: any;
  createdBy?: number;
}

export interface UpdateContextFieldData {
  fieldName?: string;
  fieldType?: ContextFieldType;
  description?: string;
  isRequired?: boolean;
  defaultValue?: string;
  validationRules?: any;
  updatedBy?: number;
}

// Config Rules (now used as Segments)
export interface ConfigRule {
  id: number;
  configId?: number; // Optional for backward compatibility
  ruleName: string;
  conditions: any; // JSON conditions
  value?: string;
  priority: number;
  isActive: boolean;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;

  // Relations
  createdByName?: string;
  config?: RemoteConfig;
}

export interface CreateConfigRuleData {
  configId?: number; // Optional for segments
  ruleName: string;
  conditions: any;
  value?: string;
  priority?: number;
  isActive?: boolean;
  createdBy?: number;
}

// Config Variants (A/B Testing - Pure traffic split, no conditions)
export interface ConfigVariant {
  id: number;
  configId: number;
  variantName: string;
  value?: string;
  trafficPercentage: number;
  isActive: boolean;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;

  // Relations
  createdByName?: string;
  config?: RemoteConfig;
}

export interface CreateConfigVariantData {
  configId: number;
  variantName: string;
  value?: string;
  trafficPercentage?: number;
  isActive?: boolean;
  createdBy?: number;
}

// Campaigns
export interface Campaign {
  id: number;
  campaignName: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  targetConditions?: any;
  trafficPercentage: number;
  priority: number;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused';
  isActive: boolean;
  createdBy?: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;

  // Relations
  createdByName?: string;
  updatedByName?: string;
  configs?: CampaignConfig[];
}

export interface CreateCampaignData {
  campaignName: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  targetConditions?: any;
  trafficPercentage?: number;
  priority?: number;
  status?: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused';
  isActive?: boolean;
  createdBy?: number;
  updatedBy?: number;
}

// Campaign-Config Association
export interface CampaignConfig {
  id: number;
  campaignId: number;
  configId: number;
  campaignValue?: string;
  createdAt: string;

  // Relations
  campaign?: Campaign;
  config?: RemoteConfig;
  configKeyName?: string;
  configValueType?: string;
}

export interface CreateCampaignConfigData {
  campaignId: number;
  configId: number;
  campaignValue?: string;
}

// Deployments
export interface Deployment {
  id: number;
  deploymentName?: string;
  description?: string;
  configsSnapshot?: any; // JSON snapshot
  deployedBy?: number;
  deployedAt: string;
  rollbackDeploymentId?: number;
  
  // Relations
  deployedByName?: string;
  rollbackDeployment?: Deployment;
}

export interface CreateDeploymentData {
  deploymentName?: string;
  description?: string;
  configsSnapshot?: any;
  deployedBy?: number;
  rollbackDeploymentId?: number;
}

// Evaluation Context (for client requests)
export interface EvaluationContext {
  userId?: string;
  userSegment?: string;
  appVersion?: string;
  platform?: string;
  country?: string;
  language?: string;
  deviceType?: string;
  customFields?: Record<string, any>;
}

// Evaluation Result
export interface EvaluationResult {
  [configKey: string]: {
    value: any;
    source: 'default' | 'rule' | 'variant' | 'campaign';
    ruleId?: number;
    variantId?: number;
    campaignId?: number;
    appliedAt: string;
  };
}

// API Response Types
export interface RemoteConfigListResponse {
  configs: RemoteConfig[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RemoteConfigFilters {
  environmentId?: string;
  search?: string;
  valueType?: ConfigValueType;
  isActive?: boolean;
  createdBy?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Publishing (staging system removed)

export interface PublishRequest {
  stagedConfigIds: number[];
  deploymentName?: string;
  description?: string;
}

export interface RollbackRequest {
  deploymentId: number;
  description?: string;
}
