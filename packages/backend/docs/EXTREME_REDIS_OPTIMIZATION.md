# Extreme Redis Optimization (Zero DB Lock)

## 개요 (도입 배경)
이번 아키텍처 개선의 **가장 핵심적인 목적은 "전체 Gatrix Backend의 글로벌 지연(Global Hang) 현상 제거"**입니다.

과거 오픈 초기 등 쿠폰 사용량이 시간당 수천 건 수준으로 폭증할 때, 개별 유저의 응답성이 떨어지는 것을 넘어 **Gatrix Backend 시스템 전체의 응답 속도가 수 초에서 수십 초까지 지연되는 심각한 문제**가 발생했습니다.

### ⚠️ 원인 분석: 왜 전체 시스템이 마비되었는가?
1. **공유 자원에 대한 DB Lock (`forUpdate`)**: 쿠폰 사용 시 `g_coupon_settings` 테이블의 특정 쿠폰 row에 배타적 쓰기 락(`forUpdate`)을 겁니다.
2. **병목 현상**: 수많은 유저가 동시에 같은 쿠폰 코드를 입력하면, MySQL은 이 row에 대한 락을 순차적으로 처리합니다. 
3. **커넥션 풀 고갈 (Connection Pool Exhaustion)**: 락을 대기하는 동안 각 쿠폰 요청은 Node.js의 DB 커넥션을 쥐고 놓지 않습니다. 순식간에 Knex 커넥션 풀이 꽉 차게 됩니다.
4. **글로벌 장애**: 커넥션 풀이 고갈되면, 쿠폰과 전혀 상관없는 로그인, 상점 조회, 캐릭터 데이터 갱신 등 **모든 백엔드 API 요청이 DB 커넥션을 할당받지 못해 무한정 대기**하게 됩니다. 이로 인해 시스템 전체가 수십 초간 응답하지 않는 현상이 발생했습니다.

이를 근본적으로 해결하기 위해, 메인 DB(MySQL)를 쿠폰 검증의 크리티컬 패스(Critical Path)에서 완전히 격리시키는 **Extreme Redis Architecture**를 도입했습니다.

## 아키텍처 개요

### 1. Zero DB Lock 검증 (Redis SETNX / INCR)
사용자가 쿠폰 코드를 입력하면 메인 DB(MySQL)에 어떠한 조회나 락도 걸지 않습니다. 대신 Redis의 원자적(Atomic) 연산을 사용하여 초고속 인메모리 검증을 수행합니다.

- **단일 사용 쿠폰 (NORMAL)**: `SETNX`로 중복 사용 차단
- **공용 쿠폰 및 계정당 제한 (SPECIAL / Per-User Limits)**: `INCR`로 횟수 차감 및 통제.
  - **Lazy-Loading**: `INCR` 결과가 1일 경우(캐시 미스), 이것이 정말 최초 사용인지 확실히 하기 위해 비동기로 MySQL을 조회(`COUNT`)하여 기존 기록으로 Redis 카운터를 보정합니다. 기존 데이터와 완벽하게 호환됩니다.

### 2. 비동기 영구 저장 (Asynchronous Persistence via BullMQ)
Redis 검증이 성공하면, MySQL을 거치지 않고 **즉각 게임 서버에 보상 지급 성공(HTTP 200)을 응답**하여 해당 요청의 스레드와 생명주기를 즉시 종료시킵니다.

- **큐잉 & 백그라운드 워커**: 실제 DB 저장은 BullMQ 큐에 담아 백그라운드 워커(`processCouponRedeemJob`)가 잉여 DB 커넥션을 사용해 비동기로 안전하게 밀어넣습니다.

## 아키텍처 비교 (Before & After)

| 구분 | 레거시(Legacy) 구조 | Extreme Redis 구조 (개선 후) | 개선 효과 (가장 중요) |
| :--- | :--- | :--- | :--- |
| **시스템 전체 장애** | 쿠폰 락 대기로 인해 **전체 DB 커넥션 풀 고갈** | DB 락 소멸. 커넥션 풀 점유 시간 0 | **전체 Gatrix Backend 병목(수십 초 지연) 완벽 제거** |
| **동시성 제어** | MySQL Row Lock (`forUpdate()`) | Redis 원자적 연산 (`SETNX`, `INCR`) | 수천/수만 건의 요청도 Lock 없이 즉시 처리 |
| **API 응답 생명주기** | DB 트랜잭션이 완전히 끝날 때까지 대기 | Redis 검증 후 즉시 응답 (10ms 이내) | API 스레드 고갈 방지 및 극한의 반응성 |
| **데이터 영구 저장** | 유저 요청 스레드에서 직접 `INSERT` | BullMQ 백그라운드 워커가 비동기 적재 | 트래픽 폭주 시에도 DB 부하가 평탄하게 분산됨 |

### 🛑 레거시 병목 구조 (Legacy DB Bottleneck)
공유 자원에 대한 Lock 대기가 DB 커넥션 풀을 모두 고갈시켜, 쿠폰 외의 다른 모든 백엔드 요청까지 수십 초간 마비시키는 현상입니다.
![Legacy DB Architecture](./img/legacy_db_bottleneck.png)

### ⚡ Extreme Redis 최적화 구조 (Optimized Architecture)
Redis가 방파제 역할을 하여 모든 동시성 검증을 인메모리로 끝냅니다. 메인 DB는 백그라운드 워커를 통해 천천히 여유롭게 데이터를 적재하므로, Gatrix Backend 전체의 안정성이 100% 유지됩니다.
![Extreme Redis Architecture](./img/extreme_redis.png)

## 핵심 성과 (Key Outcomes)
이번 구조 개선을 통해, 오픈 초기 등 **순간적으로 극심한 트래픽이 몰리더라도 Gatrix Backend가 전체적으로 느려지는 현상을 구조적으로 완전히 제거**했습니다. DB 커넥션 풀은 항상 여유를 가지며, 쿠폰 시스템은 메인 시스템의 성능에 더 이상 어떠한 악영향도 주지 않습니다.

## 관련 코드
- `src/services/coupon-redeem-service.ts` (API 엔드포인트 및 Redis 검증)
- `src/services/jobs/coupon-redeem-job.ts` (비동기 처리 BullMQ 워커)
- `src/services/queue-service.ts` (큐 등록 및 관리)
