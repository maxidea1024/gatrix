# Gatrix CocosCreator Client SDK (한국어)

**CocosCreator 2.x / 3.x** 전용 [Gatrix](https://gatrix.io) 피처 플래그 클라이언트 SDK입니다.

> **런타임 의존성 0개** — 소스 파일을 CocosCreator 프로젝트에 추가하기만 하면 됩니다.

## 특징

- 🎮 **CocosCreator 네이티브** — Web, Android, iOS 모두 지원 (JSB 런타임 호환)
- 🔄 **실시간 업데이트** — WebSocket 스트리밍 + 자동 폴링 fallback
- 💾 **영속 캐시** — `cc.sys.localStorage`를 통한 즉시 시작
- 📊 **사용량 메트릭스** — 플래그 접근 자동 추적 및 보고
- 🔍 **명시적 동기화 모드** — 플래그 변경이 게임 로직에 적용되는 시점을 제어
- 🛡️ **타입 안전** — 완전한 TypeScript 지원

## 설치

### 방법 1: 소스 파일 복사 (권장)

1. `src/` 디렉토리의 파일을 CocosCreator 프로젝트의 `assets/scripts/gatrix/` 폴더에 복사
2. 끝 — CocosCreator가 자동으로 TypeScript 파일을 컴파일합니다

```
your-cocos-project/
└── assets/
    └── scripts/
        └── gatrix/
            ├── index.ts
            ├── gatrix-client.ts
            ├── features-client.ts
            └── ... (src/ 의 모든 파일)
```

## 빠른 시작

```typescript
import { GatrixClient } from './gatrix/index';

// 1. 클라이언트 생성
const client = new GatrixClient({
  apiUrl: 'https://your-gatrix-server.com/api/v1',
  apiToken: 'your-client-api-token',
  appName: 'my-cocos-game',
});

// 2. SDK 시작
await client.start();

// 3. 피처 플래그 확인
if (client.features.isEnabled('new-boss-fight')) {
  // 새 보스전 표시
}

// 4. 타입별 값 가져오기
const difficulty = client.features.numberVariation('difficulty-level', 1);
const theme = client.features.stringVariation('ui-theme', 'default');
const config = client.features.jsonVariation('game-config', { speed: 1.0 });

// 5. 종료 시 정리
client.stop();
```

## 컨텍스트 (사용자 타겟팅)

플래그 평가를 위한 컨텍스트 속성을 설정합니다:

```typescript
const client = new GatrixClient({
  apiUrl: 'https://your-gatrix-server.com/api/v1',
  apiToken: 'your-token',
  appName: 'my-game',
  features: {
    context: {
      userId: 'player-123',
      properties: {
        platform: 'ios',
        level: '42',
        isPremium: 'true',
      },
    },
  },
});
```

런타임에 컨텍스트 업데이트:

```typescript
// 로그인 후 사용자 ID 업데이트
await client.features.updateContext({
  userId: 'player-456',
  properties: { level: '50' },
});
```

## 플래그 변경 감시 (Watch)

실시간 플래그 변경에 반응합니다:

```typescript
// 단일 플래그 감시
const unwatch = client.features.watchRealtimeFlag('sale-banner', (flag) => {
  if (flag.enabled) {
    showSaleBanner(flag.stringVariation(''));
  } else {
    hideSaleBanner();
  }
});

// 초기 상태와 함께 감시 (현재 값으로 즉시 콜백 호출)
client.features.watchRealtimeFlagWithInitialState('ui-theme', (flag) => {
  applyTheme(flag.stringVariation('default'));
});

// 감시 해제
unwatch();
```

### Watch 그룹

여러 워처를 그룹으로 관리합니다:

```typescript
const group = client.features.createWatchFlagGroup('battle-scene');

group
  .watchRealtimeFlag('boss-health-multiplier', (flag) => {
    setBossHealth(flag.numberVariation(1.0));
  })
  .watchRealtimeFlag('enable-power-ups', (flag) => {
    togglePowerUps(flag.enabled);
  });

// 씬 전환 시 일괄 해제
group.destroy();
```

## 명시적 동기화 모드

기본적으로 **명시적 동기화 모드**가 활성화되어 있습니다. 서버에서 받은 플래그 변경사항은 `syncFlags()`를 호출할 때만 게임 로직에 적용됩니다. 이를 통해 프레임 중간에 플래그가 변경되는 것을 방지합니다.

```typescript
// 대기 중인 변경사항 확인
if (client.features.hasPendingSyncFlags()) {
  // 안전한 시점에 변경사항 적용 (예: 씬 전환 사이)
  await client.features.syncFlags();
}
```

즉시 업데이트를 원하면 동기화 모드를 비활성화합니다:

```typescript
client.features.setExplicitSyncMode(false);
```

## Variation 메서드

| 메서드 | 반환 타입 | 설명 |
|---|---|---|
| `isEnabled(name)` | `boolean` | 플래그 활성화 여부 |
| `boolVariation(name, fallback)` | `boolean` | Boolean 값 또는 기본값 |
| `stringVariation(name, fallback)` | `string` | String 값 또는 기본값 |
| `numberVariation(name, fallback)` | `number` | Number 값 또는 기본값 |
| `jsonVariation(name, fallback)` | `T` | JSON 객체 또는 기본값 |
| `boolVariationOrThrow(name)` | `boolean` | 없거나 타입 불일치 시 에러 발생 |

## 이벤트

```typescript
import { GatrixClient } from './gatrix/index';

// SDK 준비 완료
client.on(GatrixClient.EVENTS.FLAGS_READY, () => {
  console.log('플래그 준비 완료!');
});

// 플래그 변경
client.on(GatrixClient.EVENTS.FLAGS_CHANGE, ({ flags }) => {
  console.log(`${flags.length}개 플래그 업데이트`);
});

// 스트리밍 연결
client.on(GatrixClient.EVENTS.FLAGS_STREAMING_CONNECTED, () => {
  console.log('WebSocket 스트리밍 연결됨');
});

// 에러
client.on(GatrixClient.EVENTS.SDK_ERROR, (error) => {
  console.error('SDK 에러:', error);
});
```

## 설정

```typescript
const client = new GatrixClient({
  // 필수
  apiUrl: 'https://your-server.com/api/v1',
  apiToken: 'your-client-token',
  appName: 'my-game',

  // 선택
  enableDevMode: false,           // 상세 디버그 로깅
  customHeaders: {},              // 추가 HTTP 헤더

  features: {
    // 폴링
    refreshInterval: 30,          // 폴링 주기 (초, 기본: 30)
    disableRefresh: false,        // 폴링 비활성화

    // 스트리밍 (WebSocket)
    streaming: {
      enabled: true,              // WebSocket 스트리밍 활성화 (기본: true)
      websocket: {
        reconnectBase: 1,         // 초기 재연결 지연 (초)
        reconnectMax: 30,         // 최대 재연결 지연 (초)
        pingInterval: 30,         // Ping 주기 (초)
      },
    },

    // 스토리지
    cacheKeyPrefix: 'gatrix_cache', // 스토리지 키 프리픽스

    // 동기화
    explicitSyncMode: true,       // 수동 syncFlags() 필요 (기본: true)

    // 메트릭스
    disableMetrics: false,        // 사용량 추적 비활성화
    metricsInterval: 60,          // 메트릭스 전송 주기 (초)

    // 오프라인
    offlineMode: false,           // 네트워크 요청 없음 (캐시/부트스트랩 사용)
    bootstrap: [],                // 즉시 사용을 위한 초기 플래그 데이터
  },
});
```

## CocosCreator 버전 호환성

| CocosCreator 버전 | 지원 |
|---|---|
| 3.x (최신) | ✅ 완전 지원 |
| 2.x | ✅ 완전 지원 |

SDK가 자동으로 CocosCreator 버전을 감지하고 적절한 API를 사용합니다.

## JS SDK와의 차이점

이 SDK는 `@gatrix/gatrix-js-client-sdk`와 **동일한 공개 API**를 제공합니다. 차이는 내부 구현뿐:

| 기능 | JS SDK | CocosCreator SDK |
|---|---|---|
| HTTP 클라이언트 | `ky` (Fetch API) | `XMLHttpRequest` |
| 스트리밍 | SSE + WebSocket | WebSocket 전용 |
| 스토리지 | `localStorage` | `cc.sys.localStorage` |
| URL 파싱 | `new URL()` | 자체 `UrlBuilder` |
| 해시 함수 | `crypto.subtle` (비동기) | `djb2` (동기) |
| 의존성 | 2개 | **0개** |

## 라이선스

MIT
