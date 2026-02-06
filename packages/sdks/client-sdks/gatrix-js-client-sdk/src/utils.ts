/**
 * Utility functions for Gatrix Client SDK
 */

/**
 * Generate a UUID v4
 */
export function uuidv4(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Resolve AbortController from global scope
 */
export function resolveAbortController(): (() => AbortController) | undefined {
  try {
    if (typeof window !== 'undefined' && 'AbortController' in window) {
      return () => new window.AbortController();
    }
    if (typeof globalThis !== 'undefined' && 'AbortController' in globalThis) {
      return () => new globalThis.AbortController();
    }
  } catch {
    // Ignore errors
  }
  return undefined;
}

/**
 * Build URL with context as query parameters (for GET requests)
 */
export function urlWithContextAsQuery(apiUrl: URL, context: Record<string, any>): URL {
  const url = new URL(apiUrl.toString());

  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null) continue;

    if (key === 'properties' && typeof value === 'object') {
      // Flatten properties into query params with 'properties[key]' format
      for (const [propKey, propValue] of Object.entries(value)) {
        if (propValue !== undefined && propValue !== null) {
          url.searchParams.set(`properties[${propKey}]`, String(propValue));
        }
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
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
 * Compute SHA-256 hash of a string
 */
async function sha256(input: string): Promise<string> {
  const cryptoSubtle =
    typeof globalThis !== 'undefined' && globalThis.crypto?.subtle
      ? globalThis.crypto?.subtle
      : undefined;

  if (
    typeof TextEncoder === 'undefined' ||
    !cryptoSubtle?.digest ||
    typeof Uint8Array === 'undefined'
  ) {
    throw new Error('Hashing function not available');
  }

  const msgUint8 = new TextEncoder().encode(input);
  const hashBuffer = await cryptoSubtle.digest('SHA-256', msgUint8);
  const hexString = Array.from(new Uint8Array(hashBuffer))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
  return hexString;
}

/**
 * Compute a hash value for context (for cache TTL validation)
 * Falls back to raw string if crypto not available
 */
export async function computeContextHash(context: Record<string, any>): Promise<string> {
  const value = contextString(context);

  try {
    const hash = await sha256(value);
    return hash;
  } catch {
    return value;
  }
}
