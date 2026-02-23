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
  environment: 'production',             // 환경 이름 (필수)
  context: {
    userId: 'user-123',
  },
  features: {
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
| `environment` | `string` | 환경 이름 (예: `development`, `staging`, `production`) |

> **참고:** SDK가 피처 플래그 엔드포인트를 자동 구성합니다:
> `{apiUrl}/client/features/{environment}/eval`

### 선택 필드

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `context` | `object` | `{}` | 초기 평가 컨텍스트 |
| `enableDevMode` | `boolean` | `false` | 상세 디버그 로깅 활성화 |
| `logger` | `Logger` | Console | 커스텀 로거 구현 |
| `features.refreshInterval` | `number` | `30` | 폴링 간격 (초) |
| `features.disableRefresh` | `boolean` | `false` | 자동 폴링 비활성화 |
| `features.bootstrap` | `EvaluatedFlag[]` | - | 오프라인/SSR용 초기 플래그 데이터 |
| `features.offlineMode` | `boolean` | `false` | 캐시/부트스트랩 데이터만 사용 |

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
  name: string;        // 플래그 이름
  enabled: boolean;    // 플래그 활성화 여부
  variant: {
    name: string;      // 배리언트 이름
    enabled: boolean;  // 배리언트 활성화 여부
    value?: any;       // 배리언트 값 (선택)
  };
  variantType?: string;  // 예상 타입: 'string' | 'number' | 'json' | 'none'
  reason?: string;       // 평가 이유
  version: number;       // 플래그 버전
}
```

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

```typescript
// 변경 시에만 콜백
const unwatch = client.features.watchFlag('my-feature', (flag) => {
  console.log('플래그 변경:', flag.enabled);
});

// 초기 상태 포함 즉시 콜백
const unwatch = client.features.watchFlagWithInitialState('my-feature', (flag) => {
  console.log('현재 상태:', flag.enabled);
});

// 감시 중지
unwatch();
```

### Watch 그룹

여러 워처를 함께 관리 (컴포넌트에 유용):

```typescript
const group = client.features.createWatchFlagGroup('my-component');

group
  .watchFlag('feature-a', (flag) => console.log('A:', flag.enabled))
  .watchFlag('feature-b', (flag) => console.log('B:', flag.enabled))
  .watchFlagWithInitialState('feature-c', (flag) => console.log('C:', flag.enabled));

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
| `on(event, callback)` | 이벤트 구독 |
| `off(event, callback)` | 이벤트 구독 해제 |
| `features` | FeaturesClient 접근 |

### FeaturesClient (`client.features`)

| 메서드 | 설명 |
|--------|------|
| `isEnabled(flagName)` | 플래그 활성화 확인 |
| `boolVariation(flagName, default)` | Boolean 값 (flag.enabled) |
| `stringVariation(flagName, default)` | String 값 |
| `numberVariation(flagName, default)` | Number 값 |
| `jsonVariation(flagName, default)` | JSON 값 |
| `stringVariationDetails(flagName, default)` | String + 상세 정보 |
| `numberVariationDetails(flagName, default)` | Number + 상세 정보 |
| `jsonVariationDetails(flagName, default)` | JSON + 상세 정보 |
| `stringVariationOrThrow(flagName)` | String 또는 예외 |
| `numberVariationOrThrow(flagName)` | Number 또는 예외 |
| `jsonVariationOrThrow(flagName)` | JSON 또는 예외 |
| `getVariant(flagName)` | 원시 배리언트 |
| `getAllFlags()` | 모든 플래그 |
| `watchFlag(flagName, callback)` | 변경 감시 |
| `watchFlagWithInitialState(flagName, callback)` | 초기 콜백 포함 감시 |
| `createWatchFlagGroup(name)` | Watch 그룹 생성 |
| `isFetching()` | 현재 페칭 중인지 확인 |
| `isExplicitSync()` | 명시적 동기화 모드 확인 |
| `hasPendingSyncFlags()` | 보류 중인 변경 존재 여부 |
| `syncFlags(fetchNow?)` | 수동 동기화 (명시적 모드) |
| `updateContext(context)` | 평가 컨텍스트 업데이트 |
| `getContext()` | 현재 컨텍스트 가져오기 |

### WatchFlagGroup

| 메서드 | 설명 |
|--------|------|
| `watchFlag(flagName, callback)` | 워처 추가 (체이닝 가능) |
| `watchFlagWithInitialState(flagName, callback)` | 초기 상태 포함 워처 추가 (체이닝 가능) |
| `unwatchAll()` | 모든 워처 제거 |
| `destroy()` | unwatchAll의 별칭 |
| `size` | 활성 워처 수 |
| `getName()` | 그룹 이름 가져오기 |

## 라이선스

MIT
