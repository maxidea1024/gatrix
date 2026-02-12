import * as fs from 'fs';
import * as path from 'path';
import { CacheStore, CacheEntry, RawFlagReference } from '../types';
import { computeFileHash } from '../utils';

// ============================================================
// File hash cache for incremental scanning
// ============================================================

const CACHE_FILE_NAME = '.gatrix-flag-code-refs.cache.json';
const CACHE_VERSION = '1.0.0';

export class ScanCache {
  private store: CacheStore;
  private cacheFilePath: string;
  private dirty = false;

  constructor(root: string) {
    this.cacheFilePath = path.resolve(root, CACHE_FILE_NAME);
    this.store = this.loadCache();
  }

  /**
   * Check if a file has changed since last scan.
   */
  hasChanged(filePath: string, content: string): boolean {
    const hash = computeFileHash(content);
    const existing = this.store.entries[filePath];

    if (!existing) return true;
    return existing.fileHash !== hash;
  }

  /**
   * Get cached references for a file.
   */
  getCached(filePath: string): RawFlagReference[] | null {
    const entry = this.store.entries[filePath];
    if (!entry) return null;
    return entry.references;
  }

  /**
   * Update cache for a file.
   */
  update(filePath: string, content: string, references: RawFlagReference[]): void {
    const hash = computeFileHash(content);
    this.store.entries[filePath] = {
      fileHash: hash,
      lastModified: Date.now(),
      references,
    };
    this.dirty = true;
  }

  /**
   * Save cache to disk.
   */
  save(): void {
    if (!this.dirty) return;

    try {
      const json = JSON.stringify(this.store, null, 2);
      fs.writeFileSync(this.cacheFilePath, json, 'utf-8');
    } catch (err) {
      console.error('[WARN] Failed to save cache:', err);
    }
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.store.entries = {};
    this.dirty = true;
  }

  /**
   * Get cache statistics.
   */
  getStats(): { totalEntries: number; cacheFilePath: string } {
    return {
      totalEntries: Object.keys(this.store.entries).length,
      cacheFilePath: this.cacheFilePath,
    };
  }

  /**
   * Load cache from disk.
   */
  private loadCache(): CacheStore {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const raw = fs.readFileSync(this.cacheFilePath, 'utf-8');
        const parsed = JSON.parse(raw) as CacheStore;

        // Invalidate cache if version mismatch
        if (parsed.version !== CACHE_VERSION) {
          return { version: CACHE_VERSION, entries: {} };
        }

        return parsed;
      }
    } catch {
      // Ignore cache read errors
    }

    return { version: CACHE_VERSION, entries: {} };
  }
}
