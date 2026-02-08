# OpenPanel vs Event Lens - 상세 비교 분석

## 📊 Executive Summary

OpenPanel의 GitHub 저장소를 철저히 분석한 결과, **Event Lens는 OpenPanel의 핵심 최적화 기술 대부분을 구현했으나, 몇 가지 중요한 차이점과 누락된 부분이 발견되었습니다.**

---

## ✅ 구현된 OpenPanel 최적화 기술

### 1. ClickHouse 최적화

| 기술                       | OpenPanel                                                                            | Event Lens                                                                                                              | 상태                        |
| -------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **ZSTD 압축**              | ✅ ZSTD(3)                                                                           | ✅ ZSTD(3)                                                                                                              | ✅ 동일                     |
| **Bloom Filter 인덱스**    | ✅ name, origin, path                                                                | ✅ name, sessionId, profileId, path, referrer, country, browser, os, device, UTM, propertiesKeys                        | ✅ **더 많음**              |
| **월별 파티셔닝**          | ✅ `toYYYYMM(created_at)`                                                            | ✅ `toYYYYMM(createdAt)`                                                                                                | ✅ 동일                     |
| **TTL 자동 삭제**          | ❌ 없음                                                                              | ✅ 90일/365일                                                                                                           | ✅ **Event Lens가 더 나음** |
| **Materialized Views**     | ✅ 4개 (dau_mv, cohort_events_mv, distinct_event_names_mv, event_property_values_mv) | ✅ 7개 (daily_metrics, hourly_metrics, event_name_metrics, path_metrics, referrer_metrics, device_metrics, geo_metrics) | ✅ **Event Lens가 더 많음** |
| **LowCardinality 타입**    | ✅ name, sdk_name, country, os, browser, device 등                                   | ❌ 사용 안 함                                                                                                           | ⚠️ **누락**                 |
| **Delta/DoubleDelta 압축** | ✅ duration, created_at                                                              | ❌ 사용 안 함                                                                                                           | ⚠️ **누락**                 |
| **Gorilla 압축**           | ✅ longitude, latitude                                                               | ❌ 사용 안 함                                                                                                           | ⚠️ **누락**                 |
| **Map 타입**               | ✅ `Map(String, String)`                                                             | ❌ String (JSON)                                                                                                        | ⚠️ **누락**                 |

### 2. 배치 처리 및 버퍼링

| 기술                    | OpenPanel                            | Event Lens            | 상태             |
| ----------------------- | ------------------------------------ | --------------------- | ---------------- |
| **Redis 버퍼링**        | ✅ EventBuffer (복잡한 Lua 스크립트) | ✅ BullMQ 큐          | ⚠️ **다른 방식** |
| **배치 삽입**           | ✅ 4000개 (설정 가능)                | ✅ 1000개 (설정 가능) | ✅ 유사          |
| **청크 처리**           | ✅ 1000개 청크                       | ✅ 없음 (전체 배치)   | ⚠️ **누락**      |
| **세션 이벤트 처리**    | ✅ screen_view duration 계산         | ❌ 없음               | ⚠️ **누락**      |
| **Pending 이벤트 관리** | ✅ 마지막 screen_view 보류           | ❌ 없음               | ⚠️ **누락**      |

### 3. 워커 및 큐 시스템

| 기술            | OpenPanel                                                         | Event Lens                  | 상태               |
| --------------- | ----------------------------------------------------------------- | --------------------------- | ------------------ |
| **BullMQ 사용** | ✅                                                                | ✅                          | ✅ 동일            |
| **이벤트 큐**   | ✅ eventsQueue                                                    | ✅ eventQueue               | ✅ 동일            |
| **세션 큐**     | ✅ sessionsQueue                                                  | ✅ sessionQueue             | ✅ 동일            |
| **프로필 큐**   | ❌ (버퍼 사용)                                                    | ✅ profileQueue             | ✅ Event Lens 추가 |
| **Cron 작업**   | ✅ flushEvents (10초), flushProfiles (60초), flushSessions (10초) | ✅ 유사                     | ✅ 동일            |
| **재시도 로직** | ✅ 3회, exponential backoff                                       | ✅ 3회, exponential backoff | ✅ 동일            |

