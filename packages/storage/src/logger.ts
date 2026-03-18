/**
 * Storage Logger Interface
 *
 * Simple logger abstraction so consuming packages (backend, edge)
 * can inject their own logger implementation.
 */
export interface StorageLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Default console-based logger
 */
export const defaultLogger: StorageLogger = {
  debug: (msg, meta) => console.debug(`[storage] ${msg}`, meta || ''),
  info: (msg, meta) => console.info(`[storage] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[storage] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[storage] ${msg}`, meta || ''),
};
