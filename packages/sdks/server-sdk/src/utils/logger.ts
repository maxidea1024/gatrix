/**
 * Logger Utility
 */

import { LoggerConfig } from "../types/config";
import * as os from "os";

import { LokiTransport } from "./LokiTransport";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFormat = "pretty" | "json";

// ANSI color codes for terminal output
const COLORS = {
  reset: "\x1b[0m",
  debug: "\x1b[36m", // Cyan
  info: "\x1b[32m", // Green
  warn: "\x1b[33m", // Yellow
  error: "\x1b[31m", // Red
  timestamp: "\x1b[90m", // Gray
  bracket: "\x1b[90m", // Gray
};

/**
 * Get internal IPv4 address
 */
function getInternalIp(): string {
  const interfaces = os.networkInterfaces();

  // First pass: Look for non-internal IPv4 addresses
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const addr of iface) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }

  // Second pass: Fall back to internal IPv4 addresses
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const addr of iface) {
      if (addr.family === "IPv4") {
        return addr.address;
      }
    }
  }

  return "127.0.0.1";
}

export class Logger {
  private level: LogLevel;
  private customLogger?: (level: string, message: string, meta?: any) => void;
  private colorEnabled: boolean;
  private timeOffset: number; // Time offset in hours
  private timestampFormat: "iso8601" | "local"; // Timestamp format
  private sourceCategory?: string; // Source Category for logging
  private format: LogFormat; // Output format
  private context?: Record<string, any>; // Additional context fields
  private hostname: string; // Cached hostname
  private internalIp: string; // Cached internal IP
  private lokiTransport?: LokiTransport; // Optional Loki transport

  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config?: LoggerConfig, sourceCategory?: string) {
    this.level = config?.level || "info";
    this.customLogger = config?.customLogger;
    this.timeOffset = config?.timeOffset ?? 0; // Default: UTC (0 offset)
    this.timestampFormat = config?.timestampFormat ?? "iso8601"; // Default: ISO8601
    this.sourceCategory = sourceCategory || config?.sourceCategory;

    // Fallback: Infer sourceCategory from Loki labels if not explicitly set
    if (!this.sourceCategory && config?.loki?.labels) {
      if (config.loki.labels["sourceCategory"]) {
        this.sourceCategory = config.loki.labels["sourceCategory"];
      } else if (config.loki.labels["source_category"]) {
        this.sourceCategory = config.loki.labels["source_category"];
      }
    }

    this.format = config?.format ?? "pretty"; // Default: pretty
    this.context = config?.context;
    // Enable colors by default, disable if running in non-TTY environment
    this.colorEnabled = process.stdout?.isTTY !== false;
    // Cache hostname and IP (only used for JSON format)
    this.hostname = os.hostname();
    this.internalIp = getInternalIp();

    // Initialize Loki transport if enabled
    if (config?.loki?.enabled && config.loki.url) {
      this.lokiTransport = new LokiTransport(config.loki);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private getFormattedTimestamp(): string {
    const now = new Date();

    // Apply time offset if specified
    const offsetMs = this.timeOffset * 60 * 60 * 1000;
    const offsetDate = new Date(now.getTime() + offsetMs);

    // Format based on timestampFormat setting
    if (this.timestampFormat === "local") {
      // Format: YYYY-MM-DD HH:mm:ss.sss
      const year = offsetDate.getUTCFullYear();
      const month = String(offsetDate.getUTCMonth() + 1).padStart(2, "0");
      const day = String(offsetDate.getUTCDate()).padStart(2, "0");
      const hours = String(offsetDate.getUTCHours()).padStart(2, "0");
      const minutes = String(offsetDate.getUTCMinutes()).padStart(2, "0");
      const seconds = String(offsetDate.getUTCSeconds()).padStart(2, "0");
      const ms = String(offsetDate.getUTCMilliseconds()).padStart(3, "0");

      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
    }

    // ISO8601 format (default)
    return offsetDate.toISOString();
  }

  private formatPrettyMessage(level: LogLevel, message: string): string {
    const timestamp = this.getFormattedTimestamp();
    const sourceCategory = this.sourceCategory || "GatrixServerSDK";

    if (!this.colorEnabled || this.customLogger) {
      // Plain text format when colors are disabled or custom logger is used
      return `[${timestamp}] [${level.toUpperCase()}] [${sourceCategory}] ${message}`;
    }

    // Colored format
    const levelColor = COLORS[level];
    const coloredLevel = `${levelColor}${level.toUpperCase()}${COLORS.reset}`;
    const coloredTimestamp = `${COLORS.timestamp}${timestamp}${COLORS.reset}`;
    const coloredBracket = COLORS.bracket;

    return `${coloredBracket}[${coloredTimestamp}] [${coloredLevel}${coloredBracket}] [${sourceCategory}]${COLORS.reset} ${message}`;
  }

  private formatJsonMessage(
    level: LogLevel,
    message: string,
    meta?: any,
  ): string {
    const logEntry: Record<string, any> = {
      timestamp: this.getFormattedTimestamp(),
      level: level.toUpperCase(),
      sourceCategory: this.sourceCategory || "GatrixServerSDK",
      message,
      hostname: this.hostname,
      internalIp: this.internalIp,
    };

    // Add custom context if provided
    if (this.context) {
      Object.assign(logEntry, this.context);
    }

    // Add meta if provided
    if (meta !== undefined) {
      if (typeof meta === "object" && meta !== null && !Array.isArray(meta)) {
        Object.assign(logEntry, meta);
      } else {
        logEntry.meta = meta;
      }
    }

    const replacer = (_key: string, value: any) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    };

    try {
      return JSON.stringify(logEntry, replacer);
    } catch (error: any) {
      // Handle serialization errors (e.g. circular references)
      // Remove meta causing the issue and add error info
      delete logEntry.meta;
      logEntry.serializationError = error.message;
      return JSON.stringify(logEntry, replacer);
    }
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    if (!this.shouldLog(level)) return;

    if (this.customLogger) {
      this.customLogger(level, message, meta);
      return;
    }

    // Determine source_category based on category
    // Determine source_category based on category
    const category = this.sourceCategory || "GatrixServerSDK";
    let sourceCategory = category;

    if (category === "GatrixServerSDK") {
      sourceCategory = process.env.GATRIX_SOURCE_CATEGORY || "gatrix";
    } else if (category.toLowerCase().includes("infra")) {
      sourceCategory = "infra";
    }

    // JSON format
    if (this.format === "json") {
      const jsonOutput = this.formatJsonMessage(level, message, meta);
      switch (level) {
        case "debug":
          console.debug(jsonOutput);
          break;
        case "info":
          console.info(jsonOutput);
          break;
        case "warn":
          console.warn(jsonOutput);
          break;
        case "error":
          console.error(jsonOutput);
          break;
      }

      // Push to Loki if enabled (structured)
      if (this.lokiTransport) {
        this.lokiTransport.send(level, jsonOutput, {
          source_category: sourceCategory,
        });
      }
      return;
    }

    // Pretty format (default)
    const formatted = this.formatPrettyMessage(level, message);
    const logFn =
      level === "debug"
        ? console.debug
        : level === "info"
          ? console.info
          : level === "warn"
            ? console.warn
            : console.error;

    if (meta !== undefined) {
      logFn(`${formatted}:`, meta);
    } else {
      logFn(formatted);
    }

    // Push to Loki if enabled (use structured JSON for better querying)
    if (this.lokiTransport) {
      try {
        // Always use JSON format for Loki, regardless of console output format
        const jsonOutput = this.formatJsonMessage(level, message, meta);

        this.lokiTransport.send(level, jsonOutput, {
          source_category: sourceCategory,
        });
      } catch (err) {
        // Fallback if JSON serialization fails
        try {
          const fallbackEntry = {
            timestamp: this.getFormattedTimestamp(),
            level: level.toUpperCase(),
            sourceCategory: this.sourceCategory || "GatrixServerSDK",
            message: `${message} [Serialization Error]`,
            meta: {
              error: (err as Error).message,
            },
            hostname: this.hostname,
            internalIp: this.internalIp,
          };
          const jsonOutput = JSON.stringify(fallbackEntry);

          this.lokiTransport.send(level, jsonOutput, {
            source_category: sourceCategory,
            serialization_error: "true",
          });
        } catch (_fallbackErr) {
          const minimalJson = JSON.stringify({
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message: "Critical Serialization Error",
          });
          this.lokiTransport.send(level, minimalJson, {
            source_category: sourceCategory,
            serialization_error: "true",
          });
        }
      }
    }
  }

  debug(message: string, meta?: any): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: any): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: any): void {
    this.log("error", message, meta);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  setColorEnabled(enabled: boolean): void {
    this.colorEnabled = enabled;
  }

  isColorEnabled(): boolean {
    return this.colorEnabled;
  }

  setTimeOffset(hours: number): void {
    this.timeOffset = hours;
  }

  getTimeOffset(): number {
    return this.timeOffset;
  }

  setTimestampFormat(format: "iso8601" | "local"): void {
    this.timestampFormat = format;
  }

  getTimestampFormat(): "iso8601" | "local" {
    return this.timestampFormat;
  }

  /**
   * Get source category name
   */
  getSourceCategory(): string | undefined {
    return this.sourceCategory;
  }

  /**
   * Set source category name
   */
  setSourceCategory(sourceCategory: string): void {
    this.sourceCategory = sourceCategory;
  }

  /**
   * Set output format
   */
  setFormat(format: LogFormat): void {
    this.format = format;
  }

  /**
   * Get output format
   */
  getFormat(): LogFormat {
    return this.format;
  }

  /**
   * Set additional context fields (JSON format only)
   */
  setContext(context: Record<string, any>): void {
    this.context = context;
  }

  /**
   * Get additional context fields
   */
  getContext(): Record<string, any> | undefined {
    return this.context;
  }

  /**
   * Add or update context fields
   */
  addContext(fields: Record<string, any>): void {
    this.context = { ...this.context, ...fields };
  }
}

/**
 * Factory function to create a logger with a specific source category
 */
export function getLogger(
  sourceCategory: string,
  config?: LoggerConfig,
): Logger {
  return new Logger(config, sourceCategory);
}