### 4. 데이터 모델링

| 기술              | OpenPanel             | Event Lens            | 상태                        |
| ----------------- | --------------------- | --------------------- | --------------------------- |
| **UUID 생성**     | ✅ uuid v4            | ✅ ULID               | ✅ **Event Lens가 더 나음** |
| **프로필 병합**   | ✅ ReplacingMergeTree | ✅ ReplacingMergeTree | ✅ 동일                     |
| **세션 추적**     | ✅                    | ✅                    | ✅ 동일                     |
| **이벤트 정규화** | ✅ toDots()           | ❌ 없음               | ⚠️ **누락**                 |

---

## ❌ 누락된 OpenPanel 최적화 기술

### 1. **ClickHouse 고급 압축 기술**

OpenPanel은 다양한 압축 코덱을 사용하여 스토리지를 최적화합니다:

```sql
-- OpenPanel
`device_id` String CODEC(ZSTD(3)),
`duration` UInt64 CODEC(Delta(4), LZ4),
`created_at` DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),
`longitude` Nullable(Float32) CODEC(Gorilla, LZ4),
`latitude` Nullable(Float32) CODEC(Gorilla, LZ4),
```

**Event Lens는 ZSTD만 사용하고 Delta/DoubleDelta/Gorilla 압축을 사용하지 않습니다.**

**영향:**

- 스토리지 사용량 10-20% 증가 가능
- 시계열 데이터 (duration, created_at) 압축 효율 저하
- 지리 데이터 (longitude, latitude) 압축 효율 저하

### 2. **LowCardinality 타입**

OpenPanel은 카디널리티가 낮은 필드에 `LowCardinality` 타입을 사용합니다:

```sql
-- OpenPanel
`name` LowCardinality(String),
`country` LowCardinality(FixedString(2)),
`os` LowCardinality(String),
`browser` LowCardinality(String),
`device` LowCardinality(String),
```

**Event Lens는 모든 필드를 일반 String으로 저장합니다.**

**영향:**

- 메모리 사용량 30-50% 증가 가능
- 쿼리 성능 10-20% 저하 가능
- 스토리지 사용량 20-30% 증가 가능

### 3. **Map 타입 vs JSON String**

OpenPanel은 properties를 `Map(String, String)` 타입으로 저장합니다:

```sql
-- OpenPanel
`properties` Map(String, String) CODEC(ZSTD(3)),
```

**Event Lens는 JSON String으로 저장합니다:**

```sql
-- Event Lens
properties String DEFAULT '{}',
```

**영향:**

- Map 타입은 ClickHouse에서 네이티브 지원되어 쿼리 성능이 더 좋음
- JSON 파싱 오버헤드 발생
- 필터링 시 `JSONExtractString()` 함수 사용 필요 (느림)

### 4. **복잡한 Redis 버퍼링 시스템**

OpenPanel은 매우 정교한 Redis 버퍼링 시스템을 사용합니다:

- **세션 이벤트 분리**: `screen_view`와 `session_end` 이벤트를 별도로 처리
- **Duration 계산**: 다음 이벤트와의 시간 차이로 duration 자동 계산
- **Pending 이벤트**: 마지막 `screen_view`는 다음 이벤트가 올 때까지 보류
- **Lua 스크립트**: 원자적 연산을 위한 복잡한 Lua 스크립트 사용

**Event Lens는 단순한 BullMQ 큐만 사용합니다.**

**영향:**

- Duration 계산 누락 (모든 이벤트 duration = 0)
- 세션 분석 정확도 저하
- 실시간 세션 추적 불가능

### 5. **이벤트 정규화 (toDots)**

OpenPanel은 중첩된 객체를 평탄화합니다:

```typescript
// OpenPanel
import { toDots } from '@openpanel/common';

properties: toDots(payload.properties),
// { user: { name: 'John' } } → { 'user.name': 'John' }
```

