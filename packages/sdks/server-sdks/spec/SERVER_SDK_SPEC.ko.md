# Gatrix Server SDK 사양서

이 문서는 모든 Gatrix Server SDK의 핵심 아키텍처, API, 동작을 정의합니다. 모든 서버 사이드 구현(Node.js, .NET, Java, Go 등)의 기준선으로서 이 사양서를 반드시 엄격하게 준수해야 합니다. Client SDK 사양서와 동일한 수준의 엄격함을 갖추도록 설계되었습니다.

## 범위 및 Client SDK와의 핵심 차이점

> [!IMPORTANT]
> Server SDK는 Client SDK와 근본적으로 다른 환경에서 동작합니다.
> 
> - **다중 사용자 환경:** Server SDK 인스턴스는 다양한 사용자를 위해 수천 개의 요청을 동시에 처리합니다. 따라서 Context(UserId, SessionId, properties 등)는 클라이언트 인스턴스에 전역으로 저장하는 것이 아니라, **평가 시마다(per-evaluation)** 전달해야 합니다.
> - **로컬 평가:** 각 사용자의 평가된 피처 플래그를 위해 Edge API를 호출하는 대신, Server SDK는 **모든 플래그 정의, 규칙, 세그먼트**를 가져와 로컬 메모리에 캐시하고, 내장된 규칙 엔진을 사용하여 로컬에서 평가를 수행합니다. 이를 통해 플래그 평가 시 **네트워크 지연이 전혀 없습니다**.
> - **멀티 서비스 아키텍처:** Client SDK와 마찬가지로 Server SDK는 Feature Flag, Game World, Popup, Survey, Service Discovery, Maintenance를 처리하는 통합 플랫폼입니다.

## 용어

> [!CAUTION]
> Gatrix는 **"flag"** (또는 **"feature flag"**) 용어를 사용합니다 — **"toggle"** 또는 **"feature toggle"**은 절대 사용하지 않습니다.
> 모든 SDK 코드, API, 메트릭 페이로드, 문서, 주석에서 `flag`/`flags`를 일관되게 사용해야 합니다.

## SDK 명명 규칙

모든 서버 SDK 이름에는 반드시 `gatrix`와 `server`가 모두 포함되어야 합니다.

### 폴더명

패턴: `gatrix-{platform}-server-sdk`

| 플랫폼 | 폴더명 |
|--------|--------|
| Node.js | `server-sdk` (레거시) 또는 `gatrix-node-server-sdk` |
| .NET | `gatrix-dotnet-server-sdk` |
| Java | `gatrix-java-server-sdk` |
| Go | `gatrix-go-server-sdk` |

### 패키지 / 모듈명

| 플랫폼 | 패키지명 |
|--------|----------|
| Node.js | `@gatrix/gatrix-node-server-sdk` |
| .NET | `Gatrix.Server.Sdk` |
| Java | `com.gatrix.server.sdk` |
| Go | `github.com/gatrix/gatrix-go-server-sdk` |

## 데이터 범위 (Organization → Project → Environment)

> [!CAUTION]
> **캐싱 또는 데이터 저장을 구현하기 전에**, SDK 개발자는 각 데이터 타입의 올바른 **범위(scope)**를 반드시 식별해야 합니다. Gatrix는 엄격한 **Organization → Project → Environment** 계층 구조를 따릅니다. 잘못된 범위에서 데이터를 캐싱하면 프로젝트 간 데이터 유출 또는 데이터 누락이 발생합니다.

**SDK가 캐시하는 모든 데이터 타입에 대해 어느 수준에 속하는지 판단해야 합니다:**

| 범위 | 설명 | 예시 |
|------|------|------|
| **Environment별** | 특정 환경에 고유한 데이터. 캐시 키에 반드시 `environmentId`를 포함해야 합니다. | Feature Flag 정의, Game World, Popup Notice, Survey, Whitelist, Maintenance, Banner, Store Product, Client Version, Service Notice, Vars |
| **Project별** | 단일 프로젝트 내 모든 환경에서 공유되지만, 프로젝트 간에는 격리되는 데이터. 캐시 키에 반드시 `projectId`를 포함해야 합니다. | **Segment** (Feature Segment) |
| **Organization별** | 조직 내 모든 프로젝트에서 공유되는 데이터. | (현재 없음) |
| **전역** | 모든 조직에서 공유되는 데이터. | (현재 없음) |

**구현 요구사항:**

