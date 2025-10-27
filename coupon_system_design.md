# 온라인 게임 쿠폰 시스템 설계 및 구현 지침 (ULID + 배치 발급 + 진행률 UI + SSE 실시간 + 쿠폰 무효화 + per-user limit + UI 사용량)

## 1. 개요
- 환경: Node.js + TypeScript, MySQL, Redis, BullMQ, SSE
- 목표: 대규모 유저(억 단위) 대상 쿠폰 시스템 구축
- 쿠폰 종류:
  - **스페셜 쿠폰**: 운영자가 지정, 전체 유저 대상 1회 사용
  - **일반 쿠폰**: 발행 시 지정 수량, 유저별 사용 제한(per_user_limit)
- 핵심 고려 사항: 유저 수가 많아도 Redis/DB 부하 최소화, 쿠폰 만료 및 Redis 키 관리, 확장성 확보, 발급 진행률 UI 제공, 실시간 SSE 통지, 운영자 임의 무효화 지원, per-user limit 지원, UI에서 사용량 및 사용자 표시

---

## 2. 데이터베이스 설계

### 2.1 테이블 구조 (ULID 사용)

#### coupons
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 쿠폰 고유 ID |
| code | VARCHAR(32) | 쿠폰 코드, 16자리 + 하이픈 포함, 유니크 |
| type | ENUM('SPECIAL','NORMAL') | 쿠폰 타입 |
| total | BIGINT | 발행 수량 (NORMAL용) |
| used | BIGINT | 사용 수량 |
| per_user_limit | INT | 유저별 최대 사용 횟수 |
| reward_data | JSON | 보상 정보 |
| starts_at | DATETIME | 사용 시작 시간 |
| expires_at | DATETIME | 만료 시간 |
| status | ENUM('ACTIVE','DISABLED','DELETED') | 쿠폰 상태 |
| disabled_by | VARCHAR(64) | 무효화한 운영자 ID |
| disabled_at | DATETIME | 무효화 시간 |
| disabled_reason | TEXT | 무효화 사유 |
| created_at | DATETIME | 생성일 |

#### coupon_uses (per-user limit > 1 지원)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 고유 ID |
| coupon_id | CHAR(26) | coupons.id 참조 |
| user_id | BIGINT | 유저 ID |
| sequence | INT | 1부터 per_user_limit까지 사용 순서 |
| used_at | DATETIME | 사용 시간 |
| UNIQUE | (coupon_id, user_id, sequence) | 유저별 중복 사용 제한 관리 |

#### coupon_logs
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 고유 ID |
| coupon_id | CHAR(26) | coupons.id 참조 |
| user_id | BIGINT | 유저 ID |
| action | ENUM('USE','INVALID','EXPIRED','FAILED') | 로그 종류 |
| detail | TEXT | 상세 정보 |
| created_at | DATETIME | 로그 시간 |

#### coupon_batch_jobs
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 배치 Job ID |
| total_count | BIGINT | 배치에서 발급할 총 쿠폰 수 |
| issued_count | BIGINT | 현재까지 발급된 쿠폰 수 |
| status | ENUM('PENDING','RUNNING','DONE','FAILED') | Job 상태 |
| created_at | DATETIME | 생성 시간 |
| updated_at | DATETIME | 마지막 업데이트 |

---

## 3. Redis 캐싱 전략
- **쿠폰 코드별 Hash**: 메타 정보, 사용량 등 캐싱
  - key: `coupon:special:{code}` / `coupon:normal:{code}`
- **유저별 사용 기록**: 누적 count 기반
  - key: `coupon:normal:{code}:usedCount:{userId}`
  - key: `coupon:normal:{code}:used:zset` → score = timestamp, value = userId (UI용 최근 사용 유저 조회)
- 장점: 실시간 UI에서 **사용자 리스트, 사용 횟수, 최근 사용 시간** 조회 가능
- TTL로 자동 만료 처리 가능
- **배치 진행 상태 캐싱**
  - key: `batch_job:{jobId}` → `{ total_count, issued_count, status }`
- **만료 관리**: 쿠폰 `expires_at` 기준으로 TTL 설정
- **SCAN 기반 배치 삭제**: TTL 누락 시 Job으로 정리
- **무효화 처리**: Redis key 삭제 또는 status=DISABLED 갱신

---

## 4. 쿠폰 생성 및 발급
- 기존 문서 내용 유지
- per_user_limit > 1 지원: Redis 및 DB sequence 필드 활용

---

## 5. 일반 쿠폰 대량 배치 Job 구조
- 기존 문서 내용 유지
- 배치 발급 중 UI에 진행률 및 최근 사용자 정보 제공 가능

---

## 6. SSE 기반 실시간 Progress 및 사용량 통지
- 쿠폰 발급 진행률: `batch_job:{jobId}` 업데이트 → SSE 전송
- 쿠폰 사용 이벤트:
```json
{ "event": "coupon.used", "code": "ABCD-EFGH-IJKL-MN12", "userId": 12345, "usedCount": 2, "usedAt": "2025-10-27T12:34:56Z" }
```
- UI에서 Progress bar, 최근 사용 유저, 사용 횟수 실시간 갱신 가능

---

## 7. 쿠폰 사용 (Redeem) 처리
- per_user_limit > 1 지원:
  - Redis에서 현재 사용 횟수 조회
  - `usedCount >= per_user_limit` 시 reject
  - DB `coupon_uses`에 sequence+1로 insert
- 무효화된 쿠폰(`status=DISABLED`) 사용 시 즉시 reject

---

## 8. 쿠폰 만료 및 Redis 정리
- 기존 문서 내용 유지
- per-user 사용 기록(zset/usedCount)도 TTL 또는 cleanup Job으로 정리

---

## 9. 쿠폰 무효화 (운영자 임의 삭제)
- 기존 문서 내용 유지
- 무효화 시 Redis zset 및 usedCount도 즉시 반영
- UI 실시간 업데이트 가능

---

## 10. UI 사용량 및 사용자 표시
- Redis zset: 최근 사용 유저 리스트 + timestamp 제공
- DB fallback: 전체 사용자 기록, 감사 로그
- API 예시: `GET /admin/coupon/:code/usage`
```json
{
  "code": "ABCD-EFGH-IJKL-MN12",
  "totalIssued": 100000,
  "usedCount": 35000,
  "users": [
    { "userId": 12345, "usedCount": 2, "lastUsedAt": "2025-10-27T12:34:56Z" },
    { "userId": 67890, "usedCount": 1, "lastUsedAt": "2025-10-27T12:32:10Z" }
  ]
}
```
- UI에서는 Progress bar + 사용자 리스트 + 사용 횟수 실시간 표시 가능
- SSE 구독으로 실시간 업데이트

---

## 11. 운영 및 모니터링
- 기존 문서 내용 유지
- per_user_limit 관련 지표: 사용자별 사용 횟수, 제한 초과 시도, 최근 사용자 현황 모니터링



쿠폰명

타겟팅:
  대상 게임월드
  대상 플랫폼
  대상 채널
  대상 서브채널

사용기간
설명
태그들
