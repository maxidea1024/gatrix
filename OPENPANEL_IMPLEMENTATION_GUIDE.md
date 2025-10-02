# OpenPanel 구현 가이드 (Implementation Guide)

> **작성일**: 2025-10-02  
> **대상**: OpenPanel과 유사한 웹/제품 분석 플랫폼 구축  
> **참고**: https://github.com/Openpanel-dev/openpanel

---

## 📋 목차

1. [시스템 아키텍처 개요](#1-시스템-아키텍처-개요)
2. [기술 스택 상세](#2-기술-스택-상세)
3. [데이터베이스 설계](#3-데이터베이스-설계)
4. [이벤트 수집 시스템](#4-이벤트-수집-시스템)
5. [분석 엔진 구현](#5-분석-엔진-구현)
6. [대시보드 구현](#6-대시보드-구현)
7. [인증 및 권한 관리](#7-인증-및-권한-관리)
8. [실시간 처리 파이프라인](#8-실시간-처리-파이프라인)
9. [API 설계](#9-api-설계)
10. [배포 및 인프라](#10-배포-및-인프라)

---

## 1. 시스템 아키텍처 개요

### 1.1 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                        클라이언트                              │
│  (웹사이트/앱 + SDK: Script Tag, React, Vue, Next.js 등)      │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    이벤트 수집 API (Fastify)                   │
│  - 이벤트 검증 및 정규화                                        │
│  - IP → 지리정보 변환 (GeoIP)                                 │
│  - User-Agent 파싱                                           │
│  - Rate Limiting                                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Redis (Pub/Sub + Queue)                  │
│  - 이벤트 버퍼링                                              │
│  - BullMQ 작업 큐                                            │
│  - 세션 캐시                                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Worker (BullMQ)                          │
│  - 배치 처리                                                 │
│  - 이벤트 집계                                                │
│  - 프로필 업데이트                                            │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌──────────────┐          ┌──────────────────┐
│  PostgreSQL  │          │   ClickHouse     │
│              │          │                  │
│ - 사용자     │          │ - 이벤트 저장    │
│ - 프로젝트   │          │ - 세션 데이터    │
│ - 클라이언트 │          │ - 집계 쿼리      │
│ - 프로필     │          │ - 실시간 분석    │
└──────────────┘          └──────────────────┘
        │                         │
        └────────────┬────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              대시보드 (Next.js + tRPC)                        │
│  - 실시간 대시보드                                            │
│  - 차트 및 리포트                                             │
│  - 사용자 관리                                                │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 핵심 컴포넌트

#### **Apps (애플리케이션)**
- `apps/api` - Fastify 기반 이벤트 수집 API
- `apps/dashboard` - Next.js 기반 관리 대시보드
- `apps/worker` - BullMQ 워커 (백그라운드 작업)
- `apps/docs` - 문서 사이트
- `apps/public` - 공개 웹사이트

#### **Packages (공유 라이브러리)**
- `packages/db` - Prisma 스키마 및 DB 클라이언트
- `packages/queue` - BullMQ 설정
- `packages/redis` - Redis 클라이언트
- `packages/auth` - 인증 로직 (Arctic + Oslo)
- `packages/trpc` - tRPC 라우터 및 프로시저
- `packages/validation` - Zod 스키마
- `packages/sdks` - 클라이언트 SDK (Web, React, Vue 등)
- `packages/geo` - GeoIP 처리
- `packages/email` - Resend 이메일
- `packages/payments` - 결제 처리

---

## 2. 기술 스택 상세

### 2.1 프론트엔드

#### **Next.js 15 (App Router)**
```typescript
// apps/dashboard/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
```

**주요 기능**:
- Server Components 활용
- Streaming SSR
- Route Groups로 레이아웃 분리
- Parallel Routes로 모달 구현

#### **Tailwind CSS + Shadcn/ui**
```typescript
// 컴포넌트 예시
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function MetricCard({ title, value, change }) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-semibold">{value}</p>
        <span className={cn(
          "text-sm",
          change > 0 ? "text-green-600" : "text-red-600"
        )}>
          {change > 0 ? '+' : ''}{change}%
        </span>
      </div>
    </Card>
  );
}
```

### 2.2 백엔드

#### **Fastify (이벤트 API)**
```typescript
// apps/api/src/index.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

const fastify = Fastify({
  logger: true,
  trustProxy: true,
});

// CORS 설정
await fastify.register(cors, {
  origin: true,
  credentials: true,
});

// Rate Limiting
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// 이벤트 수집 엔드포인트
fastify.post('/track', async (request, reply) => {
  const { type, payload } = request.body;
  
  // 클라이언트 인증
  const clientId = request.headers['openpanel-client-id'];
  const clientSecret = request.headers['openpanel-client-secret'];
  
  // IP 및 User-Agent 추출
  const ip = request.headers['x-client-ip'] || request.ip;
  const userAgent = request.headers['user-agent'];
  
  // 이벤트 처리
  await processEvent({
    type,
    payload,
    ip,
    userAgent,
    clientId,
  });
  
  return { success: true };
});

await fastify.listen({ port: 3000, host: '0.0.0.0' });
```

**Fastify 선택 이유**:
- Express보다 2-3배 빠른 성능
- TypeScript 네이티브 지원
- 플러그인 아키텍처
- 스키마 기반 검증 (JSON Schema)

#### **tRPC (API 레이어)**
```typescript
// packages/trpc/src/router/insights.ts
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const insightsRouter = router({
  getMetrics: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      filters: z.array(z.object({
        name: z.string(),
        operator: z.enum(['is', 'isNot', 'contains']),
        value: z.array(z.string()),
      })).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { projectId, startDate, endDate, filters } = input;
      
      // ClickHouse 쿼리
      const metrics = await ctx.clickhouse.query({
        query: `
          SELECT
            uniq(deviceId) as unique_visitors,
            count() as total_sessions,
            avg(duration) as avg_session_duration,
            sum(screenViews) as total_screen_views
          FROM events
          WHERE projectId = {projectId:String}
            AND createdAt >= {startDate:DateTime}
            AND createdAt <= {endDate:DateTime}
          ${buildFilterClause(filters)}
        `,
        query_params: { projectId, startDate, endDate },
      });
      
      return metrics.json();
    }),
});
```

### 2.3 데이터베이스

#### **PostgreSQL (메타데이터)**
```prisma
// packages/db/prisma/schema.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  projects  Project[]
  sessions  Session[]
}

model Project {
  id          String   @id @default(cuid())
  name        String
  domain      String
  timezone    String   @default("UTC")
  userId      String
  createdAt   DateTime @default(now())
  
  user        User     @relation(fields: [userId], references: [id])
  clients     Client[]
  
  @@index([userId])
}

model Client {
  id          String   @id @default(cuid())
  name        String
  type        ClientType
  projectId   String
  secret      String
  cors        String[]
  createdAt   DateTime @default(now())
  
  project     Project  @relation(fields: [projectId], references: [id])
  
  @@index([projectId])
}

enum ClientType {
  write
  read
  root
}
```

#### **ClickHouse (이벤트 데이터)**
```sql
-- 이벤트 테이블
CREATE TABLE events (
    id UUID DEFAULT generateUUIDv4(),
    projectId String,
    name String,
    deviceId String,
    profileId Nullable(String),
    sessionId String,
    
    -- 타임스탬프
    createdAt DateTime DEFAULT now(),
    timestamp DateTime,
    
    -- 디바이스 정보
    country Nullable(String),
    city Nullable(String),
    region Nullable(String),
    os Nullable(String),
    osVersion Nullable(String),
    browser Nullable(String),
    browserVersion Nullable(String),
    device Nullable(String),
    brand Nullable(String),
    model Nullable(String),
    
    -- 페이지 정보
    path Nullable(String),
    origin Nullable(String),
    referrer Nullable(String),
    referrerName Nullable(String),
    referrerType Nullable(String),
    
    -- UTM 파라미터
    utmSource Nullable(String),
    utmMedium Nullable(String),
    utmCampaign Nullable(String),
    utmTerm Nullable(String),
    utmContent Nullable(String),
    
    -- 커스텀 속성 (JSON)
    properties String,
    
    -- 세션 메트릭
    duration Nullable(UInt32),
    screenViews Nullable(UInt16)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(createdAt)
ORDER BY (projectId, createdAt, deviceId)
SETTINGS index_granularity = 8192;

-- 프로필 테이블
CREATE TABLE profiles (
    id String,
    projectId String,
    profileId String,
    
    -- 기본 정보
    firstName Nullable(String),
    lastName Nullable(String),
    email Nullable(String),
    avatar Nullable(String),
    
    -- 커스텀 속성
    properties String,
    
    -- 메트릭
    firstSeenAt DateTime,
    lastSeenAt DateTime,
    
    createdAt DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(createdAt)
PARTITION BY toYYYYMM(createdAt)
ORDER BY (projectId, profileId)
SETTINGS index_granularity = 8192;
```

**ClickHouse 선택 이유**:
- 컬럼 기반 스토리지로 분석 쿼리 최적화
- 초당 수백만 행 삽입 가능
- 실시간 집계 쿼리 성능 우수
- 자동 파티셔닝 및 압축

---

## 3. 데이터베이스 설계

### 3.1 PostgreSQL 스키마 설계

#### **핵심 테이블 구조**

```typescript
// packages/db/src/schema.ts
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash'),
  emailVerified: boolean('email_verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const projects = pgTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  domain: text('domain').notNull(),
  timezone: text('timezone').default('UTC'),
  userId: text('user_id').notNull().references(() => users.id),
  settings: jsonb('settings').$type<ProjectSettings>(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('projects_user_id_idx').on(table.userId),
}));

export const clients = pgTable('clients', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  type: text('type').$type<'write' | 'read' | 'root'>().notNull(),
  projectId: text('project_id').notNull().references(() => projects.id),
  secret: text('secret').notNull(),
  cors: text('cors').array(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  projectIdIdx: index('clients_project_id_idx').on(table.projectId),
}));
```

### 3.2 ClickHouse 스키마 최적화

#### **파티셔닝 전략**
```sql
-- 월별 파티셔닝으로 오래된 데이터 삭제 용이
PARTITION BY toYYYYMM(createdAt)

-- 프로젝트별 + 시간순 정렬로 쿼리 최적화
ORDER BY (projectId, createdAt, deviceId)
```

#### **Materialized View로 집계 최적화**
```sql
-- 일별 집계 뷰
CREATE MATERIALIZED VIEW daily_metrics
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (projectId, date)
AS SELECT
    projectId,
    toDate(createdAt) as date,
    uniq(deviceId) as unique_visitors,
    count() as total_events,
    sum(duration) as total_duration,
    sum(screenViews) as total_screen_views
FROM events
GROUP BY projectId, date;
```

---

## 4. 이벤트 수집 시스템

### 4.1 SDK 구조

#### **Web SDK (packages/sdks/web)**
```typescript
// packages/sdks/web/src/index.ts
export class OpenPanel {
  private clientId: string;
  private apiUrl: string;
  private deviceId: string;
  private sessionId: string;
  
  constructor(config: OpenPanelConfig) {
    this.clientId = config.clientId;
    this.apiUrl = config.apiUrl || 'https://api.openpanel.dev';
    this.deviceId = this.getOrCreateDeviceId();
    this.sessionId = this.getOrCreateSessionId();
    
    // 자동 페이지뷰 추적
    if (config.trackScreenViews) {
      this.trackPageView();
      this.setupPageViewTracking();
    }
    
    // 자동 아웃바운드 링크 추적
    if (config.trackOutgoingLinks) {
      this.setupLinkTracking();
    }
  }
  
  track(eventName: string, properties?: Record<string, any>) {
    const event = {
      type: 'track',
      payload: {
        name: eventName,
        properties: {
          ...this.getDefaultProperties(),
          ...properties,
        },
        deviceId: this.deviceId,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
      },
    };
    
    this.send(event);
  }
  
  identify(profileId: string, traits?: Record<string, any>) {
    const event = {
      type: 'identify',
      payload: {
        profileId,
        ...traits,
        deviceId: this.deviceId,
      },
    };
    
    this.send(event);
  }
  
  private send(event: Event) {
    // Beacon API 사용 (페이지 이탈 시에도 전송 보장)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `${this.apiUrl}/track`,
        JSON.stringify(event)
      );
    } else {
      // Fallback to fetch
      fetch(`${this.apiUrl}/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'openpanel-client-id': this.clientId,
        },
        body: JSON.stringify(event),
        keepalive: true,
      });
    }
  }
  
  private getDefaultProperties() {
    return {
      path: window.location.pathname,
      origin: window.location.origin,
      referrer: document.referrer,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      language: navigator.language,
    };
  }
}
```

### 4.2 이벤트 처리 파이프라인

```typescript
// apps/api/src/services/event-processor.ts
export class EventProcessor {
  async processEvent(rawEvent: RawEvent) {
    // 1. 검증
    const validatedEvent = await this.validate(rawEvent);
    
    // 2. 보강 (Enrichment)
    const enrichedEvent = await this.enrich(validatedEvent);
    
    // 3. 큐에 추가
    await this.queue.add('process-event', enrichedEvent);
    
    return { success: true };
  }
  
  private async enrich(event: ValidatedEvent) {
    const { ip, userAgent } = event;
    
    // GeoIP 조회
    const geo = await this.geoip.lookup(ip);
    
    // User-Agent 파싱
    const ua = UAParser(userAgent);
    
    return {
      ...event,
      country: geo.country,
      city: geo.city,
      region: geo.region,
      os: ua.os.name,
      osVersion: ua.os.version,
      browser: ua.browser.name,
      browserVersion: ua.browser.version,
      device: ua.device.type,
      brand: ua.device.vendor,
      model: ua.device.model,
    };
  }
}
```

---

## 5. 분석 엔진 구현

### 5.1 메트릭 계산

```typescript
// packages/trpc/src/services/metrics.ts
export class MetricsService {
  async getMetrics(params: MetricsParams) {
    const { projectId, startDate, endDate, filters } = params;
    
    const query = `
      SELECT
        -- 방문자 수
        uniq(deviceId) as unique_visitors,
        uniqExact(deviceId) as unique_visitors_exact,
        
        -- 세션 수
        uniq(sessionId) as total_sessions,
        
        -- 페이지뷰
        countIf(name = 'screen_view') as total_screen_views,
        
        -- 평균 세션 시간
        avg(duration) as avg_session_duration,
        
        -- 이탈률
        countIf(screenViews = 1) / count() * 100 as bounce_rate,
        
        -- 세션당 페이지뷰
        total_screen_views / total_sessions as views_per_session
        
      FROM events
      WHERE projectId = {projectId:String}
        AND createdAt >= {startDate:DateTime}
        AND createdAt <= {endDate:DateTime}
        ${this.buildFilterClause(filters)}
    `;
    
    const result = await this.clickhouse.query({
      query,
      query_params: { projectId, startDate, endDate },
      format: 'JSONEachRow',
    });
    
    return result.json();
  }
  
  async getTimeSeries(params: TimeSeriesParams) {
    const { projectId, startDate, endDate, interval = 'day' } = params;
    
    const query = `
      SELECT
        ${this.getTimeInterval(interval)} as date,
        uniq(deviceId) as unique_visitors,
        uniq(sessionId) as total_sessions,
        countIf(name = 'screen_view') as total_screen_views,
        avg(duration) as avg_session_duration
      FROM events
      WHERE projectId = {projectId:String}
        AND createdAt >= {startDate:DateTime}
        AND createdAt <= {endDate:DateTime}
      GROUP BY date
      ORDER BY date
    `;
    
    return this.clickhouse.query({ query, query_params: params });
  }
  
  private getTimeInterval(interval: string) {
    switch (interval) {
      case 'hour':
        return 'toStartOfHour(createdAt)';
      case 'day':
        return 'toDate(createdAt)';
      case 'week':
        return 'toMonday(createdAt)';
      case 'month':
        return 'toStartOfMonth(createdAt)';
      default:
        return 'toDate(createdAt)';
    }
  }
}
```

### 5.2 퍼널 분석

```typescript
// packages/trpc/src/services/funnel.ts
export class FunnelService {
  async analyzeFunnel(params: FunnelParams) {
    const { projectId, steps, startDate, endDate } = params;

    // 각 단계별 이벤트 필터링
    const stepQueries = steps.map((step, index) => `
      SELECT DISTINCT deviceId
      FROM events
      WHERE projectId = {projectId:String}
        AND name = {step${index}:String}
        AND createdAt >= {startDate:DateTime}
        AND createdAt <= {endDate:DateTime}
    `).join(' INTERSECT ');

    const query = `
      WITH
        ${steps.map((step, i) => `
          step${i} AS (
            SELECT deviceId, min(createdAt) as timestamp
            FROM events
            WHERE projectId = {projectId:String}
              AND name = {step${i}:String}
              AND createdAt >= {startDate:DateTime}
              AND createdAt <= {endDate:DateTime}
            GROUP BY deviceId
          )
        `).join(',')}

      SELECT
        ${steps.map((_, i) => `
          count(DISTINCT step${i}.deviceId) as step${i}_count,
          ${i > 0 ? `
            step${i}_count / step${i-1}_count * 100 as step${i}_conversion
          ` : '100 as step0_conversion'}
        `).join(',')}
      FROM step0
      ${steps.slice(1).map((_, i) => `
        LEFT JOIN step${i+1} ON step${i+1}.deviceId = step${i}.deviceId
          AND step${i+1}.timestamp > step${i}.timestamp
      `).join('\n')}
    `;

    return this.clickhouse.query({ query, query_params: params });
  }
}
```

### 5.3 리텐션 분석

```typescript
// packages/trpc/src/services/retention.ts
export class RetentionService {
  async analyzeRetention(params: RetentionParams) {
    const { projectId, startDate, endDate, period = 'day' } = params;

    const query = `
      WITH
        first_seen AS (
          SELECT
            deviceId,
            toDate(min(createdAt)) as cohort_date
          FROM events
          WHERE projectId = {projectId:String}
            AND createdAt >= {startDate:DateTime}
            AND createdAt <= {endDate:DateTime}
          GROUP BY deviceId
        ),
        activity AS (
          SELECT
            deviceId,
            toDate(createdAt) as activity_date
          FROM events
          WHERE projectId = {projectId:String}
            AND createdAt >= {startDate:DateTime}
            AND createdAt <= {endDate:DateTime}
          GROUP BY deviceId, activity_date
        )

      SELECT
        cohort_date,
        dateDiff('${period}', cohort_date, activity_date) as period_number,
        count(DISTINCT activity.deviceId) as retained_users,
        count(DISTINCT first_seen.deviceId) as cohort_size,
        retained_users / cohort_size * 100 as retention_rate
      FROM first_seen
      LEFT JOIN activity ON first_seen.deviceId = activity.deviceId
      GROUP BY cohort_date, period_number
      ORDER BY cohort_date, period_number
    `;

    return this.clickhouse.query({ query, query_params: params });
  }
}
```

---

## 6. 대시보드 구현

### 6.1 실시간 대시보드

```typescript
// apps/dashboard/app/(dashboard)/[projectId]/page.tsx
'use client';

import { trpc } from '@/lib/trpc';
import { MetricCard } from '@/components/metric-card';
import { Chart } from '@/components/chart';
import { useRealtime } from '@/hooks/use-realtime';

export default function DashboardPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;

  // 메트릭 조회
  const { data: metrics, isLoading } = trpc.insights.getMetrics.useQuery({
    projectId,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
  });

  // 시계열 데이터
  const { data: timeSeries } = trpc.insights.getTimeSeries.useQuery({
    projectId,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    interval: 'day',
  });

  // 실시간 방문자
  const liveVisitors = useRealtime(projectId);

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* 실시간 방문자 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Live Visitors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">{liveVisitors}</p>
        </CardContent>
      </Card>

      {/* 주요 메트릭 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Unique Visitors"
          value={metrics.unique_visitors.toLocaleString()}
          change={12.5}
        />
        <MetricCard
          title="Total Sessions"
          value={metrics.total_sessions.toLocaleString()}
          change={8.3}
        />
        <MetricCard
          title="Bounce Rate"
          value={`${metrics.bounce_rate.toFixed(1)}%`}
          change={-2.1}
        />
        <MetricCard
          title="Avg. Session Duration"
          value={formatDuration(metrics.avg_session_duration)}
          change={5.7}
        />
      </div>

      {/* 차트 */}
      <Card>
        <CardHeader>
          <CardTitle>Visitors Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <Chart
            data={timeSeries}
            xKey="date"
            yKeys={['unique_visitors', 'total_sessions']}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 7. 인증 및 권한 관리

### 7.1 인증 시스템 (Arctic + Oslo)

```typescript
// packages/auth/src/index.ts
import { Arctic } from 'arctic';
import { Lucia } from 'lucia';
import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle';

// OAuth 설정
export const github = new Arctic.GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
  `${process.env.APP_URL}/auth/callback/github`
);

export const google = new Arctic.Google(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  `${process.env.APP_URL}/auth/callback/google`
);

// Lucia 설정
const adapter = new DrizzlePostgreSQLAdapter(db, sessions, users);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    expires: false,
    attributes: {
      secure: process.env.NODE_ENV === 'production',
    },
  },
  getUserAttributes: (attributes) => {
    return {
      email: attributes.email,
      name: attributes.name,
      emailVerified: attributes.emailVerified,
    };
  },
});

// 세션 검증
export async function validateSession(sessionId: string) {
  const { session, user } = await lucia.validateSession(sessionId);

  if (!session) {
    return { session: null, user: null };
  }

  // 세션 갱신
  if (session.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id);
    // Set cookie...
  }

  return { session, user };
}
```

---

## 8. 실시간 처리 파이프라인

### 8.1 BullMQ 큐 설정

```typescript
// packages/queue/src/index.ts
import { Queue, Worker, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  maxRetriesPerRequest: null,
});

// 이벤트 처리 큐
export const eventQueue = new Queue('events', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600, // 1시간 후 삭제
      count: 1000,
    },
    removeOnFail: {
      age: 86400, // 24시간 후 삭제
    },
  },
});

// 프로필 업데이트 큐
export const profileQueue = new Queue('profiles', {
  connection,
});

// 집계 큐
export const aggregationQueue = new Queue('aggregations', {
  connection,
});
```

---

## 9. API 설계

### 9.1 Track API

```typescript
// apps/api/src/routes/track.ts
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

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

export const trackRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/track', {
    schema: {
      body: trackSchema,
      response: {
        200: z.object({
          success: z.boolean(),
        }),
      },
    },
  }, async (request, reply) => {
    // 클라이언트 인증
    const clientId = request.headers['openpanel-client-id'] as string;
    const clientSecret = request.headers['openpanel-client-secret'] as string;

    const client = await validateClient(clientId, clientSecret);

    if (!client) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // 이벤트 처리
    const { type, payload } = request.body;

    const event = {
      ...payload,
      projectId: client.projectId,
      ip: request.headers['x-client-ip'] || request.ip,
      userAgent: request.headers['user-agent'],
      createdAt: new Date().toISOString(),
    };

    // 큐에 추가
    await eventQueue.add('process-event', { event });

    return { success: true };
  });
};
```

---

## 10. 배포 및 인프라

### 10.1 Docker Compose (개발 환경)

```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: openpanel
      POSTGRES_USER: openpanel
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Redis
  redis:
    image: redis:7.2.5-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # ClickHouse
  clickhouse:
    image: clickhouse/clickhouse-server:24.12.2.29-alpine
    ports:
      - "8123:8123"  # HTTP
      - "9000:9000"  # Native
    volumes:
      - clickhouse_data:/var/lib/clickhouse
      - ./clickhouse/config.xml:/etc/clickhouse-server/config.xml
    ulimits:
      nofile:
        soft: 262144
        hard: 262144

volumes:
  postgres_data:
  redis_data:
  clickhouse_data:
```

---

## 11. 성능 최적화

### 11.1 ClickHouse 최적화

```sql
-- 인덱스 최적화
ALTER TABLE events ADD INDEX idx_name name TYPE bloom_filter GRANULARITY 1;
ALTER TABLE events ADD INDEX idx_path path TYPE bloom_filter GRANULARITY 1;

-- 압축 설정
ALTER TABLE events MODIFY COLUMN properties String CODEC(ZSTD(3));

-- TTL 설정 (90일 후 자동 삭제)
ALTER TABLE events MODIFY TTL createdAt + INTERVAL 90 DAY;
```

### 11.2 Redis 캐싱

```typescript
// packages/redis/src/cache.ts
export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, value: any, ttl: number = 3600) {
    await redis.setex(key, ttl, JSON.stringify(value));
  }

  async invalidate(pattern: string) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

// 사용 예시
const cacheKey = `metrics:${projectId}:${startDate}:${endDate}`;
const cached = await cache.get(cacheKey);

if (cached) {
  return cached;
}

const metrics = await getMetrics(params);
await cache.set(cacheKey, metrics, 300); // 5분 캐시
```

---

## 12. 참고 자료

### 12.1 공식 문서
- OpenPanel Docs: https://openpanel.dev/docs
- GitHub Repository: https://github.com/Openpanel-dev/openpanel

### 12.2 기술 스택 문서
- Next.js: https://nextjs.org/docs
- Fastify: https://fastify.dev/
- ClickHouse: https://clickhouse.com/docs
- tRPC: https://trpc.io/docs
- Prisma: https://www.prisma.io/docs
- BullMQ: https://docs.bullmq.io/

### 12.3 유사 프로젝트
- Plausible: https://github.com/plausible/analytics
- Umami: https://github.com/umami-software/umami
- PostHog: https://github.com/PostHog/posthog

---

## 13. 결론

OpenPanel과 같은 분석 플랫폼을 구축하기 위한 핵심 요소:

1. **확장 가능한 아키텍처**: Fastify + ClickHouse + Redis로 대용량 이벤트 처리
2. **실시간 처리**: BullMQ를 활용한 비동기 작업 처리
3. **효율적인 데이터 저장**: ClickHouse의 컬럼 기반 스토리지 활용
4. **타입 안전성**: TypeScript + tRPC + Zod로 엔드투엔드 타입 안전성 확보
5. **개발자 경험**: Monorepo + pnpm으로 효율적인 코드 관리
6. **보안**: 다층 인증 및 권한 관리 시스템
7. **성능 최적화**: 캐싱, 배치 처리, 인덱싱 전략

이 가이드를 기반으로 단계적으로 구현하면 프로덕션 레벨의 분석 플랫폼을 구축할 수 있습니다.

