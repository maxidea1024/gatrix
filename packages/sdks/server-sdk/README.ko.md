# @gatrix/server-sdk

Gatrix 서버 사이드 SDK for Node.js — 캐싱, 이벤트 처리, 서비스 디스커버리를 지원합니다.

## 주요 기능

- 🚀 **쉬운 사용** — 일반 작업을 위한 간단한 API
- 📦 **캐싱** — 자동 갱신이 포함된 내장 캐싱
- 🔔 **이벤트 처리** — Redis PubSub을 통한 실시간 캐시 업데이트
- 🔍 **서비스 디스커버리** — Backend API 기반 서비스 디스커버리
- 📝 **TypeScript** — 타입 정의가 포함된 완전한 TypeScript 지원
- ✅ **테스트** — 포괄적인 테스트 커버리지

## 설치

```bash
npm install @gatrix/server-sdk
```

## 요구 사항

- Node.js >= 22.0.0
- Redis (선택, 이벤트 처리용)

## 빠른 시작

```typescript
import { GatrixServerSDK } from '@gatrix/server-sdk';

// SDK 인스턴스 생성
const sdk = new GatrixServerSDK({
  // 필수
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token', // 선택: 테스트용은 기본 토큰 사용
  applicationName: 'your-app-name',
  service: 'worldd',       // 서비스 이름 (예: 'auth', 'lobby', 'world', 'chat')
  group: 'kr-1',           // 서비스 그룹 (예: 'kr', 'us', 'production')
  environment: 'env_prod', // 환경 식별자 (예: 'env_prod', 'env_staging')
});

// SDK 초기화 (캐시 로드)
await sdk.initialize();

// SDK 사용
const worlds = await sdk.fetchGameWorlds();
console.log('게임 월드:', worlds);

// 완료 시 SDK 종료
await sdk.close();
```

### 테스트용 토큰 없이 사용

```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'http://localhost:5000',
  applicationName: 'test-server',
  service: 'test-service',
  group: 'test-group',
  environment: 'env_dev',
  // apiToken 생략 - 기본값: 'gatrix-unsecured-server-api-token'
});
```

⚠️ **경고:** 비보안 토큰은 테스트 전용입니다. 프로덕션에서는 반드시 적절한 API 토큰을 사용하세요.

## 설정

### 기본 설정

```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  applicationName: 'your-app-name',
  service: 'worldd',
  group: 'kr-1',
  environment: 'env_prod',
});
```

### Redis 설정 (이벤트 처리용)

```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  applicationName: 'your-app-name',
  service: 'worldd',
  group: 'kr-1',
  environment: 'env_prod',
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-redis-password', // 선택
    db: 0, // 선택
  },
});
```

### 전체 설정

```typescript
const sdk = new GatrixServerSDK({
  // 필수
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  applicationName: 'your-app-name',
  service: 'worldd',
  group: 'kr-1',
  environment: 'env_prod',

  // 선택 - Redis
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-redis-password',
    db: 0,
  },

  // 선택 - 캐시
  cache: {
    enabled: true,
    ttl: 300, // 초 ('polling' refreshMethod에서만 사용)
    refreshMethod: 'polling', // 'polling' | 'event' | 'manual'. 기본: 'polling'
  },

  // 선택 - 메트릭
  metrics: {
    enabled: true,
    port: 9337, // 메트릭 서버 포트 (기본: 9337 또는 SDK_METRICS_PORT 환경변수)
  },

  // 선택 - 로거
  logger: {
    level: 'info', // 'debug' | 'info' | 'warn' | 'error'
    timeOffset: 9, // 시간 오프셋 (예: 9 = +09:00). 기본: 0 (UTC)
    timestampFormat: 'local', // 'iso8601' | 'local'. 기본: 'iso8601'
  },

  // 선택 - HTTP 재시도
  retry: {
    enabled: true,
    maxRetries: 10,        // 최대 재시도 횟수. -1이면 무한 재시도 (기본: 10)
    retryDelay: 2000,      // 초기 재시도 지연 ms (기본: 2000)
    retryDelayMultiplier: 2, // 지수 백오프 배수 (기본: 2)
    maxRetryDelay: 10000,  // 최대 재시도 지연 ms (기본: 10000)
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  },
});
```

### createInstance로 오버라이드 설정

공유 기본 설정을 기반으로 서비스별 커스터마이징이 필요할 때:

```typescript
import { GatrixServerSDK, GatrixSDKConfig } from '@gatrix/server-sdk';

const baseConfig: GatrixSDKConfig = {
  gatrixUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  applicationName: 'my-game',
  service: 'default-service',
  group: 'default-group',
  environment: 'production',
  redis: { host: 'localhost', port: 6379 },
  cache: { enabled: true, refreshMethod: 'event' },
};

// 빌링 워커용
const billingSDK = GatrixServerSDK.createInstance(baseConfig, {
  service: 'billing-worker',
  group: 'payment',
});

// 월드 서버용
const worldSDK = GatrixServerSDK.createInstance(baseConfig, {
  service: 'worldd',
  group: 'kr-1',
  worldId: 'world-1',
});
```

