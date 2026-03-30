/**
 * Version Map Service
 * Maintains an in-memory map of projectId + clientVersion -> targetEnv
 * for O(1) environment resolution with project tokens.
 */

import { createLogger } from '../config/logger';

const logger = createLogger('VersionMapService');

interface VersionEntry {
  targetEnv: string;
  platform?: string;
}

/**
 * In-memory version map for fast environment resolution.
 * Key format: "{projectId}:{clientVersion}" or "{projectId}:{platform}:{clientVersion}"
 */
export class VersionMapService {
  // Map: "projectId:clientVersion" -> targetEnv (platform-agnostic)
  private versionMap = new Map<string, string>();
  // Map: "projectId:platform:clientVersion" -> targetEnv (platform-specific)
  private platformVersionMap = new Map<string, string>();

  /**
   * Resolve environment for a given project + version + optional platform.
   * Platform-specific match takes priority over generic match.
   */
  resolveEnvironment(
    projectId: string,
    clientVersion: string,
    platform?: string
  ): string | null {
    // Try platform-specific match first
    if (platform) {
      const platformKey = `${projectId}:${platform}:${clientVersion}`;
      const platformResult = this.platformVersionMap.get(platformKey);
      if (platformResult) return platformResult;
    }

    // Fall back to generic (platform-agnostic) match
    const genericKey = `${projectId}:${clientVersion}`;
    return this.versionMap.get(genericKey) || null;
  }

  /**
   * Load version map data from backend sync response.
   * Called periodically by the data sync service.
   */
  loadVersionMap(
    entries: Array<{
      projectId: string;
      clientVersion: string;
      platform?: string;
      targetEnv: string;
    }>
  ): void {
    const newVersionMap = new Map<string, string>();
    const newPlatformVersionMap = new Map<string, string>();

    for (const entry of entries) {
      if (!entry.targetEnv) continue;

      if (entry.platform) {
        const key = `${entry.projectId}:${entry.platform}:${entry.clientVersion}`;
        newPlatformVersionMap.set(key, entry.targetEnv);
      }
      // Always add to generic map (last write wins for same projectId:version)
      const genericKey = `${entry.projectId}:${entry.clientVersion}`;
      newVersionMap.set(genericKey, entry.targetEnv);
    }

    this.versionMap = newVersionMap;
    this.platformVersionMap = newPlatformVersionMap;

    logger.info(
      `Version map loaded: ${newVersionMap.size} generic + ${newPlatformVersionMap.size} platform-specific entries`
    );
  }

  /**
   * Clear all version map data
   */
  clear(): void {
    this.versionMap.clear();
    this.platformVersionMap.clear();
  }

  get size(): number {
    return this.versionMap.size + this.platformVersionMap.size;
  }
}

export const versionMapService = new VersionMapService();
