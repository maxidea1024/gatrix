# Optic — Argus Query Abstraction Layer

> **상태**: 설계 (Design)
> **최종 수정**: 2026-06-06
> **영감**: Sentry Snuba (ClickHouse 쿼리 서비스)

---

## 1. 개요

**Optic**(시신경)은 Argus의 ClickHouse 쿼리를 추상화하는 내부 서비스 레이어입니다.
Argus(백 개의 눈을 가진 감시자)의 눈(데이터 소스)에서 두뇌(애플리케이션)로 데이터를 전달하는 경로 역할을 합니다.

### 왜 필요한가

현재 Argus는 **95+개의 raw ClickHouse SQL**이 12개 route 파일에 인라인으로 산재해 있습니다.
이로 인해 다음과 같은 문제가 발생합니다:

| 문제 | 영향 |
|------|------|
| SQL 문자열이 route 로직과 혼재 | 비즈니스 로직과 데이터 접근 레이어 분리 불가 |
| 동일 패턴이 파일 간 복붙 | 변경 시 10+개 파일 수정 필요, 불일치 발생 |
| 시간 필터 구성이 3가지 이상 존재 | `now() - INTERVAL`, `toDateTime(fillStart)`, `>= 'start'` 혼재 |
| 스키마 변경 시 전체 검색 필요 | 컬럼명 변경 시 grep으로 파일을 뒤져야 함 |
| 쿼리 성능 측정 불가 | 느린 쿼리 감지, 메트릭 수집 인프라 없음 |
| 보안 검증 분산 | `ALLOWED_COLUMNS` 세트가 파일마다 중복 정의 |

### 현재 쿼리 분포

```
Route 파일               ClickHouse 쿼리 수   주요 패턴
────────────────────────────────────────────────────────────
overview.ts              15                  집계, 트렌드, 분포, 이전 기간 비교
discover.ts               3                  동적 쿼리 빌더, 태그 분포
performance.ts            9                  트랜잭션 집계, waterfall, suspect tags
issues.ts                 7                  이벤트 조회, 태그 분포, sparkline
logs.ts                   8                  로그 브라우징, 패턴 분석, live tail
traces.ts                 8                  스팬 집계, 트레이스 목록
sessions.ts               8                  세션 헬스, 릴리스별 분포
metrics.ts                6                  메트릭 시계열, 요약
releases.ts               5                  릴리스별 에러/세션 집계
projects.ts               3                  프로젝트 통계
feedback.ts              ~5                  피드백 조회, 감정 분석
Workers (7개)             7 inserts          배치 ingestion
```

---

## 2. 아키텍처

### 2.1. 계층 구조

```
┌─────────────────────────────────────────────────────────┐
│                     Route Layer                         │
│  overview.ts │ discover.ts │ issues.ts │ logs.ts │ ...  │
└──────────────────────┬──────────────────────────────────┘
                       │  OpticQuery (선언적 쿼리 객체)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                    Optic Client                         │
│  ┌───────────┐ ┌──────────────┐ ┌─────────────────┐    │
│  │  Logging   │ │   Caching    │ │  Rate Limiting  │    │
│  │  & Metrics │ │  (Redis)     │ │  (per-project)  │    │
│  └───────────┘ └──────────────┘ └─────────────────┘    │
└──────────────────────┬──────────────────────────────────┘
                       │  validated OpticQuery
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  Query Builder                          │
│  ┌─────────────┐ ┌───────────────┐ ┌────────────────┐  │
│  │ Validation  │ │  SQL Generate │ │  MV Routing    │  │
│  │ (schema     │ │  (parameterized│ │  (materialized │  │
│  │  check)     │ │   ClickHouse)  │ │   view auto)   │  │
│  └─────────────┘ └───────────────┘ └────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │  validated SQL + params
                       ▼
┌─────────────────────────────────────────────────────────┐
│               Dataset Registry                          │
│  ┌────────┐ ┌──────────────┐ ┌────────┐ ┌────────────┐ │
│  │ errors │ │ transactions │ │  logs  │ │  sessions  │ │
│  └────────┘ └──────────────┘ └────────┘ └────────────┘ │
│  ┌────────┐ ┌──────────────┐ ┌──────────────────────┐  │
│  │ spans  │ │   metrics    │ │ monitor_checkins     │  │
│  └────────┘ └──────────────┘ └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                       │  table name, column types
                       ▼
┌─────────────────────────────────────────────────────────┐
│              ClickHouse Client (@clickhouse/client)     │
└─────────────────────────────────────────────────────────┘
```

