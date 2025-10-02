# OpenPanel 아키텍처 및 데이터 흐름 (Architecture & Data Flow)

> **작성일**: 2025-10-02  
> **목적**: OpenPanel의 시스템 아키텍처, 데이터 흐름, 확장성 전략 상세 분석

---

## 📋 목차

1. [전체 시스템 아키텍처](#1-전체-시스템-아키텍처)
2. [데이터 흐름](#2-데이터-흐름)
3. [데이터베이스 스키마](#3-데이터베이스-스키마)
4. [확장성 전략](#4-확장성-전략)
5. [모니터링 및 관찰성](#5-모니터링-및-관찰성)

---

## 1. 전체 시스템 아키텍처

### 1.1 고수준 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                           클라이언트 레이어                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │   Web    │  │  React   │  │   Vue    │  │  Mobile  │            │
│  │   SDK    │  │   SDK    │  │   SDK    │  │   SDK    │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
└───────┼─────────────┼─────────────┼─────────────┼───────────────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          API Gateway / CDN                           │
│                    (Cloudflare, AWS CloudFront)                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Event API   │    │  Dashboard   │    │  Public API  │
│  (Fastify)   │    │  (Next.js)   │    │   (tRPC)     │
│              │    │              │    │              │
│  Port: 3000  │    │  Port: 3001  │    │  Port: 3002  │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                    │
       │                   └────────┬───────────┘
       │                            │
       ▼                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Redis Cluster                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Cache      │  │   Pub/Sub    │  │    Queue     │              │
│  │              │  │              │  │   (BullMQ)   │              │
│  └──────────────┘  └──────────────┘  └──────┬───────┘              │
└─────────────────────────────────────────────┼───────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Worker Cluster                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Event      │  │   Profile    │  │ Aggregation  │              │
│  │   Worker     │  │   Worker     │  │   Worker     │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼──────────────────┼──────────────────┼─────────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  PostgreSQL  │    │  ClickHouse  │    │    Redis     │
│              │    │              │    │              │
│  - Users     │    │  - Events    │    │  - Sessions  │
│  - Projects  │    │  - Profiles  │    │  - Cache     │
│  - Clients   │    │  - Sessions  │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

### 1.2 컴포넌트별 역할

#### **Event API (Fastify)**
- **역할**: 이벤트 수집 및 초기 처리
- **책임**:
  - 클라이언트 인증
  - 이벤트 검증
  - IP → GeoIP 변환
  - User-Agent 파싱
  - Rate Limiting
  - 큐에 이벤트 전달

#### **Dashboard (Next.js)**
- **역할**: 관리 대시보드 및 분석 UI
- **책임**:
  - 사용자 인증
  - 실시간 메트릭 표시
  - 차트 및 리포트 생성
  - 프로젝트 관리
  - 사용자 관리

#### **Worker Cluster**
- **역할**: 백그라운드 작업 처리
- **책임**:
  - 이벤트 배치 삽입
  - 프로필 업데이트
  - 세션 집계
  - 일별/주별/월별 집계
  - Webhook 전송

#### **PostgreSQL**
- **역할**: 메타데이터 저장
- **데이터**:
  - 사용자 계정
  - 프로젝트 설정
  - 클라이언트 인증 정보
  - Webhook 설정

#### **ClickHouse**
- **역할**: 이벤트 데이터 저장 및 분석
- **데이터**:
  - 원시 이벤트
  - 사용자 프로필
  - 세션 데이터
  - 집계 데이터

#### **Redis**
- **역할**: 캐싱, 큐, Pub/Sub
- **용도**:
  - 메트릭 캐싱
  - BullMQ 작업 큐
  - 실시간 방문자 카운트
  - 세션 임시 저장

---

## 2. 데이터 흐름

### 2.1 이벤트 수집 흐름

```
┌─────────────┐
│   Client    │
│   (SDK)     │
└──────┬──────┘
       │ 1. track('event_name', { ... })
       ▼
┌─────────────────────────────────────────┐
│         Event API (Fastify)             │
│                                         │
│  2. 클라이언트 인증                      │
│  3. 이벤트 검증 (Zod)                   │
│  4. IP → GeoIP 변환                     │
│  5. User-Agent 파싱                     │
│  6. 이벤트 정규화                        │
└──────┬──────────────────────────────────┘
       │ 7. 큐에 추가
       ▼
┌─────────────────────────────────────────┐
│         Redis (BullMQ Queue)            │
│                                         │
│  - 이벤트 버퍼링                         │
│  - 순서 보장                             │
│  - 재시도 로직                           │
└──────┬──────────────────────────────────┘
       │ 8. Worker가 처리
       ▼
┌─────────────────────────────────────────┐
│         Event Worker                    │
│                                         │
│  9. 배치 수집 (1000개씩)                │
│  10. ClickHouse에 삽입                  │
│  11. 세션 업데이트                       │
│  12. 프로필 업데이트 큐에 추가           │
└──────┬──────────────────────────────────┘
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ ClickHouse  │  │   Redis     │  │  Profile    │
│   Events    │  │  Sessions   │  │   Queue     │
└─────────────┘  └─────────────┘  └─────────────┘
```

### 2.2 프로필 업데이트 흐름

```
┌─────────────┐
│   Client    │
│   (SDK)     │
└──────┬──────┘
       │ 1. identify('user_id', { email, name })
       ▼
┌─────────────────────────────────────────┐
│         Event API                       │
│                                         │
│  2. 프로필 업데이트 큐에 추가            │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│         Profile Worker                  │
│                                         │
│  3. 기존 프로필 조회                     │
│  4. 프로필 병합                          │
│  5. ClickHouse에 삽입                   │
│  6. 디바이스-프로필 매핑 저장 (Redis)    │
│  7. 과거 이벤트 업데이트                 │
└──────┬──────────────────────────────────┘
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ ClickHouse  │  │   Redis     │  │ ClickHouse  │
│  Profiles   │  │  Device Map │  │   Events    │
│             │  │             │  │  (UPDATE)   │
└─────────────┘  └─────────────┘  └─────────────┘
```

### 2.3 대시보드 쿼리 흐름

```
┌─────────────┐
│  Dashboard  │
│   (Next.js) │
└──────┬──────┘
       │ 1. tRPC Query
       ▼
┌─────────────────────────────────────────┐
│         tRPC Router                     │
│                                         │
│  2. 인증 확인                            │
│  3. 권한 확인                            │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│         Metrics Service                 │
│                                         │
│  4. 캐시 확인 (Redis)                   │
└──────┬──────────────────────────────────┘
       │
       ├─── Cache Hit ──────┐
       │                    │
       │ Cache Miss         │
       ▼                    │
┌─────────────────────┐     │
│    ClickHouse       │     │
│                     │     │
│  5. 쿼리 실행       │     │
│  6. 결과 집계       │     │
└──────┬──────────────┘     │
       │                    │
       ▼                    │
┌─────────────────────┐     │
│      Redis          │     │
│                     │     │
│  7. 캐시 저장       │     │
│     (5분 TTL)       │     │
└──────┬──────────────┘     │
       │                    │
       └────────┬───────────┘
                │
                ▼
       ┌─────────────────┐
       │   Dashboard     │
       │   (결과 표시)    │
       └─────────────────┘
```

### 2.4 실시간 업데이트 흐름

```
┌─────────────┐
│   Client    │
│   (SDK)     │
└──────┬──────┘
       │ 1. 이벤트 전송
       ▼
┌─────────────────────────────────────────┐
│         Event API                       │
│                                         │
│  2. Redis Pub/Sub에 발행                │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│         Redis Pub/Sub                   │
│                                         │
│  3. 구독자에게 브로드캐스트              │
└──────┬──────────────────────────────────┘
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Dashboard  │  │  Dashboard  │  │  Dashboard  │
│  Client 1   │  │  Client 2   │  │  Client 3   │
│             │  │             │  │             │
│  4. 실시간  │  │  4. 실시간  │  │  4. 실시간  │
│     업데이트│  │     업데이트│  │     업데이트│
└─────────────┘  └─────────────┘  └─────────────┘
```

---

## 3. 데이터베이스 스키마

### 3.1 PostgreSQL 스키마 (메타데이터)

```sql
-- 사용자 테이블
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    password_hash TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 프로젝트 테이블
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    user_id TEXT NOT NULL REFERENCES users(id),
    settings JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);

-- 클라이언트 테이블 (API 키)
CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('write', 'read', 'root')),
    project_id TEXT NOT NULL REFERENCES projects(id),
    secret TEXT NOT NULL,
    cors TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_clients_project_id ON clients(project_id);

-- 세션 테이블 (인증)
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- Webhook 테이블
CREATE TABLE webhooks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    secret TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhooks_project_id ON webhooks(project_id);

-- Webhook 전송 기록
CREATE TABLE webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL REFERENCES webhooks(id),
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    status INTEGER NOT NULL,
    response TEXT,
    attempts INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);
```

### 3.2 ClickHouse 스키마 (이벤트 데이터)

```sql
-- 이벤트 테이블
CREATE TABLE events (
    -- 기본 식별자
    id UUID DEFAULT generateUUIDv4(),
    project_id String,
    name String,
    device_id String,
    profile_id Nullable(String),
    session_id String,
    
    -- 타임스탬프
    created_at DateTime DEFAULT now(),
    timestamp DateTime,
    
    -- 지리 정보
    country Nullable(String),
    city Nullable(String),
    region Nullable(String),
    latitude Nullable(Float32),
    longitude Nullable(Float32),
    
    -- 디바이스 정보
    os Nullable(String),
    os_version Nullable(String),
    browser Nullable(String),
    browser_version Nullable(String),
    device Nullable(String),
    brand Nullable(String),
    model Nullable(String),
    
    -- 페이지 정보
    path Nullable(String),
    origin Nullable(String),
    referrer Nullable(String),
    referrer_name Nullable(String),
    referrer_type Nullable(String),
    
    -- UTM 파라미터
    utm_source Nullable(String),
    utm_medium Nullable(String),
    utm_campaign Nullable(String),
    utm_term Nullable(String),
    utm_content Nullable(String),
    
    -- 커스텀 속성
    properties String,
    
    -- 세션 메트릭
    duration Nullable(UInt32),
    screen_views Nullable(UInt16)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (project_id, created_at, device_id)
SETTINGS index_granularity = 8192;

-- 인덱스 추가
ALTER TABLE events ADD INDEX idx_name name TYPE bloom_filter GRANULARITY 1;
ALTER TABLE events ADD INDEX idx_path path TYPE bloom_filter GRANULARITY 1;
ALTER TABLE events ADD INDEX idx_country country TYPE bloom_filter GRANULARITY 1;

-- 프로필 테이블
CREATE TABLE profiles (
    id String,
    project_id String,
    profile_id String,
    
    -- 기본 정보
    first_name Nullable(String),
    last_name Nullable(String),
    email Nullable(String),
    avatar Nullable(String),
    
    -- 커스텀 속성
    properties String,
    
    -- 메트릭
    first_seen_at DateTime,
    last_seen_at DateTime,
    
    created_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(created_at)
PARTITION BY toYYYYMM(created_at)
ORDER BY (project_id, profile_id)
SETTINGS index_granularity = 8192;

-- 세션 테이블
CREATE TABLE sessions (
    session_id String,
    project_id String,
    device_id String,
    profile_id Nullable(String),
    
    -- 타임스탬프
    start_time DateTime,
    end_time DateTime,
    
    -- 메트릭
    duration UInt32,
    screen_views UInt16,
    is_bounce Boolean,
    
    -- 속성
    country Nullable(String),
    city Nullable(String),
    browser Nullable(String),
    os Nullable(String),
    referrer Nullable(String),
    
    created_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(created_at)
PARTITION BY toYYYYMM(start_time)
ORDER BY (project_id, start_time, session_id)
SETTINGS index_granularity = 8192;

-- 일별 집계 Materialized View
CREATE MATERIALIZED VIEW daily_metrics
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (project_id, date)
AS SELECT
    project_id,
    toDate(created_at) as date,
    uniq(device_id) as unique_visitors,
    uniq(session_id) as total_sessions,
    countIf(name = 'screen_view') as total_screen_views,
    sum(duration) as total_duration,
    countIf(screen_views = 1) as bounced_sessions
FROM events
GROUP BY project_id, date;

-- 시간별 집계 Materialized View
CREATE MATERIALIZED VIEW hourly_metrics
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, hour)
AS SELECT
    project_id,
    toStartOfHour(created_at) as hour,
    uniq(device_id) as unique_visitors,
    uniq(session_id) as total_sessions,
    count() as total_events
FROM events
GROUP BY project_id, hour;
```

---

## 4. 확장성 전략

### 4.1 수평 확장 (Horizontal Scaling)

#### **API 서버 확장**
```yaml
# Kubernetes Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: event-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: event-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### **Worker 확장**
```typescript
// Worker 동적 확장
const workerCount = Math.max(
  2,
  Math.min(
    os.cpus().length,
    Math.ceil(queueSize / 1000)
  )
);

for (let i = 0; i < workerCount; i++) {
  new Worker('events', processEvent, {
    connection: redisConnection,
    concurrency: 10,
  });
}
```

### 4.2 데이터베이스 샤딩

#### **ClickHouse 분산 테이블**
```sql
-- 로컬 테이블 (각 샤드에)
CREATE TABLE events_local ON CLUSTER '{cluster}' (
    -- 스키마 동일
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (project_id, created_at, device_id);

-- 분산 테이블
CREATE TABLE events ON CLUSTER '{cluster}' AS events_local
ENGINE = Distributed('{cluster}', default, events_local, rand());
```

### 4.3 캐싱 전략

```typescript
// 다층 캐싱
export class CacheStrategy {
  // L1: 메모리 캐시 (Node.js)
  private memoryCache = new Map<string, any>();
  
  // L2: Redis 캐시
  private redisCache: Redis;
  
  async get<T>(key: string): Promise<T | null> {
    // L1 캐시 확인
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }
    
    // L2 캐시 확인
    const cached = await this.redisCache.get(key);
    if (cached) {
      const value = JSON.parse(cached);
      this.memoryCache.set(key, value);
      return value;
    }
    
    return null;
  }
  
  async set(key: string, value: any, ttl: number) {
    // L1 캐시 저장
    this.memoryCache.set(key, value);
    
    // L2 캐시 저장
    await this.redisCache.setex(key, ttl, JSON.stringify(value));
    
    // L1 캐시 크기 제한
    if (this.memoryCache.size > 1000) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
  }
}
```

---

## 5. 모니터링 및 관찰성

### 5.1 메트릭 수집

```typescript
// Prometheus 메트릭
import { register, Counter, Histogram, Gauge } from 'prom-client';

// 이벤트 카운터
const eventCounter = new Counter({
  name: 'openpanel_events_total',
  help: 'Total number of events processed',
  labelNames: ['project_id', 'event_name'],
});

// 처리 시간 히스토그램
const processingDuration = new Histogram({
  name: 'openpanel_event_processing_duration_seconds',
  help: 'Event processing duration',
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5],
});

// 큐 크기 게이지
const queueSize = new Gauge({
  name: 'openpanel_queue_size',
  help: 'Current queue size',
  labelNames: ['queue_name'],
});

// 사용 예시
fastify.post('/track', async (request, reply) => {
  const end = processingDuration.startTimer();
  
  try {
    await processEvent(request.body);
    eventCounter.inc({
      project_id: request.body.projectId,
      event_name: request.body.name,
    });
  } finally {
    end();
  }
});
```

### 5.2 로깅 전략

```typescript
// 구조화된 로깅
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// 컨텍스트 로깅
logger.info({
  event: 'event_processed',
  projectId: 'proj_123',
  eventName: 'page_view',
  duration: 45,
}, 'Event processed successfully');

// 에러 로깅
logger.error({
  event: 'event_processing_failed',
  projectId: 'proj_123',
  error: error.message,
  stack: error.stack,
}, 'Failed to process event');
```

### 5.3 분산 추적 (Distributed Tracing)

```typescript
// OpenTelemetry 설정
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [
    new FastifyInstrumentation(),
  ],
});

// 커스텀 스팬
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('openpanel');

async function processEvent(event: Event) {
  const span = tracer.startSpan('process_event');
  
  try {
    span.setAttribute('project_id', event.projectId);
    span.setAttribute('event_name', event.name);
    
    await enrichEvent(event);
    await saveEvent(event);
    
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    throw error;
  } finally {
    span.end();
  }
}
```

---

## 6. 결론

OpenPanel의 아키텍처는 다음과 같은 핵심 원칙을 따릅니다:

1. **확장성**: 수평 확장 가능한 마이크로서비스 아키텍처
2. **성능**: ClickHouse와 Redis를 활용한 고성능 데이터 처리
3. **신뢰성**: 큐 기반 비동기 처리로 데이터 손실 방지
4. **관찰성**: 메트릭, 로깅, 추적을 통한 시스템 모니터링
5. **유연성**: 다양한 SDK와 통합 옵션 제공

이 아키텍처를 기반으로 월 수억 건의 이벤트를 처리할 수 있는 확장 가능한 분석 플랫폼을 구축할 수 있습니다.


