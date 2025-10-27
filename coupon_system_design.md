# 온라인 게임 쿠폰 시스템 설계 및 구현 지침 (ULID + 배치 발급 + 진행률 UI + SSE 실시간 + 쿠폰 무효화 + per-user limit + UI 사용량)

## 1. 개요
- 환경: Node.js + TypeScript, MySQL, Redis, BullMQ, SSE
- 목표: 대규모 유저(억 단위) 대상 쿠폰 시스템 구축
- 쿠폰 종류:
  - **스페셜 쿠폰**: 운영자가 지정, 전체 유저 대상 1회 사용
  - **일반 쿠폰**: 발행 시 지정 수량, 유저별 사용 제한(perUserLimit)
- 핵심 고려 사항: 유저 수가 많아도 Redis/DB 부하 최소화, 쿠폰 만료 및 Redis 키 관리, 확장성 확보, 발급 진행률 UI 제공, 실시간 SSE 통지, 운영자 임의 무효화 지원, per-user limit 지원, UI에서 사용량 및 사용자 표시

---

## 2. 데이터베이스 설계

### 2.1 테이블 구조 (ULID 사용)

#### coupons (camelCase, 쿠폰 정의 항목 반영)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 쿠폰 고유 ID |
| code | VARCHAR(64) UNIQUE | 식별 문자열(SPECIAL: 쿠폰이름, NORMAL: 단일코드 시 사용) |
| type | ENUM('SPECIAL','NORMAL') | 쿠폰 타입 |
| nameKey | VARCHAR(128) | 로컬라이징 키(쿠폰명) |
| descriptionKey | VARCHAR(128) | 로컬라이징 키(설명) |
| tags | JSON | 태그 리스트(Array<String>) |
| total | BIGINT | 발행 수량 (NORMAL용) |
| used | BIGINT | 사용 수량 |
| maxTotalUses | BIGINT NULL | SPECIAL \uc120
a
a
| perUserLimit | INT | 유저별 최대 사용 횟수 |
| rewardData | JSON | 보상 정보 |
| startsAt | DATETIME | 사용 시작 시간 (MySQL 형식) |
| expiresAt | DATETIME | 만료 시간 (MySQL 형식) |
| status | ENUM('ACTIVE','DISABLED','DELETED') | 쿠폰 상태 |
| disabledBy | VARCHAR(64) | 무효화한 운영자 ID |
| disabledAt | DATETIME | 무효화 시간 |
| disabledReason | TEXT | 무효화 사유 |
| createdAt | DATETIME | 생성일 |

- 주의
  - 컬럼명은 camelCase 유지. 기존 snake_case는 마이그레이션 시 camelCase로 정리
  - nameKey/descriptionKey는 i18n 키로 저장. 추가 시 로컬라이징 테이블 중복 키 여부 반드시 확인
  - MySQL은 ISO 8601(YYYY-MM-DDTHH:MM:SSZ)을 직접 받지 못하므로 앱에서 DATETIME으로 변환하여 저장
  - maxTotalUses: SPECIAL 


#### couponIssuances (발행 회차)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 발행 회차 ID(issuanceId) |
| couponId | CHAR(26) | coupons.id 참조(해당 정의의 발행 회차) |
| roundNo | INT NULL | 해당 쿠폰 내 회차 번호(선택). UNIQUE(couponId, roundNo) 권장 |
| plannedCount | BIGINT NULL | 계획 발행 수량(코드 생성 예정 수) |
| issuedCount | BIGINT DEFAULT 0 | 실제 생성/발행된 코드 수 |
| status | ENUM('PENDING','RUNNING','DONE','FAILED') | 발행/코드생성 진행 상태 |
| createdAt | DATETIME | 생성일 |
| updatedAt | DATETIME | 수정일 |
| UNIQUE | (couponId, roundNo) | 회차 번호 중복 방지(선택) |

- 비고
  - NORMAL 대량 발급 시 반드시 issuanceId를 생성한 후 couponCodes에 해당 issuanceId로 코드를 귀속합니다.
  - SPECIAL은 발행 회차 없이 정의만으로 운영합니다(issuanceId 불필요).
  - 배치/Export Job은 issuanceId를 포함하여 진행 현황을 추적합니다.


#### couponTargetWorlds
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 고유 ID |
| couponId | CHAR(26) | coupons.id 참조 |
| gameWorldId | BIGINT | 대상 게임월드 ID |
| createdAt | DATETIME | 생성일 |
| UNIQUE | (couponId, gameWorldId) | 중복 방지 |

#### couponTargetPlatforms
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 고유 ID |
| couponId | CHAR(26) | coupons.id 참조 |
| platform | VARCHAR(32) | 대상 플랫폼 (예: ios, android, pc 등) |
| createdAt | DATETIME | 생성일 |
| UNIQUE | (couponId, platform) | 중복 방지 |

#### couponTargetChannels
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 고유 ID |
| couponId | CHAR(26) | coupons.id 참조 |
| channel | VARCHAR(64) | 대상 채널 |
| createdAt | DATETIME | 생성일 |
| UNIQUE | (couponId, channel) | 중복 방지 |

#### couponTargetSubchannels
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 고유 ID |
| couponId | CHAR(26) | coupons.id 참조 |
| subchannel | VARCHAR(64) | 대상 서브채널 |
| createdAt | DATETIME | 생성일 |
| UNIQUE | (couponId, subchannel) | 중복 방지 |

