# gatrix-js-client-sdk

Gatrix 플랫폼용 클라이언트 사이드 JavaScript SDK입니다.

## 설치

```bash
npm install @gatrix/gatrix-js-client-sdk
# 또는
yarn add @gatrix/gatrix-js-client-sdk
```

## 빠른 시작

```typescript
import { GatrixClient } from '@gatrix/gatrix-js-client-sdk';

const client = new GatrixClient({
  apiUrl: 'https://your-api.com/api/v1', // 기본 URL (필수)
  apiToken: 'your-api-token',            // 클라이언트 API 토큰 (필수)
  appName: 'my-app',                     // 애플리케이션 이름 (필수)
  features: {
    context: {
      userId: 'user-123',
    },
    refreshInterval: 30, // 초 (기본값: 30)
  },
});

// 클라이언트 시작
await client.start();

// 기능 활성화 확인
const isEnabled = client.features.isEnabled('my-feature');

// 명시적 기본값으로 배리언트 가져오기
const stringValue = client.features.stringVariation('my-string-flag', 'default-value');
const numberValue = client.features.numberVariation('my-number-flag', 0);
const jsonValue = client.features.jsonVariation('my-json-flag', { fallback: true });

// 정리
client.stop();
```

## 설정

### 필수 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `apiUrl` | `string` | Edge 또는 Backend 서버의 기본 API URL. SDK가 엔드포인트를 자동 구성합니다. |
| `apiToken` | `string` | 인증용 클라이언트 API 토큰 |
| `appName` | `string` | 식별을 위한 애플리케이션 이름 |

### 선택 필드

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `enableDevMode` | `boolean` | `false` | 상세 디버그 로깅 활성화 |
| `logger` | `Logger` | Console | 커스텀 로거 구현 |
| `features.context` | `object` | `{}` | 초기 평가 컨텍스트 |
| `features.refreshInterval` | `number` | `30` | 폴링 간격 (초) |
| `features.disableRefresh` | `boolean` | `false` | 자동 폴링 비활성화 |
| `features.explicitSyncMode` | `boolean` | `true` | 명시적 동기화 모드 활성화 |
| `features.bootstrap` | `EvaluatedFlag[]` | - | 오프라인/SSR용 초기 플래그 데이터 |
| `features.bootstrapOverride` | `boolean` | `true` | 저장된 플래그를 부트스트랩으로 덮어쓰기 |
| `features.offlineMode` | `boolean` | `false` | 캐시/부트스트랩 데이터만 사용 |
| `features.storageProvider` | `StorageProvider` | Auto | 커스텀 스토리지 프로바이더 |
| `features.cacheKeyPrefix` | `string` | `gatrix_cache` | 캐시 키 접두사 |
| `features.disableMetrics` | `boolean` | `false` | 메트릭 수집 비활성화 |
| `features.impressionDataAll` | `boolean` | `false` | 모든 플래그에 대해 임프레션 추적 |
| `features.usePOSTRequests` | `boolean` | `false` | GET 대신 POST 요청 사용 |
| `features.streaming` | `StreamingConfig` | - | 스트리밍 설정 |

### 스트리밍 설정

SSE 또는 WebSocket을 통한 실시간 플래그 무효화. 스트리밍은 **기본적으로 활성화**됩니다.

#### StreamingConfig

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 스트리밍 활성화/비활성화 |
| `transport` | `'sse' \| 'websocket'` | `'sse'` | 전송 타입 |
| `sse` | `SseStreamingConfig` | - | SSE 전용 설정 |
| `websocket` | `WebSocketStreamingConfig` | - | WebSocket 전용 설정 |

#### SseStreamingConfig

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `url` | `string` | - | SSE 엔드포인트 URL 오버라이드 (기본: apiUrl에서 파생) |
| `reconnectBase` | `number` | `1` | 재연결 초기 지연 (초) |
| `reconnectMax` | `number` | `30` | 재연결 최대 지연 (초) |
| `pollingJitter` | `number` | `5` | 폴링 지터 범위 (초, 동시 재연결 방지) |