### 2.2. 계층별 책임

| 계층 | 파일 | 책임 |
|------|------|------|
| **Dataset Registry** | `optic/datasets/*.ts` | 테이블 스키마 정의, 컬럼 허용 목록, 타입 정보, alias 매핑 |
| **Query Builder** | `optic/query-builder.ts` | OpticQuery → parameterized ClickHouse SQL 변환, 유효성 검증 |
| **Optic Client** | `optic/client.ts` | 쿼리 실행, 결과 파싱, 로깅, 캐싱, batch 실행 |
| **Route Layer** | `routes/*.ts` | 선언적 OpticQuery 객체 구성, 결과를 HTTP 응답으로 변환 |

### 2.3. 핵심 설계 원칙

1. **선언적 쿼리**: Route는 "무엇을" 조회할지만 선언하고, "어떻게" SQL을 만들지는 Optic이 담당
2. **스키마 중심**: 모든 컬럼 허용 여부는 Dataset 정의에서 관리. 한곳에서 변경하면 전체 반영
3. **project_id + timeRange 자동 주입**: 모든 쿼리에 공통인 조건을 자동 처리
4. **escape hatch**: 복잡한 쿼리(JOIN, 서브쿼리)는 `rawQuery()`로 직접 SQL 작성 가능
5. **QueryParser 통합**: 기존 Sentry-compatible 검색 문법을 search 파라미터로 자연스럽게 통합

---

## 3. Dataset 정의

각 Dataset은 ClickHouse 테이블 하나에 대응하며, 스키마 메타데이터를 포함합니다.

### 3.1. Dataset 구조

```typescript
interface DatasetConfig {
  /** 데이터셋 식별자 (e.g., 'errors', 'transactions') */
  name: string;

  /** ClickHouse 테이블 전체 경로 (e.g., 'argus.errors') */
  table: string;

  /** 타임스탬프 컬럼명 (시간 필터에 사용) */
  timestampColumn: string;

  /** 기본 정렬 */
  defaultOrderBy: string;

  /** 허용된 컬럼 정의 */
  columns: Map<string, ColumnDef>;

  /** 허용된 집계 함수 */
  aggregates: Set<string>;

  /** 컬럼 alias 매핑 (UI-friendly name → DB column) */
  columnAliases: Record<string, string>;

  /** 자유 텍스트 검색 대상 컬럼 */
  searchableColumns: string[];

  /** Materialized View 정의 (자동 라우팅 용) */
  materializedViews?: MaterializedViewDef[];
}

interface ColumnDef {
  /** DB 컬럼명 */
  name: string;

  /** ClickHouse 타입 (parameterized query 생성에 사용) */
  type: 'String' | 'UInt8' | 'UInt16' | 'UInt32' | 'UInt64'
      | 'Float64' | 'DateTime' | 'DateTime64'
      | 'FixedString' | 'Array' | 'Map';

  /** LowCardinality 여부 (태그 분포 조회에 사용) */
  lowCardinality?: boolean;

  /** ILIKE 검색 가능 여부 */
  searchable?: boolean;
}
```

### 3.2. Dataset 목록

#### errors

```
테이블: argus.errors
컬럼수: 38
소비처: overview, discover, issues, releases, projects, feedback, cron-supervisor
```