- 참고: 컬럼명은 camelCase를 유지. 예약어 충돌 시 테이블명+필드명 형태로 회피(예: clientGroup)

#### couponCodes (대량 발급 시 개별 코드 관리)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 고유 ID |
| couponId | CHAR(26) | coupons.id 참조 |
| issuanceId | CHAR(26) NULL | couponIssuances.id 참조(NORMAL 대량 발급 회차) |
| code | VARCHAR(32) UNIQUE | 개별 쿠폰 코드(대문자+하이픈 권장) |
| status | ENUM('ISSUED','USED','REVOKED') | 코드 상태 |
| issuedBatchJobId | CHAR(26) NULL | couponBatchJobs.id 참조(해당 배치에서 생성된 코드일 경우) |
| createdAt | DATETIME | 생성일(발급 시점) |
| usedAt | DATETIME NULL | 사용 시점 |
| INDEX | (couponId, issuanceId, status) | 상태/회차별 조회 최적화 |

- Redeem 시 코드 검색: 우선 couponCodes.code에서 조회하고, 없으면 coupons.code에서 조회(단일 코드형)
- NORMAL 대량 발급 시 couponCodes에 저장하고, SPECIAL/단일코드형은 coupons.code만 사용 가능

#### couponUses (per-user limit > 1 지원)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 고유 ID |
| couponId | CHAR(26) | coupons.id 참조 |
| issuanceId | CHAR(26) NULL | couponIssuances.id 참조(NORMAL 코드 사용 시 회차 정보; SPECIAL은 NULL) |
| userId | BIGINT | 유저 ID |
| userName | VARCHAR(128) | 유저 표시명(로그/조회용) — 저장 시 XSS-safe sanitize 적용 |
| sequence | INT | 1부터 perUserLimit까지 사용 순서 |
| usedAt | DATETIME | 사용 시간 |
| gameWorldId | BIGINT NULL | 사용 시점 게임월드 ID(선택) |
| platform | VARCHAR(32) NULL | 사용 시점 플랫폼(선택) |
| channel | VARCHAR(64) NULL | 사용 시점 채널(선택) |
| subchannel | VARCHAR(64) NULL | 사용 시점 서브채널(선택) |
| UNIQUE | (couponId, userId, sequence) | 유저별 중복 사용 제한 관리 |
| INDEX | (couponId, issuanceId, usedAt) | 시간/회차별 조회 최적화 |

#### couponLogs
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 고유 ID |
| couponId | CHAR(26) | coupons.id 참조 |
| userId | BIGINT | 유저 ID |
| action | ENUM('USE','INVALID','EXPIRED','FAILED') | 로그 종류 |
| detail | TEXT | 상세 정보 |
| createdAt | DATETIME | 로그 시간 |

#### couponBatchJobs
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 배치 Job ID |
| couponId | CHAR(26) | coupons.id 참조 |
| issuanceId | CHAR(26) NULL | couponIssuances.id 참조(NORMAL 대량 발급 시) |
| totalCount | BIGINT | 배치에서 발급할 총 쿠폰 수 |
| issuedCount | BIGINT | 현재까지 발급된 쿠폰 수 |
| status | ENUM('PENDING','RUNNING','DONE','FAILED') | Job 상태 |
| createdAt | DATETIME | 생성 시간 |
| updatedAt | DATETIME | 마지막 업데이트 |

#### rewardTemplates
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 보상 템플릿 ID |
| nameKey | VARCHAR(128) NULL | 템플릿 표시용 이름 키(i18n) |
| descriptionKey | VARCHAR(128) NULL | 템플릿 설명 키(i18n) |
| createdAt | DATETIME | 생성일 |
| updatedAt | DATETIME | 수정일 |

#### rewardItems
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | CHAR(26) PK | ULID 기반 고유 ID |
| rewardTemplateId | CHAR(26) | rewardTemplates.id 참조 |
| itemType | VARCHAR(64) | 보상 유형(예: gold, item, currency 등) |
| itemId | VARCHAR(64) NULL | 아이템 식별자(유형에 따라 선택) |
| amount | BIGINT | 수량 |
| data | JSON NULL | 추가 메타데이터(JSON) — MySQL JSON은 드라이버가 객체로 반환하므로 JSON.parse 금지 |
| createdAt | DATETIME | 생성일 |
| INDEX | (rewardTemplateId) | 템플릿별 조회 최적화 |


---

## 3. Redis 캐싱 전략
- **쿠폰 코드별 Hash**: 메타 정보, 사용량 등 캐싱
  - key: `coupon:special:{code}` / `coupon:normal:{code}`
  - fields(hset): { type, status, startsAt, expiresAt, perUserLimit, maxTotalUses, nameKey, descriptionKey }
  - TTL: expiresAt 기준으로 설정(초 단위). DISABLED 시 즉시 삭제 또는 status 필드만 DISABLED로 갱신
- **최근 사용 유저 캐시(선택)**: 이름 표시가 필요한 경우
  - key: `coupon:normal:{code}:recentUsers` (hash) → field=`{userId}`, value=`{"name":"<sanitized>","lastUsedAt":<ts>}`
  - 주의: Redis에 저장된 JSON 문자열은 앱 레이어에서 타입 체크 후 parse. MySQL JSON과 혼동 금지