1. Feature Flag API 응답(`GET /api/v1/server/features`)에는 `projectId` 필드가 포함됩니다.
2. SDK는 올바른 데이터 범위를 결정하기 위해 **`environmentId → projectId` 매핑**을 유지해야 합니다.
3. `environmentId=X`에 대한 플래그를 평가할 때, 평가기는 매핑에서 `projectId`를 조회한 후 `segments[projectId]`를 사용해야 합니다 — 전역 세그먼트 캐시를 사용하면 안 됩니다.
4. 세그먼트 Pub/Sub 이벤트(`segment.created/updated/deleted`) 처리 시, 이벤트 페이로드의 `projectId`를 사용하여 캐시 작업의 범위를 지정해야 합니다.

> [!WARNING]
> 흔한 실수는 세그먼트를 단일 전역 맵으로 캐시하는 것입니다. 이것은 **잘못된 방법**입니다. 세그먼트는 프로젝트별이며 `Map<projectId, Map<segmentName, Segment>>`로 저장해야 합니다.

## 핵심 개념

### 1. 로컬 평가 및 정의 캐싱

Feature Flag 서비스에서 Server SDK는:
- `GET /api/v1/server/features`에서 원시 **플래그 정의 및 세그먼트**를 가져옵니다. 환경은 `X-API-Token` 헤더에서 서버 사이드로 결정됩니다 — URL 경로의 일부가 아닙니다.
- 주기적으로 폴링하거나 무효화 이벤트를 수신하여 이러한 정의를 업데이트합니다.
- 정의를 최적화된 인메모리 캐시에 로컬로 저장합니다:
  - **플래그**는 **환경별**로 캐시됩니다 (각 환경마다 고유한 플래그 정의 세트가 있습니다).
  - **세그먼트**는 **프로젝트별**로 캐시됩니다 (전역이 아님). Gatrix는 **Organization → Project → Environment** 계층 구조를 따릅니다. 세그먼트는 프로젝트에 속하며 해당 프로젝트 내 모든 환경에서 공유되지만, 프로젝트 간에는 격리됩니다. API 응답에는 세그먼트가 속한 프로젝트를 식별하기 위한 `projectId` 필드가 포함되며, SDK는 평가 시 올바른 세그먼트를 결정하기 위해 `environmentId → projectId` 매핑을 유지해야 합니다.
- 공유 평가 엔진을 사용하여 완전히 로컬에서 플래그를 평가합니다 (`@gatrix/evaluator`의 `FeatureFlagEvaluator`를 포팅 또는 래핑; 타입은 `@gatrix/shared`에 정의). 특정 환경의 플래그를 평가할 때, 평가기는 해당 환경이 속한 프로젝트의 세그먼트를 사용해야 합니다.
- 사용량 메트릭을 로컬에서 버퍼링하고 네트워크 스팸을 방지하기 위해 주기적으로 Gatrix Edge API로 플러시합니다.
- **Client SDK와 달리 Server SDK에는 `synced` vs `realtime` 플래그 개념이나 `explicitSyncMode`가 없습니다.** 모든 플래그 평가는 암묵적으로 실시간이며, 인메모리 캐시의 최신 정의를 사용합니다. 세션 중 일관성은 스테이트리스 요청에서 동일한 컨텍스트를 전달하여 처리됩니다.

### 2. 서비스 네임스페이스 접근

깔끔하고 확장 가능한 API를 유지하기 위해, **모든 서비스별 작업은 전용 하위 서비스를 통해 접근해야 합니다** — 메인 루트 `GatrixServerSdk` 객체에서 직접 접근하면 안 됩니다.

| ❌ 잘못된 방법 | ✅ 올바른 방법 |
|---------------|---------------|
| `sdk.isEnabled("flag", context)` | `sdk.featureFlag.isEnabled("flag", context)` |
| `sdk.getGameWorld("world-1")` | `sdk.gameWorld.fetchById("world-1")` |

**필수 서비스:**
- `coupon`
- `gameWorld`
- `popupNotice`
- `survey`
- `whitelist`
- `serviceMaintenance`
- `storeProduct`
- `featureFlag`
- `serviceDiscovery`
- `impactMetrics`
- `banner`
- `clientVersion`
- `serviceNotice`
- `vars`

### 3. 통합 라이프사이클: 단일 `initialize()`

Client SDK의 `start()`에 해당하며, Server SDK는 캐시와 연결을 부트스트랩하기 위해 단일 초기화 메서드를 사용합니다.

```typescript
const sdk = new GatrixServerSDK(config);
await sdk.initialize();
```

### 4. 캐시 관리 및 갱신 전략

