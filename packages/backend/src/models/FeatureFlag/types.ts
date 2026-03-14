import db from '../../config/knex';
import { createLogger } from '../../config/logger';

const logger = createLogger('types');
import { ulid } from 'ulid';
import { parseJsonField } from '../../utils/db-utils';

// Re-export shared types for backward compatibility
// All consumers that import from this file still work unchanged
export type {
  ValueType,
  ConstraintOperator,
  StrategyParameters,
  Constraint,
} from '@gatrix/evaluator';

import type {
  Constraint,
  StrategyParameters,
  ValueType,
} from '@gatrix/evaluator';

// ==================== Backend-only Types ====================

export type FlagType =
  | 'release'
  | 'experiment'
  | 'operational'
  | 'killSwitch'
  | 'permission'
  | 'remoteConfig'; // Purpose

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
export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'semver'
  | 'array'
  | 'country'
  | 'countryCode3'
  | 'languageCode'
  | 'localeCode'
  | 'timezone';

// ==================== Interfaces ====================

// Feature Flag - Now GLOBAL (no environment column)
export interface FeatureFlagAttributes {
  id: string;
  projectId: string;
  flagName: string;
  displayName?: string;
  description?: string;
  flagType: FlagType; // Purpose: release, experiment, operational, killSwitch, permission, remoteConfig
  isArchived: boolean;
  isFavorite?: boolean;
  archivedAt?: Date;
  impressionDataEnabled: boolean;
  stale?: boolean;
  tags?: string[];
  links?: { url: string; title?: string }[];
  valueType: ValueType;
  enabledValue: any; // Value when flag evaluates to true
  disabledValue: any; // Value when flag evaluates to false
  useFixedWeightVariants: boolean; // Whether variants use fixed weight ratios
  validationRules?: ValidationRules; // Type-specific validation rules
  createdBy: string;
  createdByName?: string; // Joined from g_users
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  version?: number;
  codeReferenceCount?: number;
  // Environment-specific fields (joined from g_feature_flag_environments)
  lastSeenAt?: Date;
  // Relations - loaded per environment when needed
  environments?: FeatureFlagEnvironmentAttributes[];
  strategies?: FeatureStrategyAttributes[];
  variants?: FeatureVariantAttributes[];
}

// NEW: Per-environment flag settings
export interface FeatureFlagEnvironmentAttributes {
  id: string;
  flagId: string;
  environmentId: string;
  isEnabled: boolean;
  overrideEnabledValue?: boolean;
  overrideDisabledValue?: boolean;
  enabledValue?: any; // Environment-specific enabled value override
  disabledValue?: any; // Environment-specific disabled value override
  lastSeenAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  version?: number;
}

// Draft data snapshot for staged changes
export interface FeatureFlagDraftData {
  // Environment-level value overrides
  overrideEnabledValue?: boolean;
  overrideDisabledValue?: boolean;
  enabledValue?: any;
  disabledValue?: any;
  // Strategies snapshot
  strategies?: Array<{
    id?: string;
    strategyName: string;
    title?: string;
    parameters?: StrategyParameters;
    constraints?: Constraint[];
    segments?: string[];
    sortOrder: number;
    isEnabled: boolean;
  }>;
  // Variants snapshot
  variants?: Array<{
    id?: string;
    variantName: string;
    weight: number;
    value?: any;
    valueType: ValueType;
  }>;
}

// Strategy - now includes environment
export interface FeatureStrategyAttributes {
  id: string;
  flagId: string;
  environmentId: string;
  strategyName: string;
  /** Optional user-facing display name */
  title?: string;
  parameters?: StrategyParameters;
  constraints?: Constraint[];
  sortOrder: number;
  isEnabled: boolean;
  createdBy: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  // Relations - segment names returned from enrichStrategiesWithSegments
  segments?: string[];
}

// Variant - now includes environment
export interface FeatureVariantAttributes {
  id: string;
  flagId: string;
  environmentId: string;
  variantName: string;
  weight: number;
  value?: any;
  valueType: ValueType;
  createdBy: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Segment - Project scoped
export interface FeatureSegmentAttributes {
  id: string;
  projectId: string;
  segmentName: string;
  displayName?: string;
  description?: string;
  constraints: Constraint[];
  isActive: boolean;
  tags?: string[];
  createdBy: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FeatureContextFieldAttributes {
  id: string;
  projectId: string;
  fieldName: string;
  displayName?: string;
  fieldType: FieldType;
  description?: string;
  validationRules?: ValidationRules;
  tags?: string[];
  stickiness: boolean;
  isDefaultStickinessField?: boolean;
  isEnabled?: boolean;
  sortOrder: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FeatureMetricsAttributes {
  id: string;
  environmentId: string;
  flagName: string;
  metricsBucket: Date;
  yesCount: number;
  noCount: number;
  variantCounts?: Record<string, number>;
  createdAt?: Date;
}

// ==================== Helper Functions ====================

/**
 * Coerce a value to match the declared valueType.
 * Used on the WRITE path to ensure stored values have the correct type,
 * and on the READ path as defense-in-depth.
 */
export function coerceValueByType(
  value: any,
  valueType: string | undefined
): any {
  if (value === null || value === undefined) return value;
  switch (valueType) {
    case 'string':
      return typeof value === 'string' ? value : String(value);
    case 'number': {
      if (typeof value === 'number') return value;
      const num = Number(value);
      return Number.isNaN(num) ? 0 : num;
    }
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === 1) return true;
      if (value === 'false' || value === 0) return false;
      return Boolean(value);
    case 'json':
      if (typeof value === 'object') return value;
      try {
        return JSON.parse(String(value));
      } catch {
        return {};
      }
    default:
      return value;
  }
}
