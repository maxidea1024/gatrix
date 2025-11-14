import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config';
import os from 'os';

const logLevel = config.logLevel;
const nodeEnv = config.nodeEnv;
const logFormatEnv = process.env.LOG_FORMAT || '';
const serviceName = process.env.LOG_SERVICE_NAME || 'gatrix-event-lens';
const monitoringEnabled = process.env.MONITORING_ENABLED === 'true' || process.env.MONITORING_ENABLED === '1';
const hostname = os.hostname();

const useJsonFormat = logFormatEnv ? logFormatEnv === 'json' : monitoringEnabled || nodeEnv !== 'development';

// Add base service metadata to all log entries
const serviceFormat = winston.format((info) => {
  if (!info.service) {
    info.service = serviceName;
  }
  if (!info.hostname) {
    info.hostname = hostname;
  }
  return info;
});

// JSON format for Loki / file logs
const jsonFormat = winston.format.combine(
  serviceFormat(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Pretty console format (for human readable logs)
const consolePrettyFormat = winston.format.combine(
  serviceFormat(),
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      try {
        msg += ` ${JSON.stringify(meta)}`;
      } catch (error) {
        msg += ' [Object could not be serialized]';
      }
    }
    return msg;
  })
);

const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: useJsonFormat ? jsonFormat : consolePrettyFormat,
  }),
];

// File transports (only in production)
if (config.nodeEnv === 'production') {
  transports.push(
    new DailyRotateFile({
      filename: 'logs/event-lens-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: jsonFormat,
    }),
    new DailyRotateFile({
      filename: 'logs/event-lens-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      format: jsonFormat,
    })
  );
}

const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: {
    service: serviceName,
  },
  transports,
  exitOnError: false,
});

export default logger;

