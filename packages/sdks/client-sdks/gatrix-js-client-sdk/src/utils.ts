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
 * Resolve fetch function from global scope
 */
export function resolveFetch(): typeof fetch | undefined {
  try {
    if (typeof window !== 'undefined' && 'fetch' in window) {
      return fetch.bind(window);
    }
    if (typeof globalThis !== 'undefined' && 'fetch' in globalThis) {
      return fetch.bind(globalThis);
    }
  } catch {
    // Ignore errors
  }
  return undefined;
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
export function urlWithContextAsQuery(baseUrl: URL, context: Record<string, any>): URL {
  const url = new URL(baseUrl.toString());

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
