"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const config = {
    // Server configuration
    port: parseInt(process.env.PORT || '5000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? 'http://frontend:80' : 'http://localhost:3000'),
    frontendUrl: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'http://frontend:80' : 'http://localhost:3000'),
    // Database configuration
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        name: process.env.DB_NAME || 'admin_panel',
        debug: process.env.DB_DEBUG === 'true',
    },
    // Redis configuration
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || '',
    },
    // JWT configuration
    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '30d', // 임시로 30일로 연장
    },
    // Session configuration
    session: {
        secret: process.env.SESSION_SECRET || 'your-super-secret-session-key',
        maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10), // 24 hours in milliseconds
        ttl: parseInt(process.env.SESSION_TTL || '86400', 10), // 24 hours in seconds for Redis
    },
    // OAuth configuration
    oauth: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID || '',
            clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        },
        qq: {
            clientId: process.env.QQ_CLIENT_ID || '',
            clientSecret: process.env.QQ_CLIENT_SECRET || '',
        },
        wechat: {
            clientId: process.env.WECHAT_CLIENT_ID || '',
            clientSecret: process.env.WECHAT_CLIENT_SECRET || '',
        },
        baidu: {
            clientId: process.env.BAIDU_CLIENT_ID || '',
            clientSecret: process.env.BAIDU_CLIENT_SECRET || '',
        },
    },
    // Admin configuration
    admin: {
        email: process.env.ADMIN_EMAIL || 'admin@example.com',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        name: process.env.ADMIN_NAME || 'Administrator',
    },
    // Logging configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        dir: process.env.LOG_DIR || 'logs',
    },
    // Chat Server configuration
    chatServer: {
        url: process.env.CHAT_SERVER_URL || 'http://localhost:5100',
        apiToken: process.env.CHAT_SERVER_API_TOKEN || 'gatrix-api-default-token',
    },
};
exports.config = config;
// Validate required environment variables
const requiredEnvVars = [
    'JWT_SECRET',
    'SESSION_SECRET',
];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0 && process.env.NODE_ENV === 'production') {
    // Note: logger may not be available yet during config initialization
    console.error('Missing required environment variables:', missingEnvVars);
    process.exit(1);
}
exports.default = config;
//# sourceMappingURL=index.js.map