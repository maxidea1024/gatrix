# Sentry vs Gatrix Argus: Ingestion Pipeline Analysis

본 문서는 Sentry의 최신 소스코드(Relay, Sentry Core) 분석을 바탕으로, 현재 Gatrix 내부의 `argus` 파이프라인(GroupMQ/Redis 기반)과 아키텍처 및 구현을 비교하여 **부족하거나 보완이 필요한 부분**을 사실 기반(Fact-based)으로 분석한 보고서입니다.

---

## 1. 아키텍처 개요 비교

### Sentry의 인제스천(Ingestion) 파이프라인
Sentry는 대규모 트래픽 처리를 위해 고도로 분산된 아키텍처를 채택하고 있습니다.
1. **Relay (Rust)**: Edge Ingestion 프록시. 모든 SDK 요청을 가장 먼저 받아 처리합니다. 페이로드 검증, Rate Limiting, PII 스크러빙, 인바운드 데이터 필터링(브라우저/IP 등), 트랜잭션 동적 샘플링(Dynamic Sampling) 등을 수행하며 CPU 집약적 작업을 담당합니다.
2. **Kafka**: Relay를 통과한 이벤트는 Kafka 토픽(예: `ingest-events`)에 프로듀스됩니다.
3. **Sentry Core Workers (Python)**: Kafka에서 이벤트를 소비하여, 이슈 그루핑, 알림 규칙(Alerts) 평가, 플러그인 연동 등을 처리합니다.
4. **Snuba (ClickHouse Consumer)**: Sentry Core나 Relay가 직접 ClickHouse에 기록하지 않으며, 전용 컨슈머(Snuba)가 Kafka에서 데이터를 읽어 ClickHouse에 안전하게 배치 삽입(Batch Insert)합니다.
5. **Symbolicator (Rust)**: Minidump, Source Maps, dSYM 등 네이티브 크래시와 스택트레이스를 전용으로 처리하는 서비스입니다.

### Gatrix Argus 파이프라인
현재 작성된 사양(`PIPELINE_OPTIMIZATION_SPEC.md`)과 구현체(`error-worker.ts`, `ingest.ts`) 기준 아키텍처:
1. **API Server (Node.js)**: `ingest.ts`가 이벤트를 받아 즉시 Redis 기반의 `GroupMQ` 또는 `Redis Streams`로 넣습니다.
2. **Workers (Node.js)**: `GroupMQ`에서 이벤트를 꺼내 정규화(Normalization), 핑거프린팅, 인메모리 캐시 기반 이슈 그룹화, Alert 평가를 동기적/비동기적으로 수행합니다.
3. **직접 삽입 (Direct Insert)**: Worker 내부 인메모리 배열 버퍼(`chBuffer`)에 이벤트를 모아 주기가 되면 ClickHouse로 직접 삽입합니다.

---

## 2. Argus 파이프라인의 아키텍처적 부족함 (Missing Capabilities)

### 2.1. Edge Layer 역할의 부재 (Relay의 부재)
Sentry의 핵심 경쟁력은 무거운 파싱과 필터링을 Node/Python이 아닌 Rust 기반의 **Relay**로 분리한 것입니다.
* **문제점**: Argus는 `ingest.ts` (API 서버)에서 페이로드를 받아 바로 Redis로 넣습니다. 만약 비정상적인 트래픽 폭주나 악의적 페이로드가 들어오면 Node.js API 서버의 Event Loop가 막히거나 메모리 부족이 발생할 수 있습니다.
* **Sentry의 해결 방식**: Relay는 메모리 안전성이 높고 빠른 Rust로 구현되어, 잘못된 형식의 이벤트(Invalid JSON/Msgpack, 크기가 큰 페이로드)를 DB나 Queue에 넣기 전에 `processor.rs` 레벨에서 즉시 폐기(Discard)합니다.

### 2.2. 고급 데이터 필터링 및 PII 스크러빙 로직의 한계
* **문제점**: Sentry는 사용자가 프로젝트 설정에서 IP, 오래된 브라우저, 특정 에러 메시지 등을 필터링하고(Inbound Filters), 비밀번호나 신용카드 번호 같은 개인정보(PII)를 제거하는 고급 규칙을 제공합니다. Argus의 정규화(`normalizer.ts`)는 단순히 스키마를 맞추는 수준이며 PII 스크러빙 기능이 빈약합니다.
* **Sentry의 해결 방식**: Relay 내부에 `relay_pii` 와 `relay_filter` 모듈을 두어 정규식과 사전 정의된 규칙 기반으로 페이로드를 정제한 후 파이프라인으로 넘깁니다.

