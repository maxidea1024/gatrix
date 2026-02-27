import { Response } from 'express';
import crypto from 'crypto';
import { CacheService } from '../services/CacheService';

interface EtagCacheEntry<TPayload> {
  etag: string;
  payload: TPayload;
}

interface RespondWithEtagCacheOptions<TPayload> {
  cacheKey: string;
  ttlMs: number;
  requestEtag?: string | string[];
  buildPayload: () => Promise<TPayload>;
}

/**
 * Helper for Server SDK endpoints to handle ETag-based caching.
 *
 * - Stores { etag, payload } in CacheService using the provided cache key.
 * - Returns 304 Not Modified when the client ETag matches the cached one.
 * - Otherwise returns the cached payload or builds a fresh one and caches it.
 */
export async function respondWithEtagCache<TPayload>(
  res: Response,
  options: RespondWithEtagCacheOptions<TPayload>
): Promise<void> {
  const { cacheKey, ttlMs, requestEtag, buildPayload } = options;

  const clientEtag = Array.isArray(requestEtag) ? requestEtag[0] : requestEtag;
  const ttlSeconds = ttlMs > 0 ? Math.floor(ttlMs / 1000) : 0;

  const cached = await CacheService.get<EtagCacheEntry<TPayload>>(cacheKey);

  if (cached) {
    if (clientEtag && clientEtag === cached.etag) {
      res.status(304).end();
      return;
    }

    res.set('ETag', cached.etag);
    if (ttlSeconds > 0) {
      res.set('Cache-Control', `public, max-age=${ttlSeconds}`);
    }
    res.json(cached.payload as any);
    return;
  }

  const payload = await buildPayload();
  const etag = generateEtag(payload);

  if (clientEtag && clientEtag === etag) {
    res.status(304).end();
    return;
  }

  // Defensive: If payload looks empty (empty array or object with empty array),
  // consider not caching it or using a very short TTL to avoid persistent "no data" state
  const isEmpty = (p: any): boolean => {
    if (!p) return true;
    if (Array.isArray(p) && p.length === 0) return true;
    if (typeof p === 'object') {
      // Check for common response structures like { items: [], total: 0 } or { clientVersions: [], total: 0 }
      const keys = Object.keys(p);
      for (const key of keys) {
        if (Array.isArray(p[key]) && p[key].length > 0) return false;
      }
      if (keys.some((k) => Array.isArray(p[k]))) return true; // Found empty array(s)
    }
    return false;
  };

  if (!isEmpty(payload)) {
    await CacheService.set<EtagCacheEntry<TPayload>>(
      cacheKey,
      { etag, payload },
      ttlSeconds || undefined
    );
  } else {
    // If empty, we might still want to cache for a very short duration (e.g. 5s)
    // to prevent hammering the DB if there really is no data
    await CacheService.set<EtagCacheEntry<TPayload>>(
      cacheKey,
      { etag, payload },
      5 // 5 seconds instead of full TTL
    );
  }

  res.set('ETag', etag);
  if (ttlSeconds > 0) {
    res.set('Cache-Control', `public, max-age=${ttlSeconds}`);
  }
  res.json(payload as any);
}

function generateEtag(payload: unknown): string {
  try {
    const json = JSON.stringify(payload);
    const hash = crypto.createHash('sha1').update(json).digest('hex');
    return `"${hash}"`;
  } catch {
    // Fallback ETag if payload cannot be stringified for some reason
    return `"fallback-${Date.now().toString(36)}"`;
  }
}
