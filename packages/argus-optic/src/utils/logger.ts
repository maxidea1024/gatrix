import winston from 'winston';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, category, ...meta }) => {
    const prefix = category ? `[${category}]` : '';
    let msg = `${timestamp} [${level}]${prefix}: ${message}`;
    const { service: _s, ...rest } = meta;
    if (Object.keys(rest).length > 0) {
      try {
        msg += ` ${JSON.stringify(rest)}`;
      } catch {
        msg += ' [Object could not be serialized]';
      }
    }
    return msg;
  })
);

const sharedTransports = [new winston.transports.Console({ format })];

/**
 * Create a logger with a category label.
 * Lightweight — no Loki, no file rotation. Host apps provide their own logging.
 */
export function createLogger(category: string): winston.Logger {
  return winston.createLogger({
    level: LOG_LEVEL,
    defaultMeta: { service: 'optic', category },
    transports: sharedTransports,
    exitOnError: false,
  });
}