### 필수 설정 필드

| 필드 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `gatrixUrl` | string | Gatrix 백엔드 URL | `https://api.gatrix.com` |
| `apiToken` | string | 서버 API 토큰 | `your-server-api-token` |
| `applicationName` | string | 애플리케이션 이름 | `my-game-server` |
| `service` | string | 서비스 이름 | `auth`, `lobby`, `world`, `chat` |
| `group` | string | 서비스 그룹 | `kr`, `us`, `production` |
| `environment` | string 또는 `'*'` | 환경 식별자 또는 멀티 환경 모드 | `env_prod`, `env_staging`, `*` |

### 멀티 환경 모드

모든 환경의 데이터를 캐시해야 하는 Edge 서버 등에서 와일드카드 `'*'` 사용:

```typescript
const sdk = new GatrixServerSDK({
  // ...
  environment: '*', // 멀티 환경 모드
  cache: { enabled: true, refreshMethod: 'event' },
});

await sdk.initialize();

const devWorlds = sdk.getCachedGameWorlds('development');
const prodWorlds = sdk.getCachedGameWorlds('production');
```

## API 레퍼런스

### 쿠폰

```typescript
const result = await sdk.redeemCoupon({
  code: 'COUPON123',
  userId: 'user-123',
  userName: 'John Doe',
  characterId: 'char-456', // 선택
  worldId: 'world-1',      // 선택
  platform: 'pc',          // 선택
  channel: 'steam',        // 선택
  subChannel: 'global',    // 선택
});

console.log('보상:', result.reward);
console.log('사용 횟수:', result.userUsedCount);
```

### 게임 월드

```typescript
// 모든 게임 월드 가져오기
const worlds = await sdk.fetchGameWorlds('en');

// ID로 게임 월드 가져오기
const world = await sdk.fetchGameWorldById(1);

// worldId로 게임 월드 가져오기
const world = await sdk.fetchGameWorldByWorldId('world-1');

// 캐시된 게임 월드
const worlds = sdk.getCachedGameWorlds();

// 점검 상태 확인
const isActive = sdk.isWorldMaintenanceActive('world-1');
const message = sdk.getWorldMaintenanceMessage('world-1', 'ko');
```

### 점검 (Maintenance) API

#### 이름 규칙

| 속성/메서드 | 설명 |
|-------------|------|
| `hasMaintenanceScheduled` | 점검이 예약되어 있는지 (관리자에서 설정) |
| `isMaintenanceActive` | 점검이 현재 활성 상태인지 (시간 기반 확인) |

```typescript
// 글로벌 서비스 점검 확인
const isActive = sdk.isServiceMaintenanceActive();
const message = sdk.getServiceMaintenanceMessage('ko');

// 점검 상태 확인 (서비스 + 월드 결합)
const isActive = sdk.isMaintenanceActive('world-1');

// 상세 점검 정보
const info = sdk.getMaintenanceInfo('world-1', 'ko');
// { isMaintenanceActive, source, message, startsAt, endsAt, forceDisconnect, ... }

// 클라이언트 전달용 현재 점검 상태
const status = sdk.getCurrentMaintenanceStatus();
```

#### 점검 이벤트

```typescript
sdk.on('local.maintenance.started', (event) => {
  console.log('점검 시작:', event.data);
});

sdk.on('local.maintenance.ended', (event) => {
  console.log('점검 종료:', event.data);
});

sdk.on('local.maintenance.grace_period_expired', (event) => {
  console.log('유예 기간 만료:', event.data);
});
```

### 팝업 공지

```typescript
const notices = await sdk.fetchPopupNotices();
const cached = sdk.getCachedPopupNotices();
const worldNotices = sdk.getPopupNoticesForWorld('world-1');
```

### 설문

```typescript
const surveys = await sdk.fetchSurveys();
const cached = sdk.getCachedSurveys();
const active = sdk.getActiveSurveys();
const worldSurveys = sdk.getSurveysForWorld('world-1');
```

### 캐시 관리

#### 캐시 갱신 방식

| 방식 | TTL 사용 | Redis 필요 | 갱신 트리거 |
|------|----------|------------|-------------|
| `polling` | ✅ 예 | ❌ 아니오 | `ttl` 기반 주기적 갱신 |
| `event` | ❌ 아니오 | ✅ 예 | Redis PubSub 이벤트 |
| `manual` | ❌ 아니오 | ❌ 아니오 | 수동 `sdk.refreshCache()` 호출만 |

```typescript
// 모든 캐시 갱신
await sdk.refreshCache();

// 특정 캐시 갱신
await sdk.refreshGameWorldsCache();
await sdk.refreshPopupNoticesCache();
await sdk.refreshSurveysCache();
```

