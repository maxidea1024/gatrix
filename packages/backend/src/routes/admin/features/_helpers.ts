/**
 * Shared helpers for feature flag admin routes
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { RequestContext } from '../../../services/FeatureFlagService';

/**
 * Validate environment is set in request
 */
export const requireEnvironment = (req: AuthenticatedRequest, res: Response): string | null => {
  const environmentId = req.environmentId;
  if (!environmentId) {
    res.status(400).json({
      success: false,
      error: 'Environment is required (x-environment-id header)',
    });
    return null;
  }
  return environmentId;
};

/**
 * Extract request context for audit logs
 */
export const getRequestContext = (req: AuthenticatedRequest): RequestContext => ({
  ipAddress: req.ip,
  userAgent: req.get('User-Agent'),
});

/**
 * Get fallback value based on valueType when value is undefined/null
 */
export function getFallbackValue(value: any, valueType?: string): any {
  if (value === undefined || value === null) {
    switch (valueType) {
      case 'boolean':
        return false;
      case 'number':
        return 0;
      case 'json':
        return {};
      case 'string':
      default:
        return '';
    }
  }

  // Coerce to match declared valueType (defense-in-depth)
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
