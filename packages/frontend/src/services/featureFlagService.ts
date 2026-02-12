import api from './api';

// ==================== Types ====================

export type FlagType =
  | 'release'
  | 'experiment'
  | 'operational'
  | 'killSwitch'
  | 'permission'
  | 'remoteConfig'; // Purpose
export type FlagStatus = 'enabled' | 'disabled' | 'archived';

// Per-environment settings
export interface FeatureFlagEnvironment {
  id: string;
  flagId: string;
  environment: string;
  isEnabled: boolean;
  lastSeenAt?: string;
}

export interface FeatureFlag {
  id: string;
  flagName: string;
  displayName?: string;
  description?: string;
  flagType: FlagType; // Purpose: release, experiment, operational, killSwitch, permission, remoteConfig
  isArchived: boolean;
  isFavorite?: boolean;
  impressionDataEnabled: boolean;
  staleAfterDays?: number;
  stale?: boolean;
  tags?: string[];
  valueType: 'string' | 'number' | 'boolean' | 'json';
  enabledValue: any;
  disabledValue: any;
  archivedAt?: string;
  createdBy?: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt?: string;
  // Per-environment settings
  environments?: FeatureFlagEnvironment[];
  // Legacy: for backward compatibility (current env's value)
  isEnabled?: boolean;
  lastSeenAt?: string;
}

export interface FeatureFlagListParams {
  page?: number;
  limit?: number;
  search?: string;
  flagType?: FlagType;

  isEnabled?: boolean;
  isArchived?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FeatureFlagListResponse {
  flags: FeatureFlag[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateFeatureFlagInput {
  flagName: string;
  displayName?: string;
  description?: string;
  flagType?: FlagType;

  valueType: 'string' | 'number' | 'boolean' | 'json';
  enabledValue: any;
  disabledValue: any;
  isEnabled?: boolean;
  impressionDataEnabled?: boolean;
  staleAfterDays?: number;
  tags?: string[];
}

export interface UpdateFeatureFlagInput {
  displayName?: string;
  description?: string;
  isEnabled?: boolean;
  valueType?: 'string' | 'number' | 'boolean' | 'json';
  enabledValue?: any;
  disabledValue?: any;
  impressionDataEnabled?: boolean;
  staleAfterDays?: number;
  tags?: string[];
}

// ==================== Service ====================

/**
 * Get all feature flags
 */
export async function getFeatureFlags(
  params: FeatureFlagListParams = {}
): Promise<FeatureFlagListResponse> {
  const response = await api.get('/admin/features', { params });
  // Backend returns { data: [...], total: N }, map to { flags: [...], total: N }
  const result = response.data;
  return {
    flags: result.data || [],
    total: result.total || 0,
    page: params.page || 1,
    limit: params.limit || 50,
  };
}

/**
 * Get a specific feature flag
 */
export async function getFeatureFlag(flagName: string): Promise<FeatureFlag> {
  const response = await api.get(`/admin/features/${flagName}`);
  return response.data.flag;
}

/**
 * Create a new feature flag
 */
export async function createFeatureFlag(data: CreateFeatureFlagInput): Promise<FeatureFlag> {
  const response = await api.post('/admin/features', data);
  return response.data.flag;
}

/**
 * Update a feature flag
 */
export async function updateFeatureFlag(
  flagName: string,
  data: UpdateFeatureFlagInput
): Promise<FeatureFlag> {
  const response = await api.put(`/admin/features/${flagName}`, data);
  return response.data.flag;
}

/**
 * Toggle a feature flag for a specific environment
 */
export async function toggleFeatureFlag(
  flagName: string,
  isEnabled: boolean,
  environment?: string
): Promise<FeatureFlag> {
  const response = await api.post(`/admin/features/${flagName}/toggle`, {
    isEnabled,
    environment,
  });
  return response.data.flag;
}

/**
 * Archive a feature flag
 */
export async function archiveFeatureFlag(flagName: string): Promise<FeatureFlag> {
  const response = await api.post(`/admin/features/${flagName}/archive`);
  return response.data.flag;
}

/**
 * Revive an archived feature flag
 */
export async function reviveFeatureFlag(flagName: string): Promise<FeatureFlag> {
  const response = await api.post(`/admin/features/${flagName}/revive`);
  return response.data.flag;
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(flagName: string, isFavorite: boolean): Promise<FeatureFlag> {
  const response = await api.post(`/admin/features/${flagName}/favorite`, {
    isFavorite,
  });
  return response.data.flag;
}

/**
 * Delete a feature flag
 */
export async function deleteFeatureFlag(flagName: string): Promise<void> {
  await api.delete(`/admin/features/${flagName}`);
}

const featureFlagService = {
  getFeatureFlags,
  getFeatureFlag,
  createFeatureFlag,
  updateFeatureFlag,
  toggleFeatureFlag,
  archiveFeatureFlag,
  reviveFeatureFlag,
  toggleFavorite,
  deleteFeatureFlag,
};

export default featureFlagService;