**Event Lens는 JSON.stringify만 사용합니다.**

**영향:**

- 중첩된 properties 쿼리 어려움
- 필터링 성능 저하

### 6. **FixedString 타입**

OpenPanel은 고정 길이 문자열에 `FixedString`을 사용합니다:

```sql
-- OpenPanel
`country` LowCardinality(FixedString(2)),
```

**Event Lens는 일반 String을 사용합니다.**

**영향:**

- 메모리 사용량 소폭 증가
- 쿼리 성능 소폭 저하

---

## 🔍 상세 비교

### ClickHouse 스키마 비교

#### OpenPanel Events 테이블

```sql
CREATE TABLE IF NOT EXISTS events (
  `id` UUID DEFAULT generateUUIDv4(),
  `name` LowCardinality(String),
  `sdk_name` LowCardinality(String),
  `sdk_version` LowCardinality(String),
  `device_id` String CODEC(ZSTD(3)),
  `profile_id` String CODEC(ZSTD(3)),
  `project_id` String CODEC(ZSTD(3)),
  `session_id` String CODEC(LZ4),
  `path` String CODEC(ZSTD(3)),
  `origin` String CODEC(ZSTD(3)),
  `referrer` String CODEC(ZSTD(3)),
  `referrer_name` String CODEC(ZSTD(3)),
  `referrer_type` LowCardinality(String),
  `duration` UInt64 CODEC(Delta(4), LZ4),
  `properties` Map(String, String) CODEC(ZSTD(3)),
  `created_at` DateTime64(3) CODEC(DoubleDelta, ZSTD(3)),
  `country` LowCardinality(FixedString(2)),
  `city` String,
  `region` LowCardinality(String),
  `longitude` Nullable(Float32) CODEC(Gorilla, LZ4),
  `latitude` Nullable(Float32) CODEC(Gorilla, LZ4),
  `os` LowCardinality(String),
  `os_version` LowCardinality(String),
  `browser` LowCardinality(String),
  `browser_version` LowCardinality(String),
  `device` LowCardinality(String),
  `brand` LowCardinality(String),
  `model` LowCardinality(String),
  `imported_at` Nullable(DateTime) CODEC(Delta(4), LZ4),
  INDEX idx_name name TYPE bloom_filter GRANULARITY 1,
  INDEX idx_properties_bounce properties['__bounce'] TYPE set(3) GRANULARITY 1,
  INDEX idx_origin origin TYPE bloom_filter(0.05) GRANULARITY 1,
  INDEX idx_path path TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (project_id, toDate(created_at), profile_id, name)
SETTINGS index_granularity = 8192;
```

#### Event Lens Events 테이블

```sql
CREATE TABLE IF NOT EXISTS event_lens.events (
  id String,
  projectId String,
  name String,
  deviceId String,
  profileId Nullable(String),
  sessionId String,
  createdAt DateTime,
  timestamp DateTime,

  -- Geo
  country Nullable(String),
  city Nullable(String),
  region Nullable(String),
  latitude Nullable(Float64),
  longitude Nullable(Float64),

  -- Device
  os Nullable(String),
  osVersion Nullable(String),
  browser Nullable(String),
  browserVersion Nullable(String),
  device Nullable(String),
  brand Nullable(String),
  model Nullable(String),

  -- Page
  path Nullable(String),
  origin Nullable(String),
  referrer Nullable(String),
  referrerName Nullable(String),
  referrerType Nullable(String),

  -- UTM
  utmSource Nullable(String),
  utmMedium Nullable(String),
  utmCampaign Nullable(String),
  utmTerm Nullable(String),
  utmContent Nullable(String),

  -- Custom
  properties String DEFAULT '{}',

  -- Session metrics
  duration Nullable(UInt32),
  screenViews Nullable(UInt32),

  -- Raw data
  ip Nullable(String),
  userAgent Nullable(String)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(createdAt)
ORDER BY (projectId, createdAt, deviceId)
SETTINGS index_granularity = 8192;
```