- **유저별 사용 기록**: 누적 count 기반
- **선착순(글로벌) 사용 카운터(SPECIAL 전용)**
  - key: `coupon:special:{code}:globalUsed`
  - 의미: 현재까지의 전체 사용량. `maxTotalUses`가 null이 아니면 Lua 스크립트에서 perUserLimit 체크와 함께 원자적으로 증가/검사

  - key: `coupon:normal:{code}:usedCount:{userId}`
  - key: `coupon:special:{code}:usedCount:{userId}`

  - NORMAL(선택): 발행 회차 단위 집계를 원하면 다음 키를 병행
    - key: `coupon:issuance:{issuanceId}:userUsedCount:{userId}`
  - key: `coupon:normal:{code}:used:zset` → score = timestamp, value = userId (UI용 최근 사용 유저 조회)
- 장점: 실시간 UI에서 **사용자 리스트, 사용 횟수, 최근 사용 시간** 조회 가능
- TTL로 자동 만료 처리 가능
- **배치 진행 상태 캐싱**
  - key: `batch_job:{jobId}` → `{ totalCount, issuedCount, status }`
- **만료 관리**: 쿠폰 `expiresAt` 기준으로 TTL 설정
- **SCAN 기반 배치 삭제**: TTL 누락 시 Job으로 정리
- **무효화 처리**: Redis key 삭제 또는 status=DISABLED 갱신

---

## 4. 쿠폰 생성 및 발급
- 생성 파라미터(쿠폰 정의 반영): type, code?(SPECIAL은 쿠폰이름으로 사용), nameKey, descriptionKey, tags[], startsAt, expiresAt, perUserLimit?(SPECIAL 기본=1), maxTotalUses?(SPECIAL 선착순 한도; null이면 제한 없음), targetGameWorldIds[], targetPlatforms[], targetChannels[], targetSubchannels[]
- 유효성 검사:
  - startsAt <= expiresAt
  - nameKey/descriptionKey 존재 및 중복 키 미존재 확인(로컬라이징 테이블)
  - tags 문자열 길이 제한 및 금지 문자 필터링
  - 플랫폼/채널/서브채널 값은 허용 목록만 통과
- 저장 절차:
  1) coupons insert (camelCase 컬럼 사용)
  2) 대상 타겟팅은 전용 테이블에 bulk insert (아래 참조)
- perUserLimit > 1 지원: Redis 및 DB sequence 필드 활용
- 주의: MySQL JSON 필드(tags, rewardData)는 드라이버가 객체로 반환되므로 별도 JSON.parse 금지
---

## 5. 일반 쿠폰 대량 배치 Job 구조

목적
- NORMAL 쿠폰을 대량 대상자(예: CSV 업로드 사용자 목록)에게 배포(알림/메일/푸시)하거나, 미리 발급 준비 진행 상황을 추적합니다.

구성
- Queue: BullMQ `coupon-batch`
- Job 데이터: `{ jobId, couponId, recipients: number[], chunkSize: 1000 }`
- Redis 캐시: `batch_job:{jobId}` → `{ totalCount, issuedCount, status }`
- DB: couponBatchJobs(totalCount, issuedCount, status, createdAt, updatedAt)

상태 전이
- PENDING → RUNNING → DONE | FAILED (에러 메시지는 couponLogs.detail 또는 batch job 로그에 기록)

동작 흐름
1) 배치 Job 등록: totalCount = recipients.length 저장, status=PENDING
2) Worker 시작: status=RUNNING, recipients를 chunkSize로 분할 처리
3) 각 청크 처리 시
   - 대상자에게 안내 발송(메일/푸시 등) 또는 사전 발급 준비
   - 진행 건수만큼 issuedCount 증가
   - Redis와 DB 양쪽에 issuedCount 동기화, 1~2초 간격으로 SSE `batch.progress` 전송
5) (선택) 코드 생성형 NORMAL 쿠폰의 경우: couponCodes에 개별 코드들을 생성/저장하고, recipients와 매핑하거나 미할당 상태로 보관
   - 생성 규칙: 대문자+하이픈, 중복 불가, UNIQUE(code)
   - 보안: 코드 길이/엔트로피 충분히 확보(예: 16~20자)

4) 전체 처리 완료 시 status=DONE, 실패 시 status=FAILED(부분 실패는 재시도 큐로 분기)

재시도/내고장성
- BullMQ 기본 재시도(backoff) 사용, 청크 단위 재시도 권장
- idempotency 보장: `{jobId, userId}` 기준 처리 여부 기록(중복 발송 방지)

모니터링/운영
- SSE로 진행률 표시, Admin UI에서 취소/재시작 제공 가능
- 중단 시점 복구: Redis의 `batch_job:{jobId}` 스냅샷을 기준으로 재개


---

## 6. SSE 기반 실시간 Progress 및 사용량 통지

엔드포인트
- GET /api/v1/coupons/{id}/events
- 헤더: `Cache-Control: no-cache`, `Connection: keep-alive`
- 재연결: Last-Event-ID 헤더 지원(선택)

이벤트 타입
- `coupon.used`
  - payload: `{ code, userId, userName, usedCount, usedAt }`
  - 트리거: Redeem 성공 커밋 직후 전송
- `batch.progress`
  - payload: `{ jobId, totalCount, issuedCount, status, updatedAt }`
  - 트리거: 배치 Worker에서 주기적으로 전송(1~2초)
- `codes.export.progress`
  - payload: `{ exportJobId, totalCount, processed, status, updatedAt }`
  - 트리거: 코드 다운로드(Export) Job 진행률 전송


형식 예시
```
event: coupon.used
data: {"code":"ABCD-EFGH-IJKL-MN12","userId":12345,"userName":"홍길동","usedCount":2,"usedAt":"2025-10-27 12:34:56"}

event: batch.progress
data: {"jobId":"01J...","totalCount":100000,"issuedCount":35000,"status":"RUNNING","updatedAt":"2025-10-27 12:35:00"}
```

