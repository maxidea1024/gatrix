/**
 * UrlBuilder - URL parsing and construction utility for CocosCreator
 *
 * Replaces the browser `URL` class which is not available in CocosCreator's
 * JSB runtime. Provides the subset of URL functionality used by the SDK:
 * - Parse a URL string into components
 * - Build/modify query parameters
 * - Serialize back to a full URL string
 *
 * Compatible with CocosCreator 2.x and 3.x.
 */

export class UrlSearchParams {
  private params: Map<string, string> = new Map();

  constructor(initial?: string) {
    if (initial) {
      // Strip leading '?'
      const qs = initial.startsWith('?') ? initial.slice(1) : initial;
      if (qs) {
        for (const pair of qs.split('&')) {
          const eqIdx = pair.indexOf('=');
          if (eqIdx >= 0) {
            const key = decodeURIComponent(pair.slice(0, eqIdx));
            const value = decodeURIComponent(pair.slice(eqIdx + 1));
            this.params.set(key, value);
          } else {
            this.params.set(decodeURIComponent(pair), '');
          }
        }
      }
    }
  }

  set(key: string, value: string): void {
    this.params.set(key, value);
  }

  get(key: string): string | null {
    return this.params.has(key) ? this.params.get(key)! : null;
  }

  has(key: string): boolean {
    return this.params.has(key);
  }

  delete(key: string): void {
    this.params.delete(key);
  }

  toString(): string {
    const parts: string[] = [];
    this.params.forEach((value, key) => {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    });
    return parts.join('&');
  }

  entries(): IterableIterator<[string, string]> {
    return this.params.entries();
  }
}

/**
 * Lightweight URL builder that replaces the native URL class.
 *
 * Usage:
 * ```ts
 * const url = new UrlBuilder('https://api.example.com/api/v1/client/features/eval');
 * url.searchParams.set('appName', 'myApp');
 * url.searchParams.set('userId', '123');
 * const fullUrl = url.toString();
 * // => "https://api.example.com/api/v1/client/features/eval?appName=myApp&userId=123"
 * ```
 */
export class UrlBuilder {
  /** Protocol + authority + path (everything before '?') */
  private _base: string;
  /** Query parameters */
  readonly searchParams: UrlSearchParams;

  constructor(urlString: string) {
    const qIdx = urlString.indexOf('?');
    if (qIdx >= 0) {
      this._base = urlString.slice(0, qIdx);
      this.searchParams = new UrlSearchParams(urlString.slice(qIdx + 1));
    } else {
      this._base = urlString;
      this.searchParams = new UrlSearchParams();
    }
  }

  /**
   * Serialize the URL back to a string.
   */
  toString(): string {
    const qs = this.searchParams.toString();
    return qs ? `${this._base}?${qs}` : this._base;
  }
}

/**
 * Validate whether a string looks like a valid URL.
 * Uses a simple regex check (no native URL constructor dependency).
 */
export function isValidUrl(url: string): boolean {
  // Accept http://, https://, ws://, wss:// with at least one path character
  return /^(?:https?|wss?):\/\/.+/i.test(url);
}
