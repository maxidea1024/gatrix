/**
 * In-Memory Storage Provider
 * Uses a simple Map for non-persistent storage
 */
import { StorageProvider } from './storage-provider';

export class InMemoryStorageProvider implements StorageProvider {
  private store: Map<string, any> = new Map();

  async get(key: string): Promise<any> {
    return this.store.get(key);
  }

  async save(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
