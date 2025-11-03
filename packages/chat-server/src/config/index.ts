import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || 'localhost',

  // Database
  database: {
    host: process.env.CHAT_DB_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.CHAT_DB_PORT || process.env.DB_PORT || '3306', 10),
    name: process.env.CHAT_DB_NAME || 'gatrix_chat',
    user: process.env.CHAT_DB_USER || process.env.DB_USER || 'root',
    password: process.env.CHAT_DB_PASSWORD || process.env.DB_PASSWORD || 'password',
    debug: process.env.DB_DEBUG === 'true',
  },

  // Redis (supports cluster mode for scaling)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '1', 10),
    cluster: {
      enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
      nodes: process.env.REDIS_CLUSTER_NODES ?
        process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
          const [host, port] = node.split(':');
          return { host, port: parseInt(port, 10) };
        }) : [],
    },
    // Connection pool settings for high concurrency
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableOfflineQueue: false,
    lazyConnect: true,
    keepAlive: 30000,
    family: 4,
    connectTimeout: 10000,
    commandTimeout: 5000,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-chat-server',
    serverSecret: process.env.JWT_SERVER_SECRET || 'your-super-secret-server-key-for-chat-server',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // File Upload
  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10), // 10MB
    allowedTypes: (process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,audio/mp3,audio/wav,application/pdf,text/plain').split(','),
    path: process.env.UPLOAD_PATH || './uploads',
  },

  // Gatrix Main Server
  gatrix: {
    apiUrl: process.env.GATRIX_API_URL || 'http://localhost:3000',
    apiSecret: process.env.GATRIX_API_SECRET || 'shared-secret-between-servers',
    connectionTimeout: parseInt(process.env.GATRIX_CONNECTION_TIMEOUT || '30000', 10),
  },

  // CORS
  cors: {
    // Allow wildcard "*" in dev by converting ["*"] to "*" for Socket.IO
    get origin() {
      const defaultOrigins = process.env.NODE_ENV === 'production'
        ? 'http://frontend:80'
        : 'http://localhost:5173,http://localhost:3000,http://localhost:3002';
      const corsEnv = process.env.CORS_ORIGIN || defaultOrigins;
      const list = corsEnv.split(',');
      return list.includes('*') ? '*' : list;
    },
    credentials: true,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // WebSocket (optimized for high concurrency)
  websocket: {
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000', 10),
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000', 10),
    maxHttpBufferSize: parseInt(process.env.WS_MAX_HTTP_BUFFER_SIZE || '1048576', 10), // 1MB
    transports: ['websocket', 'polling'],
    upgradeTimeout: parseInt(process.env.WS_UPGRADE_TIMEOUT || '10000', 10),
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '10000', 10), // Per instance
    compression: process.env.WS_COMPRESSION !== 'false',
    perMessageDeflate: {
      threshold: 1024,
      zlibDeflateOptions: {
        level: 3,
        chunkSize: 1024,
      },
    },
  },

  // Clustering
  cluster: {
    enabled: process.env.CLUSTER_ENABLED === 'true',
    workers: parseInt(process.env.CLUSTER_WORKERS || '0', 10) || require('os').cpus().length,
    stickySession: process.env.STICKY_SESSION === 'true',
  },

  // Message Broadcasting Optimization
  broadcasting: {
    batchSize: parseInt(process.env.BROADCAST_BATCH_SIZE || '1000', 10),
    batchDelay: parseInt(process.env.BROADCAST_BATCH_DELAY || '10', 10), // ms
    useMessagePack: process.env.USE_MESSAGE_PACK === 'true',
    compression: process.env.BROADCAST_COMPRESSION === 'true',
    channelSharding: process.env.CHANNEL_SHARDING === 'true',
    maxChannelsPerShard: parseInt(process.env.MAX_CHANNELS_PER_SHARD || '1000', 10),
  },

  // Performance Monitoring
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
    healthCheckPath: process.env.HEALTH_CHECK_PATH || '/health',
    readinessCheckPath: process.env.READINESS_CHECK_PATH || '/ready',
  },

  // Memory Management
  memory: {
    maxMemoryUsage: parseInt(process.env.MAX_MEMORY_USAGE || '1073741824', 10), // 1GB
    gcInterval: parseInt(process.env.GC_INTERVAL || '300000', 10), // 5 minutes
    connectionCleanupInterval: parseInt(process.env.CONNECTION_CLEANUP_INTERVAL || '60000', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/chat-server.log',
  },

  // Health Check
  healthCheck: {
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
  },

  // Development
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};