보안
- Admin 전용 채널은 인증/권한 체크 필수
- 이벤트 데이터에 포함되는 userName은 sanitize된 값만 전송

UI
- Progress bar, 최근 사용 유저, 사용 횟수 실시간 갱신
- 장애 시 자동 재연결 및 백오프 적용

---
- 스페셜(SPECIAL): 기본적으로 유저당 1회 사용만 허용합니다(perUserLimit 기본=1).
- 스페셜 선착순 제한: maxTotalUses가 설정되어 있으면, 전체 사용량이 해당 한도를 초과하지 않도록 원자적으로 검사/증가해야 합니다(null이면 선착순 제한 없음).


## 7. 쿠폰 사용 (Redeem) 처리

요구사항
- 유저 사용 시 반드시 userId와 userName을 함께 지정해야 합니다.
- userName은 저장 전에 XSS-safe sanitize를 적용하고, 최대 길이 128자로 제한합니다.
- 타겟팅 조건(gameWorldId, platform, channel, subchannel)이 설정되어 있다면, 사용 요청의 컨텍스트가 조건을 충족해야 합니다.

엔드포인트
- POST /api/v1/coupons/{code}/redeem

Request Body 예시
```json
{
  "userId": 123456,
  "userName": "홍길동",
  "gameWorldId": 101,
  "platform": "ios",
  "channel": "kakao",
  "subchannel": "promotion",
  "requestId": "b2c1a0f8-5e91-4b8b-a7a9-1a2b3c4d5e6f"
}
```

Response 예시
```json
{
  "success": true,
  "data": {
    "reward": { /* rewardData에서 계산된 실제 보상 */ },
    "userUsedCount": 2,
    "globalUsed": 35001,


    "sequence": 2,
    "usedAt": "2025-10-27 12:34:56"
  }
}
```

오류 형식 및 코드
- 공통 오류 포맷: `{ "success": false, "error": { "code": "...", "message": "...", "details": {...} } }`
- 404 NOT_FOUND: 코드가 없거나 삭제/비활성화된 쿠폰
- 409 CONFLICT: perUserLimit 초과, 재시도 불가 상태
- 409 LIMIT_REACHED: 스페셜 선착순 한도 소진(추가 사용 불가)
- 422 INVALID_TEMPLATE: rewardTemplateId가 존재하지 않거나 비활성 상태
- 400 INVALID_PARAMETERS: rewardTemplateId와 rewardData를 동시에 지정함(서로 배타적)


- 422 UNPROCESSABLE_ENTITY: 기간 외 사용(startsAt/expiresAt 불만족), 타겟팅 미충족, 입력값 유효성 실패(userName 길이 초과 등)
- 429 TOO_MANY_REQUESTS: 동일 유저/코드에 대한 과도한 요청(스팸) 제한
- 500 INTERNAL_ERROR: 서버 내부 오류


처리 알고리즘(원자성/동시성)
1) 사전검증: 쿠폰 status=ACTIVE, 기간(startsAt<=now<=expiresAt) 충족, 타겟팅 조건 충족 여부 확인
   - 코드 검색 순서: couponCodes.code → 없으면 coupons.code(단일 코드형)
2) Redis 원자 연산(Lua 스크립트 권장)으로 perUserLimit 체크 및 증가를 함께 수행
   - 키 예: `coupon:normal:{code}:usedCount:{userId}`
   - 현재값이 perUserLimit 이상이면 즉시 거부; 아니면 INCR 후 해당 값이 sequence가 됨
- SPECIAL 선착순 처리: `coupon:special:{code}:globalUsed` < `maxTotalUses`일 때만 증가 허용. 초과 시 409 LIMIT_REACHED 반환

3) MySQL 트랜잭션 시작
   - 코드형(NORMAL): couponCodes.status를 USED로 전이(행 잠금). 집계는 별도(예: couponIssuances 기준 배치 집계)
   - couponUses에 insert: { couponId, issuanceId?, userId, userName, sequence, usedAt(now), gameWorldId?, platform?, channel?, subchannel? }
   - 성공 시 커밋, 실패 시 롤백 및 Redis 보정(decr 또는 보정 Job 큐)
4) 보상 계산 및 응답 데이터 구성
   - rewardTemplateId가 존재하면 rewardItems에서 {itemType,itemId,amount,data} 목록을 조회하여 보상 구성
   - 없다면 coupons.rewardData(JSON)를 그대로 사용
   - 응답 payload에는 계산된 reward를 포함
5) 쿠폰 로그(couponLogs) 기록: action='USE', detail에 컨텍스트 저장(IP, userAgent 등)
6) SSE 이벤트 전송: `coupon.used` → { code, userId, userName, usedCount, usedAt, issuanceId? }

Idempotency(중복요청 방지)
- requestId를 Body에 허용하여, {code,userId,requestId} 기준으로 멱등 처리
- 이미 처리된 requestId는 동일 응답을 반환

