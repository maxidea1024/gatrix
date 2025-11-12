/**
 * Logger Utility
 */

import { LoggerConfig } from '../types/config';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ANSI color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m', // Green
  warn: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
  timestamp: '\x1b[90m', // Gray
  bracket: '\x1b[90m', // Gray
};

export class Logger {
  private level: LogLevel;
  private customLogger?: (level: string, message: string, meta?: any) => void;
  private colorEnabled: boolean;
  private timeOffset: number; // Time offset in hours
  private timestampFormat: 'iso8601' | 'local'; // Timestamp format
  private category?: string; // Category for logging

  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config?: LoggerConfig, category?: string) {
    this.level = config?.level || 'info';
    this.customLogger = config?.customLogger;
    this.timeOffset = config?.timeOffset ?? 0; // Default: UTC (0 offset)
    this.timestampFormat = config?.timestampFormat ?? 'iso8601'; // Default: ISO8601
    this.category = category;
    // Enable colors by default, disable if running in non-TTY environment
    this.colorEnabled = process.stdout?.isTTY !== false;
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
    if (this.timestampFormat === 'local') {
      // Format: YYYY-MM-DD HH:mm:ss.sss
      const year = offsetDate.getUTCFullYear();
      const month = String(offsetDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(offsetDate.getUTCDate()).padStart(2, '0');
      const hours = String(offsetDate.getUTCHours()).padStart(2, '0');
      const minutes = String(offsetDate.getUTCMinutes()).padStart(2, '0');
      const seconds = String(offsetDate.getUTCSeconds()).padStart(2, '0');
      const ms = String(offsetDate.getUTCMilliseconds()).padStart(3, '0');

      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
    }

    // ISO8601 format (default)
    return offsetDate.toISOString();
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = this.getFormattedTimestamp();
    const category = this.category || 'GatrixServerSDK';

    if (!this.colorEnabled || this.customLogger) {
      // Plain text format when colors are disabled or custom logger is used
      return `[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}`;
    }

    // Colored format
    const levelColor = COLORS[level];
    const coloredLevel = `${levelColor}${level.toUpperCase()}${COLORS.reset}`;
    const coloredTimestamp = `${COLORS.timestamp}${timestamp}${COLORS.reset}`;
    const coloredBracket = COLORS.bracket;

    return `${coloredBracket}[${coloredTimestamp}] [${coloredLevel}${coloredBracket}] [${category}]${COLORS.reset} ${message}`;
  }

  debug(message: string, meta?: any): void {
    if (!this.shouldLog('debug')) return;

    if (this.customLogger) {
      this.customLogger('debug', message, meta);
    } else {
      const formatted = this.formatMessage('debug', message, meta);
      if (meta !== undefined) {
        console.debug(`${formatted}:`, meta);
      } else {
        console.debug(formatted);
      }
    }
  }

  info(message: string, meta?: any): void {
    if (!this.shouldLog('info')) return;

    if (this.customLogger) {
      this.customLogger('info', message, meta);
    } else {
      const formatted = this.formatMessage('info', message, meta);
      if (meta !== undefined) {
        console.info(`${formatted}:`, meta);
      } else {
        console.info(formatted);
      }
    }
  }

  warn(message: string, meta?: any): void {
    if (!this.shouldLog('warn')) return;

    if (this.customLogger) {
      this.customLogger('warn', message, meta);
    } else {
      const formatted = this.formatMessage('warn', message, meta);
      if (meta !== undefined) {
        console.warn(`${formatted}:`, meta);
      } else {
        console.warn(formatted);
      }
    }
  }

  error(message: string, meta?: any): void {
    if (!this.shouldLog('error')) return;

    if (this.customLogger) {
      this.customLogger('error', message, meta);
    } else {
      const formatted = this.formatMessage('error', message, meta);
      if (meta !== undefined) {
        console.error(`${formatted}:`, meta);
      } else {
        console.error(formatted);
      }
    }
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

  setTimestampFormat(format: 'iso8601' | 'local'): void {
    this.timestampFormat = format;
  }

  getTimestampFormat(): 'iso8601' | 'local' {
    return this.timestampFormat;
  }

  /**
   * Get category name
   */
  getCategory(): string | undefined {
    return this.category;
  }

  /**
   * Set category name
   */
  setCategory(category: string): void {
    this.category = category;
  }
}

/**
 * Factory function to create a logger with a specific category
 */
export function getLogger(category: string, config?: LoggerConfig): Logger {
  return new Logger(config, category);
}

