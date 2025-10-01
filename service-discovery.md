# Node.js + ioredis 기반 Service Discovery 설계 문서

본 문서는 Redis를 활용한 경량 Service Discovery 시스템의 설계, 동작 방식, 운영 고려사항, 그리고 Node.js(TypeScript) 기반 SDK 구현 계획을 정리합니다.

## 🎯 목표(Goals)
- Redis를 활용한 경량 Service Discovery 시스템 설계
- 각 서버 인스턴스의 등록(Register) / 갱신(Heartbeat) / 조회(Discover) / 제거(Remove) 제공
- 서버 상태, 성능 지표, 시스템 정보까지 관리
- 운영 환경에서 확장성(Scaling)과 장애 복구(HA/Failover) 고려

## 📦 관리 항목(데이터 모델)
각 서버 인스턴스는 아래 필드를 관리합니다. 모든 필드는 camelCase 규칙을 준수합니다.

- instanceId: ULID 기반 고유 ID
- type: 서비스 타입 (예: auth, game, chat)
- group: 서버 그룹명 (예: kr-1, us-east)
- hostname: 서버 호스트명 (DNS 기준)
- publicIp: 외부 접속용 IP
- privateIp: 내부 통신용 IP
- systemInfo: CPU, Memory, OS 등 기본 시스템 정보(JSON 직렬화)
- performance: TPS, Latency, Load Avg 등 성능 지표(JSON 직렬화)
- lastHeartbeat: 마지막 헬스체크 시각(ISO8601). TTL 갱신용 기준

TypeScript 인터페이스 예시:

```ts
export interface ServiceInstance {
  instanceId: string;
  type: string;        // e.g., 'auth' | 'game' | 'chat'
  group: string;       // e.g., 'kr-1' | 'us-east'
  hostname: string;
  publicIp: string;
  privateIp: string;
  systemInfo: string;  // JSON stringified
  performance: string; // JSON stringified
  lastHeartbeat: string; // ISO8601
}
```

## 🏗 Redis 키 설계
1) 서버 인스턴스 저장(Hash)
- Key: `service:instance:{instanceId}`
- Value: Hash(ServiceInstance의 각 필드)

예:

```
service:instance:01JCYFZQ7D4NB4MZ5S6Z6NXYK8
{
  "type": "game",
  "group": "kr-1",
  "hostname": "game-01.kr.example.com",
  "publicIp": "123.45.67.89",
  "privateIp": "10.0.0.5",
  "systemInfo": "{cpu:16, memory:32768, os:linux}",
  "performance": "{tps:1200, latency:5ms, load:0.8}",
  "lastHeartbeat": "2025-10-01T02:00:15Z"
}
```

2) 서비스 그룹 인덱스(Set)
- Key: `service:group:{type}:{group}`
- Members: `instanceId` 목록

예:

```
service:group:game:kr-1 = {
  01JCYFZQ7D4NB4MZ5S6Z6NXYK8,
  01JCYFZQ8V7KX92NDQ7HBMJH3S
}
```

3) TTL 관리(Key Expiry)
- 각 인스턴스 키(`service:instance:{id}`)에는 EXPIRE 설정(기본 30s)
- 서버는 주기적으로 Heartbeat를 호출하여 TTL을 갱신(예: 10s 주기)
- TTL 만료 시 자동으로 인스턴스 삭제됨
- 그룹 인덱스(Set) 정리는 Lua Script 혹은 주기적 정리 Job으로 수행(유령 인스턴스 제거)

정리 Lua Script 예시(개념):

```lua
-- KEYS[1] = service:group:{type}:{group}
local stale = {}
local members = redis.call('SMEMBERS', KEYS[1])
for _, id in ipairs(members) do
  local k = 'service:instance:' .. id
  if redis.call('EXISTS', k) == 0 then
    table.insert(stale, id)
  end
end
for _, id in ipairs(stale) do
  redis.call('SREM', KEYS[1], id)
end
return #stale
```

## 🔄 동작 흐름(시퀀스)
- 등록(Register)
  - 서버 시작 시 ULID 생성 후 `HSET`으로 상세 정보 저장
  - `EXPIRE`(기본 30s) 설정, `SADD service:group:{type}:{group}`에 `instanceId` 추가
- 조회(Discover)
  - `SMEMBERS service:group:{type}:{group}`로 후보 인스턴스 조회
  - 각 `instanceId`에 대해 `HGETALL service:instance:{id}`로 상세 조회
