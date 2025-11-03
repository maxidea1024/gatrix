---
slug: production-deployment-tips
title: Gatrix 프로덕션 배포를 위한 필수 팁과 베스트 프랙티스
authors: [gatrix-team]
tags: [gatrix, tips, deployment, production]
---

Gatrix를 프로덕션 환경에 안전하고 효율적으로 배포하기 위한 실전 팁과 베스트 프랙티스를 공유합니다. 이 가이드를 따라하면 안정적이고 확장 가능한 게임 플랫폼을 구축할 수 있습니다.

<!-- truncate -->

## 🚀 배포 전 체크리스트

### 1. 환경 설정 검증

```bash
# 필수 환경 변수 확인
echo "=== 필수 환경 변수 체크 ==="
echo "NODE_ENV: $NODE_ENV"
echo "DB_HOST: $DB_HOST"
echo "REDIS_HOST: $REDIS_HOST"
echo "JWT_SECRET: ${JWT_SECRET:0:10}..."
echo "API_SECRET: ${API_SECRET:0:10}..."

# 데이터베이스 연결 테스트
npm run test:db-connection

# Redis 연결 테스트
npm run test:redis-connection
```

### 2. 보안 설정 점검

```javascript
// 보안 미들웨어 설정
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate Limiting 설정
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100 요청
  message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
```

## 🐳 Docker 최적화

### 1. 멀티스테이지 빌드

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run build

# 프로덕션 이미지
FROM node:18-alpine AS production

# 보안을 위한 non-root 사용자 생성
RUN addgroup -g 1001 -S nodejs
RUN adduser -S gatrix -u 1001

WORKDIR /app

# 필요한 파일만 복사
COPY --from=builder --chown=gatrix:nodejs /app/dist ./dist
COPY --from=builder --chown=gatrix:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=gatrix:nodejs /app/package*.json ./

USER gatrix

EXPOSE 3000 5000 3001

CMD ["node", "dist/index.js"]
```

### 2. Docker Compose 프로덕션 설정

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
      - chat-server

  frontend:
    build:
      context: ./packages/frontend
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
      - REACT_APP_API_URL=https://api.gatrix.com
    restart: unless-stopped

  backend:
    build:
      context: ./packages/backend
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
      - DB_HOST=mysql
      - REDIS_HOST=redis
    depends_on:
      - mysql
      - redis
    restart: unless-stopped

  chat-server:
    build:
      context: ./packages/chat-server
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
      - DB_HOST=mysql
      - REDIS_HOST=redis
    depends_on:
      - mysql
      - redis
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_ROOT_PASSWORD}
      - MYSQL_DATABASE=${DB_NAME}
      - MYSQL_USER=${DB_USER}
      - MYSQL_PASSWORD=${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql/conf.d:/etc/mysql/conf.d
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  mysql_data:
  redis_data:
```

## 📊 모니터링 설정

### 1. Prometheus 메트릭 수집

```javascript
// metrics.js
const prometheus = require('prom-client');

// 기본 메트릭 수집
const register = new prometheus.Registry();
prometheus.collectDefaultMetrics({ register });

// 커스텀 메트릭
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const activeConnections = new prometheus.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections'
});

const jobQueueSize = new prometheus.Gauge({
  name: 'job_queue_size',
  help: 'Number of jobs in queue',
  labelNames: ['queue_name']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(activeConnections);
register.registerMetric(jobQueueSize);

module.exports = { register, httpRequestDuration, activeConnections, jobQueueSize };
```

### 2. Grafana 대시보드 설정

```json
{
  "dashboard": {
    "title": "Gatrix Production Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Active Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "websocket_connections_active"
          }
        ]
      },
      {
        "title": "Job Queue Size",
        "type": "graph",
        "targets": [
          {
            "expr": "job_queue_size",
            "legendFormat": "{{queue_name}}"
          }
        ]
      }
    ]
  }
}
```

## 🔒 보안 강화

### 1. SSL/TLS 설정

```nginx
# nginx.conf
server {
    listen 80;
    server_name gatrix.com www.gatrix.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name gatrix.com www.gatrix.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # 보안 헤더
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://chat-server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. 데이터베이스 보안

```sql
-- MySQL 보안 설정
-- 루트 사용자 비밀번호 변경
ALTER USER 'root'@'localhost' IDENTIFIED BY 'strong_password_here';

-- 불필요한 사용자 제거
DROP USER IF EXISTS ''@'localhost';
DROP USER IF EXISTS ''@'%';

-- 데이터베이스별 사용자 생성
CREATE USER 'gatrix_app'@'%' IDENTIFIED BY 'app_password';
CREATE USER 'gatrix_readonly'@'%' IDENTIFIED BY 'readonly_password';

