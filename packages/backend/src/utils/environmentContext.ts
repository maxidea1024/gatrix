/**
 * Environment Context Utilities
 *
 * Provides utilities for managing environment context in multi-environment setup.
 * This module helps with:
 * - Getting current environment from request context
 * - Filtering queries by environment
 * - Validating environment access
 *
 * Note: Environment IDs are ULID strings (26 characters)
 */

import { AsyncLocalStorage } from 'async_hooks';

// Default environment ID will be fetched from database on first request
// This is a placeholder that should be replaced with actual development environment ID
let cachedDefaultEnvironmentId: string | null = null;

// Environment context storage using AsyncLocalStorage for request-scoped context
const environmentStorage = new AsyncLocalStorage<{ environmentId: string }>();

/**
 * Set the default environment ID (called during application initialization)
 */
export function setDefaultEnvironmentId(envId: string): void {
  cachedDefaultEnvironmentId = envId;
}

/**
 * Get the default environment ID
 * Throws if not initialized
 */
export function getDefaultEnvironmentId(): string {
  if (!cachedDefaultEnvironmentId) {
    throw new Error('Default environment ID not initialized. Call initializeDefaultEnvironment() first.');
  }
  return cachedDefaultEnvironmentId;
}

/**
 * Check if default environment is initialized
 */
export function isDefaultEnvironmentInitialized(): boolean {
  return cachedDefaultEnvironmentId !== null;
}

/**
 * Get the current environment ID from context
 * Falls back to default environment if not set
 */
export function getCurrentEnvironmentId(): string {
  const store = environmentStorage.getStore();
  if (store?.environmentId) {
    return store.environmentId;
  }
  return getDefaultEnvironmentId();
}

/**
 * Run a function with a specific environment context
 */
export function runWithEnvironment<T>(environmentId: string, fn: () => T): T {
  return environmentStorage.run({ environmentId }, fn);
}

/**
 * Run an async function with a specific environment context
 */
export async function runWithEnvironmentAsync<T>(environmentId: string, fn: () => Promise<T>): Promise<T> {
  return environmentStorage.run({ environmentId }, fn);
}

/**
 * Set environment context for the current async context
 * This is typically called by middleware
 */
export function setEnvironmentContext(environmentId: string): void {
  const store = environmentStorage.getStore();
  if (store) {
    store.environmentId = environmentId;
  }
}

/**
 * Environment filter helper for Knex queries
 * Adds environmentId filter to a query builder
 */
export function withEnvironmentFilter<T>(query: T, environmentId?: string): T {
  const envId = environmentId ?? getCurrentEnvironmentId();
  return (query as any).where('environmentId', envId);
}

/**
 * Validate ULID format (26 characters, Crockford Base32)
 */
export function isValidUlid(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (id.length !== 26) return false;
  // Crockford Base32 characters (excluding I, L, O, U)
  const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
  return ulidRegex.test(id);
}

/**
 * Get environment ID from request headers or query params
 * Priority: X-Environment-Id header > environmentId query param > body > default
 */
export function getEnvironmentIdFromRequest(req: any): string {
  // Check header first
  const headerEnvId = req.headers?.['x-environment-id'];
  if (headerEnvId && isValidUlid(headerEnvId)) {
    return headerEnvId;
  }

  // Check query param
  const queryEnvId = req.query?.environmentId;
  if (queryEnvId && isValidUlid(queryEnvId)) {
    return queryEnvId;
  }

  // Check body (for POST/PUT requests)
  const bodyEnvId = req.body?.environmentId;
  if (bodyEnvId && isValidUlid(bodyEnvId)) {
    return bodyEnvId;
  }

  return getDefaultEnvironmentId();
}

/**
 * Validate that an environment ID exists
 */
export async function validateEnvironmentId(db: any, environmentId: string): Promise<boolean> {
  if (!isValidUlid(environmentId)) {
    return false;
  }
  const result = await db('g_remote_config_environments')
    .where('id', environmentId)
    .first();
  return !!result;
}

/**
 * Get all available environment IDs
 */
export async function getAllEnvironmentIds(db: any): Promise<string[]> {
  const environments = await db('g_remote_config_environments')
    .select('id')
    .orderBy('displayOrder', 'asc');
  return environments.map((e: any) => e.id);
}

/**
 * Initialize the default environment ID from database
 * Should be called once during application startup
 */
export async function initializeDefaultEnvironment(db: any): Promise<string> {
  const defaultEnv = await db('g_remote_config_environments')
    .where('isDefault', true)
    .first();

  if (!defaultEnv) {
    throw new Error('No default environment found in database');
  }

  setDefaultEnvironmentId(defaultEnv.id);
  return defaultEnv.id;
}

/**
 * Check if user has access to a specific environment
 * This will be expanded when access token environment restrictions are implemented
 */
export async function hasEnvironmentAccess(
  _db: any,
  _userId: number,
  _environmentId: string
): Promise<boolean> {
  // TODO: Implement environment access control based on user roles and token permissions
  // For now, all authenticated users have access to all environments
  return true;
}

