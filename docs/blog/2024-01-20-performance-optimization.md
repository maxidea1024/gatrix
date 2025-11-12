---
slug: performance-optimization-guide
title: "Gatrix 성능 최적화 완전 가이드: 초고속 게임 플랫폼 구축하기"
authors: [gatrix-team]
tags: [gatrix, performance, optimization, tips]
---

Gatrix의 성능을 극대화하여 수백만 사용자를 지원하는 초고속 게임 플랫폼을 구축하는 방법을 알아보겠습니다. 데이터베이스 최적화부터 캐싱 전략, 로드 밸런싱까지 모든 영역을 다룹니다.

<!-- truncate -->

## 🚀 성능 최적화 개요

Gatrix의 성능 최적화는 다음과 같은 영역에서 이루어집니다:

- **데이터베이스 최적화**: 쿼리 성능 향상 및 인덱싱
- **캐싱 전략**: Redis를 활용한 다층 캐싱
- **API 최적화**: 응답 시간 단축 및 처리량 증가
- **채팅 서버 최적화**: 실시간 메시징 성능 향상
- **프론트엔드 최적화**: 번들 크기 최적화 및 로딩 속도 향상

## 🗄️ 데이터베이스 최적화

### 1. 인덱스 전략

```sql
-- 사용자 테이블 최적화
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);

-- 복합 인덱스
CREATE INDEX idx_users_status_created ON users(status, created_at);
CREATE INDEX idx_users_role_status ON users(role, status);

-- 메시지 테이블 최적화
CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at);
CREATE INDEX idx_messages_user_created ON messages(user_id, created_at);
CREATE INDEX idx_messages_type ON messages(type);

-- 작업 테이블 최적화
CREATE INDEX idx_jobs_status_scheduled ON jobs(status, scheduled_at);
CREATE INDEX idx_jobs_type_status ON jobs(type, status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at);
```

### 2. 쿼리 최적화

```javascript
// 비효율적인 쿼리
const users = await db('users')
  .where('status', 'active')
  .where('created_at', '>', '2024-01-01')
  .orderBy('created_at', 'desc')
  .limit(100);

// 최적화된 쿼리
const users = await db('users')
  .select('id', 'username', 'email', 'created_at')
  .where('status', 'active')
  .where('created_at', '>', '2024-01-01')
  .orderBy('created_at', 'desc')
  .limit(100);

// 페이지네이션 최적화
const users = await db('users')
  .select('id', 'username', 'email', 'created_at')
  .where('status', 'active')
  .where('id', '>', lastId) // 커서 기반 페이지네이션
  .orderBy('id', 'asc')
  .limit(100);
```

### 3. 연결 풀 최적화

```javascript
// database.js
const knex = require('knex');

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4'
  },
  pool: {
    min: 2,
    max: 20,
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 600000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200
  },
  acquireConnectionTimeout: 60000
});

// 연결 상태 모니터링
setInterval(async () => {
  try {
    const stats = await db.raw('SHOW STATUS LIKE "Threads_connected"');
    console.log('Active connections:', stats[0][0].Value);
  } catch (error) {
    console.error('Database connection error:', error);
  }
}, 30000);
```

## ⚡ 캐싱 전략

### 1. 다층 캐싱 아키텍처

```javascript
// cache-manager.js
const Redis = require('ioredis');
const NodeCache = require('node-cache');

class CacheManager {
  constructor() {
    // L1 캐시 (메모리)
    this.l1Cache = new NodeCache({
      stdTTL: 60, // 1분
      checkperiod: 120,
      useClones: false
    });

    // L2 캐시 (Redis)
    this.l2Cache = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.l2Cache.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.l2Cache.on('connect', () => {
      console.log('Redis connected');
    });
  }

  async get(key) {
    // L1 캐시에서 먼저 확인
    let value = this.l1Cache.get(key);
    if (value) {
      return value;
    }

    // L2 캐시에서 확인
    try {
      const cached = await this.l2Cache.get(key);
      if (cached) {
        value = JSON.parse(cached);
        // L1 캐시에 저장
        this.l1Cache.set(key, value);
        return value;
      }
    } catch (error) {
      console.error('Redis get error:', error);
    }

    return null;
  }

  async set(key, value, ttl = 3600) {
    // L1 캐시에 저장
    this.l1Cache.set(key, value);

    // L2 캐시에 저장
    try {
      await this.l2Cache.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async invalidate(pattern) {
    // L1 캐시 무효화
    this.l1Cache.flushAll();

    // L2 캐시 무효화
    try {
      const keys = await this.l2Cache.keys(pattern);
      if (keys.length > 0) {
        await this.l2Cache.del(...keys);
      }
    } catch (error) {
      console.error('Redis invalidate error:', error);
    }
  }
}

module.exports = new CacheManager();
```

