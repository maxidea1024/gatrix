/**
 * Storage Provider Interface
 */
export interface StorageProvider {
  get(key: string): Promise<any>;
  save(key: string, value: any): Promise<void>;
  delete?(key: string): Promise<void>;
}