- 헬스체크(Heartbeat)
  - 주기적으로 `HSET lastHeartbeat` 갱신 + `EXPIRE` 재설정
  - 필요시 성능 지표(performance) 동시 업데이트
- 제거(Remove)
  - 정상 종료 시 `DEL service:instance:{id}` + `SREM service:group:{type}:{group}` 실행
  - 비정상 종료 시 TTL 만료로 자동 정리, 주기적 Lua 정리 스크립트로 Set 정합성 유지

## 🖼 아키텍처 다이어그램
```mermaid
flowchart LR
    subgraph Server Instances
        A1[Game Server 1]
        A2[Game Server 2]
        B1[Auth Server 1]
        C1[Chat Server 1]
    end

    subgraph Redis
        R1[(service:instance:{id})]
        R2[(service:group:{type}:{group})]
    end

    A1 -- Register/Heartbeat --> R1
    A1 -- Register --> R2
    A2 -- Register/Heartbeat --> R1
    A2 -- Register --> R2
    B1 -- Register/Heartbeat --> R1
    B1 -- Register --> R2
    C1 -- Register/Heartbeat --> R1
    C1 -- Register --> R2

    ClientApp -- Discover --> R2
    R2 -- instanceId list --> ClientApp
    ClientApp -- HGETALL --> R1
    R1 -- instance details --> ClientApp
```

## 🧩 Node.js + ioredis 코드 예시
```ts
import Redis from 'ioredis';
import { ulid } from 'ulid';

const redis = new Redis(process.env.REDIS_URL || undefined);
const instanceId = ulid();
const serviceType = 'game';
const group = 'kr-1';

async function register() {
  const key = `service:instance:${instanceId}`;
  await redis.hmset(key, {
    type: serviceType,
    group,
    hostname: 'game-01.kr.example.com',
    publicIp: '123.45.67.89',
    privateIp: '10.0.0.5',
    systemInfo: JSON.stringify({ cpu: 16, memory: 32768, os: 'linux' }),
    performance: JSON.stringify({ tps: 1200, latency: '5ms', load: 0.8 }),
    lastHeartbeat: new Date().toISOString(),
  });
  await redis.expire(key, 30); // TTL 30s
  await redis.sadd(`service:group:${serviceType}:${group}`, instanceId);
}

async function heartbeat() {
  const key = `service:instance:${instanceId}`;
  await redis.hset(key, 'lastHeartbeat', new Date().toISOString());
  await redis.expire(key, 30);
}

setInterval(heartbeat, 10_000); // 10초마다 갱신
register().catch(console.error);
```

## ⚙️ 운영 고려사항
1) 장애 복구(HA)
- Redis Sentinel 또는 Redis Cluster(권장)로 고가용성 구성
- TTL 기반 자동 삭제로 비정상 종료 시 유령 인스턴스 자동 정리
- Set 인덱스는 Lua/백그라운드 Job으로 주기 정리하여 정합성 보장

2) 확장성
- 서비스 타입/그룹 기준 샤딩(`service:group:{type}:{group}`)
- 대규모 환경에서는 Redis Cluster/KeyDB 고려
- 읽기 부하는 그룹 인덱스 접근 최적화로 완화(필요 시 캐시 계층 추가)

3) 모니터링/알림
- `lastHeartbeat` 기반 생존 여부 확인
- `performance`는 Prometheus Exporter 또는 Pull 방식으로 연동
- Redis 데이터 기반 대시보드(UI) 구성 가능(조회용 API 또는 Grafana + Redis 플러그인)

4) 보안
- Redis 접근을 내부망으로 제한, ACL 필수
- 관리용 토큰/서명 기반 등록 정책(HTTP 게이트웨이 모드 시)
- 비밀정보는 환경변수/Secret Manager로 관리

5) 운영 자동화
- 신규 서버 부팅 시 자동 등록 스크립트 포함
- 정상 종료 시 `remove()` 호출을 systemd 종료 훅에 연결
- 장애 탐지 시 Slack/PagerDuty 등 알림 연동

## 🔐 데이터 정합성 및 원자성
- `register` 시 `MULTI/EXEC` 또는 파이프라인으로 `HMSET`, `EXPIRE`, `SADD`를 묶어 반쯤 등록되는 상태 방지
- `remove` 시 `DEL`과 `SREM`을 묶어서 실행(또는 Lua 스크립트)
- `discover` 결과 필터링: `HGETALL` 결과가 없으면 해당 `instanceId`는 Set에서 제거