| 컬럼 | 타입 | LC | 검색 | 설명 |
|------|------|:--:|:----:|------|
| event_id | FixedString(32) | | | 이벤트 고유 ID |
| project_id | String | | | 프로젝트 ID |
| issue_id | UInt64 | | | 이슈 ID |
| timestamp | DateTime64(3) | | | 이벤트 발생 시각 |
| received_at | DateTime64(3) | | | 수신 시각 |
| platform | String | ✓ | | 플랫폼 |
| level | String | ✓ | | 로그 레벨 (alias: `severity`) |
| logger | String | ✓ | | 로거명 |
| type | String | ✓ | ✓ | 예외 타입 |
| value | String | | ✓ | 예외 메시지 |
| mechanism | String | ✓ | | 예외 메커니즘 |
| fingerprint | Array(String) | | | 핑거프린트 |
| primary_hash | FixedString(32) | | | 기본 해시 |
| exception | String | | | 예외 JSON |
| stacktrace_frames | String | | | 스택트레이스 |
| breadcrumbs | String | | | 브레드크럼 |
| user_id | String | | | 사용자 ID |
| user_email | String | | | 사용자 이메일 |
| user_ip | String | | | 사용자 IP |
| user_name | String | | | 사용자명 |
| environment | String | ✓ | | 환경 |
| release | String | ✓ | | 릴리스 |
| dist | String | ✓ | | 배포 |
| server_name | String | ✓ | | 서버명 |
| transaction | String | | ✓ | 트랜잭션명 |
| os_name | String | ✓ | | OS 이름 |
| os_version | String | ✓ | | OS 버전 |
| browser_name | String | ✓ | | 브라우저 이름 |
| browser_version | String | ✓ | | 브라우저 버전 |
| device_name | String | ✓ | | 디바이스 이름 |
| device_family | String | ✓ | | 디바이스 패밀리 |
| runtime_name | String | ✓ | | 런타임 이름 |
| runtime_version | String | ✓ | | 런타임 버전 |
| sdk_name | String | ✓ | | SDK 이름 |
| sdk_version | String | ✓ | | SDK 버전 |
| geo_country | FixedString(2) | ✓ | | 국가 코드 |
| geo_city | String | | | 도시 |
| geo_region | String | ✓ | | 지역 |
| http_method | String | ✓ | | HTTP 메서드 |
| http_url | String | | ✓ | HTTP URL |
| http_referer | String | | | HTTP Referer |
| tags | Map(String, String) | | | 태그 |
| extra | Map(String, String) | | | 추가 데이터 |
| contexts | String | | | 컨텍스트 JSON |
| is_handled | UInt8 | | | 처리 여부 |
| is_symbolicated | UInt8 | | | 심볼화 여부 |

**Materialized Views:**
- `error_frequency_hourly` — project_id, issue_id, hour별 집계 (countMerge, uniqMerge)
- `error_frequency_hourly_mv` — errors 테이블에서 자동 갱신

**Alias 매핑:**
- `severity` → `level`
- `message` → `value`

---

#### transactions

```
테이블: argus.transactions
컬럼수: 18
소비처: overview, performance, traces
```

| 컬럼 | 타입 | LC | 설명 |
|------|------|:--:|------|
| event_id | FixedString(32) | | 트랜잭션 이벤트 ID |
| trace_id | FixedString(32) | | 트레이스 ID |
| span_id | FixedString(16) | | 루트 스팬 ID |
| parent_span_id | FixedString(16) | | 부모 스팬 ID |
| project_id | String | | 프로젝트 ID |
| timestamp | DateTime64(3) | | 종료 시각 |
| start_timestamp | DateTime64(3) | | 시작 시각 |
| duration | UInt64 | | 소요시간 (ms) |
| transaction | String | | 트랜잭션명 |
| transaction_op | String | ✓ | 오퍼레이션 타입 |
| transaction_status | String | ✓ | 상태 (ok, error 등) |
| http_method | String | ✓ | HTTP 메서드 |
| http_status_code | UInt16 | | HTTP 상태 코드 |
| platform | String | ✓ | 플랫폼 |
| environment | String | ✓ | 환경 |
| release | String | ✓ | 릴리스 |
| user_id | String | | 사용자 ID |
| measurements | Map(String, Float64) | | 커스텀 측정값 |
| tags | Map(String, String) | | 태그 |
| span_count | UInt32 | | 하위 스팬 수 |

