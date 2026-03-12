# @gatrix/gatrix-node-server-sdk

Gatrix 서버 사이드 SDK for Node.js — 캐싱, 이벤트 처리, 서비스 디스커버리를 지원합니다.

## 주요 기능

- 🚀 **쉬운 사용** — 일반 작업을 위한 간단한 API
- 📦 **캐싱** — 자동 갱신이 포함된 내장 캐싱
- 🔔 **이벤트 처리** — Redis PubSub을 통한 실시간 캐시 업데이트
- 🔍 **서비스 디스커버리** — Backend API 기반 서비스 디스커버리
- 📝 **TypeScript** — 타입 정의가 포함된 완전한 TypeScript 지원
- 🏴 **피처 플래그** — MurmurHash3 기반 일관된 퍼센트 버킷팅으로 로컬 평가
- 📊 **메트릭** — prom-client 연동 Prometheus 메트릭
- ☁️ **클라우드 감지** — 클라우드 제공자, 리전, 존 자동 감지

## 설치

```bash
npm install @gatrix/gatrix-node-server-sdk
```

## 요구 사항

- Node.js >= 22.0.0
- Redis (선택, 이벤트 처리용)

## 빠른 시작

```typescript
import { GatrixServerSDK } from '@gatrix/gatrix-node-server-sdk';

const sdk = new GatrixServerSDK({
  apiUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  appName: 'your-app-name',
  meta: {
    service: 'worldd',
    group: 'kr-1',
  },
  uses: {
    gameWorld: true,
  },
});

await sdk.initialize();

// 서비스 getter를 통해 접근
const worlds = sdk.gameWorld.getCached();
console.log('게임 월드:', worlds);

await sdk.close();
```

테스트 시 `apiToken`을 생략하면 기본 비보안 토큰(`unsecured-server-api-token`)이 사용됩니다.

⚠️ **경고:** 비보안 토큰은 테스트 전용입니다. 프로덕션에서는 반드시 적절한 API 토큰을 사용하세요.

## 설정

### 전체 설정

```typescript
const sdk = new GatrixServerSDK({
  // 필수
  apiUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  appName: 'your-app-name',

  // 선택 - 서비스 메타데이터
  meta: {
    service: 'worldd',          // 서비스 이름
    group: 'kr-1',              // 서비스 그룹
    version: '1.2.3',           // 버전 정보 (서비스 디스커버리용)
    commitHash: 'abc123',       // Git 커밋 해시
    gitBranch: 'main',          // Git 브랜치 이름
  },

  // 선택 - 월드 ID (월드 수준 점검 확인용)
  worldId: 'world-1',

  // 선택 - 클라우드 설정 (리전 자동 감지)
  cloud: {
    provider: 'aws', // 'aws' | 'gcp' | 'azure' | 'tencentcloud' | 'alibabacloud' | 'oraclecloud'
  },

  // 선택 - Redis (PubSub 이벤트용)
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-redis-password',
    db: 0,
  },

  // 선택 - 캐시
  cache: {
    enabled: true,
    ttl: 300,                   // 초 ('polling' refreshMethod에서만 사용)
    refreshMethod: 'polling',   // 'polling' | 'event' | 'manual'. 기본: 'polling'
  },

  // 선택 - 메트릭
  metrics: {
    enabled: true,              // SDK 내부 메트릭 활성화 (기본: false)
    serverEnabled: true,        // 독립 메트릭 서버 활성화 (기본: false)
    port: 9337,                 // 메트릭 서버 포트
    userMetricsEnabled: true,   // 사용자 메트릭 레지스트리 활성화
  },

  // 선택 - 기능 토글 (선택적 캐싱, 모두 기본: false — opt-in)
  uses: {
    gameWorld: true,            // 게임 월드 캐싱
    popupNotice: true,          // 팝업 공지 캐싱
    survey: true,               // 설문 캐싱
    whitelist: true,            // 화이트리스트 캐싱
    serviceMaintenance: true,   // 서비스 점검 캐싱
    featureFlag: true,          // 피처 플래그 캐싱 및 평가
    vars: true,                 // Vars (KV) 캐싱
    clientVersion: true,        // 클라이언트 버전 캐싱
    serviceNotice: true,        // 서비스 공지 캐싱
    banner: true,               // 배너 캐싱
    storeProduct: true,         // 스토어 상품 캐싱
  },

  // 선택 - 피처 플래그 설정
  featureFlags: {
    compact: true,              // 비활성 플래그에서 평가 데이터 제거 (기본: true)
  },

  // 선택 - 로거
  logger: {
    level: 'info',              // 'debug' | 'info' | 'warn' | 'error'
    timeOffset: 9,              // 시간 오프셋 (예: 9 = +09:00). 기본: 0 (UTC)
    format: 'pretty',           // 'pretty' | 'json'. 기본: 'pretty'
  },

  // 선택 - HTTP 재시도
  retry: {
    enabled: true,
    maxRetries: 10,             // 최대 재시도 횟수 (-1이면 무한). 기본: 10
    retryDelay: 2000,           // 초기 재시도 지연 ms. 기본: 2000
    retryDelayMultiplier: 2,    // 지수 백오프 배수. 기본: 2
    maxRetryDelay: 10000,       // 최대 재시도 지연 ms. 기본: 10000
  },
});
```

