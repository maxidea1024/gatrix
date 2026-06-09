import { useState, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FetchFieldValues = (fieldKey: string) => Promise<string[]>;

interface CacheEntry {
  values: string[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Lazy-loading hook for facet field values.
 *
 * - Field names come from the static field registry (no fetching needed).
 * - Field VALUES are fetched on-demand when the user types `field:`.
 * - Results are cached in-memory with a 5-minute TTL.
 *
 * @param fetchFieldValues - Domain-specific callback to fetch values for a field.
 */
export function useLazyFacets(fetchFieldValues?: FetchFieldValues) {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const inflightRef = useRef<Map<string, Promise<string[]>>>(new Map());
  const [, forceRender] = useState(0);

  /**
   * Get cached values for a field. Returns [] if not yet loaded.
   * Triggers a background fetch if cache is empty or stale.
   */
  const getFieldValues = useCallback(
    (fieldKey: string): string[] => {
      const cached = cacheRef.current.get(fieldKey);
      const now = Date.now();

      // Cache hit — return immediately
      if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.values;
      }

      // No fetch function — nothing we can do
      if (!fetchFieldValues) return [];

      // Already in-flight — don't duplicate
      if (inflightRef.current.has(fieldKey)) {
        return cached?.values ?? [];
      }

      // Trigger background fetch
      const promise = fetchFieldValues(fieldKey)
        .then((values) => {
          cacheRef.current.set(fieldKey, { values, fetchedAt: Date.now() });
          inflightRef.current.delete(fieldKey);
          forceRender((n) => n + 1); // re-render to surface new data
          return values;
        })
        .catch(() => {
          inflightRef.current.delete(fieldKey);
          return [] as string[];
        });

      inflightRef.current.set(fieldKey, promise);
      return cached?.values ?? []; // return stale data while loading
    },
    [fetchFieldValues]
  );

  /**
   * Check if a field is currently being fetched.
   */
  const isFieldLoading = useCallback((fieldKey: string): boolean => {
    return inflightRef.current.has(fieldKey);
  }, []);

  /**
   * Build a Map<string, string[]> snapshot of currently cached values.
   * This is what the suggestion-engine expects.
   */
  const getCachedFacetMap = useCallback((): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    for (const [key, entry] of cacheRef.current) {
      map.set(key, entry.values);
    }
    return map;
  }, []);

  /**
   * Ensure values for a specific field are loaded into cache.
   * Returns a promise that resolves when the values are available.
   */
  const ensureFieldValues = useCallback(
    async (fieldKey: string): Promise<string[]> => {
      const cached = cacheRef.current.get(fieldKey);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.values;
      }

      if (!fetchFieldValues) return [];

      // Reuse in-flight request
      const inflight = inflightRef.current.get(fieldKey);
      if (inflight) return inflight;

      const promise = fetchFieldValues(fieldKey)
        .then((values) => {
          cacheRef.current.set(fieldKey, { values, fetchedAt: Date.now() });
          inflightRef.current.delete(fieldKey);
          forceRender((n) => n + 1);
          return values;
        })
        .catch(() => {
          inflightRef.current.delete(fieldKey);
          return [] as string[];
        });

      inflightRef.current.set(fieldKey, promise);
      return promise;
    },
    [fetchFieldValues]
  );

  return {
    getFieldValues,
    isFieldLoading,
    getCachedFacetMap,
    ensureFieldValues,
  };
}
