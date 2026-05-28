/**
 * Connected Users Cache Service
 *
 * Periodically polls admind to collect the full connected-users list and caches
 * it in memory. API requests are then served from the cache with server-side
 * search / sort / pagination — eliminating the need for admind to re-collect
 * from every lobbyd on each request.
 *
 * Design:
 * - Polling interval: configurable via CONNECTED_USERS_POLL_INTERVAL_MS (default 15 000 ms)
 * - Cache is a flat array replaced atomically (Copy-on-Write) so readers never
 *   see a partially-updated list.
 * - On poll failure the previous cache is retained (stale data > no data).
 * - The service exposes getUsers() for paginated queries and getSnapshot() for
 *   bulk export without repeated admind round-trips.
 *
 * Invoked by BullMQ scheduler job 'connected-users:poll'.
 */

import { createLogger } from '../config/logger';
import serviceDiscoveryService from '../services/service-discovery-service';

const logger = createLogger('ConnectedUsersCacheService');

// ── Types ────────────────────────────────────────────────────────────────────

export interface CachedConnectedUser {
  userId: string;
  accountId?: string;
  characterId?: string;
  userName?: string;
  worldId?: string;
  worldName?: string;
  connectedAt?: string;
  ip?: string;
  level?: number;
  nationCmsId?: number;
  isBot?: boolean;
  storeCode?: string;
  appVersion?: string;
  deviceType?: string;
  [key: string]: any;
}

export interface ConnectedUsersQueryParams {
  page?: number;
  limit?: number;
  worldId?: string;
  search?: string;
  sortBy?: string;
  sortDesc?: boolean;
}

export interface ConnectedUsersQueryResult {
  users: CachedConnectedUser[];
  total: number;
  page: number;
  limit: number;
  cachedAt: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_POLL_CHUNK_SIZE = 5000;
const ADMIND_TIMEOUT = 15000;

// Searchable string fields for the free-text search filter
const SEARCH_FIELDS: (keyof CachedConnectedUser)[] = [
  'userId',
  'accountId',
  'characterId',
  'userName',
  'worldId',
  'worldName',
  'ip',
  'storeCode',
  'appVersion',
];

// ── Service ──────────────────────────────────────────────────────────────────

export class ConnectedUsersCacheService {
  /** Current cached snapshot — replaced atomically */
  private cachedUsers: CachedConnectedUser[] = [];
  /** ISO timestamp of last successful poll */
  private cachedAt: string | null = null;
  /** Whether at least one successful poll has completed */
  private isWarmedUp = false;
  /** Guard against overlapping polls */
  private isPolling = false;

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Check whether the cache has been populated at least once.
   */
  isCacheReady(): boolean {
    return this.isWarmedUp;
  }

  /**
   * ISO timestamp of the last successful cache refresh.
   */
  getLastUpdated(): string | null {
    return this.cachedAt;
  }

  /**
   * Total number of cached users.
   */
  getCachedTotal(): number {
    return this.cachedUsers.length;
  }

  /**
   * Query the cache with search / sort / pagination.
   * Returns null if the cache has never been populated (caller should fallback).
   */
  getUsers(
    params: ConnectedUsersQueryParams
  ): ConnectedUsersQueryResult | null {
    if (!this.isWarmedUp) return null;

    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(500, Math.max(1, params.limit ?? 20));

    let filtered = this.cachedUsers;

    // ── World filter ───────────────────────────────────────────────────
    if (params.worldId) {
      const wid = params.worldId;
      filtered = filtered.filter((u) => u.worldId === wid);
    }

    // ── Free-text search ───────────────────────────────────────────────
    if (params.search) {
      const needle = params.search.toLowerCase();
      filtered = filtered.filter((u) =>
        SEARCH_FIELDS.some((f) => {
          const val = u[f];
          return val != null && String(val).toLowerCase().includes(needle);
        })
      );
    }

    const total = filtered.length;

    // ── Sort ───────────────────────────────────────────────────────────
    const sortBy = params.sortBy || 'connectedAt';
    const sortDesc = params.sortDesc ?? true;

    // Avoid mutating the source; copy only the filtered view
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      const aVal = a[sortBy] ?? '';
      const bVal = b[sortBy] ?? '';

      let cmp: number;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      return sortDesc ? -cmp : cmp;
    });