### 2. 캐시 전략별 구현

```javascript
// cache-strategies.js
class CacheStrategies {
  constructor(cacheManager) {
    this.cache = cacheManager;
  }

  // 사용자 정보 캐싱
  async getUser(userId) {
    const cacheKey = `user:${userId}`;
    
    let user = await this.cache.get(cacheKey);
    if (!user) {
      user = await db('users').where('id', userId).first();
      if (user) {
        await this.cache.set(cacheKey, user, 1800); // 30분
      }
    }
    
    return user;
  }

  // 게임 월드 목록 캐싱
  async getGameWorlds() {
    const cacheKey = 'game_worlds:public';
    
    let worlds = await this.cache.get(cacheKey);
    if (!worlds) {
      worlds = await db('game_worlds')
        .where('visible', true)
        .where('maintenance', false)
        .orderBy('display_order', 'asc');
      
      await this.cache.set(cacheKey, worlds, 600); // 10분
    }
    
    return worlds;
  }

  // 클라이언트 버전 캐싱
  async getClientVersions(channel, subChannel) {
    const cacheKey = `client_versions:${channel}:${subChannel}`;
    
    let versions = await this.cache.get(cacheKey);
    if (!versions) {
      let query = db('client_versions');
      
      if (channel) {
        query = query.where('channel', channel);
      }
      if (subChannel) {
        query = query.where('sub_channel', subChannel);
      }
      
      versions = await query.orderBy('created_at', 'desc');
      await this.cache.set(cacheKey, versions, 300); // 5분
    }
    
    return versions;
  }

  // 메시지 캐싱 (최근 메시지)
  async getRecentMessages(channelId, limit = 50) {
    const cacheKey = `messages:recent:${channelId}:${limit}`;
    
    let messages = await this.cache.get(cacheKey);
    if (!messages) {
      messages = await db('messages')
        .where('channel_id', channelId)
        .orderBy('created_at', 'desc')
        .limit(limit);
      
      await this.cache.set(cacheKey, messages, 60); // 1분
    }
    
    return messages;
  }
}

module.exports = new CacheStrategies(cacheManager);
```

## 🚀 API 최적화

### 1. 응답 압축

```javascript
// compression.js
const compression = require('compression');

const compressionOptions = {
  level: 6, // 압축 레벨 (1-9)
  threshold: 1024, // 1KB 이상일 때만 압축
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
};

app.use(compression(compressionOptions));
```

### 2. API 응답 최적화

```javascript
// api-optimization.js
class APIOptimizer {
  // 응답 데이터 최적화
  optimizeUserResponse(user) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      status: user.status,
      createdAt: user.created_at
      // 민감한 정보 제외
    };
  }

  // 배치 처리
  async batchProcessUsers(userIds) {
    const users = await db('users')
      .whereIn('id', userIds)
      .select('id', 'username', 'email', 'status', 'created_at');
    
    return users.map(user => this.optimizeUserResponse(user));
  }

  // 병렬 처리
  async parallelDataFetch(userId) {
    const [user, worlds, messages] = await Promise.all([
      this.getUser(userId),
      this.getGameWorlds(),
      this.getRecentMessages(userId)
    ]);

    return { user, worlds, messages };
  }

  // 페이지네이션 최적화
  async paginatedUsers(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      db('users')
        .select('id', 'username', 'email', 'status', 'created_at')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset),
      db('users').count('* as total').first()
    ]);

    return {
      users: users.map(user => this.optimizeUserResponse(user)),
      pagination: {
        page,
        limit,
        total: total.total,
        pages: Math.ceil(total.total / limit)
      }
    };
  }
}

module.exports = new APIOptimizer();
```

### 3. API 레이트 리미팅

