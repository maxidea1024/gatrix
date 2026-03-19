/**
 * Storage Service for Backend
 *
 * Thin wrapper around @gatrix/storage that provides a singleton
 * StorageProvider instance with backend-specific logger integration.
 */
import { createStorageProvider } from '@gatrix/storage';
import type { StorageProvider } from '@gatrix/storage';
import { createLogger } from '../../config/logger';

const logger = createLogger('StorageService');

let instance: StorageProvider | null = null;

/**
 * Get or create the singleton StorageProvider instance
 */
export function getStorageProvider(): StorageProvider {
  if (!instance) {
    logger.info(
      `Initializing file storage provider: ${process.env.FILE_STORAGE_PROVIDER || 'local'}`
    );
    instance = createStorageProvider({
      logger: {
        debug: (msg, meta) => logger.debug(msg, meta),
        info: (msg, meta) => logger.info(msg, meta),
        warn: (msg, meta) => logger.warn(msg, meta),
        error: (msg, meta) => logger.error(msg, meta),
      },
    });
  }
  return instance;
}

export type { StorageProvider, StorageFileInfo } from '@gatrix/storage';