검증 규칙 요약
- userId: 필수 숫자
- userName: 필수 문자열(1~128), sanitize 후 저장
- startsAt/expiresAt: MySQL DATETIME으로 비교
- 타겟팅: 정의된 목록에 포함되는 값만 허용. 미정의 시 해당 조건은 패스




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
    { "userId": 12345, "userName": "홍길동", "usedCount": 2, "lastUsedAt": "2025-10-27T12:34:56Z" },
    { "userId": 67890, "userName": "임샘정", "usedCount": 1, "lastUsedAt": "2025-10-27T12:32:10Z" }
  ]
}
```
- UI에서는 Progress bar + 사용자 리스트 + 사용 횟수 실시간 표시 가능
- 발급 코드 다운로드 UI
  - 소량: `GET /coupons/{id}/codes/export.csv` 링크(필터 status/jobId 적용)로 직접 다운로드
  - 대량: Export Job 생성 → 진행률 표시(SSE `codes.export.progress`) → 완료 시 다운로드 버튼 활성화(URL 제공)
  - 개인정보 최소화: includeUser=false 기본, 필요 시에만 userId/userName 포함 옵션 제공

- SSE 구독으로 실시간 업데이트

---

## 11. 운영 및 모니터링
- 기존 문서 내용 유지
- perUserLimit 관련 지표: 사용자별 사용 횟수, 제한 초과 시도, 최근 사용자 현황 모니터링


---

## 12. API 명세 (상세)

### 12.1 공통 규칙
- Base Path: `/api/v1`
- Content-Type: `application/json; charset=utf-8`
- Date/Time: MySQL DATETIME 문자열(`YYYY-MM-DD HH:MM:SS`). 클라이언트에서 ISO 8601 → DATETIME 변환 후 전송
- 에러 포맷(통일):
```json
{ "success": false, "error": { "code": "...", "message": "<i18n_key>", "details": { } } }
```
- 로컬라이징: `message`는 i18n 키 사용. 신규 키 추가 전 기존 키 중복 여부 확인 필수

### 12.2 쿠폰 관리
- POST `/coupons`
  - Body
  ```json
  {
    "type": "SPECIAL|NORMAL",
    "code": "THANKYOU2025",
    "nameKey": "coupons.summer2025.name",
    "descriptionKey": "coupons.summer2025.desc",
    "tags": ["summer", "event"],
    "rewardTemplateId": "01JABCDE7XY89PQRSTUVWXZYZ",
    "rewardData": null,
    "perUserLimit": 1,
    "maxTotalUses": null,
    "startsAt": "2025-07-01 00:00:00",
    "expiresAt": "2025-08-31 23:59:59",
    "targetGameWorldIds": [101,102],
    "targetPlatforms": ["ios","android"],
    "targetChannels": ["kakao"],
    "targetSubchannels": ["promotion"]
  }
  ```
  - SPECIAL: `code`는 사용자에게 안내되는 쿠폰이름이며, `perUserLimit` 기본=1, `maxTotalUses`로 선착순 한도 설정(null이면 제한 없음)
  - NORMAL: 단일코드형은 `code`를 사용, 대량 코드형은 `couponCodes` 생성/관리(섹션 2 참조)
  - 보상: `rewardTemplateId`가 지정되면 서버는 rewardItems 테이블에서 보상 구성을 조회하여 처리합니다. `rewardTemplateId`와 `rewardData`는 동시에 지정하지 않습니다(둘 다 지정 시 400 INVALID_PARAMETERS). `rewardTemplateId`가 유효하지 않으면 422 INVALID_TEMPLATE.

  - Response: 생성된 쿠폰(및 타겟팅) 요약 반환
- GET `/coupons`
  - Query: `page`, `perPage`, `status?`, `type?`, `tag?`
  - Response: 페이지네이션 목록. 프론트는 SimplePagination 컴포넌트 사용
- GET `/coupons/{id}`: 단건 상세
- PATCH `/coupons/{id}`: 수정(수정 가능 필드: nameKey, descriptionKey, tags, rewardData, perUserLimit, startsAt, expiresAt, status 제외)
- POST `/coupons/{id}/disable`:
  - Body: `{ "disabledBy": "adminId", "reason": "i18n_key.or.text" }`
  - 동작: status=DISABLED, disabledBy/At/Reason 설정
- PUT `/coupons/{id}/targets`: 타겟팅 재설정(전체 교체)
  - Body: `{ targetGameWorldIds: number[], targetPlatforms: string[], targetChannels: string[], targetSubchannels: string[] }`

### 12.3 쿠폰 사용(Redeem)
- POST `/coupons/{code}/redeem` (자세한 플로우는 섹션 7 참고)
  - 스페셜 쿠폰(SPECIAL)은 `{code}` 위치에 '쿠폰이름'을 그대로 사용합니다(예: `/coupons/THANKYOU2025/redeem`).

  - Body: `{ userId, userName, gameWorldId?, platform?, channel?, subchannel?, requestId? }`
  - 주요 검증: perUserLimit, 기간, 상태, 타겟팅, 입력 유효성
  - 응답: `{ success, data: { reward, userUsedCount, globalUsed, sequence, usedAt } }`

### 12.4 사용 기록 조회(관리자)
- GET `/coupons/{id}/usage`
  - Query: `page`, `perPage`, `userId?`, `userName?`, `platform?`, `channel?`, `subchannel?`, `gameWorldId?`, `from?`, `to?`
  - Response 예시
  ```json
  {
    "success": true,
    "data": {
      "items": [
        { "userId": 123, "userName": "홍길동", "sequence": 1, "usedAt": "2025-07-01 12:00:10", "platform": "ios", "channel": "kakao", "subchannel": "promotion", "gameWorldId": 101 }
      ],
      "total": 35000,
      "page": 1,
      "perPage": 20
    }
  }
  ```
  - 프론트: SimplePagination 컴포넌트 사용(일관된 UX)

### 12.5 SSE(실시간)
- GET `/coupons/{id}/events`
  - Event `coupon.used`: `{ code, userId, userName, usedCount, usedAt, issuanceId? }`
  - Event `batch.progress`: `{ jobId, issuanceId, totalCount, issuedCount, status }`
  - Event `codes.export.progress`: `{ exportJobId, issuanceId, totalCount, processed, status, updatedAt }`

### 12.6 배치 발급(Job)
- POST `/coupons/batch`
  - Body: `{ couponId, issuanceId, totalCount, meta? }`
  - Response: `{ jobId }`
- GET `/coupons/batch/{jobId}`: 상태 조회(응답에 issuanceId 포함)
- SSE `batch.progress`로 실시간 진행률 수신(페이로드에 issuanceId 포함)

### 12.7 속도 제한/멱등성
- Rate Limit: 코드+유저 기준(예: 1 req/sec)으로 스팸 방지
- Idempotency: Body.requestId 또는 헤더 `Idempotency-Key` 지원(중복 처리 방지)

### 12.8 에러 메시지 로컬라이징
- 에러 메시지는 i18n 키를 사용하고, 신규 키 추가 전 중복 키 여부를 반드시 확인
- 안내 문구는 친절한 가이드 형태("...합니다.") 유지


### 12.9 발급된 코드 목록 조회
- GET `/coupons/{id}/codes`
  - Query: `page`, `perPage`, `status?=ISSUED|USED|REVOKED`, `jobId?`, `issuanceId?`
  - Response 예시
  ```json
  {
    "success": true,
    "data": {
      "items": [
        { "code": "ABCD-EFGH-IJKL-MN12", "status": "ISSUED", "createdAt": "2025-07-01 00:00:00", "usedAt": null, "issuanceId": "01J..." },
        { "code": "PQRS-TUVW-XYZ1-2345", "status": "USED", "createdAt": "2025-07-01 00:00:01", "usedAt": "2025-07-15 12:10:00", "issuanceId": "01J..." }
      ],
      "total": 100000,
      "page": 1,
      "perPage": 100
    }
  }
  ```
  - 프론트: SimplePagination 컴포넌트 사용

### 12.10 발급 코드 다운로드(Export)
- 소량(예: ≤ 50,000건): 동기 CSV 스트리밍 가능
  - GET `/coupons/{id}/codes/export.csv?status?&jobId?&issuanceId?`
  - 헤더: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="coupon-codes.csv"`
  - Excel 호환성: UTF-8 with BOM 권장(문서 첫 바이트 `\uFEFF`)