### createInstance로 오버라이드

```typescript
import { GatrixServerSDK, GatrixSDKConfig } from '@gatrix/gatrix-node-server-sdk';

const baseConfig: GatrixSDKConfig = {
  apiUrl: 'https://api.gatrix.com',
  apiToken: 'your-server-api-token',
  appName: 'my-game',
  meta: { service: 'default', group: 'default' },
  redis: { host: 'localhost', port: 6379 },
};

const worldSDK = GatrixServerSDK.createInstance(baseConfig, {
  meta: { service: 'worldd', group: 'kr-1' },
  metrics: { enabled: true, serverEnabled: true },
});
```

모든 오버라이드 필드는 선택적이며, 미지정 필드는 기본 설정 값을 사용합니다. 중첩 객체는 deep merge됩니다.

### 멀티 환경 모드

멀티 환경 모드는 Edge 서버처럼 여러 환경의 데이터를 동시에 서빙하고 캐시해야 하는 특수 용도를 위해 설계되었습니다. 범용으로도 사용 가능하지만, 주된 사용 사례는 Edge와 같은 인프라입니다.

```typescript
import { GatrixServerSDK, IEnvironmentProvider } from '@gatrix/gatrix-node-server-sdk';

const environmentProvider: IEnvironmentProvider = {
  getEnvironmentTokens: () => [
    { environmentId: 'env_dev', token: 'dev-token' },
    { environmentId: 'env_prod', token: 'prod-token' },
  ],
};

const sdk = new GatrixServerSDK({
  apiUrl: 'https://api.gatrix.com',
  apiToken: 'your-bypass-token',
  appName: 'edge-server',
  meta: { service: 'edge', group: 'default' },
  environmentProvider,
  redis: { host: 'localhost', port: 6379 },
  cache: { enabled: true, refreshMethod: 'event' },
});

await sdk.initialize();

const devWorlds = sdk.gameWorld.getCached('env_dev');
const prodWorlds = sdk.gameWorld.getCached('env_prod');
```

## 서비스 Getter 패턴

모든 서비스는 SDK 인스턴스의 public getter를 통해 접근합니다:

| Getter                    | Service                   | `uses` 키            |
| ------------------------- | ------------------------- | -------------------- |
| `sdk.gameWorld`           | GameWorldService          | `gameWorld`          |
| `sdk.popupNotice`        | PopupNoticeService        | `popupNotice`       |
| `sdk.survey`             | SurveyService             | `survey`            |
| `sdk.whitelist`          | WhitelistService          | `whitelist`         |
| `sdk.serviceMaintenance` | ServiceMaintenanceService | `serviceMaintenance` |
| `sdk.featureFlag`        | FeatureFlagService        | `featureFlag`       |
| `sdk.vars`               | VarsService               | `vars`              |
| `sdk.storeProduct`       | StoreProductService       | `storeProduct`      |
| `sdk.banner`             | BannerService             | (Edge 기능)          |
| `sdk.clientVersion`      | ClientVersionService      | (Edge 기능)          |
| `sdk.serviceNotice`      | ServiceNoticeService      | (Edge 기능)          |
| `sdk.coupon`             | CouponService             | 항상 사용 가능       |
| `sdk.serviceDiscovery`   | ServiceDiscoveryService   | 항상 사용 가능       |
| `sdk.impactMetrics`      | MetricsAPI                | 항상 사용 가능       |

### 공통 서비스 메서드

캐시 가능 서비스(`BaseEnvironmentService` 상속)의 공통 메서드:

| 메서드                                 | 설명                               |
| -------------------------------------- | ---------------------------------- |
| `getCached(environmentId?)`            | 캐시된 항목 가져오기               |
| `listByEnvironment(environmentId?)`    | API에서 가져와 캐시 업데이트       |
| `refreshByEnvironment(environmentId?)` | 특정 환경 캐시 갱신                |