-- 권한 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON gatrix.* TO 'gatrix_app'@'%';
GRANT SELECT ON gatrix.* TO 'gatrix_readonly'@'%';

-- 원격 루트 접근 비활성화
DELETE FROM mysql.user WHERE User='root' AND Host='%';
FLUSH PRIVILEGES;
```

## 🚨 로깅 및 알림

### 1. 구조화된 로깅

```javascript
// logger.js
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    }),
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    })
  ]
});

// 프로덕션에서는 콘솔 로그 제거
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

### 2. 알림 시스템

```javascript
// notification.js
const nodemailer = require('nodemailer');
const axios = require('axios');

class NotificationService {
  constructor() {
    this.emailTransporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async sendCriticalAlert(message, details = {}) {
    // 이메일 알림
    await this.sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `[CRITICAL] Gatrix Alert: ${message}`,
      html: `
        <h2>Critical Alert</h2>
        <p><strong>Message:</strong> ${message}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p><strong>Details:</strong></p>
        <pre>${JSON.stringify(details, null, 2)}</pre>
      `
    });

    // Slack 알림
    await this.sendSlackNotification({
      text: `🚨 *Critical Alert*: ${message}`,
      attachments: [{
        color: 'danger',
        fields: [
          { title: 'Time', value: new Date().toISOString(), short: true },
          { title: 'Details', value: JSON.stringify(details), short: false }
        ]
      }]
    });
  }

  async sendEmail({ to, subject, html }) {
    return this.emailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html
    });
  }

  async sendSlackNotification(payload) {
    return axios.post(process.env.SLACK_WEBHOOK_URL, payload);
  }
}

module.exports = new NotificationService();
```

## 🔄 백업 및 복구

### 1. 자동 백업 스크립트

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/gatrix"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="gatrix"
DB_USER="gatrix_app"
DB_PASS="app_password"

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

# 데이터베이스 백업
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/db_$DATE.sql

# Redis 백업
redis-cli --rdb $BACKUP_DIR/redis_$DATE.rdb

# 애플리케이션 파일 백업
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /app/dist /app/uploads

# 오래된 백업 파일 삭제 (7일 이상)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### 2. 복구 스크립트

```bash
#!/bin/bash
# restore.sh

BACKUP_DIR="/backups/gatrix"
BACKUP_DATE=$1

if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: $0 <backup_date>"
    echo "Available backups:"
    ls -la $BACKUP_DIR/*.sql | awk '{print $9}' | sed 's/.*db_//' | sed 's/\.sql//'
    exit 1
fi

DB_NAME="gatrix"
DB_USER="gatrix_app"
DB_PASS="app_password"

# 데이터베이스 복구
mysql -u $DB_USER -p$DB_PASS $DB_NAME < $BACKUP_DIR/db_$BACKUP_DATE.sql

# Redis 복구
redis-cli --rdb $BACKUP_DIR/redis_$BACKUP_DATE.rdb

# 애플리케이션 파일 복구
tar -xzf $BACKUP_DIR/app_$BACKUP_DATE.tar.gz -C /

echo "Restore completed: $BACKUP_DATE"
```

## 📈 성능 최적화

### 1. 캐시 전략

```javascript
// cache-strategy.js
const Redis = require('ioredis');

class CacheStrategy {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
  }

  // 캐시 키 전략
  getCacheKey(type, identifier, params = {}) {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    
    return `gatrix:${type}:${identifier}:${paramString}`;
  }

  // 캐시 설정
  async set(key, value, ttl = 3600) {
    const serialized = JSON.stringify(value);
    return this.redis.setex(key, ttl, serialized);
  }

  // 캐시 조회
  async get(key) {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  // 캐시 무효화
  async invalidate(pattern) {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      return this.redis.del(...keys);
    }
  }
}

module.exports = new CacheStrategy();
```

### 2. 데이터베이스 최적화

```sql
-- 인덱스 최적화
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_messages_channel_id ON messages(channel_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_scheduled_at ON jobs(scheduled_at);

-- 파티셔닝 (메시지 테이블)
ALTER TABLE messages PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p2026 VALUES LESS THAN (2027)
);
```

## 🎯 결론

이 가이드를 따라 Gatrix를 프로덕션에 배포하면:

1. **안정성**: 모니터링과 알림으로 문제를 빠르게 감지
2. **보안성**: 다층 보안으로 시스템을 보호
3. **확장성**: 캐시와 최적화로 성능 향상
4. **복구성**: 백업과 복구로 데이터 보호

이러한 베스트 프랙티스를 적용하여 안정적이고 확장 가능한 게임 플랫폼을 구축하세요!

---

**관련 자료**:
- [Docker 설정 가이드](/docs/deployment/docker)
- [모니터링 설정](/docs/monitoring/setup)
- [GitHub 저장소](https://github.com/motifgames/gatrix)
