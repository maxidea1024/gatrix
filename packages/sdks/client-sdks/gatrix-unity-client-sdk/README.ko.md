# Gatrix Unity SDK

> **피처 플래그, A/B 테스트, 원격 구성을 위한 Unity 공식 Gatrix SDK입니다.**

새 빌드를 배포하지 않고도 게임의 동작을 실시간으로 바꿀 수 있습니다. 기능 전환, A/B 실험, 게임 파라미터 튜닝, 점진적 롤아웃 — 모두 Gatrix 대시보드에서 실행합니다.

## 🚩 피처 플래그란?

피처 플래그는 두 가지 요소로 구성됩니다:

| 요소 | 타입 | 설명 |
|---|---|---|
| **상태** (`enabled`) | `bool` | 기능이 켜져 있는가, 꺼져 있는가 — `IsEnabled()`로 확인 |
| **값** (`variant`) | `bool` `string` `number` `json` | 세부 구성 값 — `BoolVariation()`, `StringVariation()`, `FloatVariation()`으로 읽음 |

플래그는 **켜져 있으면서도** 특정 값을 가질 수 있습니다 (예: `difficulty = "hard"`). 상태와 값은 독립적이므로 두 가지 모두 처리해야 합니다.

### 💡 Quick Examples

#### 1. 피처 전환 (`IsEnabled`)

```csharp
if (GatrixSDK.Features.IsEnabled("new-shop"))
    ShowNewShop();
else
    ShowLegacyShop();
```

#### 2. 원격 구성 (`Variation`)

```csharp
float speed   = GatrixSDK.Features.FloatVariation("game-speed", 1.0f);
string theme  = GatrixSDK.Features.StringVariation("app-theme", "dark");
int maxLevel  = GatrixSDK.Features.IntVariation("max-level", 50);
```

#### 3. 조건부 타겟팅

```csharp
// 서버가 컨텍스트(레벨, 지역, 티어...)를 평가하고 올바른 값을 반환합니다.
// 클라이언트는 값을 읽기만 하면 됩니다 — 분기 로직은 서버에 있습니다!
string difficulty = GatrixSDK.Features.StringVariation("difficulty", "Normal");
```

---

## 🤔 Gatrix를 사용해야 하는 이유

| Gatrix 없이 | Gatrix와 함께 |
|---|---|
| 값을 바꾸면 새 빌드 배포 | 대시보드에서 실시간 변경 |
| 모든 플레이어가 같은 경험 | A/B 테스트로 다양한 경험 제공 |
| 하드코딩된 피처 플래그 | 실시간 원격 구성 |
| 위험한 빅뱅 릴리즈 | 즉시 롤백 가능한 점진적 배포 |

### 🔑 실제 사용 시나리오

- **📱 모바일 앱 심사 대응** — 기능을 비활성화한 채로 제출하고, 심사 통과 후 즉시 활성화. 재심사 불필요.
- **⚖️ 규제 및 법규 준수** — 법규가 바뀔 때 특정 지역에서 기능을 즉시 비활성화 (GDPR 등).
- **🚨 긴급 킬 스위치** — 크래시를 유발하는 기능을 수초 이내에 비활성화.
- **🔬 A/B 테스트** — 그룹별로 다른 배리언트를 제공하고 영향을 측정.
- **📅 출시 시점 미정** — 코드는 항상 준비되어 있고, 비즈니스에서 런칭 시점을 결정.

---

## 📐 평가 모델: 원격 평가 방식

1. SDK가 **컨텍스트**(userId, environment, properties)를 Gatrix 서버로 전송.
2. 서버가 모든 타겟팅 규칙을 원격에서 평가.
3. SDK는 **최종 평가된 플래그 값만** 수신 — 규칙은 클라이언트에 노출되지 않습니다.

