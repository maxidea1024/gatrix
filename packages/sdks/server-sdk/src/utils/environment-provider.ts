/**
 * Environment Provider Interface
 *
 * Abstracts how the SDK gets the list of environments to cache data for.
 * Each environment is identified by its environmentId, with an associated token for API auth.
 *
 * DESIGN PRINCIPLE:
 * - Token is ONLY used for API authentication (resolving environmentId)
 * - Token must NEVER be used as a cache key (Environment:Token = 1:N)
 * - environmentId is the sole cache key
 *
 * - Game servers: Use SingleEnvironmentProvider (default) — one token, one environment.
 * - Edge servers: Implement IEnvironmentProvider externally — multiple environments.
 */

/**
 * Represents an environment with its associated API token.
 */
export interface EnvironmentEntry {
  /** Environment ID — used as cache key */
  environmentId: string;
  /** API token for this environment — used for API authentication only */
  token: string;
}

/**
 * Interface for providing environments to the SDK.
 * Each entry maps an environmentId to its API token.
 */
export interface IEnvironmentProvider {
  /**
   * Get the list of environments the SDK should cache data for.
   */
  getEnvironmentTokens(): EnvironmentEntry[];

  /**
   * Optional: Register a callback for environment list changes.
   * Used by Edge servers when environments are added/removed.
   * Returns an unsubscribe function.
   */
  onEnvironmentsChanged?(
    callback: (added: EnvironmentEntry[], removed: EnvironmentEntry[]) => void
  ): () => void;

  /**
   * Optional: Update the environmentId after resolving from /ready endpoint.
   * Used by SingleEnvironmentProvider to replace the token placeholder with the real environmentId.
   */
  updateEnvironmentId?(environmentId: string): void;
}

/**
 * Default provider for single-environment mode (game servers).
 * Initially uses the configured apiToken as environmentId placeholder.
 * The environmentId is resolved to the real value from /ready endpoint via updateEnvironmentId().
 */
export class SingleEnvironmentProvider implements IEnvironmentProvider {
  private readonly token: string;
  private resolvedEnvironmentId: string | null = null;

  constructor(token: string) {
    this.token = token;
  }

  getEnvironmentTokens(): EnvironmentEntry[] {
    const environmentId = this.resolvedEnvironmentId || this.token;
    return [{ environmentId, token: this.token }];
  }

  /**
   * Update the environmentId after resolving from /ready endpoint.
   * Replaces the token placeholder with the real environmentId.
   */
  updateEnvironmentId(environmentId: string): void {
    this.resolvedEnvironmentId = environmentId;
  }
}

// Legacy aliases for backward compatibility
export type ITokenProvider = IEnvironmentProvider;
export const SingleTokenProvider = SingleEnvironmentProvider;
