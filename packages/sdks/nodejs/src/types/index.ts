/**
 * Remote Config SDK Types
 */

export interface RemoteConfigOptions {
  apiUrl: string;
  apiToken: string;
  environment: string;
  pollingInterval?: number; // in milliseconds, default 30000 (30 seconds)
  timeout?: number; // in milliseconds, default 5000 (5 seconds)
  retryAttempts?: number; // default 3
  enableCache?: boolean; // default true
  cacheTimeout?: number; // in milliseconds, default 300000 (5 minutes)
}

export interface UserContext {
  userId?: string;
  email?: string;
  platform?: string;
  appVersion?: string;
  deviceType?: string;
  language?: string;
  customAttributes?: Record<string, any>;
}

export interface ConfigValue {
  type: 'string' | 'number' | 'boolean' | 'json';
  value: any;
  defaultValue?: any;
}

export interface ConfigItem {
  key: string;
  value: ConfigValue;
  conditions?: TargetingCondition[];
  variants?: ConfigVariant[];
}

export interface ConfigVariant {
  name: string;
  value: ConfigValue;
  weight: number; // percentage 0-100
  conditions?: TargetingCondition[];
}

export interface TargetingCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'regex';
  value: any;
}

export interface RemoteConfigTemplate {
  id: number;
  templateName: string;
  templateType: 'client' | 'server';
  status: 'draft' | 'staged' | 'published' | 'archived';
  environmentId: number;
  templateData: {
    configs: Record<string, ConfigItem>;
    segments?: Record<string, TargetingCondition[]>;
    metadata?: Record<string, any>;
  };
  version: number;
  etag: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationResult {
  key: string;
  value: any;
  variant?: string;
  reason: 'default' | 'config' | 'variant' | 'targeting' | 'error';
  error?: string;
}

export interface MetricsData {
  configKey: string;
  value: any;
  variant?: string;
  userContext: UserContext;
  timestamp: number;
  evaluationTime: number; // in milliseconds
}

export interface CacheEntry {
  data: any;
  etag: string;
  timestamp: number;
  expiresAt: number;
}

export interface SDKError extends Error {
  code: string;
  statusCode?: number;
  details?: any;
}