| | 원격 평가 (Gatrix) | 로컬 평가 |
|---|---|---|
| **보안** | ✅ 규칙이 서버 밖으로 나가지 않음 | ⚠️ 규칙이 클라이언트에 노출 |
| **일관성** | ✅ 모든 SDK에서 동일한 결과 | ⚠️ 각 SDK가 로직을 재구현해야 함 |
| **페이로드** | ✅ 최종 값만 (소용량) | ⚠️ 전체 규칙 세트 (대용량) |
| **오프라인** | ⚠️ 캐시된 값 또는 부트스트랩 | ✅ 다운로드 후 완전 오프라인 |

> 🛡️ SDK는 마지막으로 알려진 값을 로컬에 캐시합니다. `fallbackValue`를 설정하면 네트워크 문제로 게임이 중단되지 않습니다.

---

## 📦 설치

### Unity Package Manager (UPM)

1. **Window > Package Manager** 열기
2. **+** → **Add package from git URL...** 클릭
3. 입력: `https://github.com/your-org/gatrix-unity-sdk.git`

또는 `Packages/manifest.json`에 직접 추가:
```json
{
  "dependencies": {
    "com.gatrix.unity-sdk": "https://github.com/your-org/gatrix-unity-sdk.git"
  }
}
```

---

## 🚀 빠른 시작

### Option A: Zero-Code 설정 (권장)

1. 첫 번째 씬의 GameObject에 **GatrixBehaviour** 컴포넌트 추가.
2. Inspector에서 API URL, API Token, App Name 설정.
3. **Gatrix > Setup Wizard**로 안내에 따라 설정.

### Option B: 코드로 설정

```csharp
using Gatrix.Unity.SDK;

public class GameManager : MonoBehaviour
{
    async void Start()
    {
        var config = new GatrixClientConfig
        {
            ApiUrl      = "https://your-api.example.com/api/v1",
            ApiToken    = "your-client-api-token",
            AppName     = "MyGame",
            Features    = new FeaturesConfig
            {
                Context = new GatrixContext { UserId = "player-123" },
            },
        };

        await GatrixBehaviour.InitializeAsync(config);

        float speed = GatrixSDK.Features.FloatVariation("game-speed", 1.0f);
    }
}
```

---

## 🏁 피처 플래그 읽기

```csharp
var features = GatrixSDK.Features;

// 활성화 상태 확인
bool newUI = features.IsEnabled("new-ui");

// 타입별 안전한 값 (예외 없음 — 에러 시 항상 폴백 반환)
bool   showBanner = features.BoolVariation("show-banner", false);
string theme      = features.StringVariation("app-theme", "dark");
int    maxRetries = features.IntVariation("max-retries", 3);
float  gameSpeed  = features.FloatVariation("game-speed", 1.0f);
double dropRate   = features.DoubleVariation("item-drop-rate", 0.05);

// 전체 평가된 플래그
EvaluatedFlag flag = features.GetFlag("feature-x");
Debug.Log($"Enabled: {flag.Enabled}, Variant: {flag.Variant?.Name}");
```

---

## 🔁 변경 감지 (Watch)

두 가지 Watch 방식:

| 메서드 | 콜백 타이밍 |
|---|---|
| `WatchRealtimeFlag` | 서버 페치 후 즉시 |
| `WatchSyncedFlag` | `SyncFlagsAsync()` 이후 (`ExplicitSyncMode = true`일 때) |

```csharp
var features = GatrixSDK.Features;

// 리얼타임 Watch — 변경 즉시 실행 (구독 해제용 Action 반환)
Action unwatch = features.WatchRealtimeFlag("dark-mode", flag =>
{
    ApplyDarkMode(flag.Enabled);
});

// 초기 상태 포함 (현재 값으로 즉시 + 변경 시 재실행)
features.WatchRealtimeFlagWithInitialState("game-speed", flag =>
{
    SetGameSpeed(flag.FloatValue(1.0f));
});

// 동기화 Watch — SyncFlagsAsync() 이후에만 실행
features.WatchSyncedFlagWithInitialState("difficulty", flag =>
{
    SetDifficulty(flag.StringValue("normal"));
});

// Watch 해제 (반환된 Action 호출)
unwatch();
```

---

## 🧩 Zero-Code 컴포넌트

스크립트 없이 GameObject에 부착해서 사용:

| 컴포넌트 | 설명 |
|---|---|
| `GatrixFlagToggle` | 플래그 활성 상태에 따라 GameObject 활성화/비활성화 |
| `GatrixFlagText` | 플래그 값으로 TextMeshPro/UI.Text 설정 |
| `GatrixFlagFloat` | 플래그 값으로 Animator float 파라미터 제어 |
| `GatrixFlagImage` | 플래그 배리언트 이름에 따라 Sprite 교체 |

---

## 🛠️ 에디터 도구

### Monitor Window
**Gatrix > Monitor** — 모든 플래그 실시간 뷰, 메트릭 그래프, 이벤트 로그, 스트리밍 상태.

### Setup Wizard
**Gatrix > Setup Wizard** — 최초 설정을 위한 단계별 가이드.

### About Window
**Gatrix > About** — SDK 버전, 링크, 변경 이력.

### Custom Inspectors
`GatrixBehaviour`와 Zero-Code 컴포넌트를 위한 Inspector 오버레이.

### Project Settings
**Edit > Project Settings > Gatrix** — 기본 설정 및 에디터 환경 설정.

---

## 🌍 컨텍스트 관리

### 컨텍스트란?

**컨텍스트**는 현재 사용자와 환경을 설명하는 속성들의 집합입니다. Gatrix 서버는 컨텍스트를 이용하여 각 플래그에 어떤 배리언트를 반환할지 결정합니다.

### 컨텍스트 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `AppName` | `string` | 앱 이름 (초기화 시 설정, 변경 불가) |
| `UserId` | `string` | 고유 사용자 식별자 — 타겟팅에 가장 중요 |
| `SessionId` | `string` | 세션 범위 실험을 위한 세션 식별자 |
| `Properties` | `Dictionary<string,string>` | 커스텀 키-값 쌍 |

### 컨텍스트 업데이트

```csharp
// 전체 컨텍스트 업데이트 (리페치 트리거)
await GatrixSDK.Client.UpdateContextAsync(new GatrixContext
{
    UserId = "player-456",
    Properties = new Dictionary<string, string>
    {
        { "level", "42" },
        { "country", "KR" }
    }
});
```

> ⚠️ 모든 컨텍스트 변경은 자동 리페치를 트리거합니다. 반복 루프 안에서 컨텍스트를 업데이트하지 마세요. 여러 필드를 동시에 변경하려면 `UpdateContextAsync`를 사용하세요.

---

## ⏱️ 명시적 동기화 모드 (Explicit Sync Mode)

타이밍이 중요한 게임을 위해 플래그 변경이 적용되는 시점을 직접 제어합니다.

```csharp
// 설정에서 활성화
config.Features.ExplicitSyncMode = true;

// 동기화 Watch: SyncFlags() 이후에만 콜백 실행
features.WatchSyncedFlagWithInitialState("difficulty", proxy =>
{
    SetDifficulty(proxy.StringValue("normal")); // SyncFlags() 이후에만 실행
});

// 안전한 시점에 적용 (로딩 화면, 라운드 사이)
if (features.HasPendingSyncFlags())
    await features.SyncFlagsAsync();
```

### 권장 동기화 시점

| 동기화 시점 | 예시 |
|---|---|
| **로딩 화면** | 씬 전환, 레벨 로딩 |
| **다운타임** | 매치 종료 후, 다음 라운드 시작 전 |
| **메뉴 / 로비** | 설정 화면, 이벤트 로비 진입 시 |
| **리스폰** | 플레이어 사망 후, 다음 리스폰 전 |

---

## 🔔 이벤트

```csharp
var events = GatrixSDK.Events;

events.On(GatrixEvents.FlagsReady, args =>
    Debug.Log("SDK 준비 완료!"));

events.On(GatrixEvents.FlagsChange, args =>
    Debug.Log("플래그 업데이트됨"));

events.Once(GatrixEvents.FlagsReady, args =>
    ShowWelcomeScreen());

events.OnAny((name, args) =>
    Debug.Log($"[Gatrix] {name}"));
```

**사용 가능한 이벤트:**