**Materialized Views:**
- `transaction_metrics_hourly` — project_id, transaction, hour별 성능 메트릭 집계

---

#### spans

```
테이블: argus.spans
컬럼수: 14
소비처: performance, traces
```

| 컬럼 | 타입 | LC | 설명 |
|------|------|:--:|------|
| span_id | FixedString(16) | | 스팬 ID |
| trace_id | FixedString(32) | | 트레이스 ID |
| parent_span_id | FixedString(16) | | 부모 스팬 ID |
| transaction_id | FixedString(32) | | 소속 트랜잭션 ID |
| project_id | String | | 프로젝트 ID |
| timestamp | DateTime64(3) | | 종료 시각 |
| start_timestamp | DateTime64(3) | | 시작 시각 |
| duration | UInt64 | | 소요시간 (ms) |
| op | String | ✓ | 오퍼레이션 (db, http 등) |
| description | String | | 스팬 설명 |
| status | String | ✓ | 상태 |
| action | String | ✓ | 액션 |
| domain | String | ✓ | 도메인 |
| data | Map(String, String) | | 스팬 데이터 |
| tags | Map(String, String) | | 태그 |

---

#### sessions

```
테이블: argus.sessions
컬럼수: 11
소비처: overview, sessions, releases
```

| 컬럼 | 타입 | LC | 설명 |
|------|------|:--:|------|
| session_id | String | | 세션 ID |
| project_id | String | | 프로젝트 ID |
| timestamp | DateTime64(3) | | 타임스탬프 |
| started | DateTime64(3) | | 세션 시작 시각 |
| status | String | ✓ | 상태 (ok, crashed, errored) |
| seq | UInt64 | | 시퀀스 |
| duration | Nullable(UInt64) | | 세션 소요시간 |
| errors | UInt32 | | 에러 수 |
| environment | String | ✓ | 환경 |
| release | String | ✓ | 릴리스 |
| distinct_id | String | | 고유 사용자 ID |
| user_agent | String | | User Agent |

**Materialized Views:**
- `session_health_daily` — project_id, release, day별 세션 헬스 집계

---

#### logs

```
테이블: argus.logs
컬럼수: 12
소비처: logs
```

| 컬럼 | 타입 | LC | 검색 | 설명 |
|------|------|:--:|:----:|------|
| log_id | String | | | 로그 ID |
| project_id | String | | | 프로젝트 ID |
| trace_id | String | | | 트레이스 ID |
| span_id | String | | | 스팬 ID |
| issue_id | UInt64 | | | 연관 이슈 ID |
| timestamp | DateTime64(3) | | | 타임스탬프 |
| level | String | ✓ | | 로그 레벨 (alias: `severity`) |
| logger_name | String | ✓ | | 로거명 (alias: `logger`) |
| message | String | | ✓ | 메시지 |
| body | String | | ✓ | 본문 |
| environment | String | ✓ | | 환경 |
| release | String | ✓ | | 릴리스 |
| service | String | ✓ | | 서비스명 |
| attributes | Map(String, String) | | | 커스텀 속성 |

**Alias 매핑:**
- `severity` → `level`
- `logger` → `logger_name`

---

#### metrics

```
테이블: argus.metrics
컬럼수: 10
소비처: metrics
```