#### WebSocketStreamingConfig

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `url` | `string` | - | WebSocket 엔드포인트 URL 오버라이드 (기본: apiUrl에서 파생) |
| `reconnectBase` | `number` | `1` | 재연결 초기 지연 (초) |
| `reconnectMax` | `number` | `30` | 재연결 최대 지연 (초) |
| `pingInterval` | `number` | `30` | Ping 인터벌 (초) |

## 로깅 & 디버그 모드

### 개발 모드 활성화

`enableDevMode: true`로 SDK 내부의 상세 디버그 로깅을 활성화합니다:

```typescript
const client = new GatrixClient({
  // ...
  enableDevMode: true,
});
```

### 커스텀 로거

```typescript
const client = new GatrixClient({
  // ...
  logger: {
    debug: (msg, ...args) => myLogger.debug(msg, ...args),
    info: (msg, ...args) => myLogger.info(msg, ...args),
    warn: (msg, ...args) => myLogger.warn(msg, ...args),
    error: (msg, ...args) => myLogger.error(msg, ...args),
  },
});
```

## 플래그 평가 이해하기

### 서버 응답 구조

```typescript
interface EvaluatedFlag {
  id: string;        // 플래그 ID
  name: string;      // 플래그 이름
  enabled: boolean;  // 플래그 활성화 여부
  variant: {
    name: string;    // 배리언트 이름
    enabled: boolean; // 배리언트 활성화 여부
    value?: string | number | boolean | object; // 배리언트 값 (valueType이 'none'일 때 undefined)
  };
  valueType: 'none' | 'string' | 'number' | 'boolean' | 'json'; // 값 타입
  version: number;   // 플래그 버전
  reason?: string;   // 평가 이유
  impressionData?: boolean; // 임프레션 추적 여부
}
```

### 예약된 배리언트 이름

SDK는 `$`로 시작하는 예약된 배리언트 이름을 사용하여 특수한 평가 상태를 나타냅니다. 반환된 값의 출처를 판단하는 데 매우 중요합니다.

| 배리언트 이름 | 설명 |
|--------------|------|
| `$missing` | SDK 캐시에서 플래그를 찾을 수 없음 |
| `$type-mismatch` | 요청한 값 타입이 플래그의 실제 `valueType`과 불일치 |
| `$env-default-enabled` | 환경 수준 `enabledValue` 기본값에서 가져온 값 |
| `$flag-default-enabled` | 플래그 수준 (글로벌) `enabledValue` 기본값에서 가져온 값 |
| `$env-default-disabled` | 환경 수준 `disabledValue` 기본값에서 가져온 값 |
| `$flag-default-disabled` | 플래그 수준 (글로벌) `disabledValue` 기본값에서 가져온 값 |

이 이름들은 `variant.name` (또는 `VariationResult`의 `variantName`)에 나타나며, 반환된 값의 정확한 출처를 판단하는 데 사용됩니다.

### 기본값이 필수인 이유

모든 variation 메서드는 명시적 기본값을 요구합니다:

```typescript
// ✓ 올바름: 명시적 기본값
const value = client.features.stringVariation('my-flag', 'fallback');

// ✗ 지원 안 됨: 기본값 없음
const value = client.features.stringVariation('my-flag');
```

**이유:**
1. **모호함 방지:** 플래그가 없거나 값이 없을 때 `undefined`나 `null`이 아닌 지정한 기본값 반환.
2. **타입 안전:** 기본값이 예상 반환 타입을 설정.
3. **안전한 동작:** 네트워크 실패나 SDK 초기화 중에도 항상 사용 가능한 값 수신.
4. **명시적 의도:** 개발자가 폴백 시나리오를 고려하도록 강제하여 버그 감소.

### 평가 시나리오

| 시나리오 | `enabled` | `variant` | 반환 값 |
|----------|-----------|-----------|---------| 
| 플래그 존재 & 활성 | `true` | 서버 배리언트 | 배리언트 값 |
| 플래그 존재하나 비활성 | `false` | 비활성 배리언트 | **기본값** |
| 플래그 없음 | N/A | N/A | **기본값** |
| 네트워크 에러 | 마지막 캐시 | 마지막 캐시 | 캐시 또는 **기본값** |
| 값 타입 불일치 | `true` | 서버 배리언트 | **기본값** |

