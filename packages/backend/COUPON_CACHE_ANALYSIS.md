# 쿠폰 캐시 시스템 데이터 일관성 분석

## 1. 발견된 문제점

### 1.1 데이터 일관성 문제

#### ❌ 문제 1: 쿠폰 삭제 시 캐시 업데이트 누락

**위치**: `CouponSettingsService.deleteSetting()` (라인 323-360)

```typescript
// 현재 코드: 상태만 DELETED로 변경
UPDATE g_coupon_settings SET status = 'DELETED', generationStatus = 'FAILED' WHERE id = ?
```

**문제**:

- 쿠폰 설정을 삭제해도 `issuedCount`, `usedCount` 캐시는 유지됨
- 삭제된 쿠폰의 코드들은 여전히 `g_coupons` 테이블에 존재
- 향후 복구 시 캐시 값이 부정확할 수 있음

**해결책**: 삭제 시 캐시를 0으로 초기화하거나, 삭제된 쿠폰의 코드도 함께 삭제

#### ❌ 문제 2: 쿠폰 상태 변경(REVOKE) 시 캐시 업데이트 누락

**위치**: 현재 REVOKE 기능이 없음
**문제**:

- 발급된 쿠폰을 취소(REVOKE)할 때 `issuedCount` 감소 로직 없음
- 쿠폰 사용 취소 시 `usedCount` 감소 로직 없음

#### ❌ 문제 3: 트랜잭션 롤백 시 캐시 불일치

**위치**: `CouponRedeemService.redeemCoupon()` (라인 140-147)

```typescript
// 트랜잭션 내에서 캐시 업데이트
await connection.execute('UPDATE g_coupon_settings SET usedCount = usedCount + 1 WHERE id = ?', [
  setting.id,
]);
await connection.commit();
```

**문제**:

- 트랜잭션 커밋 후 캐시 업데이트 → 롤백 시 캐시만 증가
- 예: 보상 지급 실패 시 트랜잭션 롤백되지만 `usedCount`는 증가

### 1.2 동시성 문제

#### ⚠️ 문제 4: usedCount 원자성 보장 부족

**현재 코드**:

```typescript
UPDATE g_coupon_settings SET usedCount = usedCount + 1 WHERE id = ?
```

**문제**:

- MySQL의 `usedCount = usedCount + 1`은 원자적이지만, 트랜잭션 격리 수준에 따라 문제 발생 가능
- READ_COMMITTED 격리 수준에서 동시 업데이트 시 손실 가능성 있음

### 1.3 기존 코드 영향

#### ❌ 문제 5: 발급된 코드 조회 시 COUNT 쿼리 사용

**위치**: `CouponSettingsService.getIssuedCodes()` (라인 454-458)

```typescript
const [countRows] = await pool.execute<RowDataPacket[]>(
  `SELECT COUNT(*) as total FROM g_coupons ${whereSql}`,
  args
);
```

**문제**:

- 검색 필터가 있을 때만 COUNT 쿼리 실행
- 필터 없을 때는 캐시된 `issuedCount` 사용 가능

#### ❌ 문제 6: 사용 기록 조회 시 COUNT 쿼리 사용

**위치**: `CouponSettingsService.getUsageBySetting()` (라인 417-421)

```typescript
const [countRows] = await pool.execute<RowDataPacket[]>(
  `SELECT COUNT(*) as total FROM g_coupon_uses ${whereSql}`,
  args
);
```

**문제**:

- 필터가 있을 때 COUNT 쿼리 필요 (캐시 불가)
- 필터 없을 때는 캐시된 `usedCount` 사용 가능

## 2. 권장 해결책

### 2.1 즉시 적용 필요

1. **쿠폰 삭제 시 캐시 초기화**
2. **트랜잭션 롤백 시 캐시 복구 로직**
3. **캐시 재계산 API 추가**

### 2.2 향후 개선

1. **REVOKE 기능 구현**
2. **자동 캐시 검증 스케줄러**
3. **캐시 불일치 감지 및 알림**

## 3. 마이그레이션 후 검증

### 초기화 상태 확인

```sql
-- 캐시 값 검증
SELECT
  cs.id,
  cs.issuedCount,
  (SELECT COUNT(*) FROM g_coupons WHERE settingId = cs.id) as actual_issued,
  cs.usedCount,
  (SELECT COUNT(*) FROM g_coupon_uses WHERE settingId = cs.id) as actual_used
FROM g_coupon_settings cs
WHERE cs.issuedCount != (SELECT COUNT(*) FROM g_coupons WHERE settingId = cs.id)
   OR cs.usedCount != (SELECT COUNT(*) FROM g_coupon_uses WHERE settingId = cs.id);
```

### 예상 결과

- 위 쿼리 결과가 0행이어야 함 (캐시가 정확함)
