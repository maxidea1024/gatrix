/**
 * LocalStorage Provider
 * Uses browser localStorage for persistent storage
 */
import { StorageProvider } from './storage-provider';

const STORAGE_PREFIX = 'gatrix:';

export class LocalStorageProvider implements StorageProvider {
  private prefix: string;

  constructor(prefix?: string) {
    this.prefix = prefix ?? STORAGE_PREFIX;
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<any> {
    try {
      if (typeof localStorage === 'undefined') {
        return undefined;
      }
      const value = localStorage.getItem(this.getKey(key));
      if (value === null) {
        return undefined;
      }
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  async save(key: string, value: any): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }
      localStorage.setItem(this.getKey(key), JSON.stringify(value));
    } catch {
      // Ignore storage errors (quota exceeded, etc.)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }
      localStorage.removeItem(this.getKey(key));
    } catch {
      // Ignore storage errors
    }
  }
}