> 싱글 환경 모드에서는 모든 메서드에서 `environmentId` 파라미터를 생략할 수 있습니다.

## API 레퍼런스

### 피처 플래그 (`sdk.featureFlag`)

백엔드 라운드트립 없이 로컬 평가. **MurmurHash3** 기반 일관된 퍼센트 버킷팅.

> `uses: { featureFlag: true }` 필요

```typescript
// 플래그 활성화 여부 확인
const enabled = sdk.featureFlag.isEnabled('new_battle_mode', false);

// 타입별 변형 값
const config = sdk.featureFlag.stringVariation('battle_config', 'default');
const maxPlayers = sdk.featureFlag.numberVariation('max_players', 100);
const premium = sdk.featureFlag.boolVariation('premium_mode', false);
const settings = sdk.featureFlag.jsonVariation<GameSettings>('game_settings', defaultSettings);
```

#### 컨텍스트를 사용한 평가

```typescript
const context = {
  userId: 'user-123',
  sessionId: 'session-456',
  properties: { platform: 'pc', country: 'KR', level: 50 },
};

const enabled = sdk.featureFlag.isEnabled('new_feature', context, false);
const variant = sdk.featureFlag.stringVariation('feature_config', context, 'default');
```

#### 평가 메서드

| 메서드                                              | 반환 타입          | 설명               |
| --------------------------------------------------- | ------------------ | ------------------ |
| `isEnabled(flag, fallback, env?)`                   | `boolean`          | 플래그 활성화 여부 |
| `isEnabled(flag, context, fallback, env?)`          | `boolean`          | 컨텍스트 포함 평가 |
| `boolVariation(flag, fallback, env?)`               | `boolean`          | 불리언 변형 값     |
| `stringVariation(flag, fallback, env?)`             | `string`           | 문자열 변형 값     |
| `numberVariation(flag, fallback, env?)`             | `number`           | 숫자 변형 값       |
| `jsonVariation<T>(flag, fallback, env?)`            | `T`                | JSON 변형 값       |
| `evaluate(flag, context?, env?)`                    | `EvaluationResult` | 전체 평가 상세     |

> 모든 메서드는 컨텍스트 포함/미포함 오버로드를 지원합니다.

#### 상세 메서드 (Detail) / OrThrow 메서드

```typescript
// Detail: 값 + 평가 메타데이터 반환
const detail = sdk.featureFlag.stringVariationDetail('feature_config', 'default', context);
// { value, reason: 'strategy_match' | 'default' | 'disabled' | 'not_found', variantName }

// OrThrow: 플래그 미발견 시 FeatureFlagError throw
const value = sdk.featureFlag.stringVariationOrThrow('required_config', context);
```

#### 정적 컨텍스트

모든 평가에 적용되는 기본 컨텍스트 (평가별 컨텍스트가 우선):

```typescript
sdk.featureFlag.setStaticContext({
  appName: 'my-game',
  properties: { platform: 'pc', region: 'kr' },
});
```

#### 평가 알고리즘

- **MurmurHash3** (32비트, seed 0) — 수식: `(murmurhash3(groupId + ':' + stickinessValue, 0) % 10001) / 100.0`
- 범위: `0.00` – `100.00`, TypeScript와 C# SDK에서 동일한 결과 보장
- 끈적임 모드: `default`, `userId`, `sessionId`, `random`, 또는 커스텀 속성

### Impact 메트릭 (`sdk.impactMetrics`)

릴리스 세이프가드용 애플리케이션 수준 메트릭:

```typescript
sdk.impactMetrics.defineCounter('http_errors', 'HTTP 오류 수');
sdk.impactMetrics.defineHistogram('response_time_ms', '응답 시간', [10, 50, 100, 500, 1000]);

sdk.impactMetrics.incrementCounter('http_errors');
sdk.impactMetrics.observeHistogram('response_time_ms', 42);
```

60초마다 자동 전송.

### 게임 월드 (`sdk.gameWorld`)

> `uses: { gameWorld: true }` 필요

```typescript
// API에서 가져오기
const worlds = await sdk.gameWorld.listByEnvironment();

// 캐시된 데이터
const cached = sdk.gameWorld.getCached();

// ID / worldId로 가져오기
const world = await sdk.gameWorld.getById('world-id');
const world = await sdk.gameWorld.getByWorldId('world-1');

// 캐시에서 worldId로 조회
const world = sdk.gameWorld.getWorldByWorldId('world-1');

// 점검 상태 확인
const isActive = sdk.gameWorld.isWorldMaintenanceActive('world-1');
const message = sdk.gameWorld.getWorldMaintenanceMessage('world-1', undefined, 'ko');
```

