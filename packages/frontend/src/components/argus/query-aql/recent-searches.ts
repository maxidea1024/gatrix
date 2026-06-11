/**
 * AQL Recent Search History — localStorage-based.
 *
 * Stores recent search queries per domain, limited to MAX_RECENT items.
 * Newest entries first, duplicates are deduplicated (moved to top).
 */

const MAX_RECENT = 10;
const STORAGE_KEY_PREFIX = 'AQL_recent_';

export interface RecentSearch {
  query: string;
  timestamp: number;
}

function getStorageKey(domain: string): string {
  return `${STORAGE_KEY_PREFIX}${domain}`;
}

/**
 * Get recent searches for a domain.
 */
export function getRecentSearches(domain: string): RecentSearch[] {
  try {
    const raw = localStorage.getItem(getStorageKey(domain));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/**
 * Add a search query to recent history.
 * Deduplicates and keeps the most recent at the top.
 */
export function addRecentSearch(domain: string, query: string): void {
  if (!query.trim()) return;

  const existing = getRecentSearches(domain);

  // Remove duplicate if exists
  const filtered = existing.filter((r) => r.query !== query);

  // Add to front
  const updated: RecentSearch[] = [
    { query, timestamp: Date.now() },
    ...filtered,
  ].slice(0, MAX_RECENT);

  try {
    localStorage.setItem(getStorageKey(domain), JSON.stringify(updated));
  } catch {
    // localStorage full or unavailable
  }
}

/**
 * Remove a specific recent search.
 */
export function removeRecentSearch(domain: string, query: string): void {
  const existing = getRecentSearches(domain);
  const filtered = existing.filter((r) => r.query !== query);
  try {
    localStorage.setItem(getStorageKey(domain), JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

/**
 * Clear all recent searches for a domain.
 */
export function clearRecentSearches(domain: string): void {
  try {
    localStorage.removeItem(getStorageKey(domain));
  } catch {
    // ignore
  }
}
