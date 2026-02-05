/**
 * Type definitions for Gatrix Client SDK
 */
import { StorageProvider } from './storage-provider';
import { Logger } from './Logger';

/**
 * Evaluation context (global for client-side)
 */
export interface GatrixContext {
  userId?: string;
  sessionId?: string;
  deviceId?: string;
  currentTime?: string;
  properties?: Record<string, string | number | boolean>;
}

/**
 * Variant information from server evaluation
 */
export interface Variant {
  name: string;
  enabled: boolean;
  payload?: string | number | boolean | object;
}

/**
 * Variant type enum
 */
export type VariantType = 'none' | 'string' | 'number' | 'json';

/**
 * Evaluated flag from Edge API
 */
export interface EvaluatedFlag {
  name: string;
  enabled: boolean;
  variant: Variant;
  variantType: VariantType;
  version: number;
  reason?: string;
  impressionData?: boolean;
}

/**
 * API response containing evaluated flags (from Edge or backend)
 */
export interface FlagsApiResponse {
  success: boolean;
  data: {
    flags: EvaluatedFlag[];
  };
  meta: {
    environment: string;
    evaluatedAt: string;
  };
}

/**
 * Impression event data
 */
export interface ImpressionEvent {
  eventType: 'isEnabled' | 'getVariant' | 'notFound';
  eventId: string;
  context: GatrixContext;
  enabled: boolean;
  featureName: string;
  impressionData: boolean;
  variantName?: string;
  reason?: string;
}

/**
 * Features configuration (feature flag specific settings)
 */
export interface FeaturesConfig {
  /** Seconds between polls (default: 30) */
  refreshInterval?: number;

  /** Disable automatic polling */
  disableRefresh?: boolean;

  /** Enable explicit sync mode */
  explicitSyncMode?: boolean;

  /** Initial flags for instant availability */
  bootstrap?: EvaluatedFlag[];

  /** Override stored flags with bootstrap (default: true) */
  bootstrapOverride?: boolean;

  /** Disable metrics collection */
  disableMetrics?: boolean;

  /** Track impressions for all flags */
  impressionDataAll?: boolean;

  /** Cache TTL in seconds (default: 0 = no expiration) */
  cacheTtlSeconds?: number;
}

/**
 * SDK Configuration
 */
export interface GatrixClientConfig {
  // ==================== Required ====================

  /** Edge API URL */
  url: string;

  /** Client API key */
  apiKey: string;

  /** Application name */
  appName: string;

  // ==================== Common Settings ====================

  /** Environment name */
  environment?: string;

  /** Initial context */
  context?: GatrixContext;

  /** Custom storage provider */
  storageProvider?: StorageProvider;

  /** Custom HTTP headers */
  customHeaders?: Record<string, string>;

  /** Authorization header name (default: 'Authorization') */
  headerName?: string;

  /** Custom fetch implementation */
  fetch?: typeof fetch;

  /** Custom logger implementation */
  logger?: Logger;

  // ==================== Feature-specific Settings ====================

  /** Feature flags configuration */
  features?: FeaturesConfig;
}

/**
 * Variation result with details (value + reason)
 */
export interface VariationResult<T> {
  value: T;
  reason: string;
  flagExists: boolean;
  enabled: boolean;
}

/**
 * Error event payload
 */
export interface ErrorEvent {
  type: string;
  error?: Error | unknown;
  code?: number;
}

/**
 * SDK internal state
 */
export type SdkState = 'initializing' | 'healthy' | 'error';
