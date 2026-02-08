# Analytics Server 통합 계획 (Detailed Integration Plan)

> **작성일**: 2025-10-02  
> **목적**: Gatrix 프로젝트에 OpenPanel 스타일의 Analytics Server를 chat-server처럼 별도 서버로 추가

---

## 📋 목차

1. [프로젝트 구조 분석](#1-프로젝트-구조-분석)
2. [Analytics Server 아키텍처](#2-analytics-server-아키텍처)
3. [구현 계획](#3-구현-계획)
4. [단계별 구현 가이드](#4-단계별-구현-가이드)
5. [Proxy 설정](#5-proxy-설정)
6. [데이터베이스 설계](#6-데이터베이스-설계)
7. [배포 전략](#7-배포-전략)

---

## 1. 프로젝트 구조 분석

### 1.1 현재 Gatrix 구조

```
gatrix/
├── packages/
│   ├── backend/          # Express 기반 메인 API (포트: 5000)
│   ├── chat-server/      # Socket.io 기반 채팅 서버 (포트: 3001)
│   ├── frontend/         # React + Vite 프론트엔드
│   └── sdks/            # SDK 모음
├── docker-compose.yml    # 인프라 설정
└── package.json         # Monorepo 설정
```

### 1.2 Chat Server 참고 구조

```
packages/chat-server/
├── src/
│   ├── app.ts           # Express + Socket.io 앱
│   ├── index.ts         # 서버 진입점
│   ├── cluster.ts       # 클러스터링
│   ├── config/          # 설정
│   ├── controllers/     # 컨트롤러
│   ├── middleware/      # 미들웨어
│   ├── models/          # 데이터 모델
│   ├── routes/          # REST API 라우트
│   └── services/        # 비즈니스 로직
├── migrations/          # DB 마이그레이션
├── Dockerfile
├── package.json
└── tsconfig.json
```

### 1.3 Backend의 Chat Proxy 구조

<augment_code_snippet path="packages/backend/src/app.ts" mode="EXCERPT">

```typescript
// Chat proxy routes - MUST be before body parsing
import chatRoutes from './routes/chat';
app.use('/api/v1/chat', chatRoutes);
```

</augment_code_snippet>

**핵심 패턴**: Backend가 `/api/v1/chat`로 들어오는 요청을 chat-server로 프록시

---

## 2. Analytics Server 아키텍처

### 2.1 전체 시스템 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  - 대시보드 UI                                                    │
│  - Analytics SDK 통합                                            │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Express) :5000                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Proxy Routes                                            │   │
│  │  - /api/v1/chat/*      → chat-server:3001              │   │
│  │  - /api/v1/analytics/* → analytics-server:3002         │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────┬────────────────────────────────────────────────────┘
             │
             ├─────────────────┬─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Chat Server     │  │ Analytics Server │  │  Main Backend    │
│  :3001           │  │  :3002           │  │  :5000           │
│                  │  │                  │  │                  │
│  - Socket.io     │  │  - Fastify       │  │  - Express       │
│  - Real-time     │  │  - Event API     │  │  - REST API      │
│    messaging     │  │  - Worker        │  │  - Auth          │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                      │
         └─────────────────────┼──────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   MySQL      │      │  ClickHouse  │      │    Redis     │
│              │      │              │      │              │
│  - Users     │      │  - Events    │      │  - Cache     │
│  - Projects  │      │  - Profiles  │      │  - Queue     │
│  - Chat      │      │  - Sessions  │      │  - Pub/Sub   │
└──────────────┘      └──────────────┘      └──────────────┘
```

### 2.2 Analytics Server 역할

#### **Event API (Fastify)**

- **포트**: 3002
- **역할**: 이벤트 수집 및 초기 처리
- **엔드포인트**:
  - `POST /track` - 이벤트 추적
  - `POST /identify` - 사용자 식별
  - `POST /increment` - 프로필 속성 증가
  - `POST /decrement` - 프로필 속성 감소

#### **Insights API (tRPC)**

- **포트**: 3002 (동일 서버)
- **역할**: 분석 데이터 조회
- **엔드포인트**:
  - `GET /insights/:projectId/metrics` - 메트릭 조회
  - `GET /insights/:projectId/funnel` - 퍼널 분석
  - `GET /insights/:projectId/retention` - 리텐션 분석
  - `GET /insights/:projectId/live` - 실시간 방문자

#### **Worker (BullMQ)**

- **역할**: 백그라운드 작업 처리
- **작업**:
  - 이벤트 배치 삽입
  - 프로필 업데이트
  - 세션 집계
  - 일별/주별/월별 집계

---

## 3. 구현 계획

### 3.1 디렉토리 구조

```
packages/analytics-server/
├── src/
│   ├── app.ts                    # Fastify 앱 설정
│   ├── index.ts                  # 서버 진입점
│   ├── worker.ts                 # BullMQ Worker
│   │
│   ├── config/
│   │   ├── index.ts              # 환경 변수 설정
│   │   ├── clickhouse.ts         # ClickHouse 연결
│   │   ├── redis.ts              # Redis 연결
│   │   └── bullmq.ts             # BullMQ 큐 설정
│   │
│   ├── routes/
│   │   ├── track.ts              # 이벤트 추적 라우트
│   │   └── insights.ts           # 분석 데이터 라우트
│   │
│   ├── services/
│   │   ├── event-processor.ts    # 이벤트 처리
│   │   ├── event-normalizer.ts   # 이벤트 정규화
│   │   ├── geoip.ts              # GeoIP 조회
│   │   ├── metrics.ts            # 메트릭 계산
│   │   ├── funnel.ts             # 퍼널 분석
│   │   ├── retention.ts          # 리텐션 분석
│   │   └── profile.ts            # 프로필 관리
│   │
│   ├── workers/
│   │   ├── event-worker.ts       # 이벤트 처리 워커
│   │   ├── profile-worker.ts     # 프로필 업데이트 워커
│   │   ├── session-worker.ts     # 세션 집계 워커
│   │   └── aggregation-worker.ts # 집계 워커
│   │
│   ├── middleware/
│   │   ├── auth.ts               # 클라이언트 인증
│   │   ├── rate-limit.ts         # Rate Limiting
│   │   └── error-handler.ts      # 에러 핸들링
│   │
│   ├── models/
│   │   ├── event.ts              # 이벤트 모델
│   │   ├── profile.ts            # 프로필 모델
│   │   └── session.ts            # 세션 모델
│   │
│   ├── utils/
│   │   ├── validation.ts         # Zod 스키마
│   │   └── logger.ts             # 로깅
│   │
│   └── types/
│       └── index.ts              # TypeScript 타입
│
├── migrations/
│   ├── clickhouse/
│   │   ├── 001_create_events_table.sql
│   │   ├── 002_create_profiles_table.sql
│   │   ├── 003_create_sessions_table.sql
│   │   └── 004_create_materialized_views.sql
│   └── mysql/
│       ├── 001_create_analytics_projects.sql
│       └── 002_create_analytics_clients.sql
│
├── scripts/
│   ├── setup-clickhouse.sh       # ClickHouse 초기화
│   └── seed-test-data.ts         # 테스트 데이터
│
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

### 3.2 기술 스택

| 레이어            | 기술       | 이유                            |
| ----------------- | ---------- | ------------------------------- |
| **API Framework** | Fastify    | 고성능, 낮은 오버헤드           |
| **Worker**        | BullMQ     | Redis 기반 큐, 재시도 로직      |
| **Event DB**      | ClickHouse | 컬럼 기반, 시계열 데이터 최적화 |
| **Metadata DB**   | MySQL      | 기존 Gatrix DB 활용             |
| **Cache/Queue**   | Redis      | 기존 인프라 활용                |
| **Validation**    | Zod        | 타입 안전성                     |
| **Logging**       | Winston    | 구조화된 로깅                   |

---

## 4. 단계별 구현 가이드

### Phase 1: 기본 인프라 설정 (1주)

#### Step 1.1: Analytics Server 프로젝트 생성

```bash
# 프로젝트 생성
mkdir -p packages/analytics-server
cd packages/analytics-server

# package.json 생성
npm init -y

# 의존성 설치
npm install fastify @fastify/cors @fastify/helmet @fastify/rate-limit
npm install bullmq ioredis @clickhouse/client
npm install zod winston dotenv
npm install -D typescript @types/node ts-node nodemon
npm install -D @types/express @typescript-eslint/eslint-plugin
```

#### Step 1.2: TypeScript 설정

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### Step 1.3: ClickHouse 설정

```yaml
# docker-compose.yml에 추가
services:
  clickhouse:
    image: clickhouse/clickhouse-server:24.12.2.29-alpine
    container_name: gatrix-clickhouse
    restart: unless-stopped
    ports:
      - '8123:8123' # HTTP
      - '9000:9000' # Native
    volumes:
      - clickhouse_data:/var/lib/clickhouse
      - ./docker/clickhouse/config.xml:/etc/clickhouse-server/config.xml
    networks:
      - gatrix-network
    ulimits:
      nofile:
        soft: 262144
        hard: 262144
    healthcheck:
      test: ['CMD', 'wget', '--spider', '-q', 'http://localhost:8123/ping']
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  clickhouse_data:
    driver: local
```

#### Step 1.4: Analytics Server 서비스 추가

```yaml
# docker-compose.yml에 추가
services:
  analytics-server:
    build:
      context: .
      dockerfile: packages/analytics-server/Dockerfile
    container_name: gatrix-analytics
    restart: unless-stopped
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      PORT: 3002
      CLICKHOUSE_HOST: clickhouse
      CLICKHOUSE_PORT: 8123
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD:-}
      MYSQL_HOST: mysql
      MYSQL_PORT: 3306
      MYSQL_DATABASE: ${DB_NAME:-gatrix}
      MYSQL_USER: ${DB_USER:-gatrix_user}
      MYSQL_PASSWORD: ${DB_PASSWORD:-gatrix_password}
    ports:
      - '3002:3002'
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
      clickhouse:
        condition: service_healthy
    networks:
      - gatrix-network
    volumes:
      - analytics_logs:/app/logs
    healthcheck:
      test: ['CMD', 'wget', '--spider', '-q', 'http://localhost:3002/health']
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  analytics_logs:
    driver: local
```

---

### Phase 2: Event API 구현 (2주)

#### Step 2.1: Fastify 서버 설정

```typescript
// src/app.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import trackRoutes from './routes/track';
import insightsRoutes from './routes/insights';
import { errorHandler } from './middleware/error-handler';

export async function createApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      },
    },
  });

  // CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Security
  await app.register(helmet);

  // Rate Limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Routes
  await app.register(trackRoutes, { prefix: '/track' });
  await app.register(insightsRoutes, { prefix: '/insights' });

  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  // Error handler
  app.setErrorHandler(errorHandler);

  return app;
}
```

#### Step 2.2: 이벤트 추적 라우트

```typescript
// src/routes/track.ts
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { EventProcessor } from '../services/event-processor';
import { authenticateClient } from '../middleware/auth';

const trackSchema = z.object({
  type: z.enum(['track', 'identify', 'increment', 'decrement']),
  payload: z.object({
    name: z.string().optional(),
    profileId: z.string().optional(),
    properties: z.record(z.any()).optional(),
    deviceId: z.string().optional(),
    sessionId: z.string().optional(),
    timestamp: z.string().optional(),
  }),
});

const trackRoutes: FastifyPluginAsync = async (fastify) => {
  const eventProcessor = new EventProcessor();

  fastify.post(
    '/',
    {
      preHandler: authenticateClient,
    },
    async (request, reply) => {
      try {
        const body = trackSchema.parse(request.body);

        const event = {
          ...body.payload,
          projectId: (request as any).client.projectId,
          ip: request.headers['x-client-ip'] || request.ip,
          userAgent: request.headers['user-agent'],
          createdAt: new Date().toISOString(),
        };

        await eventProcessor.process(event);

        return { success: true };
      } catch (error) {
        fastify.log.error(error);
        return reply.code(400).send({ error: 'Invalid request' });
      }
    }
  );
};

export default trackRoutes;
```

---

### Phase 3: Worker 구현 (2주)

#### Step 3.1: BullMQ 큐 설정

```typescript
// src/config/bullmq.ts
import { Queue, Worker } from 'bullmq';
import { redis } from './redis';

export const eventQueue = new Queue('analytics:events', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600,
      count: 1000,
    },
  },
});

export const profileQueue = new Queue('analytics:profiles', {
  connection: redis,
});

export const aggregationQueue = new Queue('analytics:aggregations', {
  connection: redis,
});
```

#### Step 3.2: Event Worker

```typescript
// src/workers/event-worker.ts
import { Worker, Job } from 'bullmq';
import { clickhouse } from '../config/clickhouse';
import { redis } from '../config/redis';

export class EventWorker {
  private worker: Worker;
  private batchSize = 1000;
  private batchTimeout = 5000;
  private batch: any[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    this.worker = new Worker('analytics:events', this.processJob.bind(this), {
      connection: redis,
      concurrency: 10,
    });
  }

  private async processJob(job: Job) {
    const { event } = job.data;

    this.batch.push(event);

    if (this.batch.length >= this.batchSize) {
      await this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.batchTimeout);
    }
  }

  private async flush() {
    if (this.batch.length === 0) return;

    const events = [...this.batch];
    this.batch = [];

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    await clickhouse.insert({
      table: 'events',
      values: events,
      format: 'JSONEachRow',
    });
  }
}
```

---

## 5. Proxy 설정

### 5.1 Backend에 Analytics Proxy 추가

```typescript
// packages/backend/src/routes/analytics.ts
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config';

const router = express.Router();

// Analytics Server로 프록시
router.use(
  '/',
  createProxyMiddleware({
    target: config.analyticsServer.url, // http://analytics-server:3002
    changeOrigin: true,
    pathRewrite: {
      '^/api/v1/analytics': '', // /api/v1/analytics/* → /*
    },
    onProxyReq: (proxyReq, req, res) => {
      // 인증 헤더 전달
      if (req.headers.authorization) {
        proxyReq.setHeader('authorization', req.headers.authorization);
      }
    },
    onError: (err, req, res) => {
      console.error('Analytics proxy error:', err);
      res.status(500).json({ error: 'Analytics service unavailable' });
    },
  })
);

export default router;
```

### 5.2 Backend app.ts에 등록

```typescript
// packages/backend/src/app.ts (추가)

// Analytics proxy routes - MUST be before body parsing
import analyticsRoutes from './routes/analytics';
app.use('/api/v1/analytics', analyticsRoutes);
```

---

## 6. 데이터베이스 설계

### 6.1 MySQL (메타데이터)

```sql
-- Analytics 프로젝트 테이블
CREATE TABLE analytics_projects (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  user_id INT NOT NULL,
  settings JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Analytics 클라이언트 (API 키)
CREATE TABLE analytics_clients (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('write', 'read', 'root') NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  secret VARCHAR(255) NOT NULL,
  cors JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES analytics_projects(id)
);
```

### 6.2 ClickHouse (이벤트 데이터)

```sql
-- 이벤트 테이블
CREATE TABLE events (
  id UUID DEFAULT generateUUIDv4(),
  project_id String,
  name String,
  device_id String,
  profile_id Nullable(String),
  session_id String,
  created_at DateTime DEFAULT now(),
  timestamp DateTime,
  country Nullable(String),
  city Nullable(String),
  os Nullable(String),
  browser Nullable(String),
  path Nullable(String),
  referrer Nullable(String),
  properties String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (project_id, created_at, device_id)
SETTINGS index_granularity = 8192;
```

---

## 7. 배포 전략

### 7.1 개발 환경

```bash
# 전체 서비스 실행
docker-compose up -d

# Analytics Server만 재시작
docker-compose restart analytics-server

# 로그 확인
docker-compose logs -f analytics-server
```

### 7.2 프로덕션 배포

```bash
# 빌드
docker-compose build analytics-server

# 배포
docker-compose up -d analytics-server
```

---

## 8. 예상 일정

| Phase    | 기간     | 작업                             |
| -------- | -------- | -------------------------------- |
| Phase 1  | 1주      | 인프라 설정, ClickHouse 추가     |
| Phase 2  | 2주      | Event API 구현                   |
| Phase 3  | 2주      | Worker 구현                      |
| Phase 4  | 3주      | 분석 엔진 (메트릭, 퍼널, 리텐션) |
| Phase 5  | 2주      | Frontend 통합                    |
| **총계** | **10주** | **약 2.5개월**                   |

---

## 9. 상세 구현 예제

### 9.1 완전한 package.json

```json
{
  "name": "@gatrix/analytics-server",
  "version": "1.0.0",
  "description": "Gatrix Analytics Server - Event tracking and analytics",
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon src/index.ts",
    "dev:worker": "nodemon src/worker.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "start:worker": "node dist/worker.js",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "migrate:clickhouse": "node scripts/migrate-clickhouse.js",
    "migrate:mysql": "node scripts/migrate-mysql.js"
  },
  "dependencies": {
    "@clickhouse/client": "^1.0.0",
    "@fastify/cors": "^8.4.2",
    "@fastify/helmet": "^11.1.1",
    "@fastify/rate-limit": "^9.1.0",
    "bullmq": "^5.0.0",
    "dotenv": "^16.3.1",
    "fastify": "^4.25.0",
    "ioredis": "^5.3.2",
    "maxmind": "^4.3.11",
    "mysql2": "^3.15.0",
    "ua-parser-js": "^1.0.37",
    "winston": "^3.11.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.10.4",
    "@types/ua-parser-js": "^0.7.39",
    "@typescript-eslint/eslint-plugin": "^6.13.1",
    "@typescript-eslint/parser": "^6.13.1",
    "eslint": "^8.54.0",
    "jest": "^29.7.0",
    "nodemon": "^3.0.2",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.1",
    "typescript": "^5.3.2"
  }
}
```

### 9.2 환경 변수 설정

```typescript
// src/config/index.ts
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  // ClickHouse
  clickhouse: {
    host: process.env.CLICKHOUSE_HOST || 'localhost',
    port: parseInt(process.env.CLICKHOUSE_PORT || '8123', 10),
    database: process.env.CLICKHOUSE_DATABASE || 'analytics',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // MySQL
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    database: process.env.MYSQL_DATABASE || 'gatrix',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
  },

  // Worker
  worker: {
    batchSize: parseInt(process.env.WORKER_BATCH_SIZE || '1000', 10),
    batchTimeout: parseInt(process.env.WORKER_BATCH_TIMEOUT || '5000', 10),
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10', 10),
  },
};
```

### 9.3 ClickHouse 연결

```typescript
// src/config/clickhouse.ts
import { createClient } from '@clickhouse/client';
import { config } from './index';

export const clickhouse = createClient({
  host: `http://${config.clickhouse.host}:${config.clickhouse.port}`,
  database: config.clickhouse.database,
  username: config.clickhouse.username,
  password: config.clickhouse.password,
  compression: {
    request: true,
    response: true,
  },
});

// 연결 테스트
export async function testClickHouseConnection() {
  try {
    const result = await clickhouse.query({
      query: 'SELECT 1',
    });
    console.log('✅ ClickHouse connected successfully');
    return true;
  } catch (error) {
    console.error('❌ ClickHouse connection failed:', error);
    return false;
  }
}
```

### 9.4 이벤트 정규화 서비스

```typescript
// src/services/event-normalizer.ts
import UAParser from 'ua-parser-js';
import { Reader } from 'maxmind';

export class EventNormalizer {
  private geoipReader: Reader | null = null;

  constructor() {
    this.initGeoIP();
  }

  private async initGeoIP() {
    try {
      // MaxMind GeoLite2 데이터베이스 로드
      this.geoipReader = await Reader.open('./data/GeoLite2-City.mmdb');
    } catch (error) {
      console.warn('GeoIP database not found, skipping geo lookup');
    }
  }

  normalize(rawEvent: any): any {
    // 1. User-Agent 파싱
    const ua = new UAParser(rawEvent.userAgent);
    const browser = ua.getBrowser();
    const os = ua.getOS();
    const device = ua.getDevice();

    // 2. GeoIP 조회
    let geo = {};
    if (this.geoipReader && rawEvent.ip) {
      try {
        const geoData = this.geoipReader.city(rawEvent.ip);
        geo = {
          country: geoData?.country?.iso_code,
          city: geoData?.city?.names?.en,
          region: geoData?.subdivisions?.[0]?.names?.en,
          latitude: geoData?.location?.latitude,
          longitude: geoData?.location?.longitude,
        };
      } catch (error) {
        // IP 조회 실패 시 무시
      }
    }

    // 3. 타임스탬프 정규화
    const timestamp = rawEvent.timestamp
      ? new Date(rawEvent.timestamp).toISOString()
      : new Date().toISOString();

    // 4. 경로 정규화
    const path = this.normalizePath(rawEvent.path);

    // 5. Referrer 분류
    const { referrerName, referrerType } = this.classifyReferrer(rawEvent.referrer);

    return {
      ...rawEvent,
      timestamp,
      path,
      browser: browser.name,
      browserVersion: browser.version,
      os: os.name,
      osVersion: os.version,
      device: this.getDeviceType(device.type),
      brand: device.vendor,
      model: device.model,
      referrerName,
      referrerType,
      ...geo,
      properties: JSON.stringify(rawEvent.properties || {}),
    };
  }

  private normalizePath(path?: string): string {
    if (!path) return '/';

    try {
      const url = new URL(path, 'http://dummy.com');
      return url.pathname;
    } catch {
      return path;
    }
  }

  private classifyReferrer(referrer?: string): {
    referrerName: string | null;
    referrerType: string | null;
  } {
    if (!referrer) {
      return { referrerName: null, referrerType: 'direct' };
    }

    try {
      const url = new URL(referrer);
      const hostname = url.hostname;

      // 검색 엔진
      const searchEngines = ['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'naver'];
      if (searchEngines.some((engine) => hostname.includes(engine))) {
        return { referrerName: hostname, referrerType: 'search' };
      }

      // 소셜 미디어
      const socialMedia = ['facebook', 'twitter', 'linkedin', 'instagram', 'reddit'];
      if (socialMedia.some((social) => hostname.includes(social))) {
        return { referrerName: hostname, referrerType: 'social' };
      }

      // 광고
      if (url.searchParams.has('utm_source') || url.searchParams.has('gclid')) {
        return { referrerName: hostname, referrerType: 'ad' };
      }

      return { referrerName: hostname, referrerType: 'other' };
    } catch {
      return { referrerName: null, referrerType: 'other' };
    }
  }

  private getDeviceType(type?: string): string {
    if (!type) return 'desktop';
    if (type === 'mobile') return 'mobile';
    if (type === 'tablet') return 'tablet';
    return 'desktop';
  }
}
```

### 9.5 메트릭 서비스

```typescript
// src/services/metrics.ts
import { clickhouse } from '../config/clickhouse';

export class MetricsService {
  async getMetrics(params: { projectId: string; startDate: string; endDate: string }) {
    const { projectId, startDate, endDate } = params;

    const query = `
      SELECT
        uniq(device_id) as unique_visitors,
        uniq(session_id) as total_sessions,
        countIf(name = 'screen_view') as total_screen_views,
        sum(duration) / total_sessions as avg_session_duration,
        countIf(screen_views = 1) / total_sessions * 100 as bounce_rate
      FROM events
      WHERE project_id = {projectId:String}
        AND created_at >= {startDate:DateTime}
        AND created_at <= {endDate:DateTime}
    `;

    const result = await clickhouse.query({
      query,
      query_params: { projectId, startDate, endDate },
    });

    const data = await result.json();
    return data[0] || {};
  }

  async getTimeSeries(params: {
    projectId: string;
    startDate: string;
    endDate: string;
    interval: 'hour' | 'day' | 'week' | 'month';
  }) {
    const { projectId, startDate, endDate, interval } = params;

    const intervalFunc = {
      hour: 'toStartOfHour',
      day: 'toDate',
      week: 'toMonday',
      month: 'toStartOfMonth',
    }[interval];

    const query = `
      SELECT
        ${intervalFunc}(created_at) as date,
        uniq(device_id) as unique_visitors,
        uniq(session_id) as total_sessions,
        count() as total_events
      FROM events
      WHERE project_id = {projectId:String}
        AND created_at >= {startDate:DateTime}
        AND created_at <= {endDate:DateTime}
      GROUP BY date
      ORDER BY date
    `;

    const result = await clickhouse.query({
      query,
      query_params: { projectId, startDate, endDate },
    });

    return result.json();
  }

  async getTopPages(params: {
    projectId: string;
    startDate: string;
    endDate: string;
    limit?: number;
  }) {
    const { projectId, startDate, endDate, limit = 10 } = params;

    const query = `
      SELECT
        path,
        count() as views,
        uniq(device_id) as unique_visitors
      FROM events
      WHERE project_id = {projectId:String}
        AND created_at >= {startDate:DateTime}
        AND created_at <= {endDate:DateTime}
        AND name = 'screen_view'
        AND path IS NOT NULL
      GROUP BY path
      ORDER BY views DESC
      LIMIT {limit:UInt32}
    `;

    const result = await clickhouse.query({
      query,
      query_params: { projectId, startDate, endDate, limit },
    });

    return result.json();
  }

  async getLiveVisitors(projectId: string) {
    const query = `
      SELECT uniq(device_id) as count
      FROM events
      WHERE project_id = {projectId:String}
        AND created_at >= now() - INTERVAL 5 MINUTE
    `;

    const result = await clickhouse.query({
      query,
      query_params: { projectId },
    });

    const data = await result.json();
    return data[0]?.count || 0;
  }
}
```

### 9.6 클라이언트 인증 미들웨어

```typescript
// src/middleware/auth.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import mysql from 'mysql2/promise';
import { config } from '../config';

let pool: mysql.Pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      database: config.mysql.database,
      user: config.mysql.user,
      password: config.mysql.password,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

export async function authenticateClient(request: FastifyRequest, reply: FastifyReply) {
  const clientId = request.headers['openpanel-client-id'] as string;
  const clientSecret = request.headers['openpanel-client-secret'] as string;

  if (!clientId || !clientSecret) {
    return reply.code(401).send({ error: 'Missing authentication headers' });
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM analytics_clients WHERE id = ? AND secret = ?', [
      clientId,
      clientSecret,
    ]);

    const clients = rows as any[];
    if (clients.length === 0) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // 클라이언트 정보를 request에 추가
    (request as any).client = clients[0];
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Authentication failed' });
  }
}
```

### 9.7 서버 진입점

```typescript
// src/index.ts
import { createApp } from './app';
import { config } from './config';
import { testClickHouseConnection } from './config/clickhouse';

async function start() {
  try {
    // ClickHouse 연결 테스트
    await testClickHouseConnection();

    // Fastify 앱 생성
    const app = await createApp();

    // 서버 시작
    await app.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    console.log(`🚀 Analytics Server running on port ${config.port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
```

### 9.8 Worker 진입점

```typescript
// src/worker.ts
import { EventWorker } from './workers/event-worker';
import { ProfileWorker } from './workers/profile-worker';
import { SessionWorker } from './workers/session-worker';
import { testClickHouseConnection } from './config/clickhouse';

async function start() {
  try {
    // ClickHouse 연결 테스트
    await testClickHouseConnection();

    // Workers 시작
    const eventWorker = new EventWorker();
    const profileWorker = new ProfileWorker();
    const sessionWorker = new SessionWorker();

    console.log('🔧 Analytics Workers started');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Shutting down workers...');
      await eventWorker.close();
      await profileWorker.close();
      await sessionWorker.close();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start workers:', error);
    process.exit(1);
  }
}

start();
```

### 9.9 Dockerfile

```dockerfile
# packages/analytics-server/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci

# 소스 복사 및 빌드
COPY . .
RUN npm run build

# 프로덕션 이미지
FROM node:18-alpine

WORKDIR /app

# 프로덕션 의존성만 설치
COPY package*.json ./
RUN npm ci --only=production

# 빌드된 파일 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --spider -q http://localhost:3002/health || exit 1

EXPOSE 3002

CMD ["node", "dist/index.js"]
```

---

## 10. Frontend 통합

### 10.1 Analytics SDK 설치

```typescript
// packages/frontend/src/lib/analytics.ts
class AnalyticsSDK {
  private clientId: string;
  private apiUrl: string;
  private deviceId: string;
  private sessionId: string;

  constructor(clientId: string, apiUrl: string = '/api/v1/analytics') {
    this.clientId = clientId;
    this.apiUrl = apiUrl;
    this.deviceId = this.getOrCreateDeviceId();
    this.sessionId = this.getOrCreateSessionId();
  }

  track(event: string, properties?: Record<string, any>) {
    return fetch(`${this.apiUrl}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'openpanel-client-id': this.clientId,
      },
      body: JSON.stringify({
        type: 'track',
        payload: {
          name: event,
          deviceId: this.deviceId,
          sessionId: this.sessionId,
          properties,
          timestamp: new Date().toISOString(),
        },
      }),
    });
  }

  identify(userId: string, traits?: Record<string, any>) {
    return fetch(`${this.apiUrl}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'openpanel-client-id': this.clientId,
      },
      body: JSON.stringify({
        type: 'identify',
        payload: {
          profileId: userId,
          deviceId: this.deviceId,
          ...traits,
        },
      }),
    });
  }

  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('analytics_device_id');
    if (!deviceId) {
      deviceId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
      localStorage.setItem('analytics_device_id', deviceId);
    }
    return deviceId;
  }

  private getOrCreateSessionId(): string {
    const sessionKey = 'analytics_session';
    const stored = sessionStorage.getItem(sessionKey);

    if (stored) {
      const session = JSON.parse(stored);
      const now = Date.now();

      // 30분 이내면 세션 유지
      if (now - session.lastActivity < 30 * 60 * 1000) {
        session.lastActivity = now;
        sessionStorage.setItem(sessionKey, JSON.stringify(session));
        return session.id;
      }
    }

    // 새 세션 생성
    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
    sessionStorage.setItem(
      sessionKey,
      JSON.stringify({
        id: sessionId,
        lastActivity: Date.now(),
      })
    );

    return sessionId;
  }
}

export const analytics = new AnalyticsSDK(import.meta.env.VITE_ANALYTICS_CLIENT_ID || 'default');
```

### 10.2 React 통합

```typescript
// packages/frontend/src/App.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from './lib/analytics';

function App() {
  const location = useLocation();

  // 페이지뷰 추적
  useEffect(() => {
    analytics.track('screen_view', {
      path: location.pathname,
      search: location.search,
    });
  }, [location]);

  // 사용자 식별
  useEffect(() => {
    const user = getCurrentUser(); // 현재 로그인한 사용자
    if (user) {
      analytics.identify(user.id, {
        email: user.email,
        name: user.name,
      });
    }
  }, []);

  return (
    // ... 앱 컴포넌트
  );
}
```

---

## 11. 모니터링 및 운영

### 11.1 로그 확인

```bash
# Analytics Server 로그
docker-compose logs -f analytics-server

# Worker 로그
docker-compose logs -f analytics-worker

# ClickHouse 로그
docker-compose logs -f clickhouse
```

### 11.2 성능 모니터링

```typescript
// src/middleware/metrics.ts
import { FastifyRequest, FastifyReply } from 'fastify';

export async function metricsMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const start = Date.now();

  reply.addHook('onSend', async () => {
    const duration = Date.now() - start;

    // 메트릭 기록
    request.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration,
    });
  });
}
```

---

## 12. 다음 단계

### 즉시 시작 가능한 작업

1. **Phase 1 시작**

   ```bash
   # Analytics Server 디렉토리 생성
   mkdir -p packages/analytics-server/src

   # package.json 생성
   cd packages/analytics-server
   npm init -y
   ```

2. **ClickHouse 추가**
   - `docker-compose.yml` 수정
   - ClickHouse 서비스 추가

3. **기본 Fastify 서버 구현**
   - `src/app.ts` 생성
   - `src/index.ts` 생성
   - Health check 엔드포인트

### 우선순위

- 🔴 **High**: Event API, Worker, ClickHouse 설정
- 🟡 **Medium**: 메트릭 조회, Frontend 통합
- 🟢 **Low**: 고급 분석 (퍼널, 리텐션)

---

**준비 완료!** Phase 1부터 시작하시겠습니까?
