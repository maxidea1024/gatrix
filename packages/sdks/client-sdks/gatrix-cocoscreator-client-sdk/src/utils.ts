/**
 * Utility functions for Gatrix CocosCreator Client SDK
 *
 * Differences from JS SDK:
 * - No crypto.randomUUID / crypto.subtle (not available in CocosCreator JSB)
 * - Uses djb2 hash instead of SHA-256
 * - No AbortController dependency
 * - computeContextHash / computeEtag are synchronous
 */

/**
 * Generate a UUID v4 (fallback implementation — no crypto.randomUUID in CocosCreator)
 */
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * Convert context to a stable JSON string for hashing
 */
export function contextString(context: Record<string, any>): string {
  const { properties = {}, ...fields } = context;

  const sortEntries = (record: Record<string, any>) =>
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b, undefined));

  return JSON.stringify([sortEntries(fields), sortEntries(properties)]);
}

/**
 * Fast djb2 hash — deterministic, lightweight, no external dependency.
 * Used in place of SHA-256 which requires crypto.subtle (unavailable in CocosCreator).
 */
export function djb2Hash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0; // hash * 33 + c
  }
  // Convert to unsigned 32-bit hex string
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Compute a hash value for context (synchronous, no crypto dependency).
 */
export function computeContextHash(context: Record<string, any>): string {
  const value = contextString(context);
  return djb2Hash(value);
}

/**
 * Compute ETag for a set of evaluated flags.
 * Replicates server-side logic in EvaluationUtils.generateETag (synchronous version).
 */
export function computeEtag(flags: any[], contextHash: string): string {
  // Sort flags by name ascending to match server-side sorting
  const sortedFlags = [...flags].sort((a, b) => a.name.localeCompare(b.name));

  const etagSource =
    contextHash +
    '|' +
    sortedFlags
      .map((f) => {
        const variantPart = f.variant ? `${f.variant.name}:${f.variant.enabled}` : 'no-variant';
        return `${f.name}:${f.version}:${f.enabled}:${variantPart}`;
      })
      .join('|');

  const hash = djb2Hash(etagSource);
  return `"${hash}"`;
}

/**
 * Deep compare two evaluated flags to detect actual value changes.
 * Optimized to use ContextHash and Version to avoid unnecessary serialization.
 */
export function isEqualFlag(
  a: any,
  b: any,
  oldContextHash?: string,
  newContextHash?: string
): boolean {
  if (!a || !b) {
    return a === b;
  }

  // Fast path: same context and same version means same outcome
  if (
    oldContextHash &&
    newContextHash &&
    oldContextHash === newContextHash &&
    a.version === b.version
  ) {
    return true;
  }

  if (
    a.enabled !== b.enabled ||
    a.variant.name !== b.variant.name ||
    a.variant.enabled !== b.variant.enabled
  ) {
    return false;
  }

  if (a.valueType !== 'json') {
    return a.variant.value === b.variant.value;
  }

  // Fallback to JSON comparison for complex objects if version/context changed
  return JSON.stringify(a.variant.value) === JSON.stringify(b.variant.value);
}