- 보안: 대량 Export URL은 서명된 일회성 URL(예: 10분 유효)로 제공, 접근/다운로드는 감사 로그에 기록
- 대량: 비동기 Export Job 권장
  - POST `/coupons/{id}/codes/export`
    - Body: `{ status?: "ISSUED|USED|REVOKED", jobId?: string, issuanceId?: string, includeUser?: boolean }`
    - Response: `{ exportJobId }`
  - GET `/coupons/{id}/codes/export/{exportJobId}`
    - Response: `{ status: "PENDING|RUNNING|DONE|FAILED", processed, totalCount, url? }`
  - SSE 이벤트: `codes.export.progress` 로 진행률 통지
- CSV 컬럼(권장): `code,status,createdAt,usedAt,userId?,userName?`

### 12.11 발행 회차 생성
- POST `/coupons/{id}/issuances`
  - Body: `{ roundNo?: number, plannedCount?: number }`
  - Response: `{ issuanceId }`
  - 비고: NORMAL 대량 발급 시 먼저 issuanceId를 만든 뒤, 해당 issuanceId로 배치 코드 생성(섹션 12.6) 실행

### 12.12 발행 회차 목록 조회
- GET `/coupons/{id}/issuances`
  - Query: `page`, `perPage`
  - Response 예시
  ```json
  {
    "success": true,
    "data": {
      "items": [
        { "id": "01J...", "roundNo": 1, "plannedCount": 100000, "issuedCount": 100000, "status": "DONE", "createdAt": "2025-07-01 00:00:00" }
      ],
      "total": 1,
      "page": 1,
      "perPage": 20
    }
  }
  ```

  - includeUser=true일 때만 userId/userName 포함(PII 최소화)




---

## 13. 마이그레이션 가이드(camelCase + userName 도입)

### 13.1 대상 및 원칙
- 컬럼명은 camelCase로 통일: `coupon_id→couponId`, `user_id→userId`, `used_at→usedAt`, `created_at→createdAt`, `updated_at→updatedAt`
- 테이블명 권장: `coupon_uses→couponUses`, `coupon_logs→couponLogs`, `coupon_batch_jobs→couponBatchJobs`
- 신규 컬럼 추가: `couponUses.userName VARCHAR(128)`(NOT NULL 권장, 기본 빈 문자열), 선택 컨텍스트 컬럼들(`gameWorldId`, `platform`, `channel`, `subchannel`)