### 이벤트 처리

#### 표준 이벤트

| 이벤트 타입 | 트리거 | 자동 갱신 |
|-------------|--------|-----------|
| `gameworld.created/updated/deleted` | 게임 월드 생성/수정/삭제 | ✅ 게임 월드 캐시 |
| `popup.created/updated/deleted` | 팝업 공지 생성/수정/삭제 | ✅ 팝업 공지 캐시 |
| `survey.created/updated/deleted` | 설문 생성/수정/삭제 | ✅ 설문 캐시 |
| `maintenance.started/ended` | 점검 시작/종료 | ✅ 게임 월드 캐시 |
| `whitelist.updated` | 화이트리스트 수정 | ✅ 화이트리스트 캐시 |

```typescript
sdk.on('gameworld.updated', async (event) => {
  console.log('게임 월드 업데이트:', event.data);
});

// 커스텀 이벤트 발행
await sdk.publishCustomEvent('player.levelup', {
  playerId: 'player-123',
  newLevel: 50,
});

// 커스텀 이벤트 수신
sdk.on('custom:player.levelup', async (event) => {
  console.log('플레이어 레벨업:', event.data);
});

// 모든 이벤트 수신
sdk.on('*', async (event) => {
  console.log('이벤트:', event.type, event.data);
});
```

### 서비스 디스커버리

```typescript
// 서비스 등록
const { instanceId, externalAddress } = await sdk.registerService({
  labels: {
    service: 'worldd',
    group: 'kr-1',
  },
  ports: {
    game: 7777,
    internalApi: 8080,
    externalApi: 8081,
  },
  status: 'ready',
  stats: { cpuUsage: 45.5, memoryUsage: 2048 },
  meta: { capacity: 1000 },
});

// 서비스 상태 업데이트
await sdk.updateServiceStatus({
  status: 'ready',
  stats: { cpuUsage: 45.5, memoryUsage: 2048 },
});

// 서비스 조회
const allServices = await sdk.fetchServices();
const worldServers = await sdk.fetchServices({ serviceType: 'worldd' });
const readyServers = await sdk.fetchServices({ status: 'ready' });

// 서비스 등록 해제
await sdk.unregisterService();
```

### 화이트리스트 관리

```typescript
// 캐시된 화이트리스트 조회
const whitelists = sdk.getCachedWhitelists();

// IP 화이트리스트 확인 (CIDR 지원)
const isIpAllowed = sdk.whitelist.isIpWhitelisted('192.168.1.100');

// 계정 화이트리스트 확인
const isAccountAllowed = sdk.whitelist.isAccountWhitelisted('account123');

// 화이트리스트 캐시 수동 갱신
await sdk.refreshWhitelistCache();
```

## 로거 설정

```typescript
import { Logger, getLogger } from '@gatrix/server-sdk';

// 카테고리 기반 로거
const logger = getLogger('MY-SERVICE');
logger.info('서비스 초기화됨');

// 설정 포함
const logger = getLogger('CACHE-MANAGER', {
  level: 'debug',
  timeOffset: 9, // +09:00 (한국)
  timestampFormat: 'local',
});

// JSON 형식 (로그 집계 도구용)
const logger = new Logger({
  level: 'info',
  format: 'json',
  context: { service: 'game-server', region: 'us-east-1' },
});
```

## 메트릭 서버

```typescript
import { createMetricsServer, getLogger } from '@gatrix/server-sdk';

const metricsServer = createMetricsServer({
  port: 9337,
  applicationName: 'my-game-server',
  service: 'worldd',
  group: 'kr-1',
  environment: 'env_prod',
  logger: getLogger('MY-SERVER'),
});

metricsServer.start();

// 커스텀 메트릭 생성
const playersOnline = metricsServer.createGauge('players_online', '현재 접속 플레이어 수', ['server_id']);
playersOnline.labels('world-1').set(150);

const eventsProcessed = metricsServer.createCounter('events_processed_total', '처리된 이벤트 수', ['event_type']);
eventsProcessed.labels('login').inc();
```

엔드포인트:
- `GET /metrics` — Prometheus 메트릭
- `GET /health` — 헬스 체크 (200 OK 반환)

## 에러 처리

```typescript
import { GatrixSDKError, isGatrixSDKError } from '@gatrix/server-sdk';

try {
  const result = await sdk.redeemCoupon({ code: 'INVALID', userId: 'user-123', userName: 'John' });
} catch (error) {
  if (isGatrixSDKError(error)) {
    console.error('SDK 에러:', error.code, error.message);
    console.error('상태 코드:', error.statusCode);
  }
}
```

## 개발

```bash
# SDK 빌드
npm run build

# 테스트 실행
npm run test

# 린트
npm run lint

# 게임 서버에 배포
npm run deploy:game
```

## 라이선스

Proprietary - Gatrix Team