| 컬럼 | 타입 | LC | 설명 |
|------|------|:--:|------|
| project_id | String | | 프로젝트 ID |
| metric_type | String | ✓ | 메트릭 타입 (counter, gauge 등) |
| name | String | ✓ | 메트릭명 |
| unit | String | ✓ | 단위 |
| timestamp | DateTime64(3) | | 타임스탬프 |
| value_counter | Float64 | | Counter 값 |
| value_gauge | Float64 | | Gauge 값 |
| value_distribution | Array(Float64) | | Distribution 값 |
| value_set | Array(String) | | Set 값 |
| environment | String | ✓ | 환경 |
| release | String | ✓ | 릴리스 |
| tags | Map(String, String) | | 태그 |

---

## 4. Query DSL (OpticQuery)

Route 파일에서 쿼리를 선언적으로 구성하는 인터페이스입니다.

### 4.1. 인터페이스

```typescript
interface OpticQuery {
  /** 대상 데이터셋 이름 */
  dataset: string;

  /** 프로젝트 ID (자동으로 WHERE project_id = ? 주입) */
  projectId: string;

  /** 시간 범위 (자동으로 timestamp 필터 + 버킷 설정) */
  timeRange: TimeRange;

  /** SELECT 절 필드 목록 */
  select: SelectField[];

  /** WHERE 조건 목록 (project_id, timeRange 외 추가 조건) */
  conditions?: Condition[];

  /** GROUP BY 컬럼 목록. '$bucket'은 자동 시간 버킷으로 치환 */
  groupBy?: string[];

  /** ORDER BY 목록 */
  orderBy?: OrderBy[];

  /** HAVING 조건 (집계 필터) */
  having?: Condition[];

  /** 자유 텍스트 검색 (기존 QueryParser 활용) */
  search?: string;

  /** WITH FILL 자동 적용 여부 (시계열 차트에 필요) */
  withFill?: boolean;

  /** LIMIT (기본값: 1000, 최대: 10000) */
  limit?: number;

  /** OFFSET */
  offset?: number;
}

interface TimeRange {
  /** 프리셋 기간 ('1h', '6h', '24h', '7d', '14d', '30d', '90d') */
  period?: string;
  /** 커스텀 시작 시각 (ISO 8601) */
  start?: string;
  /** 커스텀 종료 시각 (ISO 8601) */
  end?: string;
}

interface SelectField {
  /** 컬럼명 또는 집계식
   *  예: 'level', 'count()', 'avg(duration)', 'uniq(user_id)',
   *      'quantile(0.95)(duration)', 'countIf(status != \'ok\')'
   */
  field: string;
  /** AS 별칭 */
  alias?: string;
}

interface Condition {
  field: string;
  op: '=' | '!=' | '>' | '<' | '>=' | '<='
    | 'IN' | 'NOT IN' | 'ILIKE' | 'NOT ILIKE';
  value: string | number | string[] | number[];
}

interface OrderBy {
  field: string;
  direction: 'ASC' | 'DESC';
}
```

### 4.2. 특수 문법

| 문법 | 설명 | 예시 |
|------|------|------|
| `$bucket` | groupBy에서 사용. 자동 시간 버킷 표현식으로 치환 | `groupBy: ['$bucket', 'level']` |
| `count()` | 인자 없는 집계 | `{ field: 'count()', alias: 'total' }` |
| `p50`, `p95` 등 | quantile 축약형 | `{ field: 'p95(duration)' }` → `quantile(0.95)(duration)` |
| `search` | QueryParser 기반 전문 검색 | `search: 'severity:error service:api timeout'` |

### 4.3. 사용 예시

#### 단순 쿼리

```typescript
// 24시간 에러 요약
const result = await optic.query<ErrorSummary>({
  dataset: 'errors',
  projectId,
  timeRange: { period: '24h' },
  select: [
    { field: 'count()', alias: 'total_errors' },
    { field: 'uniq(user_id)', alias: 'affected_users' },
    { field: 'uniq(primary_hash)', alias: 'unique_issues' },
  ],
});
```

#### 시계열 (WITH FILL)