### Variation 메서드

#### 단순 Variations

```typescript
const isEnabled = client.features.boolVariation('my-flag', false);
const text = client.features.stringVariation('my-flag', 'default');
const count = client.features.numberVariation('my-flag', 0);
const config = client.features.jsonVariation('my-flag', { theme: 'light' });
```

#### Variation Details

평가 메타데이터와 함께 값 가져오기:

```typescript
const result = client.features.stringVariationDetails('my-flag', 'default');
// {
//   value: 'hello',           // 실제 값
//   reason: 'evaluated',      // 이 값이 반환된 이유
//   flagExists: true,         // 플래그 존재 여부
//   enabled: true             // 플래그 활성화 여부
// }
```

#### 엄격 Variations (OrThrow)

평가 실패 시 `GatrixFeatureError` 발생:

```typescript
import { GatrixFeatureError } from '@gatrix/gatrix-js-client-sdk';

try {
  const value = client.features.stringVariationOrThrow('my-flag');
} catch (error) {
  if (error instanceof GatrixFeatureError) {
    console.error(error.code, error.flagName, error.message);
  }
}
```

## 플래그 변경 감시

### 단일 플래그

두 가지 감시 모드가 있습니다:

| 메서드 | 콜백 타이밍 |
|--------|------------|
| `watchSyncedFlag` | `explicitSyncMode`에서: `syncFlags()` 호출 후에만. 일반 모드: 즉시 |
| `watchRealtimeFlag` | 서버 페치가 새 데이터를 가져올 때 항상 즉시 |

```typescript
// Synced watch - explicitSyncMode 존중 (게임 로직 / UI에 권장)
const unwatch = client.features.watchSyncedFlag('my-feature', (flag) => {
  console.log('플래그 변경:', flag.enabled);
});

// Synced watch - 초기 상태 포함 즉시 콜백
const unwatch = client.features.watchSyncedFlagWithInitialState('my-feature', (flag) => {
  console.log('현재 상태:', flag.enabled);
});

// Realtime watch - explicitSyncMode 무관하게 즉시 반응
const unwatch = client.features.watchRealtimeFlag('my-feature', (flag) => {
  console.log('실시간 변경:', flag.enabled);
});

// 감시 중지
unwatch();
```

### Watch 그룹

여러 워처를 함께 관리 (컴포넌트에 유용):

```typescript
const group = client.features.createWatchFlagGroup('my-component');

group
  .watchRealtimeFlag('feature-a', (flag) => console.log('A:', flag.enabled))
  .watchSyncedFlag('feature-b', (flag) => console.log('B:', flag.enabled))
  .watchSyncedFlagWithInitialState('feature-c', (flag) => console.log('C:', flag.enabled));

console.log(group.size); // 3

// 한번에 모두 해제 (예: 컴포넌트 언마운트 시)
group.destroy();
```

## 이벤트

```typescript
import { GatrixClient, EVENTS } from '@gatrix/gatrix-js-client-sdk';

client.on(EVENTS.READY, () => console.log('SDK 준비 완료'));
client.on(EVENTS.FETCH_START, () => console.log('플래그 페칭 시작'));
client.on(EVENTS.FETCH_SUCCESS, () => console.log('플래그 페치 성공'));
client.on(EVENTS.FETCH_ERROR, (error) => console.error('페치 에러:', error));
client.on(EVENTS.FETCH_END, () => console.log('페치 완료'));
client.on(EVENTS.CHANGE, ({ flags }) => console.log('플래그 변경:', flags));
client.on(EVENTS.ERROR, (error) => console.error('에러:', error));
client.on(EVENTS.RECOVERED, () => console.log('SDK 에러에서 복구됨'));

// 특정 플래그 변경 감시
client.on('flags.my-feature.change', (flag) => {
  console.log('my-feature 변경:', flag);
});
```

## 오프라인 모드