Server SDK는 정의를 갱신하기 위한 세 가지 모드를 갖춘 통합 `CacheManager`를 구현해야 합니다:

| 방식 | 설명 |
|------|------|
| `polling` (기본값) | 설정된 `ttl`에 따라 주기적으로 API에서 데이터를 가져옵니다. Redis가 필요하지 않습니다. |
| `event` | Gatrix Redis Pub/Sub에 연결합니다. Gatrix 백엔드가 변경 이벤트를 발행하면 캐시가 즉시 갱신됩니다. `ttl` 간격은 무시됩니다. |
| `manual` | 백그라운드 활동 없음. 개발자가 수동으로 `refreshCache()`를 호출합니다. |

**복원력 요구사항:**
폴링 또는 이벤트 동기화 중 Gatrix 백엔드에 접근할 수 없게 되면, SDK는 인메모리 캐시의 마지막으로 알려진 양호한 상태로 우아하게 저하(graceful degradation)하여 서비스를 계속해야 합니다. 초기화 시 호스트 애플리케이션이 충돌해서는 안 됩니다. 에러를 로깅하고 백그라운드에서 재시도해야 합니다.

### 5. Redis Pub/Sub 이벤트 시스템

`cache.refreshMethod`가 `"event"`일 때, SDK는 실시간 캐시 무효화를 위해 Redis Pub/Sub 채널을 구독합니다.

**채널:** `gatrix-sdk-events`

**이벤트 형식:**
```json
{
  "type": "gameworld.updated",
  "data": {
    "id": 42,
    "environmentId": "production",
    "isVisible": 1
  }
}
```

> **MySQL TINYINT(1):** `isVisible`과 `isActive`는 `false`/`true` 대신 `0`/`1`로 올 수 있습니다. SDK는 이 변환을 반드시 처리해야 합니다.

#### 표준 이벤트 타입

| 이벤트 타입 | 서비스 | 동작 |
|------------|--------|------|
| `gameworld.created/updated` | GameWorld | 해당 환경의 게임 월드 갱신 |
| `gameworld.deleted` | GameWorld | 캐시에서 제거 |
| `gameworld.order_changed` | GameWorld | 전체 갱신 (순서가 정렬에 영향) |
| `popup.created/updated/deleted` | PopupNotice | 팝업 공지 갱신 |
| `survey.created/updated/deleted` | Survey | 설문조사 갱신 |
| `survey.settings.updated` | Survey | 설문 설정 갱신 |
| `whitelist.updated` | Whitelist | 화이트리스트 갱신 |
| `maintenance.settings.updated` | ServiceMaintenance | 점검 상태 갱신 |
| `store_product.created/updated/deleted` | StoreProduct | 스토어 상품 갱신 |
| `store_product.bulk_updated` | StoreProduct | 전체 갱신 |
| `feature_flag.changed/created/updated/deleted` | FeatureFlag | 피처 플래그 정의 갱신 |
| `segment.created/updated/deleted` | FeatureFlag | 해당 프로젝트의 세그먼트 갱신 |
| `client_version.created/updated/deleted` | ClientVersion | 캐시 업데이트/제거 |
| `banner.created/updated/deleted` | Banner | 캐시 업데이트/제거 |
| `service_notice.created/updated/deleted` | ServiceNotice | 캐시 업데이트/제거 |

#### 처리 규칙

1. **기능 게이트 확인:** 처리 전에 `FeaturesOptions`에서 관련 기능이 활성화되어 있는지 확인합니다. 비활성화된 경우 조용히 건너뜁니다.
2. **환경/프로젝트 범위 지정:** 이벤트는 `data.environmentId`를 통해 대상 환경을 식별합니다. **세그먼트 이벤트(`segment.*`)는 환경이 필요 없습니다** — 세그먼트는 프로젝트별이므로 대신 `data.projectId`를 사용합니다. 비-세그먼트 이벤트에서 `environmentId`가 누락되면 경고를 로깅하고 건너뜁니다.
3. **재연결:** Redis 재연결 시 누락된 이벤트를 복구하기 위해 즉시 모든 캐시를 갱신합니다.
4. **폴백:** 초기화 중 Redis 연결이 실패하면 폴링 모드로 폴백합니다.

#### 사용자 이벤트 구독

SDK는 `On(eventType, callback)` / `Off(eventType, callback)` API를 통해 사용자 등록 콜백을 지원해야 합니다.
와일드카드 `"*"`는 모든 이벤트를 구독합니다. 콜백은 `SdkEvent` 객체 `{ type, data, timestamp }`를 수신합니다.