```typescript
// 에러 트렌드 차트
const result = await optic.query({
  dataset: 'errors',
  projectId,
  timeRange: { period },
  select: [
    { field: '$bucket', alias: 'hour' },
    { field: 'count()', alias: 'count' },
    { field: 'uniq(user_id)', alias: 'users' },
  ],
  groupBy: ['$bucket'],
  orderBy: [{ field: 'hour', direction: 'ASC' }],
  withFill: true,
});
```

#### 배치 쿼리 (병렬 실행)

```typescript
// Overview 페이지: 15개 쿼리를 한번에 실행
const results = await optic.queryBatch({
  errorTrend: {
    dataset: 'errors', projectId,
    timeRange: { period },
    select: [
      { field: '$bucket', alias: 'hour' },
      { field: 'count()', alias: 'count' },
    ],
    groupBy: ['$bucket'],
    withFill: true,
  },
  errorSummary: {
    dataset: 'errors', projectId,
    timeRange: { period },
    select: [
      { field: 'count()', alias: 'total_errors' },
      { field: 'uniq(user_id)', alias: 'affected_users' },
    ],
  },
  txnSummary: {
    dataset: 'transactions', projectId,
    timeRange: { period },
    select: [
      { field: 'count()', alias: 'total_transactions' },
      { field: 'avg(duration)', alias: 'avg_duration' },
      { field: 'p95(duration)', alias: 'p95' },
    ],
  },
  // ... 추가 쿼리들
});

// results.errorTrend.data, results.errorSummary.data 등으로 접근
```

#### 태그 분포 (UNION ALL 패턴 표준화)

```typescript
// 이슈의 태그 분포
const tags = await optic.queryTagDistribution({
  dataset: 'errors',
  projectId,
  timeRange: { period: '30d' },
  conditions: [{ field: 'issue_id', op: '=', value: issueId }],
  tags: ['browser_name', 'os_name', 'level', 'environment', 'release', 'http_url'],
  limit: 10,
});
// tags.browser_name = [{ value: 'Chrome', count: 1234 }, ...]
// tags.os_name = [{ value: 'Windows', count: 5678 }, ...]
```

#### Raw SQL (escape hatch)

```typescript
// JOIN이 필요한 복잡한 쿼리
const result = await optic.rawQuery<SpanData>({
  query: `
    SELECT s.description, s.op, count() AS count, avg(s.duration) AS avg_duration
    FROM argus.spans s
    INNER JOIN (
      SELECT event_id FROM argus.transactions
      WHERE project_id = {projectId:String}
        AND transaction = {txnName:String}
        AND timestamp >= toDateTime({fillStart:UInt32})
    ) t ON s.transaction_id = t.event_id
    WHERE s.project_id = {projectId:String}
    GROUP BY s.description, s.op
    ORDER BY avg_duration DESC
    LIMIT 20
  `,
  params: { projectId, txnName, fillStart },
});
```

---

## 5. OpticClient API

### 5.1. 인터페이스

```typescript
class OpticClient {
  /**
   * 단일 쿼리 실행.
   * OpticQuery → SQL 변환 → ClickHouse 실행 → 결과 파싱.
   */
  async query<T>(query: OpticQuery): Promise<OpticResult<T>>;

  /**
   * 병렬 다중 쿼리 실행.
   * 모든 쿼리를 Promise.all로 동시 실행.
   * 결과는 입력 키와 동일한 키로 반환.
   */
  async queryBatch<T extends Record<string, OpticQuery>>(
    queries: T
  ): Promise<{ [K in keyof T]: OpticResult }>;

  /**
   * Raw SQL 실행 (escape hatch).
   * 복잡한 JOIN, 서브쿼리 등에 사용.
   * 로깅/메트릭은 동일하게 적용.
   */
  async rawQuery<T>(options: {
    query: string;
    params: Record<string, any>;
  }): Promise<OpticResult<T>>;

  /**
   * 태그 분포 조회 (UNION ALL 패턴 표준화).
   * 여러 LowCardinality 컬럼의 값 분포를 한번에 조회.
   */
  async queryTagDistribution(options: {
    dataset: string;
    projectId: string;
    timeRange: TimeRange;
    conditions?: Condition[];
    tags: string[];
    limit?: number;
  }): Promise<Record<string, { value: string; count: number }[]>>;
}
```

