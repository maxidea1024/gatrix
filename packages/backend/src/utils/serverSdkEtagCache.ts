import { Response } from "express";
import crypto from "crypto";
import { CacheService } from "../services/CacheService";

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
  options: RespondWithEtagCacheOptions<TPayload>,
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

    res.set("ETag", cached.etag);
    if (ttlSeconds > 0) {
      res.set("Cache-Control", `public, max-age=${ttlSeconds}`);
    }
    res.json(cached.payload as any);
    return;
  }

  const payload = await buildPayload();
  const etag = generateEtag(payload);

  await CacheService.set<EtagCacheEntry<TPayload>>(
    cacheKey,
    { etag, payload },
    ttlSeconds || undefined,
  );

  res.set("ETag", etag);
  if (ttlSeconds > 0) {
    res.set("Cache-Control", `public, max-age=${ttlSeconds}`);
  }
  res.json(payload as any);
}

function generateEtag(payload: unknown): string {
  try {
    const json = JSON.stringify(payload);
    const hash = crypto.createHash("sha1").update(json).digest("hex");
    return `"${hash}"`;
  } catch {
    // Fallback ETag if payload cannot be stringified for some reason
    return `"fallback-${Date.now().toString(36)}"`;
  }
}
