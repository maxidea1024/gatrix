import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import LokiTransport from 'winston-loki';
import { config } from '../config';
import os from 'os';

const serviceName = process.env.LOG_SERVICE_NAME || 'gatrix-argus';
const hostname = os.hostname();

const lokiEnabled = process.env.GATRIX_LOKI_ENABLED === 'true';
const lokiUrl = process.env.GATRIX_LOKI_URL;

const useJsonConsoleFormat = process.env.LOG_CONSOLE_FORMAT === 'json';

function getInternalIp(): string {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }

  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4') {
        return addr.address;
      }
    }
  }

  return '127.0.0.1';
}

const internalIp = getInternalIp();

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

const jsonFormat = winston.format.combine(
  serviceFormat(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consolePrettyFormat = winston.format.combine(
  serviceFormat(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, category, ...meta }) => {
    const prefix = category ? `[${category}]` : '';
    let msg = `${timestamp} [${level}]${prefix}: ${message}`;
    // Exclude internal metadata from output
    const { service: _s, hostname: _h, internalIp: _i, ...rest } = meta;
    if (Object.keys(rest).length > 0) {
      try {
        msg += ` ${JSON.stringify(rest)}`;
      } catch (_error) {
        msg += ' [Object could not be serialized]';
      }
    }
    return msg;
  })
);

function buildTransports(): winston.transport[] {
  const result: winston.transport[] = [
    new winston.transports.Console({
      format: useJsonConsoleFormat ? jsonFormat : consolePrettyFormat,
    }),
  ];

  if (config.nodeEnv === 'production') {
    result.push(
      new DailyRotateFile({
        filename: 'logs/argus-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: jsonFormat,
      }),
      new DailyRotateFile({
        filename: 'logs/argus-error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '30d',
        format: jsonFormat,
      })
    );
  }

  if (lokiEnabled && lokiUrl) {
    result.push(
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

  return result;
}

const sharedTransports = buildTransports();

/**
 * Create a logger with a category label.
 *
 * @example
 * const logger = createLogger('clickhouse');
 * logger.info('Connected'); // => "2025-05-29 17:00:00 [info][clickhouse]: Connected"
 */
export function createLogger(category: string): winston.Logger {
  return winston.createLogger({
    level: config.logLevel,
    defaultMeta: {
      service: serviceName,
      category,
    },
    transports: sharedTransports,
    exitOnError: false,
  });
}

/** Root logger (no category) for top-level startup/shutdown messages. */
const rootLogger = createLogger('argus');

export default rootLogger;