### 5.2. 결과 타입

```typescript
interface OpticResult<T = Record<string, any>> {
  /** 쿼리 결과 데이터 */
  data: T[];

  /** 실행 메타데이터 */
  meta: {
    /** 쿼리 실행 시간 (ms) */
    executionTimeMs: number;
    /** 읽은 행 수 (ClickHouse statistics) */
    rowsRead: number;
    /** 읽은 바이트 수 */
    bytesRead: number;
    /** 생성된 SQL (디버그용, 개발 환경에서만) */
    sql?: string;
  };
}
```

---

## 6. Query Builder 내부 동작

### 6.1. 변환 파이프라인

```
OpticQuery
  │
  ├─ 1. Dataset 해석
  │    └─ DatasetRegistry에서 스키마 조회
  │
  ├─ 2. 유효성 검증
  │    ├─ select 필드가 dataset에 존재하는지
  │    ├─ 집계 함수가 허용 목록에 있는지
  │    ├─ conditions의 컬럼이 유효한지
  │    └─ alias 해석 (severity → level)
  │
  ├─ 3. 시간 범위 처리
  │    ├─ period → getBucketingConfig() 호출
  │    ├─ $bucket → toStartOfInterval() 표현식으로 치환
  │    └─ withFill → WITH FILL 절 생성
  │
  ├─ 4. 검색 처리
  │    ├─ search → QueryParser.parse() → AST
  │    └─ AST → WHERE/HAVING 절 생성
  │
  ├─ 5. SQL 생성
  │    ├─ SELECT 절 (집계 함수 변환: p95 → quantile)
  │    ├─ FROM 절 (dataset.table)
  │    ├─ WHERE 절 (project_id + timeRange + conditions + search)
  │    ├─ GROUP BY 절
  │    ├─ HAVING 절
  │    ├─ ORDER BY 절
  │    └─ LIMIT/OFFSET 절
  │
  └─ 6. 파라미터 생성
       └─ ClickHouse parameterized query ({name:Type}) 형태
```

### 6.2. 시간 필터 통합

현재 3가지 이상의 시간 필터 방식이 존재하는 문제를 해결합니다.
Optic은 **단일 방식**으로 통합합니다:

```
TimeRange               →  생성되는 SQL
─────────────────────────────────────────────────────────
{ period: '24h' }       →  timestamp >= toDateTime({fillStart:UInt32})
                            AND timestamp <= toDateTime({fillEnd:UInt32})

{ start, end }          →  timestamp >= toDateTime({fillStart:UInt32})
                            AND timestamp <= toDateTime({fillEnd:UInt32})

(내부적으로 모두 epoch 초 기반으로 통합)
```

### 6.3. 집계 함수 변환

| 입력 (OpticQuery) | 출력 (ClickHouse SQL) |
|-------------------|----------------------|
| `count()` | `count()` |
| `uniq(user_id)` | `uniq(user_id)` |
| `avg(duration)` | `avg(duration)` |
| `p50(duration)` | `quantile(0.5)(duration)` |
| `p75(duration)` | `quantile(0.75)(duration)` |
| `p95(duration)` | `quantile(0.95)(duration)` |
| `p99(duration)` | `quantile(0.99)(duration)` |
| `countIf(status != 'ok')` | `countIf(status != 'ok')` |

---

## 7. 파일 구조

