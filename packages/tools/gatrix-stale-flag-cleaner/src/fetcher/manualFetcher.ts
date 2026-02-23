import * as fs from 'fs';
import { StaleFlagInfo, ManualFlagEntry } from '../types';

// ============================================================
// Manual fetcher - loads stale flags from a local JSON file
// ============================================================

/**
 * Load stale flags from a JSON file.
 * Accepts both the full StaleFlagInfo format and the minimal ManualFlagEntry format
 * Accepts both the full StaleFlagInfo format and the minimal ManualFlagEntry format.
 */
export function loadFlagsFromFile(filePath: string): StaleFlagInfo[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  let raw: unknown;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    raw = JSON.parse(content);
  } catch {
    throw new Error(`Failed to parse JSON from ${filePath}`);
  }

  if (!Array.isArray(raw)) {
    throw new Error(`Expected a JSON array in ${filePath}`);
  }

  return raw.map((entry: unknown, index: number) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Invalid entry at index ${index}: expected an object`);
    }

    const e = entry as ManualFlagEntry;
    if (typeof e.key !== 'string' || !e.key) {
      throw new Error(`Missing or invalid "key" at index ${index}`);
    }
    if (e.keepBranch !== 'enabled' && e.keepBranch !== 'disabled') {
      throw new Error(`Invalid "keepBranch" at index ${index}: must be "enabled" or "disabled"`);
    }

    return {
      key: e.key,
      reason: e.reason ?? 'manually specified',
      keepBranch: e.keepBranch,
      staleReason: 'inactive' as const,
      lastModified: e.lastModified ?? 'unknown',
      metadata: e.metadata ?? {},
    } satisfies StaleFlagInfo;
  });
}