## ⏱ 기본 파라미터(권장)
- TTL: 30초
- Heartbeat 주기: 10초
- 정리 주기: 30~60초(그룹 Set 스캔 및 유령 인스턴스 SREM)
- 키 프리픽스: `service:`(환경에 따라 `sd:` 등으로 변경 가능)

## 🧪 테스트 및 검증
- 단위 테스트: 등록/갱신/조회/제거 API 및 Lua 정리 스크립트
- 통합 테스트: Redis(Single/Cluster) 환경에서 TTL 만료, 페일오버 시나리오
- 부하 테스트: 그룹 당 인스턴스 수 증가에 따른 조회/정리 성능 확인

## 📦 SDK 구현 계획(Node.js, TypeScript, axios)
요구사항: 각 실제 서버에서 손쉽게 사용 가능한 클라이언트 SDK를 `packages/` 하위에 제공합니다.

패키지 제안:
- 이름: `@gatrix/service-discovery-client`
- 경로: `packages/service-discovery-client`

지원 모드:
- Redis Direct 모드: ioredis 직접 연결(저지연, 내부망 환경)
- HTTP Gateway 모드: axios를 사용하여 중앙 게이트웨이 API 호출(네트워크/보안 정책상 Redis 직접 연결이 어려운 환경)

공통 API 설계:
```ts
export interface ServiceDiscoveryClientOptions {
  mode: 'redis' | 'http';
  ttlSeconds?: number;          // default 30
  heartbeatIntervalMs?: number; // default 10_000
  keyPrefix?: string;           // default 'service:'
  // redis
  redisUrl?: string;
  // http
  baseURL?: string;
  apiToken?: string;            // HTTP 인증 토큰
}

export interface RegisterInput {
  instanceId?: string;          // 미제공 시 SDK가 ULID 생성
  type: string;
  group: string;
  hostname: string;
  publicIp: string;
  privateIp: string;
  systemInfo?: Record<string, unknown>;
  performance?: Record<string, unknown>;
}

export interface ServiceDiscoveryClient {
  register(input: RegisterInput): Promise<{ instanceId: string }>;
  heartbeat(instanceId: string, patch?: { performance?: Record<string, unknown> }): Promise<void>;
  discover(type: string, group: string): Promise<ServiceInstance[]>;
  remove(instanceId: string, type: string, group: string): Promise<void>;
  startAutoHeartbeat(instanceId: string): void; // setInterval 내부관리
  stopAutoHeartbeat(): void;
}
```

HTTP 게이트웨이 API(초안):
- `POST /sd/v1/instances` → register
- `POST /sd/v1/instances/{id}/heartbeat` → heartbeat
- `GET /sd/v1/instances?type=game&group=kr-1` → discover
- `DELETE /sd/v1/instances/{id}?type=game&group=kr-1` → remove
- 인증: `X-API-Token` 헤더(서버 간 통신 전용)

테스트 원칙:
- 최소 단위로 Redis mocking 또는 testcontainer를 활용한 실제 Redis 테스트
- HTTP 모드에서는 supertest 기반 E2E 테스트 포함

## 📈 용량 및 성능 고려(개략)
- 인스턴스 Hash 1개당 수백 바이트~수 KB 예상(시스템/성능 필드 크기에 비례)
- 그룹 Set은 인스턴스 수(N)에 비례하여 증가
- Discover는 `SMEMBERS` + `HGETALL * N` 비용. 빈번한 Discover는 캐시(짧은 TTL) 고려

## ✅ 결론
- Node.js + ioredis 기반 경량 Service Discovery 구조는 단순하면서도 실용적
- TTL + Heartbeat 기반으로 유령 인스턴스 문제를 자동 해결
- 운영 측면에서는 Redis HA 구성, 모니터링, 보안, 자동화를 반드시 고려
- SDK는 Redis Direct/HTTP Gateway 이중 모드로 제공하여 다양한 운영 환경을 지원



## 개선점

서버 목록을 조회할때 실제로 health체크를 할지 여부를 선택적으로 적용할수 있으면 좋음.
서버 목록에는 있지만, 실제로 동작하는 서버인지 확인이 필요할수 있음.

기본은 false로. (서버 목록을 신뢰할수 있음.)

sdk는 별도의 service discovery sdk로 만들지 말고, 현재 있는 server side sdk에 포함시키는 형태로.

discovery를 관리하는 주체가 backend이므로 라이브 환경에서 backend를 여러개 실행할 경우에 처리가 문제가 없도록 감안해야함.
필요하다면 bullmq 같은 mq를 사용해도 좋음. (필요하다면)
