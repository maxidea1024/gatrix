/**
 * Request Statistics Service
 * Collects and provides request statistics for monitoring
 * - Status code counts
 * - Endpoint counts
 * - Response time statistics (min, max, avg, p95, p99)
 * - Bytes sent/received totals
 * - Rate-limited request logging
 */

export interface EndpointStats {
  count: number;
  totalDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  durations: number[]; // For percentile calculations (limited size)
  bytesSent: number;
  bytesReceived: number;
  statusCodes: Map<number, number>; // Status codes per endpoint
}

export interface RequestStatsSnapshot {
  startTime: string;
  snapshotTime: string;
  uptimeSeconds: number;
  totalRequests: number;
  statusCodes: Record<string, number>;
  endpoints: Record<
    string,
    {
      count: number;
      avgDurationMs: number;
      minDurationMs: number;
      maxDurationMs: number;
      p95DurationMs: number;
      p99DurationMs: number;
      bytesSent: number;
      bytesReceived: number;
      statusCodes: Record<string, number>; // Per-endpoint status codes
    }
  >;
  totals: {
    bytesSent: number;
    bytesReceived: number;
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
  };
}

class RequestStats {
  private startTime: Date;
  private totalRequests: number = 0;
  private statusCodes: Map<number, number> = new Map();
  private endpoints: Map<string, EndpointStats> = new Map();
  private totalBytesSent: number = 0;
  private totalBytesReceived: number = 0;
  private allDurations: number[] = [];
  private minDuration: number = Infinity;
  private maxDuration: number = 0;

  // Rate limiting for logging
  private logRateLimit: number; // requests per second
  private logTokens: number;
  private lastTokenRefill: number;

  // Max durations to keep for percentile calculations per endpoint
  private readonly maxDurationsPerEndpoint = 1000;
  private readonly maxTotalDurations = 10000;

  constructor() {
    this.startTime = new Date();
    // Default: 100 logs per second, 0 = disabled
    this.logRateLimit = parseInt(process.env.REQUEST_LOG_RATE_LIMIT || '100', 10);
    this.logTokens = this.logRateLimit;
    this.lastTokenRefill = Date.now();
  }

  /**
   * Record a request
   * @returns true if this request should be logged (rate limit check)
   */
  record(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    bytesSent: number,
    bytesReceived: number
  ): boolean {
    this.totalRequests++;

    // Status code counts
    const currentStatus = this.statusCodes.get(statusCode) || 0;
    this.statusCodes.set(statusCode, currentStatus + 1);

    // Endpoint stats (method + path)
    const endpointKey = `${method} ${path}`;
    let endpoint = this.endpoints.get(endpointKey);
    if (!endpoint) {
      endpoint = {
        count: 0,
        totalDurationMs: 0,
        minDurationMs: Infinity,
        maxDurationMs: 0,
        durations: [],
        bytesSent: 0,
        bytesReceived: 0,
        statusCodes: new Map(),
      };
      this.endpoints.set(endpointKey, endpoint);
    }

    endpoint.count++;
    endpoint.totalDurationMs += durationMs;
    endpoint.minDurationMs = Math.min(endpoint.minDurationMs, durationMs);
    endpoint.maxDurationMs = Math.max(endpoint.maxDurationMs, durationMs);
    endpoint.bytesSent += bytesSent;
    endpoint.bytesReceived += bytesReceived;

    // Track status code per endpoint
    const currentEndpointStatus = endpoint.statusCodes.get(statusCode) || 0;
    endpoint.statusCodes.set(statusCode, currentEndpointStatus + 1);

    // Keep limited durations for percentile calculation
    if (endpoint.durations.length < this.maxDurationsPerEndpoint) {
      endpoint.durations.push(durationMs);
    } else {
      // Replace random element to maintain sample diversity
      const idx = Math.floor(Math.random() * this.maxDurationsPerEndpoint);
      endpoint.durations[idx] = durationMs;
    }

    // Global stats
    this.totalBytesSent += bytesSent;
    this.totalBytesReceived += bytesReceived;
    this.minDuration = Math.min(this.minDuration, durationMs);
    this.maxDuration = Math.max(this.maxDuration, durationMs);

    // Keep limited total durations
    if (this.allDurations.length < this.maxTotalDurations) {
      this.allDurations.push(durationMs);
    } else {
      const idx = Math.floor(Math.random() * this.maxTotalDurations);
      this.allDurations[idx] = durationMs;
    }

    // Rate limit check for logging
    return this.shouldLog();
  }