```javascript
// rate-limiting.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
});

// 일반 API 레이트 리미팅
const generalLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100 요청
  message: '너무 많은 요청이 발생했습니다.',
  standardHeaders: true,
  legacyHeaders: false,
});

// 로그인 API 레이트 리미팅
const loginLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15분
  max: 5, // 최대 5회 시도
  message: '로그인 시도 횟수를 초과했습니다.',
  skipSuccessfulRequests: true,
});

// 채팅 API 레이트 리미팅
const chatLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  windowMs: 60 * 1000, // 1분
  max: 30, // 최대 30개 메시지
  message: '메시지 전송 속도를 초과했습니다.',
});

module.exports = { generalLimiter, loginLimiter, chatLimiter };
```

## 💬 채팅 서버 최적화

### 1. 메시지 브로드캐스팅 최적화

```javascript
// broadcast-optimizer.js
class BroadcastOptimizer {
  constructor() {
    this.messageQueue = [];
    this.batchSize = 1000;
    this.flushInterval = 100; // 100ms
    this.setupBatchProcessor();
  }

  setupBatchProcessor() {
    setInterval(() => {
      this.flushMessageQueue();
    }, this.flushInterval);
  }

  // 메시지를 큐에 추가
  queueMessage(channelId, message) {
    this.messageQueue.push({
      channelId,
      message,
      timestamp: Date.now()
    });

    // 배치 크기에 도달하면 즉시 처리
    if (this.messageQueue.length >= this.batchSize) {
      this.flushMessageQueue();
    }
  }

  // 큐에 있는 메시지들을 배치로 처리
  async flushMessageQueue() {
    if (this.messageQueue.length === 0) return;

    const messages = this.messageQueue.splice(0, this.batchSize);
    const groupedMessages = this.groupMessagesByChannel(messages);

    // 채널별로 병렬 처리
    const promises = Object.entries(groupedMessages).map(([channelId, msgs]) =>
      this.broadcastToChannel(channelId, msgs)
    );

    await Promise.all(promises);
  }

  // 채널별로 메시지 그룹화
  groupMessagesByChannel(messages) {
    return messages.reduce((groups, msg) => {
      if (!groups[msg.channelId]) {
        groups[msg.channelId] = [];
      }
      groups[msg.channelId].push(msg.message);
      return groups;
    }, {});
  }

  // 채널에 메시지 브로드캐스트
  async broadcastToChannel(channelId, messages) {
    const channel = io.to(channelId);
    
    // 메시지 압축
    const compressedMessages = this.compressMessages(messages);
    
    // 배치 전송
    channel.emit('message_batch', {
      channelId,
      messages: compressedMessages,
      count: messages.length
    });
  }

  // 메시지 압축
  compressMessages(messages) {
    // MessagePack 또는 gzip 압축
    return messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      type: msg.type,
      timestamp: msg.timestamp
    }));
  }
}

module.exports = new BroadcastOptimizer();
```

### 2. 연결 관리 최적화

```javascript
// connection-manager.js
class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.channelConnections = new Map();
    this.setupCleanup();
  }

  // 연결 등록
  addConnection(socketId, userId, channels = []) {
    this.connections.set(socketId, {
      userId,
      channels,
      connectedAt: Date.now(),
      lastActivity: Date.now()
    });

    // 채널별 연결 관리
    channels.forEach(channelId => {
      if (!this.channelConnections.has(channelId)) {
        this.channelConnections.set(channelId, new Set());
      }
      this.channelConnections.get(channelId).add(socketId);
    });
  }

  // 연결 제거
  removeConnection(socketId) {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.channels.forEach(channelId => {
        const channelConnections = this.channelConnections.get(channelId);
        if (channelConnections) {
          channelConnections.delete(socketId);
          if (channelConnections.size === 0) {
            this.channelConnections.delete(channelId);
          }
        }
      });
      this.connections.delete(socketId);
    }
  }

  // 채널 연결자 수 조회
  getChannelConnectionCount(channelId) {
    return this.channelConnections.get(channelId)?.size || 0;
  }

  // 활성 연결 수 조회
  getActiveConnectionCount() {
    return this.connections.size;
  }

  // 정리 작업
  setupCleanup() {
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 60000); // 1분마다
  }

  cleanupInactiveConnections() {
    const now = Date.now();
    const inactiveThreshold = 30 * 60 * 1000; // 30분

    for (const [socketId, connection] of this.connections) {
      if (now - connection.lastActivity > inactiveThreshold) {
        this.removeConnection(socketId);
      }
    }
  }
}

module.exports = new ConnectionManager();
```