    // ── Paginate ───────────────────────────────────────────────────────
    const offset = (page - 1) * limit;
    const users = sorted.slice(offset, offset + limit);

    return { users, total, page, limit, cachedAt: this.cachedAt };
  }

  /**
   * Return the full cached snapshot (for export).
   * Callers receive the same array reference — do NOT mutate.
   */
  getSnapshot(): {
    users: CachedConnectedUser[];
    cachedAt: string | null;
  } | null {
    if (!this.isWarmedUp) return null;
    return { users: this.cachedUsers, cachedAt: this.cachedAt };
  }

  // ── Polling ──────────────────────────────────────────────────────────────

  /**
   * Poll all admind instances and rebuild the cache.
   * Called by the BullMQ scheduler job.
   */
  async pollAll(): Promise<void> {
    if (this.isPolling) {
      logger.debug('Connected users poll already in progress, skipping');
      return;
    }
    this.isPolling = true;

    try {
      const instances = await serviceDiscoveryService.getServices('admind');
      const ready = instances.filter((i) => i.status === 'ready');

      if (ready.length === 0) {
        logger.debug(
          'No admind instances found via service discovery, skipping connected-users poll'
        );
        return;
      }

      // We only need to poll one admind per environment (admind already
      // aggregates from all lobbyd instances).  Group by environmentId and
      // pick the first ready instance for each.
      const envMap = new Map<
        string,
        { admindUrl: string; environmentId: string }
      >();
      for (const inst of ready) {
        const port = inst.ports?.internalApi;
        if (!port || !inst.internalAddress) continue;
        const envId =
          inst.labels?.environmentId || inst.labels?.env || 'default';
        if (!envMap.has(envId)) {
          envMap.set(envId, {
            admindUrl: `http://${inst.internalAddress}:${port}`,
            environmentId: envId,
          });
        }
      }

      // For now we merge users from all environments into one cache.
      // If multi-environment isolation is needed later, this can be split
      // into per-environment caches.
      const allUsers: CachedConnectedUser[] = [];

      for (const { admindUrl, environmentId } of envMap.values()) {
        try {
          const users = await this.fetchAllUsersFromAdmind(admindUrl);
          allUsers.push(...users);
          logger.debug(
            `Connected users polled for env ${environmentId}: ${users.length} users`
          );
        } catch (err: any) {
          logger.warn(
            `Connected users poll failed for admind (env ${environmentId}): ${err.message}`
          );
          // Continue with other environments
        }
      }

      // Atomic swap — readers of the old array are unaffected
      this.cachedUsers = allUsers;
      this.cachedAt = new Date().toISOString();
      this.isWarmedUp = true;

      logger.debug(
        `Connected users cache refreshed: ${allUsers.length} total users`
      );
    } catch (err: any) {
      logger.error('Connected users pollAll error:', err);
    } finally {
      this.isPolling = false;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Fetch all connected users from a single admind instance by paginating
   * through its /gatrix/v1/users endpoint with large page sizes.
   */
  private async fetchAllUsersFromAdmind(
    admindUrl: string
  ): Promise<CachedConnectedUser[]> {
    const baseUrl = admindUrl.replace(/\/+$/, '');
    const allUsers: CachedConnectedUser[] = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${baseUrl}/gatrix/v1/users?page=${currentPage}&limit=${DEFAULT_POLL_CHUNK_SIZE}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ADMIND_TIMEOUT);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
        });
        clearTimeout(timer);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: any = await response.json();
        const users: CachedConnectedUser[] = data.users || [];
        const total: number = data.total || 0;

        allUsers.push(...users);
        hasMore = allUsers.length < total;
        currentPage++;

        // Safety cap to prevent infinite loops
        if (currentPage > 200) {
          logger.warn(
            'Connected users poll exceeded 200 pages, stopping early'
          );
          break;
        }
      } catch (err: any) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
          throw new Error(
            `Admind users request timed out (page ${currentPage})`
          );
        }
        throw err;
      }
    }

    return allUsers;
  }
}

// Singleton
export const connectedUsersCacheService = new ConnectedUsersCacheService();
