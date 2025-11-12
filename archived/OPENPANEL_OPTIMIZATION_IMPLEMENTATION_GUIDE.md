# OpenPanel 최적화 기술 적용 가이드

## 📋 개요

이 문서는 OpenPanel GitHub 저장소를 철저히 분석한 결과를 바탕으로, Event Lens에 누락된 최적화 기술을 적용하는 방법을 설명합니다.

---

## 🔍 분석 결과 요약

### ✅ 이미 구현된 기술
- ✅ ZSTD 압축
- ✅ Bloom Filter 인덱스 (더 많음)
- ✅ 월별 파티셔닝
- ✅ TTL 자동 삭제 (OpenPanel에는 없음)
- ✅ Materialized Views (더 많음)
- ✅ BullMQ 큐 시스템
- ✅ ULID (OpenPanel은 UUID 사용)

### ❌ 누락된 핵심 기술
1. **LowCardinality 타입** - 메모리 30-50% 절감
2. **고급 압축 코덱** (Delta, DoubleDelta, Gorilla) - 스토리지 10-20% 절감
3. **Map 타입** - 쿼리 성능 5-10% 향상
4. **FixedString 타입** - 메모리 소폭 절감
5. **ORDER BY 최적화** - 쿼리 성능 5% 향상
6. **이벤트 정규화 (toDots)** - 필터링 성능 향상
7. **복잡한 Redis 버퍼링** - Duration 자동 계산

---

## 🚀 적용 방법

### Phase 1: 즉시 적용 가능 (1-2일)

#### 1.1 새로운 마이그레이션 실행

```bash
cd packages/event-lens

# 새로운 최적화 마이그레이션 실행
npm run migrate:clickhouse
```

이 마이그레이션은 다음을 생성합니다:
- `events_optimized` - LowCardinality, 고급 압축, Map 타입 적용
- `profiles_optimized` - 최적화된 프로필 테이블
- `sessions_optimized` - 최적화된 세션 테이블
- 7개의 최적화된 Materialized Views

#### 1.2 코드 수정

**event-processor.ts 수정:**

```typescript
import { toDots, normalizeEvent } from '../utils/normalize';

// 기존 코드
const event = {
  id: ulid(),
  projectId,
  name: eventData.name,
  properties: JSON.stringify(eventData.properties), // ❌ 기존
  // ...
};

// 새로운 코드
const event = {
  id: ulid(),
  projectId,
  name: eventData.name,
  properties: toDots(eventData.properties), // ✅ 평탄화된 Map
  // ...
};
```

#### 1.3 데이터 마이그레이션 (다운타임 필요)

```sql
-- 1. 기존 데이터를 새 테이블로 복사
INSERT INTO event_lens.events_optimized
SELECT
  id,
  projectId,
  name,
  deviceId,
  profileId,
  sessionId,
  createdAt,
  timestamp,
  country,
  city,
  region,
  latitude,
  longitude,
  os,
  osVersion,
  browser,
  browserVersion,
  device,
  brand,
  model,
  path,
  origin,
  referrer,
  referrerName,
  referrerType,
  utmSource,
  utmMedium,
  utmCampaign,
  utmTerm,
  utmContent,
  -- JSON String을 Map으로 변환
  CAST(JSONExtractKeysAndValues(properties, 'String'), 'Map(String, String)') as properties,
  duration,
  screenViews,
  ip,
  userAgent
FROM event_lens.events;

-- 2. 테이블 교체
RENAME TABLE event_lens.events TO event_lens.events_old;
RENAME TABLE event_lens.events_optimized TO event_lens.events;

-- 3. Materialized Views 교체
RENAME TABLE event_lens.daily_metrics TO event_lens.daily_metrics_old;
RENAME TABLE event_lens.daily_metrics_optimized TO event_lens.daily_metrics;
-- (나머지 MV도 동일하게 교체)

-- 4. 확인 후 기존 테이블 삭제
DROP TABLE event_lens.events_old;
DROP TABLE event_lens.daily_metrics_old;
-- (나머지 테이블도 삭제)
```

---

### Phase 2: 단기 개선 (1주)

#### 2.1 이벤트 정규화 적용

**모든 이벤트 처리 코드에 적용:**

```typescript
import { normalizeEvent, toDots } from '../utils/normalize';

// 이벤트 생성 시
const event = normalizeEvent({
  id: ulid(),
  projectId,
  name: eventData.name,
  properties: eventData.properties, // 자동으로 평탄화됨
  // ...
});
```

#### 2.2 필터 빌더 업데이트

**filter-builder.ts 수정:**

```typescript
// 기존: JSON 함수 사용
const clause = `JSONExtractString(properties, '${key}') = '${value}'`;

// 새로운: Map 함수 사용 (더 빠름)
const clause = `properties['${key}'] = '${value}'`;
```

---

### Phase 3: 장기 개선 (2-4주)

#### 3.1 Redis 버퍼링 시스템 구현

OpenPanel의 복잡한 버퍼링 시스템을 참고하여 구현:

1. **세션 이벤트 분리**
   - `screen_view`와 `session_end` 이벤트를 별도 큐로 처리
   - Redis Sorted Set으로 세션 추적

2. **Duration 자동 계산**
   - 다음 `screen_view` 또는 `session_end`와의 시간 차이 계산
   - 마지막 `screen_view`는 pending 상태로 보류

3. **Lua 스크립트 사용**
   - 원자적 연산을 위한 Lua 스크립트 구현
   - 배치 업데이트 최적화

**참고 파일:**
- `packages/db/src/buffers/event-buffer-redis.ts` (OpenPanel)
- 약 600줄의 복잡한 로직

---

## 📊 예상 성능 개선

### 스토리지 사용량
- **현재**: 100GB 기준
- **Phase 1 적용 후**: 약 70-80GB (20-30% 감소)
- **Phase 3 적용 후**: 약 65-75GB (25-35% 감소)

### 쿼리 성능
- **현재**: 기준
- **Phase 1 적용 후**: 약 15-25% 빠름
- **Phase 3 적용 후**: 약 20-30% 빠름

### 메모리 사용량
- **현재**: 기준
- **Phase 1 적용 후**: 약 30-50% 감소
- **Phase 3 적용 후**: 약 35-55% 감소

---

## ⚠️ 주의사항

### 1. 다운타임
- 테이블 교체 시 짧은 다운타임 발생 (약 1-5분)
- 트래픽이 적은 시간대에 진행 권장

### 2. 데이터 마이그레이션
- 대용량 데이터의 경우 시간이 오래 걸릴 수 있음
- 단계적으로 진행 권장 (예: 최근 30일 데이터만 먼저 마이그레이션)

### 3. 호환성
- 기존 쿼리 코드 수정 필요
- JSON 함수 → Map 함수로 변경
- 철저한 테스트 필요

### 4. 롤백 계획
- 기존 테이블 백업 필수
- 문제 발생 시 즉시 롤백 가능하도록 준비

---

## 🧪 테스트 계획

### 1. 단위 테스트
```typescript
// normalize.test.ts
import { toDots, fromDots, normalizeEvent } from '../utils/normalize';

describe('toDots', () => {
  it('should flatten nested objects', () => {
    const input = { user: { name: 'John', age: 30 } };
    const output = toDots(input);
    expect(output).toEqual({ 'user.name': 'John', 'user.age': '30' });
  });
});
```

### 2. 통합 테스트
- 이벤트 삽입 테스트
- 쿼리 성능 테스트
- 필터링 테스트

### 3. 성능 테스트
- 100만 이벤트 삽입 시간 측정
- 쿼리 응답 시간 측정
- 메모리 사용량 측정

---

## 📚 참고 자료

### OpenPanel GitHub
- **저장소**: https://github.com/Openpanel-dev/openpanel
- **핵심 파일**:
  - `packages/db/code-migrations/3-init-ch.sql` - ClickHouse 스키마
  - `packages/db/src/buffers/event-buffer-redis.ts` - Redis 버퍼링
  - `packages/db/src/services/event.service.ts` - 이벤트 서비스
  - `apps/worker/src/jobs/events.incoming-event.ts` - 이벤트 처리

### Event Lens 파일
- **비교 분석**: `packages/event-lens/OPENPANEL_COMPARISON_ANALYSIS.md`
- **마이그레이션**: `packages/event-lens/migrations/clickhouse/006_apply_openpanel_optimizations.sql`
- **정규화 유틸**: `packages/event-lens/src/utils/normalize.ts`

---

## ✅ 체크리스트

### Phase 1 (즉시 적용)
- [ ] 마이그레이션 파일 검토
- [ ] 테스트 환경에서 마이그레이션 실행
- [ ] 데이터 마이그레이션 스크립트 작성
- [ ] 백업 생성
- [ ] 프로덕션 마이그레이션 실행
- [ ] 코드 수정 및 배포
- [ ] 성능 모니터링

### Phase 2 (단기 개선)
- [ ] 정규화 유틸리티 테스트
- [ ] 모든 이벤트 처리 코드에 적용
- [ ] 필터 빌더 업데이트
- [ ] 통합 테스트
- [ ] 배포 및 모니터링

### Phase 3 (장기 개선)
- [ ] Redis 버퍼링 시스템 설계
- [ ] Lua 스크립트 작성
- [ ] Duration 계산 로직 구현
- [ ] 세션 이벤트 분리 구현
- [ ] 철저한 테스트
- [ ] 단계적 배포

---

## 🎯 결론

Event Lens는 OpenPanel의 핵심 아이디어를 잘 구현했으나, **프로덕션 레벨의 성능 최적화**를 위해서는 위의 3단계 개선 작업이 필요합니다.

**Phase 1만 적용해도 20-30%의 성능 개선**을 기대할 수 있으며, **Phase 3까지 완료하면 OpenPanel과 동등한 수준**의 최적화를 달성할 수 있습니다.

**권장 사항**: Phase 1을 우선 적용하고, 트래픽과 데이터 증가에 따라 Phase 2, 3를 순차적으로 적용하는 것이 안전합니다.