**주요 차이점:**

1. ❌ LowCardinality 타입 미사용
2. ❌ 고급 압축 코덱 미사용 (Delta, DoubleDelta, Gorilla)
3. ❌ Map 타입 대신 JSON String 사용
4. ❌ FixedString 미사용
5. ✅ UTM 필드 추가 (OpenPanel은 properties에 저장)
6. ❌ ORDER BY에 `toDate(created_at)` 누락

---

## 📈 성능 영향 예측

### 스토리지 사용량

- **OpenPanel**: 100GB 기준
- **Event Lens**: 약 130-150GB 예상 (30-50% 증가)

**이유:**

- LowCardinality 미사용: +20-30%
- 고급 압축 미사용: +10-20%
- Map 대신 JSON String: +5-10%

### 쿼리 성능

- **OpenPanel**: 기준
- **Event Lens**: 약 10-30% 느림 예상

**이유:**

- LowCardinality 미사용: +10-20% 느림
- Map 대신 JSON String: +5-10% 느림
- ORDER BY 최적화 부족: +5% 느림

### 메모리 사용량

- **OpenPanel**: 기준
- **Event Lens**: 약 30-50% 증가 예상

**이유:**

- LowCardinality 미사용: +30-50%

---

## 🎯 권장 사항

### 우선순위 1 (High Impact)

1. **LowCardinality 타입 적용**
   - name, country, os, browser, device, referrerType 등
   - 예상 효과: 메모리 30-50% 감소, 쿼리 10-20% 빠름

2. **Map 타입으로 변경**
   - properties를 `Map(String, String)`으로 변경
   - 예상 효과: 쿼리 5-10% 빠름, 필터링 성능 향상

3. **고급 압축 코덱 적용**
   - duration: `CODEC(Delta(4), LZ4)`
   - created_at: `CODEC(DoubleDelta, ZSTD(3))`
   - longitude/latitude: `CODEC(Gorilla, LZ4)`
   - 예상 효과: 스토리지 10-20% 감소

### 우선순위 2 (Medium Impact)

4. **ORDER BY 최적화**
   - `ORDER BY (projectId, toDate(createdAt), profileId, name)`
   - 예상 효과: 쿼리 5% 빠름

5. **FixedString 적용**
   - country: `LowCardinality(FixedString(2))`
   - 예상 효과: 메모리 소폭 감소

6. **이벤트 정규화 (toDots)**
   - 중첩된 properties 평탄화
   - 예상 효과: 필터링 성능 향상

### 우선순위 3 (Low Impact, High Complexity)

7. **Redis 버퍼링 시스템**
   - OpenPanel 스타일의 복잡한 버퍼링 구현
   - Duration 자동 계산
   - 예상 효과: 세션 분석 정확도 향상

---

## 📊 최종 평가

| 항목                | 점수   | 설명                       |
| ------------------- | ------ | -------------------------- |
| **기본 기능**       | ✅ 95% | 핵심 기능 모두 구현        |
| **최적화 수준**     | ⚠️ 70% | 고급 최적화 일부 누락      |
| **프로덕션 준비도** | ✅ 85% | 대부분 준비됨, 최적화 필요 |
| **확장성**          | ✅ 90% | 좋은 아키텍처              |
| **유지보수성**      | ✅ 95% | 깔끔한 코드 구조           |

**종합 점수: 87/100** ⭐⭐⭐⭐

---

## 🚀 다음 단계

1. **즉시 적용 가능** (1-2일)
   - LowCardinality 타입 적용
   - 고급 압축 코덱 적용
   - ORDER BY 최적화

2. **단기 개선** (1주)
   - Map 타입으로 마이그레이션
   - 이벤트 정규화 구현

3. **장기 개선** (2-4주)
   - Redis 버퍼링 시스템 구현
   - Duration 자동 계산

---

**결론: Event Lens는 OpenPanel의 핵심 아이디어를 잘 구현했으나, 프로덕션 레벨의 성능 최적화를 위해서는 위의 권장 사항을 적용해야 합니다.**