## API 응답 형식 (Feature Flag)

Server API는 평가된 결과가 아닌 플래그 **정의**를 반환합니다.
평가기는 캐시된 `segments`를 사용하여 세그먼트 참조를 로컬에서 해석해야 합니다.

### 플래그 정의 (`@gatrix/shared` 기준)

```typescript
interface FeatureFlag {
  id: string;
  name: string;
  isEnabled: boolean;
  strategies: FeatureStrategy[];  // 타겟팅 규칙 (segments → constraints → rollout)
  variants: Variant[];            // 가중치 기반 배리언트 목록
  valueType?: 'string' | 'number' | 'boolean' | 'json';
  enabledValue?: any;             // 활성화 시 값 (전략 매칭 없을 때)
  disabledValue?: any;            // 비활성화 시 값
  valueSource?: 'environment' | 'flag';
}

interface FeatureStrategy {
  name: string;
  parameters?: { rollout?: number; stickiness?: string; groupId?: string; };
  constraints?: Constraint[];
  segments?: string[];  // 세그먼트 이름 참조
  isEnabled: boolean;
}

interface Constraint {
  contextName: string;
  operator: ConstraintOperator;  // str_eq, num_gt, semver_gte, arr_any 등
  value?: string;
  values?: string[];
  caseInsensitive?: boolean;
  inverted?: boolean;
}
```

### 평가 순서 (전략별)
1. **세그먼트** — 참조된 모든 세그먼트 제약조건이 통과해야 함
2. **제약조건** — 모든 전략 수준 제약조건이 통과해야 함
3. **전략별 고유 로직** — 등록된 전략의 `isEnabled()` 메서드에 위임

> [!CAUTION]
> **모든 전략에 롤아웃/비율 체크를 일괄 적용하면 안 됩니다.**  
> 각 전략 클래스가 자체 활성화 로직을 내부적으로 처리해야 합니다 (예: `flexibleRollout`은 롤아웃 비율 처리, `default`는 항상 true 반환, `gradualRolloutUserId`는 userId 기반 비율 처리).  
> 평가기의 역할은 세그먼트와 제약조건(1~2단계)에 한정됩니다. 3단계는 반드시 전략 자체의 `isEnabled()` 메서드에 위임해야 합니다.  
> 모든 전략에 일괄적으로 롤아웃 체크를 적용하면 `default` 같은 전략이 `false`로 잘못 평가됩니다.

## Feature Flag 서비스 API

### 핵심 메서드

모든 메서드는 context 누락을 방지하기 위해 **두 가지 오버로드**를 제공합니다:
1. **context 없음** — 유저 타겟팅이 필요 없는 서버 내부 사용
2. **context 포함** — 유저 대상 평가로 context가 반드시 명시적으로 필요

`environmentId`를 생략하면 `apiToken`에 1:1 매핑된 환경이 암묵적으로 사용됩니다 (단일 환경 모드).
다중 환경 모드(예: `environmentProvider`를 사용하는 Edge 서버)에서는 `environmentId`를 반드시 명시적으로 지정해야 합니다.