| 이벤트 | 설명 |
|---|---|
| `flags.init` | SDK 초기화됨 |
| `flags.ready` | 첫 번째 성공적 페치 완료 |
| `flags.fetch_start` / `fetch_success` / `fetch_error` / `fetch_end` | 페치 상태 |
| `flags.change` | 서버에서 플래그 변경 |
| `flags.error` | SDK 에러 |
| `flags.sync` | 플래그 동기화됨 |
| `flags.recovered` | 에러 상태에서 복구됨 |
| `flags.streaming_connected` / `disconnected` / `error` | 스트리밍 상태 |

---

## 📡 동작 모드

### 모드 비교

| 모드 | 지연 | 대역폭 | 사용 사례 |
|---|---|---|---|
| 스트리밍 + 폴링 | 거의 즉각적 | 낮음 | 프로덕션 (온라인 게임) |
| 폴링만 | ~30초 | 낮음 | 간단한 앱, WebGL |
| 오프라인 | 없음 | 없음 | 테스트, CI, 격리 환경 |

### Mode 1: 스트리밍 + 폴링 (기본)

```csharp
config.Features.Streaming.Enabled = true;
config.Features.Streaming.Transport = GatrixStreamingTransport.WebSocket; // 또는 Sse
config.Features.Streaming.WebSocket.ReconnectBase = 1;
config.Features.Streaming.WebSocket.ReconnectMax  = 30;
```

### Mode 2: 폴링만

```csharp
config.Features.Streaming.Enabled = false;
config.Features.RefreshInterval   = 30f; // 초
```

### Mode 3: 오프라인

```csharp
config.Features.OfflineMode = true;
// 부트스트랩 데이터와 함께 사용하면 완전 오프라인 동작 가능
```

### WebGL 지원

WebGL은 네이티브 WebSocket/SSE를 지원하지 않습니다. SDK는 WebGL에서 자동으로 폴링으로 폴백합니다.

---

## 🔒 성능 & 스레딩

- 플래그 읽기는 동기적이며 Lock-free (atomic 스냅샷)
- 모든 네트워크 I/O는 백그라운드 스레드에서 실행
- Unity 콜백은 `UnitySynchronizationContext`를 통해 메인 스레드로 디스패치
- 이벤트 발행: 락 아래 콜백 수집 후 락 밖에서 실행 (데드락 방지)

---

## 🧹 정리

```csharp
// 자동: GatrixBehaviour가 OnDestroy에서 자동 정리
// 수동:
GatrixSDK.Client.Stop();
```

---

## 📖 API 레퍼런스

### FeaturesClient (`GatrixSDK.Features`)

