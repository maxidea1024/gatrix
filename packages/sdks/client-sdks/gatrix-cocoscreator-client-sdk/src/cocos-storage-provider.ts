/**
 * CocosStorageProvider - Persistent storage using CocosCreator's sys.localStorage
 *
 * Works with both CocosCreator 2.x (`cc.sys.localStorage`) and 3.x (`sys.localStorage`).
 * Falls back to in-memory storage if localStorage is not available (e.g. during tests).
 *
 * Data is JSON-serialized before saving, matching the behavior of the JS SDK's
 * LocalStorageProvider.
 */
import { type StorageProvider } from './storage-provider';

const STORAGE_PREFIX = 'gatrix:';

/**
 * Attempt to resolve the localStorage API from CocosCreator globals.
 * Supports both 2.x (`cc.sys.localStorage`) and 3.x (`sys` imported from 'cc').
 */
function resolveLocalStorage(): Storage | null {
  try {
    // CocosCreator 3.x: `sys` is available on the `cc` global
    // CocosCreator 2.x: `cc.sys.localStorage` is available
    if (typeof cc !== 'undefined' && cc.sys && cc.sys.localStorage) {
      return cc.sys.localStorage as unknown as Storage;
    }
  } catch {
    // Ignore
  }

  // Fallback: standard browser localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // Ignore (e.g. in some sandboxed environments)
  }

  return null;
}

export class CocosStorageProvider implements StorageProvider {
  private prefix: string;
  private storage: Storage | null;
  private fallback: Map<string, any> = new Map();

  constructor(prefix?: string) {
    this.prefix = prefix ?? STORAGE_PREFIX;
    this.storage = resolveLocalStorage();
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<any> {
    const fullKey = this.getKey(key);

    if (this.storage) {
      try {
        const value = this.storage.getItem(fullKey);
        if (value === null || value === undefined) {
          return undefined;
        }
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    }

    // Fallback to in-memory
    return this.fallback.get(fullKey);
  }

  async save(key: string, value: any): Promise<void> {
    const fullKey = this.getKey(key);

    if (this.storage) {
      try {
        this.storage.setItem(fullKey, JSON.stringify(value));
      } catch {
        // Ignore storage errors (quota exceeded, etc.)
      }
      return;
    }

    // Fallback to in-memory
    this.fallback.set(fullKey, value);
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getKey(key);

    if (this.storage) {
      try {
        this.storage.removeItem(fullKey);
      } catch {
        // Ignore
      }
      return;
    }

    this.fallback.delete(fullKey);
  }
}