```csharp
// ============================================
// 핵심 평가
// ============================================
// context 없음 (서버 내부)
EvaluationResult Evaluate(string flagName, string? environmentId = null);
// context 포함 (유저 대상)
EvaluationResult Evaluate(string flagName, EvaluationContext context, string? environmentId = null);

// context 없음
bool IsEnabled(string flagName, bool fallback, string? environmentId = null);
// context 포함
bool IsEnabled(string flagName, EvaluationContext context, bool fallback, string? environmentId = null);

// ============================================
// 배리언트 이름 (매칭된 배리언트 이름을 반환, 값이 아님)
// ============================================
string Variation(string flagName, string fallback = "", string? environmentId = null);
string Variation(string flagName, EvaluationContext context, string fallback = "", string? environmentId = null);

// ============================================
// 타입별 Variation (배리언트의 VALUE를 지정된 타입으로 변환하여 반환)
// 중요: BoolVariation은 배리언트의 VALUE를 bool로 파싱한 것이며, 플래그의 활성화 상태가 아닙니다.
//        플래그의 활성화 상태는 IsEnabled()를 사용하세요.
// ============================================

// context 없음 (서버 내부, 유저 타겟팅 불필요)
string StringVariation(string flagName, string fallback, string? environmentId = null);
int    IntVariation(string flagName, int fallback, string? environmentId = null);
long   LongVariation(string flagName, long fallback, string? environmentId = null);
float  FloatVariation(string flagName, float fallback, string? environmentId = null);
double DoubleVariation(string flagName, double fallback, string? environmentId = null);
bool   BoolVariation(string flagName, bool fallback, string? environmentId = null);
T?     JsonVariation<T>(string flagName, T? fallback = default, string? environmentId = null);

// context 포함 (유저 대상 평가 — context 필수)
string StringVariation(string flagName, EvaluationContext context, string fallback, string? environmentId = null);
int    IntVariation(string flagName, EvaluationContext context, int fallback, string? environmentId = null);
long   LongVariation(string flagName, EvaluationContext context, long fallback, string? environmentId = null);
float  FloatVariation(string flagName, EvaluationContext context, float fallback, string? environmentId = null);
double DoubleVariation(string flagName, EvaluationContext context, double fallback, string? environmentId = null);
bool   BoolVariation(string flagName, EvaluationContext context, bool fallback, string? environmentId = null);
T?     JsonVariation<T>(string flagName, EvaluationContext context, T? fallback = default, string? environmentId = null);

// ============================================
// *Details — 값 + 평가 메타데이터(reason, variant name) 반환
// ============================================
EvaluationDetail<string> StringVariationDetails(string flagName, string fallback, string? environmentId = null);
EvaluationDetail<string> StringVariationDetails(string flagName, EvaluationContext context, string fallback, string? environmentId = null);
// ... (모든 타입이 동일한 두 가지 오버로드 패턴을 따름)

// ============================================
// *OrThrow — 플래그를 찾을 수 없거나 값이 없으면 FeatureFlagException을 throw
// ============================================
string StringVariationOrThrow(string flagName, string? environmentId = null);
string StringVariationOrThrow(string flagName, EvaluationContext context, string? environmentId = null);
// ... (모든 타입이 동일한 두 가지 오버로드 패턴을 따름)
```

> **중요:** `BoolVariation`은 배리언트의 문자열 값을 boolean으로 파싱합니다 (`"true"`/`"false"`, `"1"`/`"0"`).
> 플래그의 활성화 상태를 반환하는 것이 **아닙니다**. 플래그 상태는 `IsEnabled()`를 사용하세요.


## SDK 설정 정의

설정 모델은 이 인터페이스를 반드시 엄격하게 따라야 합니다:

```typescript
interface GatrixSDKConfig {
  // 필수 인증 및 식별
  apiUrl: string;  // Gatrix 백엔드 URL (예: https://api.gatrix.com)
  apiToken: string;
  appName: string;

  // 선택 - 월드별 점검 확인을 위한 월드 ID
  worldId?: string;

  // 선택 - 서비스 메타데이터 (메트릭 라벨 및 서비스 디스커버리용)
  meta?: {
    service?: string;
    group?: string;
    version?: string;
    commitHash?: string;
    gitBranch?: string;
  };

  // 실시간 캐시 무효화를 위한 외부 이벤트 버스
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };

  cache?: {
    enabled: boolean;
    ttl: number; // 기본값: 300
    refreshMethod: 'polling' | 'event' | 'manual'; // 기본값: 'polling'
  };

  logger?: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };

  retry?: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;
    retryDelayMultiplier: number; // 기본값: 2
    maxRetryDelay: number; // 기본값: 10000
    retryableStatusCodes: number[]; // 기본값: [408, 429, 500, 502, 503, 504]
  };

  metrics?: {
    enabled: boolean;
    serverEnabled?: boolean;
    port?: number;
  };

  // 기능 토글 (선택적 캐싱)
  // 기본 서비스는 활성화되어 있으며, 신규 서비스는 명시적으로 활성화해야 합니다.
  uses?: {
    gameWorld?: boolean;           // 기본값: true
    popupNotice?: boolean;         // 기본값: true
    survey?: boolean;              // 기본값: true
    whitelist?: boolean;           // 기본값: true
    serviceMaintenance?: boolean;  // 기본값: true
    clientVersion?: boolean;       // 기본값: false (명시적 활성화 필요)
    serviceNotice?: boolean;       // 기본값: false (명시적 활성화 필요)
    banner?: boolean;              // 기본값: false (명시적 활성화 필요)
    storeProduct?: boolean;        // 기본값: false (명시적 활성화 필요)
    featureFlag?: boolean;         // 기본값: false (명시적 활성화 필요)
    vars?: boolean;                // 기본값: false (명시적 활성화 필요)
  };
}
```

## 복원력, 재시도, 백오프 동작