| 메서드 | 반환 | 설명 |
|---|---|---|
| `StartAsync()` | `UniTask` | 초기화 및 페칭 시작 |
| `Stop()` | `void` | 폴링, 스트리밍, 메트릭 중지 |
| `IsReady()` | `bool` | 첫 번째 성공적 페치 완료 여부 |
| `IsOfflineMode()` | `bool` | 오프라인 모드 활성화 여부 |
| `IsFetching()` | `bool` | 페치 진행 중 여부 |
| `GetError()` | `Exception` | 마지막 에러, 또는 null |
| `GetConnectionId()` | `string` | 서버 할당 연결 ID |
| `IsEnabled(flagName, forceRealtime = true)` | `bool` | 플래그 활성 상태 |
| `GetFlag(flagName, forceRealtime = true)` | `EvaluatedFlag` | 전체 평가 플래그 (메트릭 추적) |
| `GetFlagRaw(flagName, forceRealtime = true)` | `EvaluatedFlag` | 전체 평가 플래그 (메트릭 미추적) |
| `GetVariant(flagName, forceRealtime = true)` | `Variant` | 배리언트 객체 (null 반환 없음) |
| `HasFlag(flagName)` | `bool` | 캐시 존재 여부 확인 |
| `GetAllFlags(forceRealtime = true)` | `List<EvaluatedFlag>` | 모든 평가된 플래그 |
| `Variation(flagName, fallback, forceRealtime = true)` | `string` | 배리언트 이름 |
| `BoolVariation(flagName, fallback, forceRealtime = true)` | `bool` | Boolean 값 |
| `StringVariation(flagName, fallback, forceRealtime = true)` | `string` | String 값 |
| `IntVariation(flagName, fallback, forceRealtime = true)` | `int` | Integer 값 |
| `FloatVariation(flagName, fallback, forceRealtime = true)` | `float` | Float 값 |
| `DoubleVariation(flagName, fallback, forceRealtime = true)` | `double` | Double 값 |
| `JsonVariation(flagName, fallback, forceRealtime = true)` | `Dictionary<string,object>` | JSON 값 |
| `BoolVariationOrThrow(flagName, forceRealtime = true)` | `bool` | 미존재 시 예외 발생 |
| `StringVariationOrThrow(flagName, forceRealtime = true)` | `string` | 미존재 시 예외 발생 |
| `JsonVariationOrThrow(flagName, forceRealtime = true)` | `Dictionary<string,object>` | 미존재 시 예외 발생 |
| `BoolVariationDetails(flagName, fallback, forceRealtime = true)` | `VariationResult<bool>` | 값 + 이유 + 메타데이터 |
| `StringVariationDetails(flagName, fallback, forceRealtime = true)` | `VariationResult<string>` | 값 + 이유 + 메타데이터 |
| `JsonVariationDetails(flagName, fallback, forceRealtime = true)` | `VariationResult<Dictionary<string,object>>` | 값 + 이유 + 메타데이터 |
| `GetContext()` | `GatrixContext` | 현재 컨텍스트의 딥 카피 |
| `UpdateContextAsync(ctx)` | `UniTask` | 컨텍스트 교체 및 리페치 |
| `SyncFlagsAsync(fetchNow = true)` | `UniTask` | 보류 중인 변경 적용 (명시적 동기화 모드) |
| `HasPendingSyncFlags()` | `bool` | 보류 중인 변경 존재 여부 |
| `FetchFlagsAsync()` | `UniTask` | 서버 강제 페치 |
| `IsExplicitSync()` | `bool` | 명시적 동기화 모드 활성화 여부 |
| `SetExplicitSyncMode(enabled)` | `void` | 런타임 시 명시적 동기화 모드 전환 |
| `WatchRealtimeFlag(flagName, callback, name?)` | `Action` | 리얼타임 Watch (반환된 Action 호출로 구독 해제) |
| `WatchRealtimeFlagWithInitialState(flagName, callback, name?)` | `Action` | 리얼타임 Watch + 즉시 콜백 |
| `WatchSyncedFlag(flagName, callback, name?)` | `Action` | 동기화 Watch |
| `WatchSyncedFlagWithInitialState(flagName, callback, name?)` | `Action` | 동기화 Watch + 즉시 콜백 |
| `CreateWatchFlagGroup(name)` | `WatchFlagGroup` | 일괄 관리용 그룹 생성 |
| `GetStats()` | `FeaturesStats` | 전체 통계 스냅샷 |
| `GetLightStats()` | `FeaturesLightStats` | 경량 통계 (컬렉션 복사 없음) |

### GatrixSDK (정적 단축 접근)

| 멤버 | 설명 |
|---|---|
| `GatrixSDK.Features` | `GatrixBehaviour.Client.Features`의 단축 |
| `GatrixSDK.Events` | `GatrixBehaviour.Client.Events`의 단축 |
| `GatrixSDK.Client` | 활성 `GatrixClient` 인스턴스 |
| `GatrixSDK.IsInitialized` | SDK 시작 여부 |

### GatrixBehaviour (static)

| 멤버 | 설명 |
|---|---|
| `GatrixBehaviour.Client` | 활성 `GatrixClient` 인스턴스 |
| `GatrixBehaviour.IsInitialized` | SDK 시작 여부 |
| `GatrixBehaviour.InitializeAsync(config)` | 코드 기반 초기화 |
| `GatrixBehaviour.Shutdown()` | 수동 종료 |

---

## 🍳 자주 쓰는 패턴

### 게임 속도 조정

