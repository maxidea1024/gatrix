---
slug: production-deployment-tips
title: Gatrix Production Deployment Tips and Best Practices
authors: [gatrix-team]
tags: [gatrix, tips, deployment, production]
---

Essential tips and best practices for deploying Gatrix safely and efficiently to production environments.

<!-- truncate -->

## Pre-deployment Checklist

### 1. Environment Configuration

```bash
# Verify required environment variables
echo "=== Environment Check ==="
echo "NODE_ENV: $NODE_ENV"
echo "DB_HOST: $DB_HOST"
echo "REDIS_HOST: $REDIS_HOST"
echo "JWT_SECRET: ${JWT_SECRET:0:10}..."

# Database connection test
npm run test:db-connection

# Redis connection test
npm run test:redis-connection
```

### 2. Security Configuration

```javascript
// Security middleware setup
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
```

## Docker Optimization

### Multi-stage Build

```dockerfile
# Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run build

# Production image
FROM node:22-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S gatrix -u 1001

WORKDIR /app

COPY --from=builder --chown=gatrix:nodejs /app/dist ./dist
COPY --from=builder --chown=gatrix:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=gatrix:nodejs /app/package*.json ./

USER gatrix

EXPOSE 3000 5000 3001

CMD ["node", "dist/index.js"]
```

## Monitoring Setup

### Prometheus Metrics

```javascript
const prometheus = require('prom-client');

const register = new prometheus.Registry();
prometheus.collectDefaultMetrics({ register });

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

register.registerMetric(httpRequestDuration);

module.exports = { register, httpRequestDuration };
```

## Conclusion

Following this guide ensures:

1. **Stability**: Monitoring and alerts for quick issue detection
2. **Security**: Multi-layer security protection
3. **Scalability**: Caching and optimization for performance
4. **Recovery**: Backup and restore for data protection