모든 아웃바운드 HTTP 요청(롱 폴링 또는 Redis 연결 제외)은 지수적 백오프를 구현해야 합니다:
1. **초기 백오프:** 설정 가능 (기본값: 2000ms).
2. **승수:** 기본값 2x.
3. **최대 재시도:** 기본값 10.
4. **재시도 가능 상태 코드:** 408, 429, 500, 502, 503, 504.
5. 재시도 불가 HTTP 코드(예: 401, 403, 404)는 재시도 루프를 건너뛰고 즉시 실패해야 합니다.

## HTTP 헤더

모든 Server SDK는 모든 HTTP 요청에 다음 표준 헤더를 포함해야 합니다. 이를 통해 일관된 인증, 식별, 추적성을 보장합니다.

| 헤더 | 값 | 설명 |
|------|-----|------|
| `X-API-Token` | `{apiToken}` | 인증을 위한 서버 API 토큰 (환경은 이 토큰에서 결정됨) |
| `X-Application-Name` | `{appName}` | 설정의 애플리케이션 이름 |
| `X-SDK-Version` | `{sdkName}/{version}` | 예: `gatrix-java-server-sdk/1.0.0` |
| `Content-Type` | `application/json` | POST/PUT 요청에 필수 |

## 메트릭 및 텔레메트리

### 1. 내부 SDK 메트릭 (Prometheus)
SDK는 내부 사용량 메트릭을 수집하고 Prometheus 호환 엔드포인트(예: `http://0.0.0.0:9337/metrics`)에 노출해야 합니다. 모든 내부 메트릭은 `gatrix_sdk_` 접두사를 가져야 합니다.

필수 포함 항목:
- `gatrix_sdk_http_requests_total`
- `gatrix_sdk_cache_refresh_total` (라벨: `service_type`, `status`)
- `gatrix_sdk_flag_evaluations_total` (라벨: `flag_name`, `variant`, `reason`)

### 2. Gatrix 플래그 분석 (사용량 메트릭)
평가가 로컬에서 이루어지므로, Server SDK는 메모리에 평가 메트릭을 버퍼링하고 주기적으로(기본값: 60초마다) 백엔드 API로 플러시해야 합니다. 이것은 Client SDK의 `sendMetrics`와 마찬가지로 Gatrix 대시보드 카운터를 구동합니다.

### 3. Impact 메트릭 (세이프가드)
SDK는 Gatrix가 카나리/롤아웃 안전성을 평가하는 데 사용하는 커스텀 애플리케이션 수준 메트릭을 기록하기 위한 `impactMetrics` 서비스를 제공해야 합니다.
구현체는 메모리에 버퍼링하고 주기적으로 백엔드 API로 플러시해야 합니다.

```typescript
// 메트릭 정의
sdk.impactMetrics.defineCounter('http_errors', 'HTTP 오류 수');
sdk.impactMetrics.defineHistogram('response_time_ms', '응답 시간', [10, 50, 100, 500, 1000]);

// 요청 처리 중 메트릭 기록
sdk.impactMetrics.incrementCounter('http_errors');
sdk.impactMetrics.observeHistogram('response_time_ms', 42);
```

## 언어별 구현 관용구

아키텍처는 기본적으로 일관되지만, SDK는 각 생태계의 관습을 수용해야 합니다.

### .NET (C#)

.NET 구현(`gatrix-dotnet-server-sdk`)은 순수 C# 및 ASP.NET Core 통합 모두에 대해 관용적으로 구축되어야 합니다.

**1. 의존성 주입:**
`IServiceCollection.AddGatrixServerSdk(Action<GatrixSdkOptions>)`를 노출해야 합니다.
서비스는 Singleton으로 등록해야 합니다. `HttpClient`는 소켓 고갈을 방지하기 위해 `IHttpClientFactory`를 통해 등록해야 합니다.

**2. 어트리뷰트 기반 Feature 게이팅 및 라우팅:**
ASP.NET Core 애플리케이션은 현재 Request Context를 기반으로 플래그를 동적으로 평가하는 고급 ActionFilter 어트리뷰트를 지원해야 합니다.

- `[FeatureGate("flag-name")]`: 플래그가 `true`로 평가될 때만 접근을 허용합니다. `false`이면 설정 가능한 HTTP 응답(예: `404 Not Found` 또는 `403 Forbidden`)을 반환합니다.
    ```csharp
    [FeatureGate("premium-tier")]
    [HttpGet("api/premium/data")]
    public IActionResult GetPremiumData() { ... }
    ```

