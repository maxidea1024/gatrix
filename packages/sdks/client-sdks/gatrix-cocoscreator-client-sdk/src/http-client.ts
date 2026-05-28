/**
 * HttpClient - XMLHttpRequest-based HTTP client for CocosCreator
 *
 * Replaces the `ky` library which depends on the Fetch API (unavailable in
 * CocosCreator's JSB runtime). Uses XMLHttpRequest which is supported in
 * both CocosCreator 2.x and 3.x across Web, Android, and iOS platforms.
 */

/**
 * Cancel token for aborting in-flight requests.
 * CocosCreator does not provide AbortController, so we implement our own.
 */
export class CancelToken {
  private _cancelled = false;
  private _xhr: XMLHttpRequest | null = null;

  /** Whether this token has been cancelled */
  get cancelled(): boolean {
    return this._cancelled;
  }

  /** @internal Bind an XMLHttpRequest so cancel() can abort it */
  _bind(xhr: XMLHttpRequest): void {
    this._xhr = xhr;
    // If already cancelled before binding, abort immediately
    if (this._cancelled && xhr.readyState !== 4) {
      xhr.abort();
    }
  }

  /** Cancel the associated request */
  cancel(): void {
    this._cancelled = true;
    if (this._xhr && this._xhr.readyState !== 4) {
      this._xhr.abort();
    }
    this._xhr = null;
  }
}

/**
 * Minimal response interface matching what the SDK needs.
 */
export interface HttpResponse {
  /** HTTP status code */
  status: number;
  /** HTTP status text */
  statusText: string;
  /** Whether status is in the 200-299 range */
  ok: boolean;
  /** Response headers (get method) */
  headers: HttpHeaders;
  /** Parse body as JSON */
  json<T = any>(): T;
  /** Get body as text */
  text(): string;
}

/**
 * Simple header access (mirrors a subset of the Headers API)
 */
export interface HttpHeaders {
  get(name: string): string | null;
}

/**
 * Request options
 */
export interface HttpRequestOptions {
  /** HTTP method (default: 'GET') */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body (will be JSON-serialized if object) */
  body?: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Cancel token for aborting the request */
  cancelToken?: CancelToken;
}

/**
 * Error thrown when an HTTP request is aborted.
 */
export class HttpAbortError extends Error {
  readonly name = 'AbortError';
  constructor() {
    super('Request was aborted');
  }
}

/**
 * Send an HTTP request using XMLHttpRequest.
 *
 * @param url    Full URL string
 * @param opts   Request options
 * @returns      Promise resolving to an HttpResponse
 */
export function httpRequest(
  url: string,
  opts: HttpRequestOptions = {}
): Promise<HttpResponse> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = 30000,
    cancelToken,
  } = opts;

  return new Promise<HttpResponse>((resolve, reject) => {
    if (cancelToken?.cancelled) {
      reject(new HttpAbortError());
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.timeout = timeout;

    // Set headers
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    // Bind cancel token
    if (cancelToken) {
      cancelToken._bind(xhr);
    }

    xhr.onload = () => {
      const responseText = xhr.responseText || '';
      const status = xhr.status;

      const response: HttpResponse = {
        status,
        statusText: xhr.statusText,
        ok: status >= 200 && status < 300,
        headers: {
          get(name: string): string | null {
            return xhr.getResponseHeader(name);
          },
        },
        json<T = any>(): T {
          return JSON.parse(responseText);
        },
        text(): string {
          return responseText;
        },
      };

      resolve(response);
    };

    xhr.onerror = () => {
      reject(new Error(`Network error: ${method} ${url}`));
    };

    xhr.ontimeout = () => {
      reject(new Error(`Request timeout: ${method} ${url} (${timeout}ms)`));
    };

    xhr.onabort = () => {
      reject(new HttpAbortError());
    };

    xhr.send(body ?? null);
  });
}

/**
 * Convenience: send a GET request
 */
export function httpGet(
  url: string,
  options: Omit<HttpRequestOptions, 'method' | 'body'> = {}
): Promise<HttpResponse> {
  return httpRequest(url, { ...options, method: 'GET' });
}

/**
 * Convenience: send a POST request with JSON body
 */
export function httpPost(
  url: string,
  jsonBody: unknown,
  options: Omit<HttpRequestOptions, 'method' | 'body'> = {}
): Promise<HttpResponse> {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  return httpRequest(url, {
    ...options,
    method: 'POST',
    headers,
    body: JSON.stringify(jsonBody),
  });
}