### 쿠폰 (`sdk.coupon`)

```typescript
const result = await sdk.coupon.redeem({
  code: 'COUPON123',
  userId: 'user-123',
  userName: 'John Doe',
  characterId: 'char-456',
  worldId: 'world-1',
  platform: 'pc',
  channel: 'steam',
  subChannel: 'global',
});

console.log('보상:', result.reward);
```

### Vars / KV (`sdk.vars`)

> `uses: { vars: true }` 필요

```typescript
const vars = sdk.vars.getCached();
const value = sdk.vars.getValue('$channels');
const channels = sdk.vars.getParsedValue<any[]>('$channels');
const item = sdk.vars.getByKey('$channels');
```

### 팝업 공지 (`sdk.popupNotice`)

> `uses: { popupNotice: true }` 필요

```typescript
const notices = await sdk.popupNotice.listByEnvironment();
const cached = sdk.popupNotice.getCached();
const worldNotices = sdk.popupNotice.getNoticesForWorld('world-1');
const active = sdk.popupNotice.getActivePopupNotices({
  platform: 'pc', channel: 'steam', worldId: 'world-1',
});
```

### 스토어 상품 (`sdk.storeProduct`)

> `uses: { storeProduct: true }` 필요

```typescript
const products = await sdk.storeProduct.listByEnvironment();
const cached = sdk.storeProduct.getCached();
```

### 설문 (`sdk.survey`)

> `uses: { survey: true }` 필요

```typescript
const surveys = await sdk.survey.listByEnvironment();
const cached = sdk.survey.getCached();
const settings = sdk.survey.getCachedSettings();
const worldSurveys = sdk.survey.getSurveysForWorld('world-1');
const active = sdk.survey.getActiveSurveys('pc', 'steam', 'global', 'world-1', 50, 30);
```

### 화이트리스트 (`sdk.whitelist`)

> `uses: { whitelist: true }` 필요

```typescript
const data = await sdk.whitelist.listByEnvironment();
const cached = sdk.whitelist.getCached();
const isIpAllowed = sdk.whitelist.isIpWhitelisted('192.168.1.100');     // CIDR 지원
const isAccountAllowed = sdk.whitelist.isAccountWhitelisted('account123');
```

### 배너 / 클라이언트 버전 / 서비스 공지

> 각각 `uses`에서 명시적으로 활성화 필요

```typescript
const banners = sdk.banner.getCached();
const versions = sdk.clientVersion.getCached();
const notices = sdk.serviceNotice.getCached();
```

### 점검 (Maintenance)

> `uses: { serviceMaintenance: true }` 필요

SDK 인스턴스에서 직접 사용하는 편의 메서드도 제공합니다:

```typescript
// 글로벌 서비스 점검
const isActive = sdk.isServiceMaintenanceActive();
const message = sdk.getServiceMaintenanceMessage('ko');

// 결합 점검 확인 (서비스 + 월드)
const isActive = sdk.isMaintenanceActive('world-1');

// 상세 정보
const info = sdk.getMaintenanceInfo('world-1', 'ko');
// { isMaintenanceActive, source, message, startsAt, endsAt, forceDisconnect, gracePeriodMinutes, actualStartTime }

// 클라이언트 전달용 (화이트리스트 고려)
const status = sdk.getMaintenanceStatusForClient({
  clientIp: '192.168.1.100',
  accountId: 'account123',
});
// 화이트리스트에 있으면: { isMaintenanceActive: false, isWhitelisted: true }
```

#### 점검 이벤트

```typescript
sdk.on('local.maintenance.started', (event) => console.log('점검 시작:', event.data));
sdk.on('local.maintenance.ended', (event) => console.log('점검 종료:', event.data));
sdk.on('local.maintenance.grace_period_expired', (event) => console.log('유예 기간 만료:', event.data));
```

### 서비스 디스커버리 (`sdk.serviceDiscovery`)

항상 사용 가능 (`uses` 설정 불필요).

```typescript
// 서비스 등록
const { instanceId, externalAddress } = await sdk.registerService({
  labels: { service: 'worldd', group: 'kr-1' },
  ports: { game: 7777, internalApi: 8080, externalApi: 8081 },
  // metricsApi는 SDK 설정에서 자동 추가 (기본: 9337)
  status: 'ready',
  stats: { cpuUsage: 45.5, memoryUsage: 2048 },
  meta: { capacity: 1000 }, // 등록 후 변경 불가
});
// 클라우드 메타데이터 라벨, meta.version/commitHash/gitBranch 자동 추가

// 상태 업데이트 (부분 병합)
await sdk.updateServiceStatus({
  status: 'ready',
  stats: { cpuUsage: 45.5 },
});

// 서비스 조회
const worldServers = await sdk.fetchServices({ service: 'worldd' });
const readyServers = await sdk.fetchServices({ status: 'ready' });
const specific = await sdk.fetchService('worldd', 'instance-id');

// 등록 해제
await sdk.unregisterService();
```