- `[FeatureMatch("flag-name", "variant-name")]`: 플래그가 특정 배리언트로 평가될 때만 접근을 허용합니다. A/B 테스트 라우팅에 유용합니다.
    ```csharp
    [FeatureMatch("new-checkout", "v2")]
    [HttpPost("api/checkout")]
    public IActionResult CheckoutV2() { ... }
    ```

- `[FeatureValue("flag-name")]`: 플래그의 배리언트 값을 액션 파라미터에 주입합니다. 파라미터의 기본값으로 폴백합니다.
    ```csharp
    [HttpGet("api/config")]
    public IActionResult GetConfig([FeatureValue("ui-theme")] string theme = "default") { ... }
    ```

- `UseGatrixContext()`: Context(예: Claims에서 `UserId`, `RemoteAddress`)를 자동으로 추출하고 스코프된 `GatrixAmbientContext`에 주입하는 미들웨어.

**3. Options 패턴:**
설정은 `Microsoft.Extensions.Options.IOptions<GatrixSdkOptions>`에 바인딩해야 하며, `appsettings.json`에서의 설정과 `IOptionsMonitor`를 사용한 핫 리로딩을 허용해야 합니다.

**4. Context 추출:**
.NET SDK는 스코프된 `GatrixAmbientContext`를 통해 `HttpContext`와 원활하게 통합하여, 개발자가 모든 평가 호출에 수동으로 전달할 필요 없이 `EvaluationContext`를 자동으로 구축해야 합니다.

**5. 로깅:**
`Microsoft.Extensions.Logging.ILogger<T>`에 정확하게 매핑해야 합니다.

### 에러 처리 일관성

- 초기화 중 잘못된 설정은 쉽게 식별 가능한 예외(예: `GatrixConfigurationException`)를 throw해야 합니다.
- 캐싱/동기화 실패 로직은 애플리케이션 런타임 루프를 중단시키면 안 됩니다. 백그라운드 프로세스(이벤트/폴링) 중에 발생하는 모든 예외는 삼키고(swallow) 내부 Logger를 통해 로깅해야 합니다.

## 전체 서비스 API 레퍼런스

아래의 모든 서비스는 모든 Server SDK에서 구현해야 합니다. 접근은 항상 네임스페이스로 구분됩니다:
`sdk.featureFlag.*`, `sdk.gameWorld.*` 등

### BaseEnvironmentService 패턴

대부분의 서비스는 다음을 제공하는 공유 추상 베이스 클래스(`BaseEnvironmentService<T, TResponse>`)를 확장합니다:

| 메서드 | 설명 |
|--------|------|
| `fetchByEnvironment(env)` | API에서 항목을 가져와 로컬에 캐시 |
| `getCached(env)` | 특정 환경의 캐시된 항목 조회 |
| `updateCache(items, env)` | 캐시를 원자적으로 교체 |
| `upsertItemInCache(item, env)` | 캐시에서 단일 항목 업데이트 또는 추가 |
| `removeFromCache(id, env)` | 캐시에서 단일 항목 제거 |
| `clearCache()` | 모든 캐시된 데이터 삭제 |

### 1. Feature Flag (`sdk.featureFlag`)

캐시된 플래그 정의를 사용한 로컬 평가. 모든 평가는 nullable `EvaluationContext`를 받습니다.

#### 메서드 카테고리

| 카테고리 | 메서드 |
|----------|--------|
| **핵심** | `Evaluate(flagName, ctx?)`, `IsEnabled(flagName, ctx?, fallback)` |
| **타입별 Variation** | `StringVariation`, `IntVariation`, `LongVariation`, `FloatVariation`, `DoubleVariation`, `BoolVariation`, `JsonVariation<T>` |
| **\*Details** | 타입별 Variation과 동일하지만 `Value`, `Reason`, `VariantName`이 포함된 `EvaluationDetail<T>`를 반환 |
| **\*OrThrow** | 타입별 Variation과 동일하지만 플래그를 찾을 수 없거나 값이 없으면 `FeatureFlagException`을 throw |

> **`fallback`이 기본값의 표준 파라미터 이름입니다.** `missingValue`나 `defaultValue`가 아닙니다.

#### 평가 엔진

평가기는 `@gatrix/shared/FeatureFlagEvaluator`의 충실한 포트여야 합니다. 핵심 요소:

