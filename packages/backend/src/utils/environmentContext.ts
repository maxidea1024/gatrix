/**
 * Environment Context Utilities
 *
 * Provides utilities for managing environment context in multi-environment setup.
 * This module helps with:
 * - Filtering queries by environment
 * - Validating environment access
 */

/**
 * Environment filter helper for Knex queries
 * Adds environment filter to a query builder
 */
export function withEnvironmentFilter<T>(query: T, environment: string): T {
  if (!environment) {
    throw new Error('Environment must be explicitly specified for filtering.');
  }
  return (query as any).where('environment', environment);
}

/**
 * Validate environment format
 * - environment: lowercase letters, numbers, underscore, hyphen (1-100 chars)
 */
export function isValidEnvironment(environment: string): boolean {
  if (!environment || typeof environment !== 'string') return false;

  // Validate environment: lowercase, numbers, underscore, hyphen
  if (environment.length < 1 || environment.length > 100) return false;
  const envRegex = /^[a-z0-9_-]+$/;
  return envRegex.test(environment);
}

/**
 * Get environment from request headers or query params
 * Priority: X-Environment header > environment query param > body
 */
export function getEnvironmentFromRequest(req: any): string {
  // Check header first
  const headerEnv = req.headers?.['x-environment'];
  if (headerEnv && isValidEnvironment(headerEnv)) {
    return headerEnv;
  }

  // Check query param
  const queryEnv = req.query?.environment;
  if (queryEnv && isValidEnvironment(queryEnv)) {
    return queryEnv;
  }

  // Check body (for POST/PUT requests)
  const bodyEnv = req.body?.environment;
  if (bodyEnv && isValidEnvironment(bodyEnv)) {
    return bodyEnv;
  }

  throw new Error('Environment not found in request. Environment must be explicitly specified.');
}

/**
 * Validate that an environment exists
 */
export async function validateEnvironment(db: any, environment: string): Promise<boolean> {
  if (!isValidEnvironment(environment)) {
    return false;
  }
  const result = await db('g_environments')
    .where('environment', environment)
    .first();
  return !!result;
}

/**
 * Get all available environments
 */
export async function getAllEnvironments(db: any): Promise<string[]> {
  const environments = await db('g_environments')
    .select('environment')
    .orderBy('displayOrder', 'asc');
  return environments.map((e: any) => e.environment);
}

/**
 * Check if user has access to a specific environment
 */
export async function hasEnvironmentAccess(
  _db: any,
  _userId: number,
  _environment: string
): Promise<boolean> {
  // TODO: Implement environment access control based on user roles and token permissions
  return true;
}

// Deprecated/Removed functions (to be removed after fixing call sites)
export const getCurrentEnvironment = () => { throw new Error('getCurrentEnvironment is removed. Pass environment explicitly.'); };
export const getCurrentEnvironmentId = getCurrentEnvironment;
export const getDefaultEnvironment = () => { throw new Error('getDefaultEnvironment is removed.'); };
export const getDefaultEnvironmentId = getDefaultEnvironment;
export const setDefaultEnvironment = () => { throw new Error('setDefaultEnvironment is removed.'); };
export const setDefaultEnvironmentId = setDefaultEnvironment;
export const getEnvironmentIdFromRequest = getEnvironmentFromRequest;
export const isValidEnvironmentId = isValidEnvironment;
export const isValidUlid = isValidEnvironment;

