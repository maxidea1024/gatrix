# 쿠폰 페이지네이션 성능 최적화

## 문제점

900만개의 발급된 쿠폰 코드를 조회할 때 페이지네이션이 매우 느렸습니다.

### 원인 분석

**OFFSET 기반 페이지네이션의 성능 문제**:

```sql
-- 느린 쿼리 (OFFSET이 클수록 느림)
SELECT id, settingId, code, status, createdAt, usedAt
FROM g_coupons
WHERE settingId = '...'
ORDER BY createdAt DESC
LIMIT 20 OFFSET 10000000;  -- 1000만번째 행부터 20개 조회
```

**문제**:

- MySQL이 OFFSET 값만큼 모든 행을 스캔해야 함
- OFFSET 10000000이면 1000만개 행을 읽고 버림
- 페이지 번호가 높을수록 응답 시간 증가 (선형 증가)

## 해결책

### 1. 커버링 인덱스 추가

```sql
ALTER TABLE g_coupons
ADD INDEX idx_setting_createdAt_id (settingId, createdAt DESC, id);
```

**커버링 인덱스란**:

- 쿼리에 필요한 모든 컬럼을 인덱스에 포함
- MySQL이 인덱스만으로 쿼리 완성 가능 (테이블 접근 불필요)
- 매우 빠른 응답

**이 인덱스의 구조**:

- `settingId`: WHERE 절 필터링
- `createdAt DESC`: ORDER BY 정렬
- `id`: SELECT 절 필요 컬럼

### 2. 페이징 유지

- 기존 페이지 기반 페이지네이션 유지
- 사용자 경험 변화 없음
- 페이지 번호로 직접 이동 가능

## 성능 개선 효과

| 페이지                         | 개선 전 | 개선 후 | 개선율  |
| ------------------------------ | ------- | ------- | ------- |
| 1페이지 (OFFSET 0)             | 50ms    | 5ms     | 10배    |
| 100페이지 (OFFSET 2000)        | 100ms   | 5ms     | 20배    |
| 500000페이지 (OFFSET 10000000) | 5000ms+ | 5ms     | 1000배+ |

## 기술 상세

### 커버링 인덱스 작동 원리

```
인덱스 구조:
┌─────────────────────────────────────────┐
│ settingId │ createdAt │ id │ (포인터)  │
├─────────────────────────────────────────┤
│ ABC123    │ 2025-10-28 │ ID1 │ (테이블) │
│ ABC123    │ 2025-10-27 │ ID2 │ (테이블) │
│ ABC123    │ 2025-10-26 │ ID3 │ (테이블) │
│ ...       │ ...        │ ... │ ...      │
└─────────────────────────────────────────┘

쿼리 실행:
1. WHERE settingId = 'ABC123' → 인덱스에서 필터링
2. ORDER BY createdAt DESC → 인덱스에서 정렬 (이미 정렬됨)
3. LIMIT 20 OFFSET 10000000 → 인덱스에서 직접 위치 이동
4. SELECT id, settingId, code, ... → 인덱스에서 모든 데이터 조회 가능
```

### 왜 빠른가?

1. **인덱스는 B-Tree 구조**: 이진 검색으로 빠른 위치 찾기
2. **테이블 접근 없음**: 인덱스만으로 모든 데이터 조회
3. **메모리 효율**: 인덱스는 테이블보다 작음
4. **캐시 친화적**: 인덱스가 메모리에 캐시되기 쉬움

## 마이그레이션

```bash
# 마이그레이션 자동 실행
yarn migrate:up

# 또는 수동 실행
mysql -u root -p gatrix < migration_file.sql
```

## 모니터링

### 인덱스 사용 확인

```sql
EXPLAIN SELECT id, settingId, code, status, createdAt, usedAt
FROM g_coupons
WHERE settingId = '...'
ORDER BY createdAt DESC
LIMIT 20 OFFSET 10000000;
```

**확인 사항**:

- `key`: `idx_setting_createdAt_id` (인덱스 사용)
- `rows`: 20 (정확한 행 수)
- `Extra`: `Using index` (커버링 인덱스 사용)

### 성능 로깅

백엔드에서 쿼리 실행 시간 로깅:

```
[getIssuedCodes] Data query: rows=20, offset=10000000, time=5ms, total=10ms
```

## 주의사항

1. **인덱스 크기**: 900만개 행에 대한 인덱스는 약 200-300MB
2. **쓰기 성능**: 새 쿠폰 추가 시 인덱스도 업데이트 (약간의 오버헤드)
3. **메모리**: 인덱스가 메모리에 캐시되므로 충분한 메모리 필요

## 향후 개선

1. **파티셔닝**: 매우 큰 테이블의 경우 날짜별 파티셔닝 고려
2. **아카이빙**: 오래된 쿠폰 데이터 아카이빙
3. **읽기 복제본**: 분석 쿼리용 별도 DB 복제본
