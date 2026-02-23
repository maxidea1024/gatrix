import { StaleFlagInfo, StaleReason, KeepBranch, GatrixFlagDefinition } from '../types';
import axios from 'axios';

// ============================================================
// Gatrix backend fetcher - retrieves stale flags via the API
// ============================================================

interface GatrixDefinitionsResponse {
  success: boolean;
  data?: {
    flags: Record<string, GatrixFlagDefinition>;
  };
}

/**
 * Fetch all feature flag definitions from the Gatrix backend and
 * return those that are considered stale based on the given criteria.
 */
export async function fetchStaleFlags(
  backendUrl: string,
  apiKey: string,
  staleDays: number,
): Promise<StaleFlagInfo[]> {
  const baseUrl = backendUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/api/v1/server/features/definitions`;

  let definitions: Record<string, GatrixFlagDefinition>;

  try {
    const response = await axios.get<GatrixDefinitionsResponse>(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Application-Name': 'gatrix-dead-flag-cleaner',
      },
      timeout: 30000,
    });

    const result = response.data;
    if (!result.success || !result.data?.flags) {
      throw new Error(`Unexpected response format: ${JSON.stringify(result)}`);
    }

    definitions = result.data.flags;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data;
      throw new Error(`Failed to fetch flag definitions (HTTP ${status}): ${JSON.stringify(data)}`);
    }
    throw new Error(
      `Failed to fetch flag definitions: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const staleFlags: StaleFlagInfo[] = [];
  const now = Date.now();
  const staleCutoffMs = staleDays * 24 * 60 * 60 * 1000;

  for (const [key, def] of Object.entries(definitions)) {
    const { staleReason, keepBranch, reason } = classifyFlag(def, now, staleCutoffMs);
    if (staleReason === null) {
      continue;
    }

    staleFlags.push({
      key,
      reason,
      keepBranch,
      staleReason,
      lastModified: def.updatedAt ?? 'unknown',
      metadata: {},
    });
  }

  return staleFlags;
}

/**
 * Classify a single flag definition as stale or not.
 * Returns null staleReason when the flag is not stale.
 */
function classifyFlag(
  def: GatrixFlagDefinition,
  now: number,
  staleCutoffMs: number,
): { staleReason: StaleReason | null; keepBranch: KeepBranch; reason: string } {
  // Archived flags - always stale, keep disabled path
  if (def.archived) {
    return {
      staleReason: 'archived',
      keepBranch: 'disabled',
      reason: 'Flag is archived',
    };
  }

  // Check staleness by last-modified date
  const isStaleByAge =
    def.updatedAt != null && now - new Date(def.updatedAt).getTime() > staleCutoffMs;

  if (!isStaleByAge) {
    return { staleReason: null, keepBranch: 'enabled', reason: '' };
  }

  // Determine rollout state from environments
  const envData = def.environments ? Object.values(def.environments) : [];

  const allDisabled =
    envData.length > 0 && envData.every((e) => !e.enabled || e.rolloutPercentage === 0);
  const allEnabled =
    envData.length > 0 &&
    envData.every((e) => e.enabled && (e.rolloutPercentage == null || e.rolloutPercentage === 100));

  const staleAgeDays = Math.round(staleCutoffMs / (24 * 60 * 60 * 1000));

  if (allDisabled) {
    return {
      staleReason: 'fully-disabled',
      keepBranch: 'disabled',
      reason: `Fully disabled for more than ${staleAgeDays} days`,
    };
  }

  if (allEnabled) {
    return {
      staleReason: 'fully-enabled',
      keepBranch: 'enabled',
      reason: `100% rollout for more than ${staleAgeDays} days`,
    };
  }

  if (envData.length === 0) {
    return {
      staleReason: 'inactive',
      keepBranch: 'disabled',
      reason: `Inactive for more than ${staleAgeDays} days (no environment data)`,
    };
  }

  // Has partial rollout - not stale enough to auto-classify
  return { staleReason: null, keepBranch: 'enabled', reason: '' };
}
