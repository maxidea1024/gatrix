import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const logDir = process.env.LOG_DIR || 'logs';
const logLevel = process.env.LOG_LEVEL || 'verbose';

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      try {
        metaStr = '\n' + JSON.stringify(meta, null, 2);
      } catch (error) {
        metaStr = '\n[Object could not be serialized]';
      }
    }
    const result = `${timestamp} [${level}]: ${message}${metaStr}`;
    return result;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    level: logLevel,
    format: consoleFormat,
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

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  transports,
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: consoleFormat,
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

  // Custom format for category-based logging
  const categoryFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let metaStr = '';
      if (Object.keys(meta).length > 0) {
        try {
          metaStr = '\n' + JSON.stringify(meta, null, 2);
        } catch (error) {
          metaStr = '\n[Object could not be serialized]';
        }
      }
      // Apply colors to different parts
      // const coloredCategory = winston.format.colorize().colorize('info', `[${category}]`);
      const coloredCategory = `[${category}]`;
      const result = `${timestamp} [${level}] ${coloredCategory}: ${message}${metaStr}`;
      return result;
    })
  );

  const categoryLogger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true })
    ),
    transports: [...transports],
  });

  // Add console transport for development
  if (process.env.NODE_ENV !== 'production') {
    categoryLogger.add(new winston.transports.Console({
      format: categoryFormat,
    }));
  }

  loggers.set(category, categoryLogger);
  return categoryLogger;
};

// Export both default logger and factory function
export default logger;
export { createLogger };