```typescript
const client = new GatrixClient({
  // ...
  features: {
    offlineMode: true,
    bootstrap: [
      { name: 'feature-a', enabled: true, variant: { name: 'on', enabled: true }, version: 1 },
    ],
  },
});

await client.start(); // 부트스트랩 데이터 사용, 네트워크 요청 없음
```

## 명시적 동기화 모드

```typescript
const client = new GatrixClient({
  // ...
  features: {
    explicitSyncMode: true,
    disableRefresh: true,
  },
});

// 명시적으로 동기화할 때까지 플래그 업데이트 안 됨
await client.features.syncFlags();
```

## API 레퍼런스

### GatrixClient

| 메서드 | 설명 |
|--------|------|
| `start()` | SDK 초기화 및 시작 |
| `stop()` | 폴링 중지 및 정리 |
| `isReady()` | SDK 준비 여부 확인 |
| `getError()` | 마지막 에러 가져오기 |
| `getStats()` | SDK 통계 가져오기 |
| `getLightStats()` | 경량 통계 가져오기 |
| `on(event, cb, name?)` | 이벤트 구독 |
| `once(event, cb, name?)` | 일회성 이벤트 구독 |
| `off(event, cb?)` | 이벤트 구독 해제 |
| `onAny(cb, name?)` | 모든 이벤트 구독 |
| `offAny(cb?)` | 모든 이벤트 구독 해제 |
| `track(eventName, props?)` | 커스텀 이벤트 추적 (예약) |
| `features` | FeaturesClient 접근 |

### FeaturesClient (`client.features`)

모든 플래그 접근 메서드는 선택적 `forceRealtime` 파라미터를 받습니다 (기본값: `true`). `true`이면 최신 서버 상태를 읽고, `false`이면 `explicitSyncMode`를 존중합니다.

| 메서드 | 설명 |
|--------|------|
| `isEnabled(flagName, forceRealtime?)` | 플래그 활성화 확인 |
| `hasFlag(flagName, forceRealtime?)` | 플래그 존재 여부 확인 |
| `getFlag(flagName, forceRealtime?)` | 원시 EvaluatedFlag 또는 undefined |
| `getVariant(flagName, forceRealtime?)` | 원시 배리언트 |
| `getAllFlags(forceRealtime?)` | 모든 플래그 |
| `variation(flagName, fallback, forceRealtime?)` | 배리언트 이름 (string) |
| `boolVariation(flagName, fallback, forceRealtime?)` | Boolean 값 |
| `stringVariation(flagName, fallback, forceRealtime?)` | String 값 |
| `numberVariation(flagName, fallback, forceRealtime?)` | Number 값 |
| `jsonVariation(flagName, fallback, forceRealtime?)` | JSON 값 |
| `boolVariationDetails(flagName, fallback, forceRealtime?)` | Boolean + 상세 정보 |
| `stringVariationDetails(flagName, fallback, forceRealtime?)` | String + 상세 정보 |
| `numberVariationDetails(flagName, fallback, forceRealtime?)` | Number + 상세 정보 |
| `jsonVariationDetails(flagName, fallback, forceRealtime?)` | JSON + 상세 정보 |
| `boolVariationOrThrow(flagName, forceRealtime?)` | Boolean 또는 예외 |
| `stringVariationOrThrow(flagName, forceRealtime?)` | String 또는 예외 |
| `numberVariationOrThrow(flagName, forceRealtime?)` | Number 또는 예외 |
| `jsonVariationOrThrow(flagName, forceRealtime?)` | JSON 또는 예외 |
| `watchSyncedFlag(flagName, callback)` | 변경 감시 (explicitSyncMode 존중) |
| `watchSyncedFlagWithInitialState(flagName, callback)` | 초기 콜백 포함 감시 (synced) |
| `watchRealtimeFlag(flagName, callback)` | 서버 페치 시 즉시 감시 |
| `watchRealtimeFlagWithInitialState(flagName, callback)` | 초기 콜백 포함 즉시 감시 |
| `createWatchFlagGroup(name)` | Watch 그룹 생성 |
| `fetchFlags()` | 수동 플래그 페치 트리거 |
| `syncFlags(fetchNow?)` | 수동 동기화 (명시적 모드) |
| `isFetching()` | 현재 페칭 중인지 확인 |
| `isExplicitSyncEnabled()` | 명시적 동기화 모드 확인 |
| `setExplicitSyncMode(enabled)` | 런타임에 명시적 동기화 모드 변경 |
| `hasPendingSyncFlags()` | 보류 중인 변경 존재 여부 |
| `isOfflineMode()` | 오프라인 모드 확인 |
| `updateContext(context)` | 평가 컨텍스트 업데이트 |
| `getContext()` | 현재 컨텍스트 가져오기 |
| `getConfig()` | 현재 features 설정 가져오기 |
| `getConnectionId()` | 클라이언트 연결 ID 가져오기 |

