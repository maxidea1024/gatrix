import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import LokiTransport from 'winston-loki';
import path from 'path';
import os from 'os';

const logDir = process.env.LOG_DIR || 'logs';
const logLevel = process.env.LOG_LEVEL || 'verbose';
const logFormat = process.env.LOG_FORMAT || '';
const nodeEnv = process.env.NODE_ENV || 'development';
const serviceName = process.env.LOG_SERVICE_NAME || 'gatrix-backend';

// Detect AWS ECS environment for log format adjustments
// In ECS: no ANSI codes, single-line JSON metadata
const isECS = !!process.env.ECS_CONTAINER_METADATA_URI_V4;
const monitoringEnabled =
  process.env.MONITORING_ENABLED === 'true' ||
  process.env.MONITORING_ENABLED === '1';
const hostname = os.hostname();

const lokiEnabled = process.env.GATRIX_LOKI_ENABLED === 'true';
const lokiUrl = process.env.GATRIX_LOKI_URL;

// Use JSON format for file/Loki if configured via LOG_FORMAT
const useJsonFormat = logFormat === 'json';

// For console, use pretty format unless explicitly requested via LOG_CONSOLE_FORMAT
// This ignores LOG_FORMAT=json for console to keep it readable in development
const useJsonConsoleFormat = process.env.LOG_CONSOLE_FORMAT === 'json';

/**
 * Get the first non-internal IPv4 address from network interfaces
 * Falls back to first internal IPv4 address if no external address is found
 */
function getInternalIp(): string {
  const interfaces = os.networkInterfaces();

  // First pass: Look for non-internal, non-link-local IPv4 addresses
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const addr of iface) {
      if (
        addr.family === 'IPv4' &&
        !addr.internal &&
        !addr.address.startsWith('169.254.')
      ) {
        return addr.address;
      }
    }
  }

  // Second pass: Fall back to internal IPv4 addresses, still skip link-local
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.address.startsWith('169.254.')) {
        return addr.address;
      }
    }
  }

  // Ultimate fallback
  return '127.0.0.1';
}

const internalIp = getInternalIp();

// Add base service metadata to all log entries
const serviceFormat = winston.format((info) => {
  if (!info.service) {
    info.service = serviceName;
  }
  if (!info.hostname) {
    info.hostname = hostname;
  }
  if (!info.internalIp) {
    info.internalIp = internalIp;
  }
  return info;
});

// Pretty console format (for human readable logs)
const consolePrettyFormat = winston.format.combine(
  serviceFormat(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      try {
        // In ECS: single-line JSON. Otherwise: multi-line pretty-printed
        metaStr = isECS
          ? ' ' + JSON.stringify(meta)
          : '\n' + JSON.stringify(meta, null, 2);
      } catch (error) {
        metaStr = isECS
          ? ' [Object could not be serialized]'
          : '\n[Object could not be serialized]';
      }
    }
    const result = `${timestamp} [${level}]: ${message}${metaStr}`;
    return result;
  })
);

// JSON format for Loki / file logs
const jsonFormat = winston.format.combine(
  serviceFormat(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// File format always JSON
const fileFormat = jsonFormat;

// Create transports
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    level: logLevel,
    format: useJsonConsoleFormat ? jsonFormat : consolePrettyFormat,
  }),
];

// Add file transports only in production or when LOG_DIR is specified
if (process.env.NODE_ENV === 'production' || process.env.LOG_DIR) {
  // Error log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    })
  );

  // Combined log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    })
  );
}

// Add Loki transport if enabled
if (lokiEnabled && lokiUrl) {
  transports.push(
    new LokiTransport({
      host: lokiUrl,
      labels: { service: serviceName, hostname },
      json: true,
      format: jsonFormat,
      replaceTimestamp: true,
      onConnectionError: (err) => console.error(err),
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: {
    service: serviceName,
  },
  transports,
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.Console({
      format: useJsonFormat ? jsonFormat : consolePrettyFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: useJsonFormat ? jsonFormat : consolePrettyFormat,
    }),
  ],
});

// Add file exception handlers in production
if (process.env.NODE_ENV === 'production' || process.env.LOG_DIR) {
  logger.exceptions.handle(
    new DailyRotateFile({
      filename: path.join(logDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    })
  );

  logger.rejections.handle(
    new DailyRotateFile({
      filename: path.join(logDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    })
  );
}

// Category-based logger factory
const loggers = new Map<string, winston.Logger>();

const createLogger = (category: string): winston.Logger => {
  if (loggers.has(category)) {
    return loggers.get(category)!;
  }

  // Pretty format for category-based logging
  const categoryPrettyFormat = winston.format.combine(
    serviceFormat(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let metaStr = '';
      if (Object.keys(meta).length > 0) {
        try {
          // In ECS: single-line JSON. Otherwise: multi-line pretty-printed
          metaStr = isECS
            ? ' ' + JSON.stringify(meta)
            : '\n' + JSON.stringify(meta, null, 2);
        } catch (error) {
          metaStr = isECS
            ? ' [Object could not be serialized]'
            : '\n[Object could not be serialized]';
        }
      }
      // In ECS: no ANSI color codes. Otherwise: yellow category name
      const categoryLabel = isECS
        ? `[${category}]`
        : `[\x1b[33m${category}\x1b[0m]`;
      const result = `${timestamp} [${level}] ${categoryLabel}: ${message}${metaStr}`;
      return result;
    })
  );

  // JSON format for category-based logging
  const categoryJsonFormat = winston.format.combine(
    serviceFormat(),
    winston.format((info) => {
      if (!info.category) {
        info.category = category;
      }
      return info;
    })(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  const categoryLogger = winston.createLogger({
    level: logLevel,
    defaultMeta: {
      service: serviceName,
      category,
    },
    transports: [
      // Console transport with category format
      new winston.transports.Console({
        level: logLevel,
        format: useJsonConsoleFormat
          ? categoryJsonFormat
          : categoryPrettyFormat,
      }),
      // Add file transports only in production or when LOG_DIR is specified
      ...(process.env.NODE_ENV === 'production' || process.env.LOG_DIR
        ? [
            new DailyRotateFile({
              filename: path.join(logDir, 'error-%DATE%.log'),
              datePattern: 'YYYY-MM-DD',
              level: 'error',
              format: fileFormat,
              maxSize: '20m',
              maxFiles: '14d',
              zippedArchive: true,
            }),
            new DailyRotateFile({
              filename: path.join(logDir, 'combined-%DATE%.log'),
              datePattern: 'YYYY-MM-DD',
              format: fileFormat,
              maxSize: '20m',
              maxFiles: '14d',
              zippedArchive: true,
            }),
          ]
        : []),
    ],
  });

  loggers.set(category, categoryLogger);
  return categoryLogger;
};

// Export both default logger and factory function
export default logger;
export { createLogger };
