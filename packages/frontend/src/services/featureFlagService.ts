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

export interface ValidationRules {
  enabled?: boolean;
  // Common
  isRequired?: boolean;
  description?: string;

  // String type
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternDescription?: string;
  legalValues?: string[];
  trimWhitespace?: 'none' | 'trim' | 'trimStart' | 'trimEnd' | 'reject';

  // Number type
  min?: number;
  max?: number;
  integerOnly?: boolean;

  // JSON type
  jsonSchema?: string;
}

// Per-environment settings
export interface FeatureFlagEnvironment {
  id: string;
  flagId: string;
  environmentId: string;
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
  stale?: boolean;
  tags?: string[];
  valueType: 'string' | 'number' | 'boolean' | 'json';
  enabledValue: any;
  disabledValue: any;
  validationRules?: ValidationRules;
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
  codeReferenceCount?: number;
  potentiallyStale?: boolean;
  createdByName?: string;
  createdByEmail?: string;
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
  tags?: string[];
  validationRules?: ValidationRules;
}

export interface UpdateFeatureFlagInput {
  displayName?: string;
  description?: string;
  isEnabled?: boolean;
  valueType?: 'string' | 'number' | 'boolean' | 'json';
  enabledValue?: any;
  disabledValue?: any;
  impressionDataEnabled?: boolean;
  tags?: string[];
  validationRules?: ValidationRules;
}

// ==================== Service ====================

/** Build features base path from project-scoped path or fallback */
function basePath(projectApiPath: string | null): string {
  return projectApiPath ? `${projectApiPath}/features` : '/admin/features';
}

/**
 * Get all feature flags
 */
export async function getFeatureFlags(
  params: FeatureFlagListParams = {},
  projectApiPath: string | null = null
): Promise<FeatureFlagListResponse> {
  const response = await api.get(basePath(projectApiPath), { params });
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
export async function getFeatureFlag(
  flagName: string,
  projectApiPath: string | null = null
): Promise<FeatureFlag> {
  const response = await api.get(`${basePath(projectApiPath)}/${flagName}`);
  return response.data.flag;
}

/**
 * Create a new feature flag
 */
export async function createFeatureFlag(
  data: CreateFeatureFlagInput,
  projectApiPath: string | null = null
): Promise<FeatureFlag> {
  const response = await api.post(basePath(projectApiPath), data);
  return response.data.flag;
}

/**
 * Update a feature flag
 */
export async function updateFeatureFlag(
  flagName: string,
  data: UpdateFeatureFlagInput,
  projectApiPath: string | null = null
): Promise<FeatureFlag> {
  const response = await api.put(
    `${basePath(projectApiPath)}/${flagName}`,
    data
  );
  return response.data.flag;
}

/**
 * Toggle a feature flag for a specific environment
 */
export async function toggleFeatureFlag(
  flagName: string,
  isEnabled: boolean,
  environmentId?: string,
  projectApiPath: string | null = null
): Promise<FeatureFlag> {
  const response = await api.post(
    `${basePath(projectApiPath)}/${flagName}/toggle`,
    {
      isEnabled,
      environmentId,
    }
  );
  return response.data.flag;
}

/**
 * Archive a feature flag
 */
export async function archiveFeatureFlag(
  flagName: string,
  projectApiPath: string | null = null
): Promise<FeatureFlag> {
  const response = await api.post(
    `${basePath(projectApiPath)}/${flagName}/archive`
  );
  return response.data.flag;
}

/**
 * Revive an archived feature flag
 */
export async function reviveFeatureFlag(
  flagName: string,
  projectApiPath: string | null = null
): Promise<FeatureFlag> {
  const response = await api.post(
    `${basePath(projectApiPath)}/${flagName}/revive`
  );
  return response.data.flag;
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(
  flagName: string,
  isFavorite: boolean,
  projectApiPath: string | null = null
): Promise<FeatureFlag> {
  const response = await api.post(
    `${basePath(projectApiPath)}/${flagName}/favorite`,
    {
      isFavorite,
    }
  );
  return response.data.flag;
}

/**
 * Delete a feature flag
 */
export async function deleteFeatureFlag(
  flagName: string,
  projectApiPath: string | null = null
): Promise<void> {
  await api.delete(`${basePath(projectApiPath)}/${flagName}`);
}

/**
 * Update all strategies for a flag (bulk replace) in a specific environment
 */
export async function updateStrategies(
  flagName: string,
  environmentId: string,
  strategies: any[],
  projectApiPath: string | null = null
): Promise<any[]> {
  const response = await api.put(
    `${basePath(projectApiPath)}/${flagName}/strategies`,
    { strategies },
    { headers: { 'x-environment-id': environmentId } }
  );
  return response.data.strategies;
}

/**
 * Update variants for a flag (bulk replace) in a specific environment
 */
export async function updateVariants(
  flagName: string,
  environmentId: string,
  variants: any[],
  projectApiPath: string | null = null
): Promise<any[]> {
  const response = await api.put(
    `${basePath(projectApiPath)}/${flagName}/variants`,
    { variants },
    { headers: { 'x-environment-id': environmentId } }
  );
  return response.data.variants;
}

/**
 * Update flag values (enabledValue/disabledValue) for a specific environment
 */
export async function updateFlagValues(
  flagName: string,
  environmentId: string,
  values: {
    enabledValue?: any;
    disabledValue?: any;
    overrideEnabledValue?: boolean;
    overrideDisabledValue?: boolean;
  },
  projectApiPath: string | null = null
): Promise<FeatureFlag> {
  const response = await api.put(
    `${basePath(projectApiPath)}/${flagName}`,
    values,
    { headers: { 'x-environment-id': environmentId } }
  );
  return response.data.flag;
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
  updateStrategies,
  updateVariants,
  updateFlagValues,
};

export default featureFlagService;