### 2.3. 메시지 큐의 내구성과 확장성 (Redis vs Kafka)
* **문제점**: Argus는 Redis Streams와 `GroupMQ`를 사용해 프로젝트별 순서를 보장(FIFO)합니다. 하지만 Redis는 메모리 기반이므로 트래픽 스파이크 시 OOM(Out of Memory)의 위험이 있고 파티셔닝(Partitioning)의 확장성이 Kafka에 비해 떨어집니다.
* **Sentry의 해결 방식**: Kafka 토픽에 프로젝트 단위로 파티셔닝하여 적재함으로써 디스크 기반의 영속성(Durability)을 보장하고, 수십 대의 Worker가 컨슈머 그룹(Consumer Group)을 통해 스케일아웃하기 용이하게 설계되었습니다.

### 2.4. 동적 샘플링 (Dynamic Sampling) 미지원
* **문제점**: 트랜잭션(APM) 데이터는 오류 데이터보다 수량이 압도적으로 많습니다. Argus는 트랜잭션을 들어오는 대로 모두 Redis Queue에 넣고 있습니다 (`txnQueue.add`).
* **Sentry의 해결 방식**: Sentry Relay는 `Dynamic Sampling` 규칙을 평가하여, 전체 시스템 부하와 사용자의 Quota에 따라 트랜잭션을 수집 단계에서 지능적으로 버립니다(Drop). 이로써 백엔드 및 ClickHouse의 스토리지 비용을 획기적으로 줄입니다.

### 2.5. ClickHouse 버퍼 플러시(Flush) 방식의 안정성
* **문제점**: `error-worker.ts`를 보면 Node.js Worker 내부의 `chBuffer` 배열에 최대 50,000건까지 메모리에 버퍼링한 후 ClickHouse로 Insert합니다.
  * ClickHouse 장애 시 워커 메모리가 급증합니다.
  * 워커 프로세스가 크래시(Crash)되거나 배포로 인해 재시작되면 `chBuffer`에 있던 데이터는 **영구 유실**됩니다 (이미 GroupMQ에서는 처리된 것으로 마킹되었기 때문).
* **Sentry의 해결 방식**: Sentry는 Worker 단계에서 처리된 최종 이벤트를 다시 Kafka(`events` 토픽)에 발행하고, 독립적인 `Snuba-Consumer`가 Kafka의 Offset을 관리하며 ClickHouse로 일괄 적재합니다. 장애 발생 시 Kafka Offset이 커밋되지 않아 데이터 유실이 없습니다.

### 2.6. Rate Limiting 및 Quota 인프라 부족
* **문제점**: Sentry는 요금제에 기반한 한도(Quota)나 과도한 에러 발생 시 Spike Protection을 위해 세밀한 Rate Limiting 체계를 갖춥니다. Argus는 현재 Quota 초과 시 이벤트를 Drop하는 분산 Rate Limiter 아키텍처가 부재합니다.
* **Sentry의 해결 방식**: Relay 내부에서 Redis를 활용한 Quota Rate Limiter를 구동하여, 허용량을 초과하는 이벤트는 `Outcome::RateLimited`로 처리하여 큐에 넣기 전에 버립니다.

---

## 3. 결론 및 향후 개선 제안

현재 Argus의 `GroupMQ + Redis` 구조는 초기 구현 및 적당한 트래픽 규모(초당 수백~수천)에서는 잘 동작할 수 있으나, **극단적 볼륨의 스케일아웃 및 데이터 유실 방지** 관점에서는 Sentry 아키텍처와 비교하여 다음과 같은 보완이 필수적입니다.

1. **Ingestion 프록시 분리 (Relay 역할 도입)**
   * Node.js 기반 API 대신, Rust나 Go 같은 고성능 언어로 앞단 API를 분리하여 PII 스크러빙, Payload 검증, Quota 기반 Rate Limiting을 수행하여 Backend Worker를 보호해야 합니다.
2. **지속 가능한 메시지 버스 도입**
   * 영구적인 데이터 유실 방지와 확장을 위해 장기적으로 Redis Streams/GroupMQ에서 Kafka 기반 파이프라인으로의 전환을 고려해야 합니다.
3. **ClickHouse 삽입 주체 분리**
   * Worker 메모리 내부 버퍼(`chBuffer`)에 의존하지 않고, 중간 큐(Kafka/Redis)를 둔 상태에서 DB Insert만을 전담하는 별도의 Consumer 데몬을 구축하여 재시도 메커니즘을 견고하게 만들어야 합니다.
