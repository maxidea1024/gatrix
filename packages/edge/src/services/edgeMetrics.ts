import { sdkManager } from "./sdkManager";

/**
 * Edge Server Custom Metrics
 * These metrics are registered with the SDK's gameRegistry
 */

let _userRegistry: any = null;

// Metrics definitions
export let httpRequestsTotal: any = null;
export let httpRequestDuration: any = null;
export let cacheHitsTotal: any = null;
export let cacheMissesTotal: any = null;
export let cacheSize: any = null;
export let sdkInitialized: any = null;

/**
 * Initialize Edge custom metrics
 * Must be called after SDK initialization
 */
export function initEdgeMetrics(): void {
  const sdk = sdkManager.getSDK();
  if (!sdk) return;

  const registry = sdk.getUserMetricsRegistry();
  if (!registry) return;

  _userRegistry = registry;

  const promClient = require("prom-client");

  // Custom metrics
  httpRequestsTotal = new promClient.Counter({
    name: "edge_http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "path", "status"],
    registers: [registry],
  });

  httpRequestDuration = new promClient.Histogram({
    name: "edge_http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "path", "status"],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  cacheHitsTotal = new promClient.Counter({
    name: "edge_cache_hits_total",
    help: "Total number of cache hits",
    labelNames: ["cache_type"],
    registers: [registry],
  });

  cacheMissesTotal = new promClient.Counter({
    name: "edge_cache_misses_total",
    help: "Total number of cache misses",
    labelNames: ["cache_type"],
    registers: [registry],
  });

  cacheSize = new promClient.Gauge({
    name: "edge_cache_size",
    help: "Current cache size",
    labelNames: ["cache_type"],
    registers: [registry],
  });

  sdkInitialized = new promClient.Gauge({
    name: "edge_sdk_initialized",
    help: "Whether the SDK is initialized (1) or not (0)",
    registers: [registry],
  });
}