### 13.2 단계별 절차(무중단 권장)
1) 컬럼 추가
```sql
ALTER TABLE coupon_uses ADD COLUMN userName VARCHAR(128) NOT NULL DEFAULT '' AFTER user_id;
ALTER TABLE coupon_uses ADD COLUMN usedAt DATETIME NULL;
```
2) 데이터 백필(가능하다면 사용자 테이블 join)
```sql
UPDATE coupon_uses cu
JOIN users u ON u.id = cu.user_id
SET cu.userName = COALESCE(u.name, '');
```
3) 컬럼/테이블 리네임
```sql
ALTER TABLE coupon_uses RENAME TO couponUses;
ALTER TABLE couponUses CHANGE COLUMN coupon_id couponId CHAR(26) NOT NULL;
ALTER TABLE couponUses CHANGE COLUMN user_id userId BIGINT NOT NULL;
ALTER TABLE couponUses CHANGE COLUMN used_at usedAt DATETIME NULL;
```
4) 인덱스/제약 재정의
```sql
ALTER TABLE couponUses DROP INDEX coupon_user_seq;
ALTER TABLE couponUses ADD UNIQUE KEY uniq_coupon_user_seq (couponId, userId, sequence);
ALTER TABLE couponUses ADD INDEX idx_coupon_usedAt (couponId, usedAt);
```
5) 로그/배치 테이블 컬럼 camelCase 정리
```sql
ALTER TABLE coupon_logs RENAME TO couponLogs;
ALTER TABLE couponLogs CHANGE COLUMN coupon_id couponId CHAR(26) NOT NULL;
ALTER TABLE couponLogs CHANGE COLUMN user_id userId BIGINT NULL;
ALTER TABLE couponLogs CHANGE COLUMN created_at createdAt DATETIME NOT NULL;
ALTER TABLE coupon_batch_jobs RENAME TO couponBatchJobs;
ALTER TABLE couponBatchJobs CHANGE COLUMN total_count totalCount BIGINT NOT NULL;
ALTER TABLE couponBatchJobs CHANGE COLUMN issued_count issuedCount BIGINT NOT NULL;
ALTER TABLE couponBatchJobs CHANGE COLUMN created_at createdAt DATETIME NOT NULL;
ALTER TABLE couponBatchJobs CHANGE COLUMN updated_at updatedAt DATETIME NOT NULL;
```
6) 애플리케이션 업데이트
### 13.4 정의/발행 분리 도입(issuances)
1) 신규 테이블 생성
```sql
CREATE TABLE couponIssuances (
  id CHAR(26) PRIMARY KEY,
  couponId CHAR(26) NOT NULL,
  roundNo INT NULL,
  plannedCount BIGINT NULL,
  issuedCount BIGINT NOT NULL DEFAULT 0,
  status ENUM('PENDING','RUNNING','DONE','FAILED') NOT NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  UNIQUE KEY uniq_coupon_round (couponId, roundNo),
  INDEX idx_coupon_status (couponId, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
2) 연관 컬럼 추가
```sql
ALTER TABLE couponCodes ADD COLUMN issuanceId CHAR(26) NULL AFTER couponId;
ALTER TABLE couponUses ADD COLUMN issuanceId CHAR(26) NULL AFTER couponId;
ALTER TABLE couponBatchJobs ADD COLUMN issuanceId CHAR(26) NULL AFTER couponId;
```
3) 보상 템플릿 도입
```sql
ALTER TABLE coupons ADD COLUMN rewardTemplateId CHAR(26) NULL AFTER tags;
ALTER TABLE coupons MODIFY COLUMN rewardData JSON NULL;
```
4) 데이터 마이그레이션 가이드
- NORMAL 대량코드형의 경우, 기존 쿠폰별로 기본 issuance(예: roundNo=1)를 생성하고, 해당 쿠폰의 couponCodes.issuanceId를 일괄 세팅
- SPECIAL은 issuanceId 없이 운영하므로 NULL 유지
- 기존 coupons.total/used 집계가 있었다면, 통계 테이블 또는 배치 집계로 이전(정의 테이블에서 제거)

- ORM/SQL 매핑, DTO, 응답 스키마(field 이름) camelCase 반영
- Redeem API에 `userName` 필수 반영 및 sanitize 적용

7) 검증
- 샘플 쿠폰으로 Redeem 트랜잭션, 로그 기록, 사용 조회 API까지 E2E 확인
- Redis 키/TTL 정책(`expiresAt`)과 DB 값 동기화 점검

### 13.3 주의사항
- 예약어 충돌 시 테이블명+필드명 형태로 회피(예: clientGroup)
- 배포 순서: DB 스키마 → 코드 배포(읽기 우선) → 쓰기 경로 전환 → 구 스키마 청소
- 롤백 전략: 새 컬럼에만 기록하도록 feature flag를 두고 전환


---

## 14. Server-side SDK 가이드 (Node.js/TypeScript 예시)

### 14.1 개요 및 전제
- 목적: 게임 서버/백오피스 등 서버 애플리케이션에서 쿠폰 API를 안전하고 일관되게 사용하기 위한 최소 SDK 패턴 제시
- 인증: 프로젝트 표준의 서비스 간 인증 헤더 사용(예: `Authorization: Bearer <token>` 또는 `X-API-Key: <key>`)
- Base URL: `/api/v1`까지 포함한 서버 API 엔드포인트를 사용 (예: `https://api.example.com/api/v1`)

### 14.2 SDK 초기화(최소 구현)
```ts
// Keep axios side-effects minimal at import time
export class CouponSDK {
  constructor(private baseURL: string, private headers: Record<string, string>) {}
  private client() { return fetch; /* or axios instance */ }
}
```
- import 시점에는 네트워크 호출 등 부작용 금지. 명시적 메서드 호출 시에만 동작하도록 구성
- axios 사용 시에는 `axios.create({ baseURL, headers })` 패턴 권장

