import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import os from "os";
import { config } from "./env";

const logDir = process.env.LOG_DIR || "logs";
const logLevel = config.logLevel || "info";
const logFormat = process.env.LOG_FORMAT || "";
const nodeEnv = process.env.NODE_ENV || "development";
const serviceName = process.env.LOG_SERVICE_NAME || "gatrix-edge";
const monitoringEnabled =
  process.env.MONITORING_ENABLED === "true" ||
  process.env.MONITORING_ENABLED === "1";
const hostname = os.hostname();

const useJsonFormat = logFormat
  ? logFormat === "json"
  : monitoringEnabled || nodeEnv !== "development";

/**
 * Get the first non-internal IPv4 address from network interfaces
 * Falls back to first internal IPv4 address if no external address is found
 */
function getInternalIp(): string {
  const interfaces = os.networkInterfaces();

  // First pass: Look for non-internal IPv4 addresses
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const addr of iface) {
      // Skip non-IPv4 and internal addresses
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }

  // Second pass: Fall back to internal IPv4 addresses (e.g., 127.0.0.1)
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const addr of iface) {
      if (addr.family === "IPv4") {
        return addr.address;
      }
    }
  }

  // Ultimate fallback
  return "127.0.0.1";
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
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = "";
    // Exclude internal metadata from pretty printing
    const { service, hostname, internalIp, ...displayMeta } = meta;
    if (Object.keys(displayMeta).length > 0) {
      try {
        metaStr = " " + JSON.stringify(displayMeta);
      } catch (error) {
        metaStr = " [Object could not be serialized]";
      }
    }
    return `${timestamp} [${level}] ${message}${metaStr}`;
  }),
);

// JSON format for Loki / file logs
const jsonFormat = winston.format.combine(
  serviceFormat(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// File format always JSON
const fileFormat = jsonFormat;

// Create transports
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    level: logLevel,
    format: useJsonFormat ? jsonFormat : consolePrettyFormat,
  }),
];

// Add file transports in production
if (nodeEnv === "production" || process.env.LOG_DIR) {
  const logsDir = path.join(process.cwd(), logDir);

  transports.push(
    new DailyRotateFile({
      dirname: logsDir,
      filename: "edge-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
      format: fileFormat,
      zippedArchive: true,
    }),
    new DailyRotateFile({
      dirname: logsDir,
      filename: "edge-error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "30d",
      level: "error",
      format: fileFormat,
      zippedArchive: true,
    }),
  );
}

// Create logger
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
if (nodeEnv === "production" || process.env.LOG_DIR) {
  const logsDir = path.join(process.cwd(), logDir);

  logger.exceptions.handle(
    new DailyRotateFile({
      dirname: logsDir,
      filename: "edge-exceptions-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      format: fileFormat,
      maxSize: "20m",
      maxFiles: "14d",
      zippedArchive: true,
    }),
  );

  logger.rejections.handle(
    new DailyRotateFile({
      dirname: logsDir,
      filename: "edge-rejections-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      format: fileFormat,
      maxSize: "20m",
      maxFiles: "14d",
      zippedArchive: true,
    }),
  );
}

export default logger;
