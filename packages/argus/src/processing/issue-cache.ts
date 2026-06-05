

interface CachedIssue {
  issueId: number;
  status: string;
  substatus: string | null;
}

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
 */
export class IssueLookupCache {
  /** Map<"projectId:primaryHash", CachedIssue> */
  private cache: Map<string, CachedIssue> = new Map();

  private key(projectId: number, primaryHash: string): string {
    return `${projectId}:${primaryHash}`;
  }

  get(projectId: number, primaryHash: string): CachedIssue | null {
    return this.cache.get(this.key(projectId, primaryHash)) || null;
  }

  set(projectId: number, primaryHash: string, issue: CachedIssue): void {
    this.cache.set(this.key(projectId, primaryHash), issue);
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
   * Invalidate all entries for a project (e.g., project deletion).
   */
  invalidateByProjectId(projectId: number): void {
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
