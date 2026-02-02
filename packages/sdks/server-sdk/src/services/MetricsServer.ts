/**
 * SDK Metrics Server
 * - Runs on a dedicated port (default 9337) for consistent metrics collection
 * - Collects SDK metrics and allows external metrics registration
 * - No side effects at import time
 */

import type { Application, Request, Response } from "express";
import type { Registry } from "prom-client";
import type { Logger } from "../utils/logger";

export type MetricsServerConfig = {
  /** Port to listen on (default: 9337 or SDK_METRICS_PORT env) */
  port?: number;
  /** Bind address (default: 0.0.0.0 in dev, 127.0.0.1 in production) */
  bindAddress?: string;
  /** Whether to collect default Node.js metrics */
  collectDefaultMetrics?: boolean;
  /** Service name for default labels (e.g., 'auth', 'lobby', 'world') */
  service?: string;
  /** Service group for default labels (e.g., 'kr', 'us', 'production') */
  group?: string;
  /** Environment for default labels (e.g., 'env_prod', 'env_staging') */
  environment?: string;
  /** Application name for default labels */
  applicationName?: string;
  /** Logger instance */
  logger?: Logger;
  /** Existing prom-client registry to use as the primary registry (optional) */
  registry?: any;
  /** Additional registries to merge into the /metrics output (optional) */
  additionalRegistries?: any[];
};

export type MetricsServerInstance = {
  /** The express application */
  app: Application;
  /** The prom-client registry */
  registry: Registry;
  /** Register external metrics (e.g., from game servers) */
  registerExternalMetric: (metric: any) => void;
  /** Create and register a Counter metric */
  createCounter: (name: string, help: string, labelNames?: string[]) => any;
  /** Create and register a Gauge metric */
  createGauge: (name: string, help: string, labelNames?: string[]) => any;
  /** Create and register a Histogram metric */
  createHistogram: (
    name: string,
    help: string,
    labelNames?: string[],
    buckets?: number[],
  ) => any;
  /** Start the server */
  start: () => void;
  /** Stop the server */
  stop: () => Promise<void>;
};

/**
 * Create a metrics server instance
 * Does not start the server - call start() to begin listening
 */
export function createMetricsServer(
  config: MetricsServerConfig = {},
): MetricsServerInstance {
  // Lazy require to avoid side effects at import time
  const express = require("express");
  const promClient = require("prom-client");

  const port =
    config.port || parseInt(process.env.SDK_METRICS_PORT || "9337", 10);
  const nodeEnv = process.env.NODE_ENV || "development";
  const bindAddress =
    config.bindAddress || (nodeEnv === "production" ? "127.0.0.1" : "0.0.0.0");

  // Use provided registry or create a new one
  const registry: Registry = config.registry || new promClient.Registry();
  const isNewRegistry = !config.registry;

  // Set default labels only if it's a new registry or specifically requested
  // In most cases, we want consistent labels across all metrics in the registry
  if (isNewRegistry) {
    registry.setDefaultLabels({
      sdk: "gatrix-server-sdk",
      service: config.service || "unknown",
      group: config.group || "unknown",
      environment: config.environment || "unknown",
      application:
        config.applicationName || process.env.SDK_APPLICATION_NAME || "unknown",
    });
  }

  // Check if default Node.js metrics are already present in any of the registries
  // Use 'process_cpu_user_seconds_total' as a proxy for default metrics
  const PROXY_METRIC = "process_cpu_user_seconds_total";
  const allRegistriesToCheck = [
    registry,
    ...(config.additionalRegistries || []),
  ];

  let hasDefaultMetrics = false;
  try {
    hasDefaultMetrics = allRegistriesToCheck.some((reg) => {
      // getSingleMetric returns the metric if found, undefined otherwise
      return !!reg.getSingleMetric(PROXY_METRIC);
    });
  } catch (_e) {
    // Ignore errors during check
  }

  // Collect default Node.js metrics if enabled (default: true) AND not already present
  if (config.collectDefaultMetrics !== false && !hasDefaultMetrics) {
    promClient.collectDefaultMetrics({ register: registry });
  }

  const app: Application = express();
  let server: any = null;

  // Metrics endpoint
  app.get("/metrics", async (_req: Request, res: Response) => {
    try {
      let metricsOutput: string;

      if (
        config.additionalRegistries &&
        config.additionalRegistries.length > 0
      ) {
        // Merge multiple registries for output
        const allRegistries = [registry, ...config.additionalRegistries];
        metricsOutput =
          await promClient.Registry.merge(allRegistries).metrics();
      } else {
        // Single registry output
        metricsOutput = await registry.metrics();
      }

      res.set("Content-Type", registry.contentType);
      res.end(metricsOutput);
    } catch (error) {
      config.logger?.error("Error generating metrics:", error);
      res.status(500).end();
    }
  });

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  return {
    app,
    registry,

    /**
     * Register an external metric (e.g., from game servers)
     * This allows game servers to add their own metrics to the same registry
     */
    registerExternalMetric(metric: any): void {
      try {
        registry.registerMetric(metric);
      } catch (error) {
        config.logger?.warn("Failed to register external metric:", error);
      }
    },

    /**
     * Create and register a Counter metric
     */
    createCounter(name: string, help: string, labelNames: string[] = []): any {
      const counter = new promClient.Counter({
        name,
        help,
        labelNames,
        registers: [registry],
      });
      return counter;
    },

    /**
     * Create and register a Gauge metric
     */
    createGauge(name: string, help: string, labelNames: string[] = []): any {
      const gauge = new promClient.Gauge({
        name,
        help,
        labelNames,
        registers: [registry],
      });
      return gauge;
    },

    /**
     * Create and register a Histogram metric
     */
    createHistogram(
      name: string,
      help: string,
      labelNames: string[] = [],
      buckets: number[] = [0.005, 0.01, 0.05, 0.1, 0.3, 1, 3, 5, 10],
    ): any {
      const histogram = new promClient.Histogram({
        name,
        help,
        labelNames,
        buckets,
        registers: [registry],
      });
      return histogram;
    },

    /**
     * Start the metrics server
     */
    start(): void {
      server = app.listen(port, bindAddress, () => {
        config.logger?.info(
          `Metrics server listening on ${bindAddress}:${port}`,
        );
      });
    },

    /**
     * Stop the metrics server
     */
    async stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (!server) {
          resolve();
          return;
        }
        // Force close all existing connections to prevent hanging
        if (typeof server.closeAllConnections === "function") {
          server.closeAllConnections();
        }
        server.close((err: Error | undefined) => {
          if (err) {
            reject(err);
          } else {
            server = null;
            resolve();
          }
        });
      });
    },
  };
}