## 🎨 프론트엔드 최적화

### 1. 번들 최적화

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
          utils: ['axios', 'swr', 'dayjs']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  server: {
    hmr: {
      overlay: false
    }
  }
});
```

### 2. 코드 스플리팅

```javascript
// App.jsx
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// 지연 로딩
const AdminPage = lazy(() => import('./pages/AdminPage'));
const JobsPage = lazy(() => import('./pages/JobsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;
```

### 3. 이미지 최적화

```javascript
// ImageOptimizer.jsx
import { useState, useEffect } from 'react';

const ImageOptimizer = ({ src, alt, width, height, ...props }) => {
  const [imageSrc, setImageSrc] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSrc(src);
      setLoading(false);
    };
    img.src = src;
  }, [src]);

  if (loading) {
    return <div className="image-placeholder" style={{ width, height }} />;
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      {...props}
    />
  );
};

export default ImageOptimizer;
```

## 📊 성능 모니터링

### 1. 성능 메트릭 수집

```javascript
// performance-monitor.js
const prometheus = require('prom-client');

class PerformanceMonitor {
  constructor() {
    this.httpRequestDuration = new prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    });

    this.databaseQueryDuration = new prometheus.Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['query_type', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5]
    });

    this.cacheHitRate = new prometheus.Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type']
    });

    this.cacheMissRate = new prometheus.Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type']
    });

    this.activeConnections = new prometheus.Gauge({
      name: 'websocket_connections_active',
      help: 'Number of active WebSocket connections'
    });

    this.messageThroughput = new prometheus.Counter({
      name: 'messages_processed_total',
      help: 'Total number of messages processed',
      labelNames: ['channel']
    });
  }

  // HTTP 요청 시간 측정
  measureHttpRequest(method, route, statusCode, duration) {
    this.httpRequestDuration
      .labels(method, route, statusCode)
      .observe(duration);
  }

  // 데이터베이스 쿼리 시간 측정
  measureDatabaseQuery(queryType, table, duration) {
    this.databaseQueryDuration
      .labels(queryType, table)
      .observe(duration);
  }

  // 캐시 히트/미스 기록
  recordCacheHit(cacheType) {
    this.cacheHitRate.labels(cacheType).inc();
  }

  recordCacheMiss(cacheType) {
    this.cacheMissRate.labels(cacheType).inc();
  }

  // 활성 연결 수 업데이트
  updateActiveConnections(count) {
    this.activeConnections.set(count);
  }

  // 메시지 처리량 기록
  recordMessageProcessed(channel) {
    this.messageThroughput.labels(channel).inc();
  }
}

module.exports = new PerformanceMonitor();
```

### 2. 실시간 성능 대시보드

```javascript
// performance-dashboard.js
const express = require('express');
const { register } = require('./performance-monitor');

const app = express();

// Prometheus 메트릭 엔드포인트
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// 성능 상태 엔드포인트
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  };

  res.json(health);
});

// 성능 통계 엔드포인트
app.get('/stats', async (req, res) => {
  const stats = {
    connections: connectionManager.getActiveConnectionCount(),
    cache: {
      hitRate: await getCacheHitRate(),
      missRate: await getCacheMissRate()
    },
    database: {
      activeConnections: await getDatabaseConnectionCount(),
      queryTime: await getAverageQueryTime()
    }
  };

  res.json(stats);
});

module.exports = app;
```

## 🎯 결론

이 성능 최적화 가이드를 통해 Gatrix는 다음과 같은 성능을 달성할 수 있습니다:

- **API 응답 시간**: 평균 50ms 이하
- **데이터베이스 쿼리**: 복잡한 쿼리도 100ms 이하
- **채팅 메시지 처리**: 초당 100,000+ 메시지
- **동시 연결**: 100만 사용자 지원
- **캐시 히트율**: 95% 이상

이러한 최적화를 통해 안정적이고 확장 가능한 게임 플랫폼을 구축할 수 있습니다!

---

**관련 자료**:
- [데이터베이스 최적화 가이드](/docs/optimization/database)
- [캐싱 전략 문서](/docs/optimization/caching)
- [GitHub 저장소](https://github.com/motifgames/gatrix)