### 캐시 관리

| 방식      | TTL 사용 | Redis 필요 | 갱신 트리거                |
| --------- | -------- | ---------- | -------------------------- |
| `polling` | ✅ 예     | ❌ 아니오   | `ttl` 기반 주기적 갱신     |
| `event`   | ❌ 아니오 | ✅ 예       | Redis PubSub 이벤트        |
| `manual`  | ❌ 아니오 | ❌ 아니오   | 수동 refresh 호출만        |

```typescript
// 전체 캐시 갱신
await sdk.refreshCache();

// 서비스별 갱신
await sdk.gameWorld.refreshByEnvironment();
await sdk.popupNotice.refreshByEnvironment();
await sdk.survey.refreshByEnvironment();
```

### 이벤트 처리

⚠️ Redis + `refreshMethod: 'event'` 필요

| 이벤트 타입                 | 트리거                   | 자동 갱신           |
| --------------------------- | ------------------------ | ------------------- |
| `gameworld.created/updated/deleted` | 게임 월드 변경   | ✅ 게임 월드 캐시    |
| `popup.created/updated/deleted`     | 팝업 공지 변경   | ✅ 팝업 공지 캐시    |
| `survey.created/updated/deleted`    | 설문 변경        | ✅ 설문 캐시         |
| `maintenance.started/ended`         | 점검 시작/종료   | ✅ 게임 월드 캐시    |
| `whitelist.updated`                 | 화이트리스트 변경| ✅ 화이트리스트 캐시 |

```typescript
// 표준 이벤트
sdk.on('gameworld.updated', async (event) => console.log('업데이트:', event.data));

// 커스텀 이벤트 (자동으로 'custom:' 접두사)
await sdk.publishCustomEvent('player.levelup', { playerId: 'player-123', newLevel: 50 });
sdk.on('custom:player.levelup', async (event) => console.log('레벨업:', event.data));

// 전체 이벤트
sdk.on('*', async (event) => console.log(event.type, event.data));

// 연결 복구
sdk.on('connection.restored', (event) => console.log('연결 복구됨'));

// 해제
const unsubscribe = sdk.on('gameworld.updated', callback);
unsubscribe();
```

## 로거 설정

```typescript
import { Logger, getLogger } from '@gatrix/gatrix-node-server-sdk';

const logger = getLogger('MY-SERVICE');
logger.info('서비스 초기화됨');

// JSON 형식 (Loki, ELK 등)
const logger = new Logger({
  level: 'info',
  format: 'json',
  context: { service: 'game-server', region: 'us-east-1' },
});
```

## 메트릭 서버

```typescript
import { createMetricsServer } from '@gatrix/gatrix-node-server-sdk';

const metricsServer = createMetricsServer({
  port: 9337, appName: 'my-game', service: 'worldd', group: 'kr-1',
});
metricsServer.start();

const playersOnline = metricsServer.createGauge('players_online', '접속 플레이어 수', ['server_id']);
playersOnline.labels('world-1').set(150);
```

### HTTP 메트릭 미들웨어

```typescript
const middleware = sdk.createHttpMetricsMiddleware({ scope: 'private' });
app.use(middleware);
```

## 클라우드 메타데이터 감지

```typescript
const metadata = sdk.getCloudMetadata();
const region = sdk.getRegion();
// 지원: AWS, GCP, Azure, Tencent Cloud, Alibaba Cloud, Oracle Cloud
```

## 에러 처리

```typescript
import { isGatrixSDKError, isCouponRedeemError, FeatureFlagError } from '@gatrix/gatrix-node-server-sdk';

try {
  await sdk.coupon.redeem({ ... });
} catch (error) {
  if (isCouponRedeemError(error)) {
    console.error('쿠폰 에러:', error.code);
  } else if (isGatrixSDKError(error)) {
    console.error('SDK 에러:', error.code, error.statusCode);
  }
}
```

## 개발

```bash
yarn build        # 빌드
yarn test         # 테스트
yarn lint         # 린트
yarn deploy:game  # 게임 서버에 배포
```

## 라이선스

MIT License — [LICENSE](../../../LICENSE) 참조