```
packages/argus/src/optic/
├── index.ts                    # 모듈 진입점 — OpticClient 싱글톤 export
├── types.ts                    # 모든 타입/인터페이스 정의
├── client.ts                   # OpticClient — 쿼리 실행, 로깅, 캐싱
├── query-builder.ts            # OpticQuery → ClickHouse SQL 변환
├── query-validator.ts          # 쿼리 유효성 검증
└── datasets/
    ├── index.ts                # DatasetRegistry — 이름으로 데이터셋 조회
    ├── errors.ts               # errors 테이블 스키마
    ├── transactions.ts         # transactions 테이블 스키마
    ├── spans.ts                # spans 테이블 스키마
    ├── sessions.ts             # sessions 테이블 스키마
    ├── logs.ts                 # logs 테이블 스키마
    ├── metrics.ts              # metrics 테이블 스키마
    └── monitor-checkins.ts     # monitor_checkins 테이블 스키마
```

---

## 8. 전환 대상

개발 중인 프로젝트이므로 전체 route 파일을 **일괄 전환**합니다.

### 8.1. Route 파일 전환 목록

| 파일 | 쿼리 수 | 전환 방식 | 난이도 |
|------|---------|----------|:------:|
| `overview.ts` | 15 | `queryBatch` | ★★☆ |
| `discover.ts` | 3 | `query` + 기존 동적 빌더 통합 | ★★★ |
| `sessions.ts` | 8 | `queryBatch` | ★☆☆ |
| `metrics.ts` | 6 | `query` + `queryBatch` | ★☆☆ |
| `logs.ts` | 8 | `query` + `search` 통합 | ★★☆ |
| `traces.ts` | 8 | `query` + `queryBatch` | ★★☆ |
| `performance.ts` | 9 | `queryBatch` + `rawQuery` (JOIN) | ★★★ |
| `issues.ts` | 7 | `query` + `queryTagDistribution` | ★★★ |
| `releases.ts` | 5 | `queryBatch` | ★☆☆ |
| `projects.ts` | 3 | `query` | ★☆☆ |
| `feedback.ts` | ~5 | `query` | ★☆☆ |
| `uptime.ts` | ~2 | `query` | ★☆☆ |
| `crons.ts` (supervisor) | ~6 | `queryTagDistribution` + `query` | ★★☆ |

### 8.2. Worker 파일 (Insert)

Worker의 ClickHouse insert는 Optic 범위 **밖**입니다.
Optic은 **읽기(Query)** 전용 레이어이며, 쓰기는 기존 Worker의 batch buffer 방식을 유지합니다.

### 8.3. 삭제 대상

전환 완료 후 다음 코드가 불필요해집니다:

| 대상 | 사유 |
|------|------|
| 각 route 파일의 `ALLOWED_COLUMNS`, `ALLOWED_AGGREGATES` 세트 | Dataset으로 통합 |
| 각 route 파일의 `import { clickhouse }` | OpticClient로 대체 |
| `discover.ts`의 `parseField()`, `buildTimeFilter()` | QueryBuilder로 대체 |
| 각 route의 시간 필터 구성 로직 (`periodMap`, `interval`, `timeCond`) | TimeRange로 통합 |

---

## 9. 향후 확장 (Optic v2)

Core 전환 완료 후 선택적으로 도입할 기능들:

### 9.1. 쿼리 캐싱

- OpticClient에 Redis 캐싱 내장
- 쿼리 해시를 캐시 키로 사용
- TTL은 쿼리 타입에 따라 차등 (facets: 5분, 요약: 1분)
- 캐시 무효화: 데이터 ingestion 시 관련 캐시 삭제

### 9.2. 쿼리 로깅 & 메트릭

- 모든 쿼리의 실행 시간, 읽은 행 수 기록
- 느린 쿼리 경고 (임계값 초과 시 logger.warn)
- dataset별, route별 쿼리 통계

### 9.3. Materialized View 자동 라우팅

- 쿼리의 groupBy, select를 분석
- MV의 requiredGroupBy와 매칭되면 MV 테이블로 자동 전환
- 예: `errors` + `groupBy: [project_id, issue_id]` → `error_frequency_hourly` 사용

### 9.4. Rate Limiting

- 프로젝트별 동시 쿼리 수 제한
- 쿼리 실행 시간 제한 (ClickHouse `max_execution_time`)