  /**
   * Check if request should be logged based on rate limit
   */
  private shouldLog(): boolean {
    if (this.logRateLimit === 0) {
      return false; // Logging disabled
    }

    const now = Date.now();
    const elapsed = now - this.lastTokenRefill;

    // Refill tokens based on elapsed time (token bucket algorithm)
    if (elapsed >= 1000) {
      this.logTokens = this.logRateLimit;
      this.lastTokenRefill = now;
    } else {
      const tokensToAdd = (elapsed / 1000) * this.logRateLimit;
      this.logTokens = Math.min(this.logRateLimit, this.logTokens + tokensToAdd);
      this.lastTokenRefill = now;
    }

    if (this.logTokens >= 1) {
      this.logTokens--;
      return true;
    }

    return false;
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  /**
   * Get statistics snapshot
   */
  getSnapshot(): RequestStatsSnapshot {
    const now = new Date();
    const uptimeSeconds = Math.floor((now.getTime() - this.startTime.getTime()) / 1000);

    // Status codes as object
    const statusCodesObj: Record<string, number> = {};
    for (const [code, count] of this.statusCodes) {
      statusCodesObj[code.toString()] = count;
    }

    // Endpoint stats
    const endpointsObj: Record<string, RequestStatsSnapshot['endpoints'][string]> = {};
    for (const [key, stats] of this.endpoints) {
      const sorted = [...stats.durations].sort((a, b) => a - b);
      // Convert endpoint status codes Map to object
      const endpointStatusCodes: Record<string, number> = {};
      for (const [code, count] of stats.statusCodes) {
        endpointStatusCodes[code.toString()] = count;
      }
      endpointsObj[key] = {
        count: stats.count,
        avgDurationMs: stats.count > 0 ? Math.round(stats.totalDurationMs / stats.count) : 0,
        minDurationMs: stats.minDurationMs === Infinity ? 0 : stats.minDurationMs,
        maxDurationMs: stats.maxDurationMs,
        p95DurationMs: this.percentile(sorted, 95),
        p99DurationMs: this.percentile(sorted, 99),
        bytesSent: stats.bytesSent,
        bytesReceived: stats.bytesReceived,
        statusCodes: endpointStatusCodes,
      };
    }

    // Calculate global average
    const totalDuration = Array.from(this.endpoints.values()).reduce(
      (sum, e) => sum + e.totalDurationMs,
      0
    );
    const avgDuration = this.totalRequests > 0 ? Math.round(totalDuration / this.totalRequests) : 0;

    return {
      startTime: this.startTime.toISOString(),
      snapshotTime: now.toISOString(),
      uptimeSeconds,
      totalRequests: this.totalRequests,
      statusCodes: statusCodesObj,
      endpoints: endpointsObj,
      totals: {
        bytesSent: this.totalBytesSent,
        bytesReceived: this.totalBytesReceived,
        avgDurationMs: avgDuration,
        minDurationMs: this.minDuration === Infinity ? 0 : this.minDuration,
        maxDurationMs: this.maxDuration,
      },
    };
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.startTime = new Date();
    this.totalRequests = 0;
    this.statusCodes.clear();
    this.endpoints.clear();
    this.totalBytesSent = 0;
    this.totalBytesReceived = 0;
    this.allDurations = [];
    this.minDuration = Infinity;
    this.maxDuration = 0;
  }

  /**
   * Get current rate limit setting
   */
  getRateLimit(): number {
    return this.logRateLimit;
  }

  /**
   * Update rate limit at runtime
   */
  setRateLimit(limit: number): void {
    this.logRateLimit = limit;
    this.logTokens = limit;
  }
}

// Singleton instance
export const requestStats = new RequestStats();
