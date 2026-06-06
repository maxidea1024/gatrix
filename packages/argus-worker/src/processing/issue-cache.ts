

interface CachedIssue {
  issueId: number;
  status: string;
  substatus: string | null;
}

/**
 * Maximum number of entries in the issue lookup cache.
 * Prevents unbounded memory growth during long-running worker processes.
 */
const MAX_CACHE_SIZE = 100_000;

/**
 * In-memory cache for issue lookups by (projectId, primaryHash).
 *
 * Why this works:
 * - GroupMQ guarantees per-project FIFO — same project events never
 *   run concurrently, so FOR UPDATE locks are unnecessary.
 * - Cache hit means zero MySQL queries for repeated events on the same issue.
 * - Cache miss falls through to a plain SELECT (no lock).
 * - Invalidation is triggered via Pub/Sub when issue status changes
 *   (resolve, unresolve, ignore) from the API.
 * - Size is capped at MAX_CACHE_SIZE to prevent OOM in long-running processes.
 */
export class IssueLookupCache {
  /** Map<"projectId:primaryHash", CachedIssue> */
  private cache: Map<string, CachedIssue> = new Map();

  private key(projectId: string, primaryHash: string): string {
    return `${projectId}:${primaryHash}`;
  }

  get(projectId: string, primaryHash: string): CachedIssue | null {
    const k = this.key(projectId, primaryHash);
    const entry = this.cache.get(k);
    if (!entry) return null;

    // Move to end (most recently accessed) for LRU behavior
    this.cache.delete(k);
    this.cache.set(k, entry);
    return entry;
  }

  set(projectId: string, primaryHash: string, issue: CachedIssue): void {
    const k = this.key(projectId, primaryHash);

    // If already exists, delete first to update insertion order
    if (this.cache.has(k)) {
      this.cache.delete(k);
    }

    // Evict oldest entries if at capacity
    while (this.cache.size >= MAX_CACHE_SIZE) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      } else {
        break;
      }
    }

    this.cache.set(k, issue);
  }

  /**
   * Invalidate all cache entries for a specific issue ID.
   * Called when an issue status changes (resolve/unresolve/ignore).
   * O(N) scan — acceptable since status changes are rare compared to events.
   */
  invalidateByIssueId(issueId: number): void {
    for (const [key, value] of this.cache) {
      if (value.issueId === issueId) {
        this.cache.delete(key);
        break; // Each issueId maps to exactly one (projectId, primaryHash)
      }
    }
  }

  /**
   * Invalidate all entries for a project.
   */
  invalidateByProjectId(projectId: string): void {
    const prefix = `${projectId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Singleton instance — used by issue-grouper, invalidated via ConfigSubscriber.
 */
export const issueLookupCache = new IssueLookupCache();
