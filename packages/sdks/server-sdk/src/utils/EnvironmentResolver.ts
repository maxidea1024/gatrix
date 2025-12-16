/**
 * EnvironmentResolver
 * Centralized environment resolution logic for SDK services.
 *
 * DESIGN PRINCIPLES:
 * - Single source of truth for environment resolution
 * - In single-environment mode (game servers): uses defaultEnvironment if not provided
 * - In multi-environment mode (edge): environment MUST always be provided
 * - Injected into services to avoid code duplication
 */

export class EnvironmentResolver {
  private readonly defaultEnvironment: string;
  private multiEnvironmentMode: boolean = false;

  constructor(defaultEnvironment: string = 'development') {
    this.defaultEnvironment = defaultEnvironment;
  }

  /**
   * Set multi-environment mode flag
   * When true, all resolve() calls will require explicit environment parameter
   */
  setMultiEnvironmentMode(enabled: boolean): void {
    this.multiEnvironmentMode = enabled;
  }

  /**
   * Check if running in multi-environment mode
   */
  isMultiEnvironmentMode(): boolean {
    return this.multiEnvironmentMode;
  }

  /**
   * Get the default environment
   */
  getDefaultEnvironment(): string {
    return this.defaultEnvironment;
  }

  /**
   * Resolve environment parameter
   * In single-environment mode: uses defaultEnvironment if not provided
   * In multi-environment mode: throws error if not provided
   *
   * @param environment Optional environment parameter
   * @param context Context string for error messages (e.g., "GameWorldService.getCached")
   * @returns Resolved environment name
   * @throws Error if environment is not provided in multi-environment mode
   */
  resolve(environment?: string, context: string = 'method'): string {
    if (environment) {
      return environment;
    }

    if (this.multiEnvironmentMode) {
      throw new Error(
        `${context}(): environment parameter is required in multi-environment mode`
      );
    }

    return this.defaultEnvironment;
  }

  /**
   * Resolve environment parameter without throwing
   * Returns undefined if environment is not provided in multi-environment mode
   * Useful for methods that want to handle the error differently
   *
   * @param environment Optional environment parameter
   * @returns Resolved environment name or undefined
   */
  resolveOrUndefined(environment?: string): string | undefined {
    if (environment) {
      return environment;
    }

    if (this.multiEnvironmentMode) {
      return undefined;
    }

    return this.defaultEnvironment;
  }
}