### WatchFlagGroup

| 메서드 | 설명 |
|--------|------|
| `watchRealtimeFlag(flagName, callback)` | 실시간 워처 추가 (체이닝 가능) |
| `watchRealtimeFlagWithInitialState(flagName, callback)` | 초기 상태 포함 실시간 워처 추가 |
| `watchSyncedFlag(flagName, callback)` | 동기화 워처 추가 (체이닝 가능) |
| `watchSyncedFlagWithInitialState(flagName, callback)` | 초기 상태 포함 동기화 워처 추가 |
| `unwatchAll()` | 모든 워처 제거 |
| `destroy()` | unwatchAll의 별칭 |
| `size` | 활성 워처 수 |
| `getName()` | 그룹 이름 가져오기 |

## 라이선스

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](../../../../LICENSE) 파일을 참조하세요.

## ⚠️ 필수 실천 사항

### 모든 플래그 상태를 테스트하세요

모든 피처 플래그는 **최소 두 가지 코드 경로**(ON/OFF)를 만듭니다. 두 경로 모두 반드시 테스트해야 합니다. 테스트되지 않은 경로는 언젠가 프로덕션에서 터지는 시한폭탄입니다.

| 테스트 항목 | 이유 |
|---|---|
| 플래그 **ON** | 새로운 동작이 정상적으로 작동하는지 확인 |
| 플래그 **OFF** | 기존 동작이 여전히 정상인지 확인 — 이 부분이 자주 누락됨 |
| **세션 중 토글** | 실시간 모드 사용 시, 크래시나 비일관적 상태가 발생하지 않는지 확인 |
| **기본값** 경로 | 서버에 플래그가 없을 때(네트워크 오류, 새 환경 등) 동작 확인 |

### 의존성 문제에 주의하세요

플래그를 토글하면 사용하는 객체, 모듈, 리소스가 달라집니다. 해당 의존성이 준비되지 않으면 크래시나 예측할 수 없는 동작이 발생합니다.

**일반적인 함정:** 플래그 A가 플래그 B에 의해 초기화되는 객체에 의존하는 기능을 활성화하는 경우. A가 ON이지만 B가 OFF이면, 객체가 존재하지 않아 크래시가 발생합니다.

**방지 방법:**

- 플래그 상태와 무관하게 필요할 수 있는 모든 리소스를 미리 초기화하거나,
- null 체크와 함께 지연 초기화를 사용하거나,
- `ExplicitSyncMode`를 사용하여 모든 의존성을 함께 해결할 수 있는 안전한 시점에서만 플래그 변경을 적용하세요

### 모든 플래그를 문서화하세요

플래그를 생성할 때 다음 내용을 팀에 명확하게 공유해야 합니다:

| 항목 | 설명 |
|---|---|
| **사용 목적** | 이 플래그는 무엇을 제어하는가? 왜 존재하는가? |
| **영향 범위** | 어떤 화면, 시스템, API가 영향을 받는가? |
| **부작용** | 토글 시 어떤 변화가 있는가? 성능, 데이터, UX에 영향이 있는가? |
| **의존성** | 다른 플래그나 시스템 상태에 의존하는가? |
| **담당자** | 이 플래그의 책임자는 누구인가? |
| **만료일** | 이 플래그는 언제 제거해야 하는가? |

문서화되지 않은 플래그는 혼란의 원인이 되고, 결국 장애로 이어집니다.

