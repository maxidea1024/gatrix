/**
 * Logger interface for Gatrix SDK
 * Users can provide their own logger implementation
 */

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Default console logger implementation
 */
export class ConsoleLogger implements Logger {
  private prefix: string;

  constructor(prefix: string = 'GatrixClient') {
    this.prefix = prefix;
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`[${this.prefix}] ${message}`, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(`[${this.prefix}] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.prefix}] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.prefix}] ${message}`, ...args);
  }
}

/**
 * No-op logger that discards all messages
 */
export class NoOpLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}