```csharp
features.WatchRealtimeFlagWithInitialState("game-speed", proxy =>
    Time.timeScale = proxy.FloatValue(1.0f));
```

### 시즌 이벤트 전환

```csharp
features.WatchRealtimeFlagWithInitialState("winter-event", proxy =>
    SetWinterEvent(proxy.IsEnabled));
```

### A/B 테스트 UI 텍스트

```csharp
features.WatchRealtimeFlagWithInitialState("cta-button-text", proxy =>
    ctaButton.text = proxy.StringValue("지금 플레이"));
```

### 제어된 게임플레이 업데이트 (Explicit Sync)

```csharp
features.WatchSyncedFlagWithInitialState("enemy-hp-multiplier", proxy =>
    SetEnemyHpMultiplier(proxy.FloatValue(1.0f)));

// 로딩 화면에서 적용
IEnumerator LoadingScreen()
{
    yield return SceneManager.LoadSceneAsync("Game");
    await features.SyncFlagsAsync();
}
```

### 로그인 후 컨텍스트 업데이트

```csharp
async void OnLogin(string userId, int level)
{
    await GatrixSDK.Client.UpdateContextAsync(new GatrixContext
    {
        UserId = userId,
        Properties = new Dictionary<string, string> { { "level", level.ToString() } }
    });
}
```

### Watch Group으로 다중 플래그 관리

```csharp
var group = features.CreateWatchFlagGroup("shop-system");
group
    .WatchSyncedFlagWithInitialState("new-shop-enabled", f => SetShopEnabled(f.Enabled))
    .WatchSyncedFlagWithInitialState("discount-rate", f => SetDiscount(f.FloatValue(0f)));

await features.SyncFlagsAsync(); // 두 플래그 함께 적용

group.Destroy(); // 정리
```

---

## ❓ FAQ & 문제 해결

### 1. 플래그 변경이 실시간으로 감지되지 않음

| 원인 | 해결책 |
|---|---|
| 폴링 간격이 너무 김 | `RefreshInterval` 감소 (기본값: 30초) |
| `ExplicitSyncMode` 활성화됨 | `SyncFlagsAsync()` 호출 |
| `WatchSyncedFlag` 사용 중 | `WatchRealtimeFlag`로 변경하거나 `SyncFlagsAsync()` 호출 |
| `OfflineMode` 활성화됨 | `Features.OfflineMode = false` 설정 |
| 잘못된 `AppName` | 대시보드 설정과 일치 확인 |

### 2. `WatchSyncedFlag` 콜백이 실행되지 않음

`ExplicitSyncMode` 활성화 후 `SyncFlags()` 호출이 필요합니다:

```csharp
config.Features.ExplicitSyncMode = true;
features.WatchSyncedFlagWithInitialState("my-flag", flag => { ... });
await features.SyncFlagsAsync();
```

### 3. 초기화 후 플래그가 폴백 값을 반환함

| 원인 | 해결책 |
|---|---|
| SDK 아직 준비 안 됨 | `flags.ready` 이벤트 기다리거나 `WatchRealtimeFlagWithInitialState` 사용 |
| 잘못된 `AppName` | 대시보드 설정과 일치 확인 |
| 이 환경에 플래그 미할당 | 대시보드에서 확인 |
| 첫 페치 중 네트워크 에러 | `flags.fetch_error` 이벤트 및 로그 확인 |

### 4. 게임플레이 중 플래그 값이 갑자기 바뀜

`ExplicitSyncMode`를 활성화하고 게임플레이 중요 값에 `WatchSyncedFlag`를 사용하세요.

### 5. 콜백에서 메모리 누수 경고

컴포넌트 소멸 시 반드시 반환된 `Action`을 호출하거나 `group.Destroy()`를 호출:

```csharp
private Action _unwatch;

void Start() {
    _unwatch = features.WatchRealtimeFlag("my-flag", f => { ... });
}

void OnDestroy()
{
    _unwatch?.Invoke();
    watchGroup?.Destroy();
}
```

---

## 📜 라이선스

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](../../../../LICENSE) 파일을 참조하세요.