| 요소 | 설명 |
|------|------|
| **전략 평가 순서** | Segments → Constraints → 전략별 `isEnabled()` (첫 번째 매치 우선) |
| **제약조건 연산자** | `str_eq`, `str_contains`, `str_starts_with`, `str_ends_with`, `str_in`, `str_regex`, `num_eq`, `num_gt`, `num_gte`, `num_lt`, `num_lte`, `num_in`, `bool_is`, `date_eq/gt/gte/lt/lte`, `semver_eq/gt/gte/lt/lte/in`, `exists`, `not_exists`, `arr_any`, `arr_all`, `arr_empty` |
| **수정자 플래그** | `inverted` (결과 반전), `caseInsensitive` (문자열 비교) |
| **전략 위임** | 각 전략이 자체 로직을 처리: `default` → 항상 true, `flexibleRollout` → MurmurHash3 롤아웃, `gradualRolloutUserId/SessionId/Random` → 비율 기반 |
| **배리언트 선택** | murmurhash 비율에 따른 가중치 분배 |
| **값 변환** | `getFallbackValue(value, valueType)`으로 타입에 맞는 출력 보장 |

#### 플래그 분석 메트릭

SDK는 플래그 평가 메트릭을 버퍼링하고 주기적으로 플러시해야 합니다 (기본값: 60초).

```
POST /api/v1/server/features/metrics
{
  appName, sdkVersion,
  bucket: {
    start, stop,
    flags: { flagName: { yes, no, variants: { variantName: count } } },
    missing: { flagName: count }
  }
}
```

### 2. Game World (`sdk.gameWorld`)

| 메서드 | 설명 |
|--------|------|
| `fetchAsync(env)` | API에서 게임 월드 가져오기 |
| `getAll(env)` | 캐시된 게임 월드 조회 (`displayOrder`로 정렬) |
| `getByWorldId(worldId, env)` | worldId로 조회 |
| `isWorldMaintenanceActive(worldId, env)` | 시간 기반 점검 확인 |
| `getWorldMaintenanceMessage(worldId, env, lang)` | 현지화된 점검 메시지 |

### 3. Popup Notice (`sdk.popupNotice`)

| 메서드 | 설명 |
|--------|------|
| `fetchAsync(env)` | 팝업 공지 가져오기 |
| `getAll(env)` | 캐시된 공지 조회 |
| `getForWorld(worldId, env)` | targetWorlds로 필터링 |
| `getActive(env, platform?, channel?, worldId?, userId?)` | 시간 범위 + 타겟팅으로 필터링 (displayPriority로 정렬) |

**타겟팅 로직:** 각 타겟팅 필드는 `inverted` 플래그를 지원합니다. 대상 목록이 null/비어있으면 모든 값이 매칭됩니다.

### 4. Survey (`sdk.survey`)

| 메서드 | 설명 |
|--------|------|
| `fetchAsync(env)` | 설문조사 + 설정 가져오기 |
| `getAll(env)` | 캐시된 설문조사 조회 |
| `getSettings(env)` | 설문 플랫폼 설정 조회 |

### 5. Whitelist (`sdk.whitelist`)

| 메서드 | 설명 |
|--------|------|
| `fetchAsync(env)` | 화이트리스트 데이터 가져오기 |
| `get(env)` | 캐시된 화이트리스트 조회 |
| `isIpWhitelisted(ip, env)` | 화이트리스트에서 IP 확인 |
| `isAccountWhitelisted(accountId, env)` | 화이트리스트에서 계정 확인 |

### 6. Service Maintenance (`sdk.serviceMaintenance`)

| 메서드 | 설명 |
|--------|------|
| `fetchAsync(env)` | 점검 상태 가져오기 |
| `getStatus(env)` | 캐시된 상태 조회 |
| `isActive(env)` | 시간 기반 활성 확인 |
| `getMessage(env, lang)` | 현지화된 점검 메시지 |

### 7. Store Product (`sdk.storeProduct`)

| 메서드 | 설명 |
|--------|------|
| `fetchAsync(env)` | 스토어 상품 가져오기 |
| `getAll(env)` | 캐시된 상품 조회 |

### 8. Service Discovery (`sdk.serviceDiscovery`)

**캐시 없음** — 실시간 API 호출.

| 메서드 | 설명 |
|--------|------|
| `registerAsync(input)` | 서비스 인스턴스 등록 |
| `updateStatusAsync(instanceId, input)` | 상태/통계 업데이트 |
| `deregisterAsync(instanceId)` | 인스턴스 등록 해제 |
| `getServicesAsync(filter?)` | 등록된 서비스 조회 |

### 9. Coupon (`sdk.coupon`)

**캐시 없음** — 실시간 API 호출.

| 메서드 | 설명 |
|--------|------|
| `redeemAsync(request, env)` | 쿠폰 코드 사용 |
