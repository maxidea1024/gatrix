# Gatrix Argus vs Sentry: Cron & Uptime Monitor 심층 분석

본 문서는 현재 `argus`에 구현된 Cron Monitor 및 Uptime Monitor 로직을 Sentry의 실제 소스코드(Relay, Sentry Core) 구현과 비교하여, 아키텍처 및 기능적 한계를 사실 기반으로 철저하게 검증한 보고서입니다.

---

## 1. Cron Monitor (Check-ins) 분석

### 1.1. 스케줄 파싱 및 `next_checkin_at` 계산의 부재
* **Argus의 현실**: `crons.ts`의 체크인 API 주석과 코드에 명시되어 있듯, 스케줄(`schedule_value`)을 파싱하지 않고 데모용으로 하드코딩된 로직만 존재합니다.
  ```typescript
  // crons.ts: Basic calculation of next checkin (for demonstration, a real parser would parse schedule_value)
  // Here we just set it to UTC NOW + 1 hour as a placeholder until the supervisor handles it properly.
  ```
* **Sentry의 구현**: Sentry의 `sentry.monitors` 모듈은 `croniter` 등의 라이브러리를 활용해 Unix Cron 문법(`* * * * *`) 및 Interval 문법을 완벽하게 파싱하며, 사용자의 Timezone까지 고려하여 정확한 `next_checkin_at`을 산출합니다.

### 1.2. 체크인 데이터 스토리지 확장성 (MySQL vs ClickHouse)
* **Argus의 현실**: `g_argus_cronCheckins` 테이블을 MySQL에 생성하고 이벤트 발생마다 `INSERT`를 수행합니다. 초 단위로 실행되는 크론이 수천 개 모일 경우 MySQL의 쓰기 한계를 초과하여 DB 전체의 장애를 유발할 수 있습니다.
* **Sentry의 구현**: 체크인 데이터의 메타데이터(설정)만 RDBMS(Postgres)에 저장하고, 실제 체크인 텔레메트리(성공/실패 이력, 실행 시간 등)는 Kafka를 거쳐 **Snuba(ClickHouse)**로 적재합니다. 이를 통해 무제한에 가까운 트래픽을 처리합니다.

### 1.3. Supervisor Worker의 O(N) 테이블 풀스캔 문제
* **Argus의 현실**: `cron-supervisor-worker.ts`가 매 60초마다 `SELECT * FROM g_argus_cronMonitors WHERE next_checkin_at + margin < NOW()` 쿼리를 실행합니다. 모니터 개수가 많아질수록 쿼리 지연이 발생하며 놓친(missed) 이벤트를 정확한 타이밍에 처리하지 못합니다.
* **Sentry의 구현**: Celery를 활용한 `clock_dispatch.py`가 분산 큐 기반으로 동작하며, 틱(Tick) 단위의 스케줄러가 정확한 시간에 누락 검사(`check_missed`) 태스크를 발행하여 O(1) 수준으로 확장 가능한 아키텍처를 가집니다.

### 1.4. In-progress / Timeout 관리의 부재
* **Argus의 현실**: 시작(`in_progress`) 체크인 후 `max_runtime`을 초과했을 때 이를 `timeout`으로 처리하는 상태 머신 로직이 supervisor에 완벽히 구현되어 있지 않습니다.
* **Sentry의 구현**: 타임아웃 전용 데몬이 존재하여 `in_progress` 상태로 `max_runtime`을 초과한 체크인을 정확히 캡처하고 `timeout` 상태로 변경한 뒤 이슈를 생성합니다.

---

## 2. Uptime Monitor 분석

### 2.1. 중앙집중식 (Centralized) Polling의 한계 (False Positive 발생)
* **Argus의 현실**: `uptime-worker.ts` 내부에서 직접 `axios`를 호출합니다. 워커가 실행 중인 특정 리전(예: AWS us-east-1)의 네트워크 순단이나 DNS 장애 시, 타겟 서버는 정상임에도 `down`으로 간주되어 치명적인 오탐(False Positive) 알림을 발생시킵니다.
* **Sentry의 구현**: Sentry의 Uptime 모니터링(`sentry.uptime`)은 `UptimeRegionConfig`를 통해 **글로벌 다중 리전(Multi-Region)** 분산 체커(Checker) 시스템을 사용합니다. 특정 리전에서 실패해도 타 리전에서 교차 검증하여 실제 다운타임 여부를 판단합니다.

### 2.2. MySQL 대규모 `CASE WHEN` Bulk Update 병목
* **Argus의 현실**: 10초마다 워커가 핑을 날리고, 모든 모니터의 상태를 한 번에 갱신하기 위해 `UPDATE ... CASE WHEN` 문을 사용합니다. 이 쿼리는 `g_argus_uptimeMonitors` 테이블 전체에 락(Lock)을 유발하거나 데드락(Deadlock)을 발생시킬 위험이 매우 높습니다.
* **Sentry의 구현**: Uptime 결과 역시 Kafka를 거쳐 ClickHouse에 시계열 데이터로 저장됩니다. 통계(Uptime %, 평균 응답 시간)는 쿼리 시점에 집계(Aggregation)하거나 롤업(Rollup) 테이블을 활용하지, 메인 트랜잭션 DB를 주기적으로 UPDATE하지 않습니다.

### 2.3. 네트워크 상세 검증 기능 부족
* **Argus의 현실**: 단순 HTTP GET/POST 핑만 날립니다 (`status === 'fulfilled'`). HTTP 200이 아닌 4xx/5xx 응답에 대한 구체적인 매칭 규칙이나 SSL 인증서 만료 알림(Expiry check), 커스텀 헤더 지정 등의 기능이 전혀 없습니다.
* **Sentry(및 전문 모니터링 도구)의 구현**: 단순 응답 여부 외에도 `Expected Status Code`, `Regex 매칭(Body)`, `SSL 인증서 유효기간 체크` 등 다양한 Assertion(검증) 로직을 갖추고 있습니다.

---

## 3. 결론

현재 Argus의 Cron 및 Uptime 기능은 **단일 서버용 토이 프로젝트** 수준의 아키텍처에 머물러 있습니다. (유저 분의 "흉내만 낸 수준"이라는 평가가 정확합니다.)

### 시급한 아키텍처 개선 방향
1. **Cron 파서 및 상태 머신 고도화**: 더미 코드를 걷어내고 `cron-parser` 라이브러리와 타임존을 결합하여 정확한 `next_checkin_at` 및 타임아웃 처리를 구현해야 합니다.
2. **시계열 데이터 ClickHouse 마이그레이션**: Cron Checkins와 Uptime Checkins 모두 데이터 발생 주기가 매우 짧고 누적량이 방대하므로 MySQL INSERT/UPDATE를 중단하고, ClickHouse 전용 테이블(및 Batch Insert)로 즉각 마이그레이션해야 DB 장애를 막을 수 있습니다.
3. **Uptime 분산 체커 아키텍처**: Uptime 검증을 단일 Node.js 워커에서 하지 말고, AWS Lambda / Serverless 혹은 여러 리전의 Edge Node로 분리하여 결과를 취합(Aggregator)하는 구조로 개편해야 오탐을 방지할 수 있습니다.
