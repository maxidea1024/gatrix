/**
 * Logger Utility
 */

import { LoggerConfig } from '../types/config';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private level: LogLevel;
  private customLogger?: (level: string, message: string, meta?: any) => void;

  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config?: LoggerConfig) {
    this.level = config?.level || 'info';
    this.customLogger = config?.customLogger;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [Gatrix SDK] ${message}${metaStr}`;
  }

  debug(message: string, meta?: any): void {
    if (!this.shouldLog('debug')) return;

    if (this.customLogger) {
      this.customLogger('debug', message, meta);
    } else {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: any): void {
    if (!this.shouldLog('info')) return;

    if (this.customLogger) {
      this.customLogger('info', message, meta);
    } else {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: any): void {
    if (!this.shouldLog('warn')) return;

    if (this.customLogger) {
      this.customLogger('warn', message, meta);
    } else {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, meta?: any): void {
    if (!this.shouldLog('error')) return;

    if (this.customLogger) {
      this.customLogger('error', message, meta);
    } else {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }
}

