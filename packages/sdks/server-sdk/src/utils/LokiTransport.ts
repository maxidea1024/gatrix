import axios from "axios";
import { LokiConfig } from "../types/config";

/**
 * Loki Stream Interface
 */
interface LokiStream {
  stream: Record<string, string>;
  values: [string, string][]; // [nanoseconds, line]
}

/**
 * Direct Loki Push Transport
 */
export class LokiTransport {
  private config: LokiConfig;
  private buffer: {
    line: string;
    nanoseconds: string;
    labels: Record<string, string>;
  }[] = [];
  private timer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config: LokiConfig) {
    this.config = {
      batchSize: 20,
      batchInterval: 5000,
      enabled: false,
      ...config,
    };

    // Shutdown handler to flush remaining logs
    if (typeof process !== "undefined") {
      process.on("beforeExit", () => this.shutdown());
      process.on("SIGINT", () => this.shutdown());
      process.on("SIGTERM", () => this.shutdown());
    }
  }

  /**
   * Add a log entry to the buffer
   */
  send(
    level: string,
    message: string,
    extraLabels: Record<string, string> = {},
  ) {
    if (!this.config.enabled || this.isShuttingDown) return;

    const nanoseconds = (BigInt(Date.now()) * BigInt(1000000)).toString();
    const labels = {
      ...this.config.labels,
      ...extraLabels,
      level: level.toLowerCase(),
    };

    this.buffer.push({ line: message, nanoseconds, labels });

    if (this.buffer.length >= (this.config.batchSize || 20)) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(
        () => this.flush(),
        this.config.batchInterval || 5000,
      );
    }
  }

  /**
   * Flush buffered logs to Loki
   */
  async flush() {
    // Skip flush if not enabled
    if (!this.config.enabled) return;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.buffer.length === 0) return;

    const currentBatch = [...this.buffer];
    this.buffer = [];

    // Group logs by labels to create streams
    const streamMap = new Map<string, LokiStream>();

    for (const item of currentBatch) {
      const labelKey = JSON.stringify(item.labels);
      let stream = streamMap.get(labelKey);
      if (!stream) {
        stream = {
          stream: item.labels,
          values: [],
        };
        streamMap.set(labelKey, stream);
      }
      stream.values.push([item.nanoseconds, item.line]);
    }

    const payload = {
      streams: Array.from(streamMap.values()),
    };

    try {
      await axios.post(this.config.url, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      });
    } catch (error: any) {
      // Fallback to console to avoid losing critical information,
      // but avoid using the logger itself to prevent recursion.
      console.error(`[LokiTransport] Failed to push logs: ${error.message}`);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    await this.flush();
  }
}
