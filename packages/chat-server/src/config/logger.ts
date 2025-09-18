import winston from 'winston';
import { config } from './index';

// Safe JSON stringify to avoid circular references
function safeStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, val) => {
    if (val != null && typeof val === 'object') {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }
    return val;
  });
}

// Custom format for console output with timestamp
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    if (Object.keys(meta).length > 0) {
      try {
        const metaStr = safeStringify(meta);
        log += ` ${metaStr}`;
      } catch (error) {
        log += ` [Error serializing meta data]`;
      }
    }

    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    if (Object.keys(meta).length > 0) {
      try {
        log += ` ${safeStringify(meta)}`;
      } catch (error) {
        log += ` [Error serializing meta data]`;
      }
    }

    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: {
    service: 'chat-server',
    pid: process.pid,
    serverId: process.env.SERVER_ID || 'unknown',
  },
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

// Add file transport in production
if (config.isProduction) {
  logger.add(
    new winston.transports.File({
      filename: config.logging.file,
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true,
    })
  );
}

export default logger;
