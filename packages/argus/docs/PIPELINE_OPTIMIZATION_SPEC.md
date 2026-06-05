# Argus Pipeline Optimization Spec

> **전제**: 극단적 볼륨 (초당 수천~수만 이벤트)에서도 안정적으로 동작해야 함.
> **Redis 메모리**: 필요 시 증설. 메모리 예산은 제약 아님.
> **설정 원칙**: 모든 튜닝 파라미터(배치 주기, concurrency, 버퍼 크기 등)는 별도 설정 파일에서 관리. 하드코딩 금지.

---

## 목차

1. [Phase 0: 기반 인프라](#phase-0-기반-인프라)
   - [0-A. Redis 키/채널 상수 파일](#0-a-redis-키채널-상수-파일)
   - [0-B. 파이프라인 설정 파일](#0-b-파이프라인-설정-파일)
   - [0-C. GroupMQ 도입](#0-c-groupmq-도입)
2. [Phase 1: 설정 & 룰 인메모리 캐싱](#phase-1-설정--룰-인메모리-캐싱)
   - [1-A. Alert Rule Store](#1-a-alert-rule-store)
   - [1-B. DSN Key Store](#1-b-dsn-key-store)
3. [Phase 2: Issue Grouper 최적화](#phase-2-issue-grouper-최적화)
   - [2-A. Issue Lookup Cache](#2-a-issue-lookup-cache)
   - [2-B. short_id Redis 채번](#2-b-short_id-redis-채번)
4. [Phase 3: Discover Tags / Facets 캐싱](#phase-3-discover-tags--facets-캐싱)
5. [Phase 4: Event Frequency Redis 카운터](#phase-4-event-frequency-redis-카운터)
6. [Phase 5: Worker 구조 개선](#phase-5-worker-구조-개선)
7. [Phase 6: Pub/Sub 설정 전파 인프라](#phase-6-pubsub-설정-전파-인프라)
8. [Phase 7: 벤치마킹 도구](#phase-7-벤치마킹-도구)
9. [High-Pressure 배치 Flush 전략](#high-pressure-배치-flush-전략)

---

## Phase 0: 기반 인프라

> 다른 모든 Phase의 전제 조건. 가장 먼저 작업.

### 0-A. Redis 키/채널 상수 파일

**파일**: `src/config/redis-keys.ts`

**규칙**: 모든 Redis 키, Pub/Sub 채널명, GroupMQ 네임스페이스, 캐시 키 패턴은
반드시 이 파일에 정의한 후 import해서 사용. 인라인 문자열 사용 금지.

```typescript
// ── Pub/Sub 채널 ──
export const CHANNELS = {
  CONFIG_CHANGED: 'argus:config-changed',
} as const;

// ── Config Change Types ──
export const CONFIG_TYPES = {
  ALERT_RULES: 'alert_rules',
  DSN_KEYS: 'dsn_keys',
  ISSUE_STATUS: 'issue_status',
  PROJECT_SETTINGS: 'project_settings',
} as const;

// ── Redis Streams (기존 워커에서 사용 중인 것들 정리) ──
export const STREAMS = {
  ERRORS: 'argus:errors',
  TRANSACTIONS: 'argus:txns',
  SESSIONS: 'argus:sessions',
  FEEDBACK: 'argus:feedback',
  METRICS: 'argus:metrics',
  LOGS: 'argus:logs',
  streamKey: (base: string, projectId: string) => `${base}:${projectId}`,
} as const;

// ── Known Stream Sets (KEYS 명령 대체) ──
export const KNOWN_STREAMS = {
  ERRORS: 'argus:known-streams:errors',
  TRANSACTIONS: 'argus:known-streams:txns',
  SESSIONS: 'argus:known-streams:sessions',
  FEEDBACK: 'argus:known-streams:feedback',
  METRICS: 'argus:known-streams:metrics',
  LOGS: 'argus:known-streams:logs',
} as const;

// ── GroupMQ Namespaces ──
export const QUEUES = {
  ERROR_PROCESSING: 'argus:q:errors',
  TRANSACTION_PROCESSING: 'argus:q:txns',
} as const;

// ── Consumer Groups ──
export const CONSUMER_GROUPS = {
  ERRORS: 'argus-error-workers',
  TRANSACTIONS: 'argus-txn-workers',
  SESSIONS: 'argus-session-workers',
  FEEDBACK: 'argus-feedback-workers',
  METRICS: 'argus-metric-workers',
  LOGS: 'argus-log-workers',
} as const;

// ── 캐시 키 ──
export const CACHE = {
  DISCOVER_TAGS: (projectId: string) => `argus:cache:discover-tags:${projectId}`,
  LOG_FACETS: (projectId: string, period: string) =>
    `argus:cache:log-facets:${projectId}:${period}`,
} as const;

// ── 카운터 / 집계 ──
export const COUNTERS = {
  /** Sorted Set: score=timestamp, member=eventId */
  EVENT_COUNT: (projectId: string, issueId: number) =>
    `argus:evt-count:${projectId}:${issueId}`,
  /** HyperLogLog: unique user count per issue */
  USER_COUNT: (projectId: string, issueId: number) =>
    `argus:usr-hll:${projectId}:${issueId}`,
  /** Simple counter: project-level event count */
  PROJECT_EVENT_COUNT: (projectId: string) => `argus:proj-evt:${projectId}`,
  /** Hash: field=issue:{id}, value=pending increment */
  ISSUE_TIMES_SEEN: 'argus:issue-times-seen',
  /** Hash: field=short_id, atomic counter per project */
  ISSUE_SHORT_ID: (projectId: number) => `argus:issue-counter:${projectId}`,
} as const;

// ── 배치 Flush 버퍼 ──
export const BUFFERS = {
  ALERT_HISTORY: 'argus:buf:alert-history',
  ISSUE_LAST_SEEN: 'argus:buf:issue-last-seen',
} as const;
```

**마이그레이션 체크리스트** (기존 인라인 문자열을 상수로 교체):

| 현재 파일 | 현재 인라인 값 | 교체 대상 상수 |
|----------|---------------|--------------|
| `error-worker.ts:13` | `'argus:errors:*'` | `STREAMS.ERRORS + ':*'` → Phase 0-B에서 제거 |
| `error-worker.ts:14` | `'argus-error-workers'` | `CONSUMER_GROUPS.ERRORS` |
| `transaction-worker.ts:14` | `'argus:txns:*'` | `STREAMS.TRANSACTIONS + ':*'` → Phase 0-B에서 제거 |
| `transaction-worker.ts:15` | `'argus-txn-workers'` | `CONSUMER_GROUPS.TRANSACTIONS` |
| `session-worker.ts` | `'argus:sessions:*'` | `STREAMS.SESSIONS + ':*'` |
| `feedback-worker.ts` | `'argus:feedback:*'` | `STREAMS.FEEDBACK + ':*'` |
| `metric-worker.ts` | `'argus:metrics:*'` | `STREAMS.METRICS + ':*'` |
| `ingest.ts` | `STREAM_KEYS` 객체 내 문자열들 | `STREAMS.*` |
| `dsn-auth.ts` | `argus:dsn:*` Redis 캐시 키 | Phase 1-B에서 제거 |

---

### 0-B. 파이프라인 설정 파일

**파일**: `src/config/pipeline-config.ts`

**규칙**: 모든 튜닝 파라미터는 이 파일에서 관리. 환경변수로 오버라이드 가능.
하드코딩된 매직 넘버 사용 금지.

```typescript
/**
 * 파이프라인 최적화 관련 모든 튜닝 파라미터.
 * 환경변수로 오버라이드 가능 (ARGUS_ prefix).
 *
 * 변경 시 이 파일만 수정하면 모든 곳에 반영됨.
 */
export const pipelineConfig = {
  // ── GroupMQ ──
  groupmq: {
    /** 동시 처리하는 그룹(프로젝트) 수 */
    errorConcurrency: int('ARGUS_GROUPMQ_ERROR_CONCURRENCY', 100),
    /** 트랜잭션 워커 동시 처리 그룹 수 */
    txnConcurrency: int('ARGUS_GROUPMQ_TXN_CONCURRENCY', 100),
  },

  // ── ClickHouse 배치 버퍼 ──
  clickhouseBuffer: {
    /** ClickHouse flush 주기 (ms) */
    flushIntervalMs: int('ARGUS_CH_FLUSH_INTERVAL_MS', 1000),
    /** flush 트리거 배치 크기 */
    maxBatchSize: int('ARGUS_CH_MAX_BATCH_SIZE', 500),
  },

  // ── BatchFlusher ──
  batchFlush: {
    /** times_seen + last_seen flush 주기 (ms) */
    issueStatsIntervalMs: int('ARGUS_FLUSH_ISSUE_STATS_MS', 30_000),
    /** alert history flush 주기 (ms) */
    alertHistoryIntervalMs: int('ARGUS_FLUSH_ALERT_HISTORY_MS', 10_000),
    /** event counter 정리 주기 (ms) */
    counterCleanupIntervalMs: int('ARGUS_FLUSH_COUNTER_CLEANUP_MS', 300_000),
    /** event counter 최대 보존 시간 (ms) */
    counterMaxAgeMs: int('ARGUS_COUNTER_MAX_AGE_MS', 24 * 60 * 60 * 1000),
  },

  // ── Discover/Facet Cron ──
  discoverCache: {
    /** Cron 갱신 주기 (ms) */
    refreshIntervalMs: int('ARGUS_DISCOVER_REFRESH_MS', 300_000),
    /** 활성 프로젝트 판정 기준 (시간) */
    activeProjectHours: int('ARGUS_DISCOVER_ACTIVE_HOURS', 1),
  },

  // ── Worker 공통 ──
  worker: {
    /** Stream 워커 BLOCK 대기 시간 (ms) */
    blockMs: int('ARGUS_WORKER_BLOCK_MS', 5000),
    /** Redis SCAN COUNT 파라미터 */
    scanCount: int('ARGUS_SCAN_COUNT', 100),
  },

  // ── 벤치마킹 ──
  bench: {
    /** stress 시나리오 기본 duration (초) */
    defaultStressDurationSec: int('ARGUS_BENCH_STRESS_DURATION', 300),
    /** 기본 이벤트 수 */
    defaultEventCount: int('ARGUS_BENCH_DEFAULT_EVENTS', 10000),
    /** 기본 동시 요청 수 */
    defaultConcurrency: int('ARGUS_BENCH_DEFAULT_CONCURRENCY', 100),
  },
} as const;

function int(envKey: string, defaultValue: number): number {
  const v = process.env[envKey];
  return v ? parseInt(v, 10) : defaultValue;
}
```

**사용 예시**:
```typescript
import { pipelineConfig } from '../config/pipeline-config';

// ErrorWorker:
const worker = new Worker({
  queue,
  handler,
  concurrency: pipelineConfig.groupmq.errorConcurrency,
});

// BatchFlusher:
setInterval(() => this.flushIssueStats(), pipelineConfig.batchFlush.issueStatsIntervalMs);
```

---

### 0-C. GroupMQ 도입

**의존성 추가**:
```bash
cd packages/argus
npm install groupmq
```

**적용 대상**: Error Worker + Transaction Worker 모두.

**왜 둘 다 필요한가**:
- **Error Worker**: `groupIntoIssue()` 에서 같은 프로젝트의 이벤트가 동시 처리되면 `FOR UPDATE` lock 경합 발생
- **Transaction Worker**: 프로젝트별 순서 보장으로 future-proof (span 집계 등 추후 기능에서 필요)

#### Error Worker 전환 상세

**현재 코드** (`error-worker.ts`):
```
1. processLoop() — while(running) 무한 루프
2.   discoverStreams() — redis.keys('argus:errors:*')
3.   for each stream:
4.     xreadgroup() → messages
5.     for each message:
6.       processEvent() → normalize → fingerprint → groupIntoIssue → evaluateAlerts
7.     insertToClickHouse(batch)
8.     xack(messageIds)
```

**변경 후**:
```
1. Ingest API: GroupMQ queue.add({ groupId: projectId, data: serialized })
2. Worker: GroupMQ Worker handler receives jobs
3.   handler(job):
4.     job.groupId === projectId → 같은 프로젝트의 이벤트는 절대 동시 처리 안 됨
5.     processEvent(JSON.parse(job.data))
6.     ClickHouse batch insert는 GroupMQ 외부에서 주기적 flush
```

**변경 대상 파일**:

| 파일 | 변경 내용 |
|------|----------|
| `src/workers/error-worker.ts` | 전체 재작성 — `processLoop` + `discoverStreams` + `xreadgroup` 제거, GroupMQ Worker 사용 |
| `src/workers/transaction-worker.ts` | 동일 패턴으로 재작성 |
| `src/routes/ingest.ts` | 에러/트랜잭션: `redis.xadd()` → `queue.add({ groupId, data })` |
| `src/worker.ts` (엔트리) | GroupMQ Queue/Worker 인스턴스 생성 + start |

**GroupMQ Error Worker 구현 상세**:

```typescript
// src/workers/error-worker.ts (새 구조)
import Redis from 'ioredis';
import { Queue, Worker } from 'groupmq';
import { QUEUES } from '../config/redis-keys';
import { config } from '../config';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';
import { normalizeErrorEvent, NormalizedError } from '../processing/normalizer';
import { computeFingerprint } from '../processing/fingerprinter';
import { groupIntoIssue } from '../processing/issue-grouper';
import { evaluateErrorAlerts } from '../utils/alert-evaluator';
import { ArgusErrorEvent } from '../types/events';

const logger = createLogger('error-worker');

export class ErrorWorker {
  private redis: Redis;
  private queue: Queue;
  private worker: Worker | null = null;

  // ── ClickHouse 배치 버퍼 (설정값은 pipeline-config.ts에서 관리) ──
  private chBuffer: NormalizedError[] = [];
  private chFlushTimer: NodeJS.Timer | null = null;

  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue({
      redis: this.redis,
      namespace: QUEUES.ERROR_PROCESSING,
    });
  }

  async start(): Promise<void> {
    // ClickHouse 주기적 flush 타이머 시작
    this.chFlushTimer = setInterval(
      () => this.flushClickHouse(),
      pipelineConfig.clickhouseBuffer.flushIntervalMs
    );

    // GroupMQ Worker 시작
    this.worker = new Worker({
      queue: this.queue,
      handler: async (job) => {
        const rawEvent = JSON.parse(job.data) as ArgusErrorEvent & {
          project_id: string;
          internal_project_id: number;
          dsn_key_id: number;
        };

        const processed = await this.processEvent(rawEvent);
        if (processed) {
          this.chBuffer.push(processed);
          // 버퍼가 max에 도달하면 즉시 flush
          if (this.chBuffer.length >= pipelineConfig.clickhouseBuffer.maxBatchSize) {
            await this.flushClickHouse();
          }
        }
      },
      concurrency: pipelineConfig.groupmq.errorConcurrency,
    });

    await this.worker.run();
    logger.info('Error worker started (GroupMQ)', {
      namespace: QUEUES.ERROR_PROCESSING,
      concurrency: pipelineConfig.groupmq.errorConcurrency,
    });
  }

  async close(): Promise<void> {
    // 1. 워커 중지 (새 job 수신 중단)
    if (this.worker) await this.worker.close();
    // 2. 남은 ClickHouse 버퍼 flush
    if (this.chFlushTimer) clearInterval(this.chFlushTimer);
    await this.flushClickHouse();
    // 3. Redis 연결 종료
    await this.redis.quit();
    logger.info('Error worker stopped');
  }

  private async processEvent(rawEvent: /* ... */): Promise<NormalizedError | null> {
    // 기존 processEvent 로직 유지
    // 1. normalizeErrorEvent
    // 2. computeFingerprint
    // 3. groupIntoIssue (Phase 2에서 캐시 적용)
    // 4. evaluateErrorAlerts (Phase 1에서 인메모리 적용)
    // 5. return NormalizedError
  }

  private async flushClickHouse(): Promise<void> {
    if (this.chBuffer.length === 0) return;

    const batch = this.chBuffer.splice(0); // 버퍼를 비우고 복사
    try {
      await clickhouse.insert({
        table: 'argus.errors',
        values: batch,
        format: 'JSONEachRow',
      });
      logger.info('ClickHouse batch flushed', { count: batch.length });
    } catch (error) {
      // 실패 시 버퍼에 다시 넣기
      this.chBuffer.unshift(...batch);
      logger.error('ClickHouse flush failed, will retry', {
        count: batch.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
```

**GroupMQ Transaction Worker 구현 상세**:

```typescript
// src/workers/transaction-worker.ts (새 구조)
// Error Worker와 동일 패턴. 차이점:
// - namespace: QUEUES.TRANSACTION_PROCESSING
// - processEvent: normalizeTransactionEvent → { transaction, spans }
// - ClickHouse 테이블: argus.transactions + argus.spans
// - groupIntoIssue 호출 없음 (트랜잭션은 이슈 그루핑 불필요)
```

**Ingest 변경** (`src/routes/ingest.ts`):

```typescript
// 현재:
await redis.xadd(
  `argus:errors:${projectId}`,
  '*',
  'data', JSON.stringify(enrichedEvent)
);

// 변경:
import { Queue } from 'groupmq';
import { QUEUES } from '../config/redis-keys';

const errorQueue = new Queue({ redis, namespace: QUEUES.ERROR_PROCESSING });
const txnQueue = new Queue({ redis, namespace: QUEUES.TRANSACTION_PROCESSING });

// 에러 이벤트
await errorQueue.add({
  groupId: projectId,  // ← 프로젝트별 FIFO 보장
  data: JSON.stringify(enrichedEvent),
});

// 트랜잭션 이벤트
await txnQueue.add({
  groupId: projectId,
  data: JSON.stringify(enrichedEvent),
});

// 나머지 (session, feedback, metric, log) — 기존 Redis Streams 유지
await redis.xadd(`argus:sessions:${projectId}`, '*', 'data', JSON.stringify(data));
```

**Worker 엔트리 변경** (`src/worker.ts`):

```typescript
// 기존:
const errorWorker = new ErrorWorker();
await errorWorker.start();

// 변경 없음 — ErrorWorker 내부 구현만 바뀜.
// 단, BatchFlusher 추가 (아래 Phase 참조)

const batchFlusher = new BatchFlusher();
await batchFlusher.start();

// shutdown에 추가:
await batchFlusher.shutdown(); // 즉시 flush 후 종료
```

---

## Phase 1: 설정 & 룰 인메모리 캐싱

> TTL 없음. 시작 시 1회 로드 + Pub/Sub 변경 시 즉시 리로드.

### 1-A. Alert Rule Store

**파일**: `src/utils/alert-rule-store.ts` (신규)

**현재 문제** (`alert-evaluator.ts:135-144`):
```sql
-- 이벤트마다 실행됨
SELECT * FROM g_argus_alert_rules
WHERE project_id = ? AND enabled = 1 AND event_type = 'error'
```

**구현 상세**:

```typescript
import { mysqlPool } from '../config/mysql';
import { CHANNELS, CONFIG_TYPES } from '../config/redis-keys';
import Redis from 'ioredis';
import { createLogger } from './logger';

const logger = createLogger('alert-rule-store');

interface AlertRule {
  id: number;
  project_id: number;
  name: string;
  event_type: string;
  condition_type: string;
  threshold: number;
  window_seconds: number;
  // ... 기타 필드
  enabled: boolean;
}

export class AlertRuleStore {
  private rules: Map<number, AlertRule[]> = new Map(); // projectId → rules[]
  private subscriber: Redis;

  constructor(redisConfig: any) {
    this.subscriber = new Redis({
      ...redisConfig,
      maxRetriesPerRequest: null,
    });
  }

  /**
   * 워커 시작 시 호출. 전체 룰 로드 + Pub/Sub 구독.
   */
  async init(): Promise<void> {
    // 1. 전체 로드
    await this.loadAll();

    // 2. Pub/Sub 구독
    await this.subscriber.subscribe(CHANNELS.CONFIG_CHANGED);
    this.subscriber.on('message', async (_channel, message) => {
      try {
        const { type, projectId } = JSON.parse(message);
        if (type === CONFIG_TYPES.ALERT_RULES) {
          await this.reloadProject(projectId);
          logger.info('Alert rules reloaded via Pub/Sub', { projectId });
        }
      } catch (e) {
        logger.warn('Failed to process config change', { error: String(e) });
      }
    });

    logger.info('AlertRuleStore initialized', { ruleCount: this.totalRuleCount() });
  }

  /**
   * 프로젝트의 활성 룰 목록 조회. O(1) Map lookup.
   */
  getRules(projectId: number, eventType: string): AlertRule[] {
    const projectRules = this.rules.get(projectId) || [];
    return projectRules.filter(r => r.event_type === eventType);
  }

  /**
   * 특정 프로젝트의 룰만 리로드.
   */
  async reloadProject(projectId: number): Promise<void> {
    const [rows] = await mysqlPool.query(
      'SELECT * FROM g_argus_alert_rules WHERE project_id = ? AND enabled = 1',
      [projectId]
    );
    this.rules.set(projectId, rows as AlertRule[]);
  }

  private async loadAll(): Promise<void> {
    const [rows] = await mysqlPool.query(
      'SELECT * FROM g_argus_alert_rules WHERE enabled = 1'
    );
    this.rules.clear();
    for (const row of rows as AlertRule[]) {
      const existing = this.rules.get(row.project_id) || [];
      existing.push(row);
      this.rules.set(row.project_id, existing);
    }
  }

  private totalRuleCount(): number {
    let count = 0;
    for (const rules of this.rules.values()) count += rules.length;
    return count;
  }

  async close(): Promise<void> {
    await this.subscriber.quit();
  }
}
```

**alert-evaluator.ts 변경 사항**:

```diff
 // 현재:
-const [ruleRows] = await mysqlPool.query(
-  `SELECT * FROM g_argus_alert_rules WHERE project_id = ? AND enabled = 1 AND event_type = 'error'`,
-  [event.internal_project_id]
-);
-const rules = ruleRows as any[];

 // 변경:
+const rules = alertRuleStore.getRules(event.internal_project_id, 'error');
```

**호출 측 변경** (`worker.ts`):
```typescript
import { AlertRuleStore } from './utils/alert-rule-store';

const alertRuleStore = new AlertRuleStore(config.redis);
await alertRuleStore.init();
// alertRuleStore를 ErrorWorker에 주입 또는 싱글톤으로 export
```

**API 측 변경** (Alert Rule CRUD):
```typescript
// src/routes/alerts.ts — 룰 생성/수정/삭제 후:
await redis.publish(
  CHANNELS.CONFIG_CHANGED,
  JSON.stringify({ type: CONFIG_TYPES.ALERT_RULES, projectId })
);
```

---

### 1-B. DSN Key Store

**파일**: `src/utils/dsn-store.ts` (신규)

**현재 문제** (`dsn-auth.ts`):
- Redis GET → 미스 → MySQL SELECT → Redis SET (5분 TTL)
- 이벤트마다 최소 1번의 Redis 왕복

**구현**:

```typescript
export class DsnStore {
  private dsnMap: Map<string, DsnAuthResult> = new Map(); // publicKey → result
  private subscriber: Redis;

  async init(): Promise<void> {
    await this.loadAll();
    // Pub/Sub 구독
    await this.subscriber.subscribe(CHANNELS.CONFIG_CHANGED);
    this.subscriber.on('message', async (_channel, message) => {
      const { type } = JSON.parse(message);
      if (type === CONFIG_TYPES.DSN_KEYS) {
        await this.loadAll();
      }
    });
  }

  /**
   * O(1) lookup. Redis/MySQL 호출 없음.
   */
  lookup(publicKey: string): DsnAuthResult | null {
    return this.dsnMap.get(publicKey) || null;
  }

  async loadAll(): Promise<void> {
    const [rows] = await mysqlPool.query(`
      SELECT dk.*, ap.gatrix_project_id, ap.id as internal_project_id
      FROM g_argus_dsnKeys dk
      JOIN g_argus_projects ap ON dk.project_id = ap.id
      WHERE dk.is_active = 1
    `);
    this.dsnMap.clear();
    for (const row of rows as any[]) {
      this.dsnMap.set(row.public_key, {
        projectId: row.gatrix_project_id,
        internalProjectId: row.internal_project_id,
        dsnKeyId: row.id,
        isActive: true,
      });
    }
  }
}
```

**dsn-auth.ts 변경**:
```diff
-// Redis GET → MySQL fallback 로직 전체 제거
+const result = dsnStore.lookup(publicKey);
+if (!result) {
+  return reply.code(401).send({ error: 'Invalid DSN' });
+}
```

**API 측 변경** (DSN CRUD):
```typescript
// src/routes/projects.ts — DSN 생성/수정/삭제 후:
await redis.publish(
  CHANNELS.CONFIG_CHANGED,
  JSON.stringify({ type: CONFIG_TYPES.DSN_KEYS })
);
```

---

## Phase 2: Issue Grouper 최적화

### 2-A. Issue Lookup Cache

**파일**: `src/processing/issue-cache.ts` (신규)

**현재 문제** (`issue-grouper.ts:28-31`):
```sql
-- 이벤트마다 실행 (row lock 포함)
SELECT id, status, times_seen FROM g_argus_issues
WHERE project_id = ? AND primary_hash = ?
FOR UPDATE
```

> **핵심**: Phase 0의 GroupMQ로 같은 프로젝트 이벤트가 순차 처리되므로
> `FOR UPDATE` lock이 완전히 불필요해짐.

**구현**:

```typescript
import { COUNTERS, CHANNELS, CONFIG_TYPES } from '../config/redis-keys';
import Redis from 'ioredis';

interface CachedIssue {
  issueId: number;
  status: string;
  substatus: string | null;
}

export class IssueLookupCache {
  /** Map<"projectId:primaryHash", CachedIssue> */
  private cache: Map<string, CachedIssue> = new Map();
  private subscriber: Redis;

  async init(subscriber: Redis): Promise<void> {
    this.subscriber = subscriber;
    // 이슈 상태 변경 시 캐시 무효화
    // (ConfigSubscriber에서 위임받아 처리)
  }

  private key(projectId: number, primaryHash: string): string {
    return `${projectId}:${primaryHash}`;
  }

  get(projectId: number, primaryHash: string): CachedIssue | null {
    return this.cache.get(this.key(projectId, primaryHash)) || null;
  }

  set(projectId: number, primaryHash: string, issue: CachedIssue): void {
    this.cache.set(this.key(projectId, primaryHash), issue);
  }

  /**
   * 이슈 상태 변경 시 (resolve/unresolve 등) 해당 이슈를 가진 모든 캐시 무효화
   */
  invalidateByIssueId(issueId: number): void {
    for (const [key, value] of this.cache) {
      if (value.issueId === issueId) {
        this.cache.delete(key);
      }
    }
  }
}
```

**issue-grouper.ts 변경**:

```diff
 export async function groupIntoIssue(
   internalProjectId: number,
   projectId: string,
   event: ArgusErrorEvent,
   primaryHash: string,
-  fingerprint: string[]
+  fingerprint: string[],
+  cache: IssueLookupCache,
+  redis: Redis
 ): Promise<IssueGroupResult> {

+  // 1. 캐시 확인
+  const cached = cache.get(internalProjectId, primaryHash);
+  if (cached) {
+    const isRegression = cached.status === 'resolved';
+
+    // times_seen은 Redis에 누적 (BatchFlusher가 주기적 flush)
+    await redis.hincrby(COUNTERS.ISSUE_TIMES_SEEN, `issue:${cached.issueId}`, 1);
+    // last_seen도 Redis에 기록
+    await redis.hset(BUFFERS.ISSUE_LAST_SEEN, `issue:${cached.issueId}`, Date.now().toString());
+
+    if (isRegression) {
+      // 상태 변경은 즉시 MySQL (드물게 발생)
+      await mysqlPool.query(
+        `UPDATE g_argus_issues SET status = 'unresolved', substatus = 'regressed' WHERE id = ?`,
+        [cached.issueId]
+      );
+      cache.set(internalProjectId, primaryHash, { ...cached, status: 'unresolved', substatus: 'regressed' });
+    }
+
+    return { issue_id: cached.issueId, is_new: false, is_regression: isRegression };
+  }

+  // 2. 캐시 미스 → MySQL 조회 (FOR UPDATE 제거 — GroupMQ가 순서 보장)
-  const connection = await mysqlPool.getConnection();
-  try {
-    const [existing] = await connection.query(
-      `SELECT id, status, times_seen FROM g_argus_issues
-       WHERE project_id = ? AND primary_hash = ?
-       FOR UPDATE`,
-      [internalProjectId, primaryHash]
-    );
+  const [existing] = await mysqlPool.query(
+    `SELECT id, status, substatus FROM g_argus_issues
+     WHERE project_id = ? AND primary_hash = ?`,
+    [internalProjectId, primaryHash]
+  );

   const rows = existing as any[];
   if (rows.length > 0) {
     const issue = rows[0];
+    // 캐시에 적재
+    cache.set(internalProjectId, primaryHash, {
+      issueId: issue.id,
+      status: issue.status,
+      substatus: issue.substatus,
+    });
     // ... 기존 업데이트 로직 (times_seen은 Redis HINCRBY로 대체)
   }

   // 3. 새 이슈 생성
   // ... (기존 로직 유지, 단 short_id는 Redis 채번)
-  } finally {
-    connection.release();
-  }
```

### 2-B. short_id Redis 채번

**현재 문제** (`issue-grouper.ts:85-90`):
```sql
SELECT COALESCE(MAX(short_id), 0) + 1 as next_id
FROM g_argus_issues WHERE project_id = ?
```
→ 동시 INSERT 시 race condition (같은 short_id 발급 가능)

**변경**:
```typescript
// Redis atomic increment — race condition 불가능
const nextShortId = await redis.hincrby(
  COUNTERS.ISSUE_SHORT_ID(internalProjectId),
  'short_id',
  1
);
```

**초기화**: 워커 시작 시 각 프로젝트의 현재 MAX(short_id)를 Redis에 셋업.
```typescript
// AlertRuleStore.init() 와 유사하게 시작 시 1회 실행
const [rows] = await mysqlPool.query(
  'SELECT project_id, COALESCE(MAX(short_id), 0) as max_id FROM g_argus_issues GROUP BY project_id'
);
for (const row of rows as any[]) {
  await redis.hsetnx(COUNTERS.ISSUE_SHORT_ID(row.project_id), 'short_id', row.max_id);
}
```

---

## Phase 3: Discover Tags / Facets 캐싱

> 데이터 집계 결과이므로 Pub/Sub이 아닌 Cron 주기적 갱신 모델.

**현재 문제**:
- `discover.ts:248-370` — 10개 태그의 UNION ALL (30일 full scan)
- `logs.ts:150-201` — 4개 ClickHouse 쿼리를 `Promise.all`로 동시 실행

**변경 대상**:

| 파일 | 엔드포인트 | Redis 키 |
|------|----------|---------|
| `discover.ts` | `GET /:projectId/discover/tags` | `CACHE.DISCOVER_TAGS(projectId)` |
| `logs.ts` | `GET /:projectId/logs/facets` | `CACHE.LOG_FACETS(projectId, period)` |

**라우트 핸들러 변경 패턴**:

```typescript
// discover.ts — tags 핸들러
const cacheKey = CACHE.DISCOVER_TAGS(projectId);
const cached = await redis.get(cacheKey);
if (cached) {
  return reply.send(JSON.parse(cached));
}

// 캐시 미스 (최초 또는 Cron 이전)
const result = await queryClickHouseTags(projectId, period);
await redis.set(cacheKey, JSON.stringify(result));
return reply.send(result);
```

**Cron 작업** (`cron-supervisor-worker.ts`에 등록):

```typescript
// 5분마다 실행
async function refreshDiscoverCaches(): Promise<void> {
  // 최근 1시간 내 이벤트가 있는 활성 프로젝트 목록
  const [projects] = await mysqlPool.query(`
    SELECT DISTINCT p.id, p.gatrix_project_id
    FROM g_argus_projects p
    JOIN g_argus_dsnKeys dk ON dk.project_id = p.id
    WHERE dk.last_seen > DATE_SUB(NOW(), INTERVAL 1 HOUR)
  `);

  for (const project of projects as any[]) {
    try {
      const tags = await queryClickHouseTags(project.gatrix_project_id, '24h');
      await redis.set(
        CACHE.DISCOVER_TAGS(project.gatrix_project_id),
        JSON.stringify(tags)
      );
    } catch (e) {
      logger.warn('Failed to refresh discover cache', {
        projectId: project.gatrix_project_id,
        error: String(e),
      });
    }
  }
}
```

---

## Phase 4: Event Frequency Redis 카운터

**현재 문제** (`alert-evaluator.ts:273-328`):
```sql
-- 이벤트마다 실행 (최대 3회)
SELECT count() FROM argus.errors WHERE issue_id = ? AND timestamp >= ?  -- event_frequency
SELECT uniq(user_id) FROM argus.errors WHERE issue_id = ? AND timestamp >= ?  -- user_count
SELECT count() FROM argus.errors WHERE project_id = ? AND timestamp >= ?  -- project_error_rate
```

**변경**:

| 현재 | 변경 후 | Redis 자료구조 |
|------|---------|---------------|
| ClickHouse `count()` | `ZCARD` | Sorted Set (`COUNTERS.EVENT_COUNT`) |
| ClickHouse `uniq(user_id)` | `PFCOUNT` | HyperLogLog (`COUNTERS.USER_COUNT`) |
| ClickHouse project `count()` | `INCR + GET` | Simple Counter (`COUNTERS.PROJECT_EVENT_COUNT`) |

**이벤트 처리 시 카운터 등록** (`error-worker.ts`):

```typescript
// processEvent 내부, groupIntoIssue 직후:
const now = Date.now();
const eventId = rawEvent.event_id;
const pipeline = redis.pipeline();

// 1. Event count (Sorted Set)
pipeline.zadd(
  COUNTERS.EVENT_COUNT(projectId, issueId),
  now.toString(),
  eventId
);

// 2. Unique user count (HyperLogLog)
if (rawEvent.user?.id || rawEvent.user?.ip_address) {
  pipeline.pfadd(
    COUNTERS.USER_COUNT(projectId, issueId),
    rawEvent.user?.id || rawEvent.user?.ip_address || ''
  );
}

// 3. Project-level event count
pipeline.incr(COUNTERS.PROJECT_EVENT_COUNT(projectId));

await pipeline.exec();
```

**alert-evaluator.ts 변경**:

```diff
-async function getEventCountInWindow(
-  projectId: string,
-  issueId: number,
-  windowSeconds: number
-): Promise<number> {
-  const result = await clickhouse.query({ /* ... COUNT() ... */ });
-  // ...
-}

+async function getEventCountInWindow(
+  projectId: string,
+  issueId: number,
+  windowSeconds: number
+): Promise<number> {
+  const key = COUNTERS.EVENT_COUNT(projectId, issueId);
+  const minScore = Date.now() - (windowSeconds * 1000);
+  return redis.zcount(key, minScore, '+inf');
+}
```

**카운터 정리** (BatchFlusher에서 주기적 실행):
```typescript
// 5분마다: 오래된 엔트리 정리
async function cleanupEventCounters(): Promise<void> {
  const maxAge = 24 * 60 * 60 * 1000; // 24시간
  const cutoff = Date.now() - maxAge;

  // SCAN으로 argus:evt-count:* 키 순회
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'argus:evt-count:*', 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      const pipeline = redis.pipeline();
      for (const key of keys) {
        pipeline.zremrangebyscore(key, '-inf', cutoff);
      }
      await pipeline.exec();
    }
  } while (cursor !== '0');
}
```

---

## Phase 5: Worker 구조 개선

### 5-A. `KEYS` 명령 제거

**현재**: 매 루프마다 `redis.keys('argus:errors:*')` (O(N), 프로덕션 위험)

> **참고**: Error/Transaction Worker는 Phase 0에서 GroupMQ로 전환되므로
> `KEYS` 문제는 자동 해결됨. 나머지 워커(session, feedback, metric)만 처리.

**변경 대상**: `session-worker.ts`, `feedback-worker.ts`, `metric-worker.ts`

```diff
 // 현재:
-const keys = await this.redis.keys('argus:sessions:*');

 // 변경:
+const keys = await this.redis.smembers(KNOWN_STREAMS.SESSIONS);
```

**Ingest 측 변경** (`ingest.ts`):
```typescript
// 새 stream 생성 시 등록
await redis.sadd(KNOWN_STREAMS.SESSIONS, streamKey);
await redis.xadd(streamKey, '*', 'data', JSON.stringify(data));
```

### 5-B. Log Worker 추가

**현재**: `logs.ts POST /:projectId/logs` — API에서 ClickHouse 직접 insert

**변경**:

| 파일 | 변경 |
|------|------|
| `logs.ts` POST 핸들러 | ClickHouse insert → Redis Stream `xadd` |
| `src/workers/log-worker.ts` (신규) | Consumer Group 패턴으로 batch insert |

**log-worker.ts**: session-worker.ts와 동일 패턴. 차이점은 ClickHouse 테이블이 `argus.logs`.

---

## Phase 6: Pub/Sub 설정 전파 인프라

**파일**: `src/utils/config-broadcaster.ts` (신규)

> Phase 1, 2에서 사용하는 Pub/Sub의 공통 인프라.

### 발행 측 (API)

```typescript
import Redis from 'ioredis';
import { CHANNELS } from '../config/redis-keys';

export class ConfigBroadcaster {
  constructor(private redis: Redis) {}

  async publish(payload: { type: string; projectId?: number; issueId?: number }): Promise<void> {
    await this.redis.publish(CHANNELS.CONFIG_CHANGED, JSON.stringify(payload));
  }
}
```

### 구독 측 (Worker)

```typescript
import { CHANNELS, CONFIG_TYPES } from '../config/redis-keys';

type Handler = (payload: any) => Promise<void>;

export class ConfigSubscriber {
  private handlers: Map<string, Handler[]> = new Map();
  private subscriber: Redis;

  constructor(redisConfig: any) {
    this.subscriber = new Redis({ ...redisConfig, maxRetriesPerRequest: null });
  }

  on(type: string, handler: Handler): void {
    const existing = this.handlers.get(type) || [];
    existing.push(handler);
    this.handlers.set(type, existing);
  }

  async start(): Promise<void> {
    await this.subscriber.subscribe(CHANNELS.CONFIG_CHANGED);
    this.subscriber.on('message', async (_channel, message) => {
      try {
        const payload = JSON.parse(message);
        const handlers = this.handlers.get(payload.type) || [];
        await Promise.all(handlers.map(h => h(payload)));
      } catch (e) {
        // log error
      }
    });
  }

  async close(): Promise<void> {
    await this.subscriber.quit();
  }
}
```

### 발행 지점 체크리스트

| API 파일 | 액션 | publish type |
|---------|------|-------------|
| `routes/alerts.ts` | Alert Rule 생성/수정/삭제 | `CONFIG_TYPES.ALERT_RULES` + projectId |
| `routes/projects.ts` | DSN Key 생성/수정/삭제 | `CONFIG_TYPES.DSN_KEYS` |
| `routes/projects.ts` | 프로젝트 설정 변경 | `CONFIG_TYPES.PROJECT_SETTINGS` + projectId |
| `routes/issues.ts` | 이슈 상태 변경 (resolve/unresolve/ignore) | `CONFIG_TYPES.ISSUE_STATUS` + issueId |

---

## Phase 7: 벤치마킹 도구

**파일**: `scripts/argus-bench.ts` (신규)

### 사용법

```bash
# 시나리오별 실행
npx ts-node scripts/argus-bench.ts --scenario ingest --events 50000 --concurrency 100
npx ts-node scripts/argus-bench.ts --scenario full-pipeline --events 10000
npx ts-node scripts/argus-bench.ts --scenario worker-processing --events 5000
npx ts-node scripts/argus-bench.ts --scenario trace-processing --events 5000 --spans-per-txn 10
npx ts-node scripts/argus-bench.ts --scenario query --iterations 200
npx ts-node scripts/argus-bench.ts --scenario stress --duration 300

# Baseline 저장
npx ts-node scripts/argus-bench.ts --scenario full-pipeline --events 50000 --save baseline.json

# Before/After 비교
npx ts-node scripts/argus-bench.ts --scenario full-pipeline --events 50000 --compare baseline.json
```

### 시나리오 상세

| 시나리오 | 동작 | 핵심 지표 |
|---------|------|----------|
| `ingest` | HTTP POST로 에러/트랜잭션/로그 이벤트 N건 전송 | RPS, p50/p95/p99 latency |
| `full-pipeline` | ingest → 워커 처리 완료 대기 (에러 + 트랜잭션) | End-to-end latency, throughput |
| `worker-processing` | Redis에 이벤트 직접 주입 → 워커 처리 | Events/sec, MySQL queries/event |
| `trace-processing` | 트랜잭션 + span 파이프라인 단독 측정 | Spans/sec, CH insert latency, span 누락율 |
| `query` | Discover tags, Log facets, Issue list 반복 조회 | Response time p50/p95/p99 |
| `alert-evaluation` | Alert 평가만 반복 호출 | Evaluations/sec, DB queries/event |
| `stress` | 지속적 high-pressure (설정 시간 동안) | 처리량 저하 여부, 메모리 증가 |

### trace-processing 시나리오 상세

트랜잭션 + span 파이프라인을 집중 측정하는 시나리오:

```bash
# 기본: 트랜잭션 5000건, 각각 span 10개 = span 50,000건
npx ts-node scripts/argus-bench.ts --scenario trace-processing --events 5000 --spans-per-txn 10

# 대규모 trace: span 20개씩
npx ts-node scripts/argus-bench.ts --scenario trace-processing --events 10000 --spans-per-txn 20
```

**측정 항목**:
| 지표 | 설명 |
|------|------|
| Transactions/sec | 트랜잭션 처리 속도 |
| Spans/sec | span 처리 속도 (txn × spans-per-txn) |
| Span insert latency | ClickHouse spans 테이블 batch insert 소요 시간 |
| Span 누락율 | 전송한 span 수 vs ClickHouse에 실제 적재된 수 |
| Txn insert latency | ClickHouse transactions 테이블 batch insert 소요 시간 |
| GroupMQ txn queue depth | 트랜잭션 큐 pending count |

### 수집 메트릭

| 메트릭 | 수집 방법 |
|--------|----------|
| Throughput (events/sec) | 타이머 기반 계산 |
| Throughput (spans/sec) | trace 시나리오 전용 |
| Latency (p50/p95/p99) | hdr-histogram 또는 수동 정렬 |
| MySQL Queries (총 수) | `SHOW GLOBAL STATUS LIKE 'Questions'` (before/after) |
| ClickHouse Queries (총 수) | `system.query_log` 카운트 (before/after) |
| ClickHouse Rows Written | `system.query_log` written_rows 합계 (errors, transactions, spans 각각) |
| Redis Commands (총 수) | `INFO commandstats` 파싱 (before/after) |
| Memory (RSS) | `process.memoryUsage().rss` |
| Queue Depth | GroupMQ pending count (error + txn 각각) / Redis stream `XLEN` |

### 출력 포맷

```
┌──────────────────────┬────────────┬────────────┬─────────┐
│ Metric               │ Baseline   │ Current    │ Change  │
├──────────────────────┼────────────┼────────────┼─────────┤
│ Error Ingest RPS     │ 2,340      │ 8,920      │ +281%   │
│ Txn Ingest RPS       │ 1,850      │ 7,200      │ +289%   │
│ Span throughput/sec  │ 18,500     │ 72,000     │ +289%   │
│ E2E p95 (ms)         │ 847        │ 124        │ -85%    │
│ MySQL queries        │ 45,230     │ 1,204      │ -97%    │
│ CH queries           │ 12,100     │ 340        │ -97%    │
│ CH rows (errors)     │ 10,000     │ 10,000     │ 0%      │
│ CH rows (spans)      │ 50,000     │ 50,000     │ 0%      │
│ Peak RSS (MB)        │ 312        │ 389        │ +25%    │
│ GroupMQ err pending  │ n/a        │ 23         │ n/a     │
│ GroupMQ txn pending  │ n/a        │ 12         │ n/a     │
└──────────────────────┴────────────┴────────────┴─────────┘
```

JSON 출력도 지원 (`--output json`).

### CLI 옵션 전체 목록

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `--scenario` | string | 필수 | 실행할 시나리오 |
| `--events` | number | `pipelineConfig.bench.defaultEventCount` | 이벤트 수 |
| `--concurrency` | number | `pipelineConfig.bench.defaultConcurrency` | 동시 요청 수 |
| `--spans-per-txn` | number | 5 | trace 시나리오: 트랜잭션당 span 수 |
| `--duration` | number | `pipelineConfig.bench.defaultStressDurationSec` | stress 시나리오 지속 시간(초) |
| `--iterations` | number | 100 | query 시나리오 반복 횟수 |
| `--save` | string | - | 결과를 JSON 파일로 저장 |
| `--compare` | string | - | 기존 baseline JSON과 비교 |
| `--output` | string | `table` | 출력 형식 (`table` \| `json`) |

---

## High-Pressure 배치 Flush 전략

> 이벤트마다 즉시 MySQL 쓰기 → Redis 버퍼에 누적 → 주기적 배치 flush

**파일**: `src/utils/batch-flusher.ts` (신규)

### Flush 대상 목록

| 항목 | 현재 | 변경 | Redis 키 | flush 주기 |
|------|------|------|---------|-----------|
| `times_seen` | MySQL UPDATE ×1/event | HINCRBY | `COUNTERS.ISSUE_TIMES_SEEN` | 30초 |
| `last_seen` | MySQL UPDATE ×1/event | HSET | `BUFFERS.ISSUE_LAST_SEEN` | 30초 |
| Alert History | MySQL INSERT ×1/alert | RPUSH | `BUFFERS.ALERT_HISTORY` | 10초 |
| Event Counter 정리 | 없음 | ZREMRANGEBYSCORE | `COUNTERS.EVENT_COUNT(*)` | 5분 |

### 구현 상세

```typescript
import { mysqlPool } from '../config/mysql';
import { COUNTERS, BUFFERS } from '../config/redis-keys';
import Redis from 'ioredis';
import { createLogger } from './logger';

const logger = createLogger('batch-flusher');

export class BatchFlusher {
  private timers: NodeJS.Timer[] = [];
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async start(): Promise<void> {
    const { issueStatsIntervalMs, alertHistoryIntervalMs, counterCleanupIntervalMs } =
      pipelineConfig.batchFlush;

    this.timers.push(setInterval(() => this.flushIssueStats(), issueStatsIntervalMs));
    this.timers.push(setInterval(() => this.flushAlertHistory(), alertHistoryIntervalMs));
    this.timers.push(setInterval(() => this.cleanupEventCounters(), counterCleanupIntervalMs));

    logger.info('BatchFlusher started', {
      issueStatsIntervalMs,
      alertHistoryIntervalMs,
      counterCleanupIntervalMs,
    });
  }

  async shutdown(): Promise<void> {
    this.timers.forEach(t => clearInterval(t));
    // 즉시 flush — 데이터 유실 방지
    await Promise.all([
      this.flushIssueStats(),
      this.flushAlertHistory(),
    ]);
    logger.info('BatchFlusher shutdown complete');
  }

  /**
   * times_seen + last_seen 배치 UPDATE
   *
   * Redis:
   *   HGETALL argus:issue-times-seen  → { "issue:123": "5", "issue:456": "12" }
   *   HGETALL argus:buf:issue-last-seen → { "issue:123": "1717624800000" }
   *
   * MySQL:
   *   UPDATE g_argus_issues SET times_seen = times_seen + 5, last_seen = ? WHERE id = 123;
   *   UPDATE g_argus_issues SET times_seen = times_seen + 12, last_seen = ? WHERE id = 456;
   *
   * 실패 시: HDEL 안 함 → 다음 주기에 자동 재시도
   */
  private async flushIssueStats(): Promise<void> {
    const timesSeenData = await this.redis.hgetall(COUNTERS.ISSUE_TIMES_SEEN);
    const lastSeenData = await this.redis.hgetall(BUFFERS.ISSUE_LAST_SEEN);

    const entries = Object.entries(timesSeenData);
    if (entries.length === 0) return;

    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();

      for (const [field, increment] of entries) {
        const issueId = parseInt(field.replace('issue:', ''), 10);
        const lastSeenMs = lastSeenData[field];
        const lastSeen = lastSeenMs
          ? new Date(parseInt(lastSeenMs, 10)).toISOString()
          : new Date().toISOString();

        await connection.query(
          `UPDATE g_argus_issues
           SET times_seen = times_seen + ?,
               last_seen = ?
           WHERE id = ?`,
          [parseInt(increment, 10), lastSeen, issueId]
        );
      }

      await connection.commit();

      // 성공 시에만 Redis에서 제거
      const pipeline = this.redis.pipeline();
      for (const [field] of entries) {
        pipeline.hdel(COUNTERS.ISSUE_TIMES_SEEN, field);
        pipeline.hdel(BUFFERS.ISSUE_LAST_SEEN, field);
      }
      await pipeline.exec();

      logger.info('Issue stats flushed', { count: entries.length });
    } catch (error) {
      await connection.rollback();
      logger.error('Issue stats flush failed (will retry)', {
        count: entries.length,
        error: error instanceof Error ? error.message : String(error),
      });
      // HDEL 안 함 → 다음 주기에 재시도
    } finally {
      connection.release();
    }
  }

  /**
   * Alert History 배치 INSERT
   *
   * Redis:
   *   LRANGE argus:buf:alert-history 0 -1 → JSON[]
   *   LTRIM argus:buf:alert-history len -1  (atomically drain)
   *
   * MySQL:
   *   INSERT INTO g_argus_alert_history (...) VALUES (...), (...), ...
   */
  private async flushAlertHistory(): Promise<void> {
    // Atomically read and trim
    const len = await this.redis.llen(BUFFERS.ALERT_HISTORY);
    if (len === 0) return;

    const items = await this.redis.lrange(BUFFERS.ALERT_HISTORY, 0, len - 1);
    if (items.length === 0) return;

    try {
      const records = items.map(item => JSON.parse(item));
      // Batch INSERT
      if (records.length > 0) {
        const placeholders = records.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const values = records.flatMap(r => [
          r.alert_rule_id, r.project_id, r.issue_id, r.triggered_value, r.triggered_at,
        ]);

        await mysqlPool.query(
          `INSERT INTO g_argus_alert_history
           (alert_rule_id, project_id, issue_id, triggered_value, triggered_at)
           VALUES ${placeholders}`,
          values
        );
      }

      // 성공 시에만 Redis에서 제거
      await this.redis.ltrim(BUFFERS.ALERT_HISTORY, len, -1);
      logger.info('Alert history flushed', { count: items.length });
    } catch (error) {
      logger.error('Alert history flush failed (will retry)', {
        count: items.length,
        error: error instanceof Error ? error.message : String(error),
      });
      // ltrim 안 함 → 다음 주기에 재시도
    }
  }

  /**
   * Event Counter 정리 — 24시간 이상 오래된 ZSET 엔트리 제거
   */
  private async cleanupEventCounters(): Promise<void> {
    const cutoff = Date.now() - pipelineConfig.batchFlush.counterMaxAgeMs;
    let cursor = '0';
    let cleaned = 0;

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor, 'MATCH', 'argus:evt-count:*', 'COUNT', 100
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        const pipeline = this.redis.pipeline();
        for (const key of keys) {
          pipeline.zremrangebyscore(key, '-inf', cutoff);
        }
        const results = await pipeline.exec();
        cleaned += results?.reduce((sum, [, count]) => sum + (count as number || 0), 0) || 0;
      }
    } while (cursor !== '0');

    if (cleaned > 0) {
      logger.info('Event counters cleaned', { removedEntries: cleaned });
    }
  }
}
```

### worker.ts 통합

```typescript
// src/worker.ts
import { BatchFlusher } from './utils/batch-flusher';

async function start() {
  // ... 기존 DB 연결 테스트 ...

  const batchFlusher = new BatchFlusher(redis);
  await batchFlusher.start();

  const errorWorker = new ErrorWorker();
  const transactionWorker = new TransactionWorker();
  // ... 나머지 워커들 ...

  await errorWorker.start();
  await transactionWorker.start();
  // ...

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down...`);

    // 1. 워커 중지 (새 이벤트 수신 중단)
    await Promise.all([
      errorWorker.close(),
      transactionWorker.close(),
      // ...
    ]);

    // 2. 배치 flush (누적 데이터 즉시 기록)
    await batchFlusher.shutdown();

    logger.info('All workers closed, buffers flushed');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
```

---

## 전체 변경 파일 체크리스트

### 신규 파일

| 파일 | Phase | 설명 |
|------|-------|------|
| `src/config/redis-keys.ts` | 0 | Redis 키/채널 상수 |
| `src/config/pipeline-config.ts` | 0 | 파이프라인 튜닝 파라미터 (환경변수 오버라이드 가능) |
| `src/utils/alert-rule-store.ts` | 1 | Alert Rule 인메모리 Store |
| `src/utils/dsn-store.ts` | 1 | DSN Key 인메모리 Store |
| `src/processing/issue-cache.ts` | 2 | Issue Lookup 인메모리 Cache |
| `src/utils/event-counter.ts` | 4 | Redis Sliding Window Counter |
| `src/workers/log-worker.ts` | 5 | Log 전용 Consumer Worker |
| `src/utils/config-broadcaster.ts` | 6 | Pub/Sub 발행 유틸 |
| `src/utils/config-subscriber.ts` | 6 | Pub/Sub 구독 유틸 |
| `src/utils/batch-flusher.ts` | HP | 배치 Flush 관리자 |
| `scripts/argus-bench.ts` | 7 | 벤치마킹 CLI 도구 |

### 수정 파일

| 파일 | Phase | 변경 요약 |
|------|-------|----------|
| `src/workers/error-worker.ts` | 0 | Redis Streams → GroupMQ Worker 전환 |
| `src/workers/transaction-worker.ts` | 0 | Redis Streams → GroupMQ Worker 전환 |
| `src/routes/ingest.ts` | 0 | error/txn: xadd → GroupMQ add, log stream 추가 |
| `src/worker.ts` | 0 | GroupMQ + BatchFlusher + ConfigSubscriber 통합 |
| `src/utils/alert-evaluator.ts` | 1,4 | MySQL→Store, ClickHouse→Redis counter |
| `src/middleware/dsn-auth.ts` | 1 | Redis/MySQL → DsnStore.lookup() |
| `src/processing/issue-grouper.ts` | 2 | FOR UPDATE 제거, 캐시 적용, HINCRBY |
| `src/routes/discover.ts` | 3 | ClickHouse → Redis 캐시 읽기 |
| `src/routes/logs.ts` | 3,5 | facets 캐시, POST logs → stream |
| `src/workers/session-worker.ts` | 5 | KEYS → SMEMBERS |
| `src/workers/feedback-worker.ts` | 5 | KEYS → SMEMBERS |
| `src/workers/metric-worker.ts` | 5 | KEYS → SMEMBERS |
| `src/routes/alerts.ts` | 6 | CRUD 후 Pub/Sub publish |
| `src/routes/projects.ts` | 6 | DSN/설정 변경 후 Pub/Sub publish |
| `src/routes/issues.ts` | 6 | 상태 변경 후 Pub/Sub publish |
| `src/workers/cron-supervisor-worker.ts` | 3 | Discover/Facet 주기적 갱신 작업 등록 |
| `package.json` | 0 | groupmq 의존성 추가 |