### 14.3 Redeem 호출 (userId + userName 필수)
- Endpoint: `POST /coupons/{code}/redeem`
- Body: `{ userId, userName, gameWorldId?, platform?, channel?, subchannel?, requestId? }`
- userName은 API에서 저장 전 sanitize 적용. SDK 단에서는 추가 가공 없이 원문 전달 권장
```ts
// Example: redeem
async function redeemCoupon(code: string, input: any, opts?: { idempotencyKey?: string }) {
  const res = await fetch(`${BASE}/coupons/${code}/redeem`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...AUTH, ...(opts?.idempotencyKey?{'Idempotency-Key':opts.idempotencyKey}:{}) }, body: JSON.stringify(input) });
  return await res.json();
}

// SPECIAL by name helper
async function redeemByName(name: string, input: any, opts?: { idempotencyKey?: string }){
  return redeemCoupon(name, input, opts);
}
```


- 성공 시: `{ success: true, data: { reward, userUsedCount, globalUsed, sequence, usedAt } }`
- SPECIAL Redeem: `{code}` 자리에 쿠폰이름(예: THANKYOU2025)을 그대로 전달하세요.
- FCFS 제한(maxTotalUses)이 있는 SPECIAL은 409 LIMIT_REACHED 발생 시 재시도 금지

- SPECIAL  cRedeem:  c`code` c  c c c c c c ca c c c c c c c

### 14.4 멱등성·재시도 가이드
- 멱등성: `requestId`(Body) 또는 헤더 `Idempotency-Key`를 항상 포함해 재시도 안전성 확보
```ts
// Generate requestId once and reuse on retries
const requestId = crypto.randomUUID();
await redeemCoupon(code, { userId, userName, requestId });
```
- 재시도: 5xx/네트워크 오류에 한해 지수 백오프. 4xx(404/409/422)는 재시도 금지, 429는 Retry-After 또는 고정 백오프 준수

### 14.5 오류 처리 패턴(요약)
```ts
try { const r = await redeemCoupon(code, { userId, userName });
  if(!r.success){ /* map r.error.code to app logic */ }
} catch (e:any) { /* network/5xx: retry with backoff */ }
```
- 404 NOT_FOUND: 삭제/비활성/미존재 코드 → 사용자 안내(i18n)
- 409 CONFLICT: perUserLimit 초과 → 재시도 금지
- 422 UNPROCESSABLE_ENTITY: 기간/타겟팅 불만족, 입력값 오류(userName 길이 등)
- 429 TOO_MANY_REQUESTS: 일정 시간 대기 후 재시도

### 14.6 시간·타임존 처리(조회용)
- MySQL이 ISO 8601을 직접 받지 못하므로, 조회 API의 `from`/`to` 등 DATETIME 쿼리는 `YYYY-MM-DD HH:MM:SS`로 전송
```ts
function toMySQLDateTime(d: Date){ const p=(n:number)=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
```

### 14.7 사용 기록 조회(관리자 서버에서)
- Endpoint: `GET /coupons/{id}/usage`
- Query: `page`, `perPage`, `userId?`, `userName?`, `platform?`, `channel?`, `subchannel?`, `gameWorldId?`, `from?`, `to?`
```ts
const q = new URLSearchParams({ page:'1', perPage:'20', userName:'홍길동' });
const r = await fetch(`${BASE}/coupons/${id}/usage?${q}`, { headers: AUTH });
```

### 14.8 보안·로깅 권장사항
- 토큰/키는 서버 측 비밀 저장소에서 주입하고 로그에 절대 노출 금지
- 로깅은 code, userId, status, latency 중심으로 최소화(PHI/PII 최소화). userName은 필요 시 마스킹
- 에러 메시지는 i18n 키를 그대로 UI/운영도구에 전달하고, 사용자용 친절한 가이드 문구로 표시


### 14.9 발급 코드 조회/다운로드 사용 예시
```ts
// 1) 페이지네이션 목록 조회
async function listIssuedCodes(couponId: string, q: { page?: number; perPage?: number; status?: string; jobId?: string }={}){
  const qs = new URLSearchParams({ page: String(q.page??1), perPage: String(q.perPage??100), ...(q.status?{status:q.status}:{}) , ...(q.jobId?{jobId:q.jobId}:{}) });
  const r = await fetch(`${BASE}/coupons/${couponId}/codes?${qs}`, { headers: AUTH });
  return await r.json();
}

// 2) 소량 CSV 동기 다운로드
function downloadCsv(couponId: string, q: { status?: string; jobId?: string }={}){
  const qs = new URLSearchParams({ ...(q.status?{status:q.status}:{}) , ...(q.jobId?{jobId:q.jobId}:{}) });
  return fetch(`${BASE}/coupons/${couponId}/codes/export.csv?${qs}`, { headers: AUTH });
}

// 3) 대량 비동기 Export Job
async function requestExportJob(couponId: string, body: { status?: 'ISSUED'|'USED'|'REVOKED'; jobId?: string; includeUser?: boolean }={}){
  const r = await fetch(`${BASE}/coupons/${couponId}/codes/export`, { method:'POST', headers: { 'Content-Type':'application/json', ...AUTH }, body: JSON.stringify(body) });
  return await r.json(); // { exportJobId }
}
async function pollExportJob(couponId: string, exportJobId: string){
  const r = await fetch(`${BASE}/coupons/${couponId}/codes/export/${exportJobId}`, { headers: AUTH });
  return await r.json(); // { status, processed, totalCount, url? }
}
// SSE 구독: codes.export.progress로 진행률 수신 가능
```
