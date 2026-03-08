/**
 * Token Provider Interface
 *
 * Abstracts how the SDK gets the list of API tokens to cache data for.
 * Each token maps to exactly one environment (1:1).
 *
 * - Game servers: Use SingleTokenProvider (default) — one token, one environment.
 * - Edge servers: Implement ITokenProvider externally — multiple tokens, multiple environments.
 */

/**
 * Interface for providing API tokens to the SDK.
 * Each token represents one environment.
 */
export interface ITokenProvider {
  /**
   * Get the list of API tokens the SDK should cache data for.
   * Each token maps to exactly one environment.
   */
  getTokens(): string[];

  /**
   * Optional: Register a callback for token list changes.
   * Used by Edge servers when environments are added/removed.
   * Returns an unsubscribe function.
   */
  onTokensChanged?(
    callback: (added: string[], removed: string[]) => void
  ): () => void;
}

/**
 * Default provider for single-token mode (game servers).
 * Simply wraps the configured apiToken.
 */
export class SingleTokenProvider implements ITokenProvider {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  getTokens(): string[] {
    return [this.token];
  }
}
