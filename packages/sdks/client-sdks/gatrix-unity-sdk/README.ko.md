# Gatrix Unity SDK

> **피처 플래그, A/B 테스트, 원격 구성 — Unity 게임 개발자를 위해 만들어졌습니다.**

Gatrix Unity SDK를 사용하면 새 빌드를 배포하지 않고도 게임의 동작을 실시간으로 제어할 수 있습니다. 기능 토글, A/B 실험, 게임 파라미터 튜닝, 점진적 롤아웃 — 모든 것을 Gatrix 대시보드에서 수행할 수 있습니다.

---

## ✨ Gatrix를 사용해야 하는 이유

| Gatrix 없이 | Gatrix와 함께 |
|---|---|
| 값 하나 바꾸려면 새 빌드 배포 | 대시보드에서 실시간 변경 |
| 모든 플레이어가 같은 경험 | A/B 테스트로 다양한 경험 제공 |
| 하드코딩된 피처 플래그 | 실시간 원격 구성 |
| 위험한 빅뱅 릴리스 | 즉시 롤백 가능한 점진적 배포 |

---

## 📦 설치

### Unity Package Manager (UPM)

`Packages/manifest.json`에 추가:

```json
{
  "dependencies": {
    "com.gatrix.unity.sdk": "file:../../path/to/gatrix-unity-sdk"
  }
}
```

또는 **Window → Package Manager → Add package from disk...** 에서 `package.json`을 선택합니다.

---

## 🚀 빠른 시작

### 옵션 A: 코드 없이 설정 (권장)

1. Unity 메뉴에서 **Window → Gatrix → Setup Wizard**로 이동
2. API URL, 토큰, 앱 이름 입력
3. **Create SDK Manager** 클릭 — 완료!

### 옵션 B: 코드로 설정

```csharp
using Gatrix.Unity.SDK;
using UnityEngine;

public class GameManager : MonoBehaviour
{
    async void Start()
    {
        var config = new GatrixClientConfig
        {
            ApiUrl    = "https://your-api.example.com/api/v1",
            ApiToken  = "your-client-api-token",
            AppName   = "my-unity-game",
            Environment = "production",
            Context   = new GatrixContext { UserId = "player-123" }
        };

        await GatrixBehaviour.InitializeAsync(config);
        Debug.Log("Gatrix 준비 완료!");
    }
}
```

---

## 🎮 피처 플래그 읽기

```csharp
var features = GatrixBehaviour.Client.Features;

// Boolean 체크
bool newUIEnabled = features.IsEnabled("new-ui");

// 타입별 안전한 기본값 (예외 발생 없음)
bool   showBanner  = features.BoolVariation("show-banner", false);
string theme       = features.StringVariation("app-theme", "dark");
int    maxRetries  = features.IntVariation("max-retries", 3);
float  gameSpeed   = features.FloatVariation("game-speed", 1.0f);
double dropRate    = features.NumberVariation("item-drop-rate", 0.05);

// 전체 배리언트 정보 (이름 + 값)
Variant variant = features.GetVariant("experiment-a");
Debug.Log($"Variant: {variant.Name}, Value: {variant.Value}");

// 평가 상세 정보 (결정 이유 포함)
var details = features.BoolVariationDetails("feature-x", false);
Debug.Log($"Value: {details.Value}, Reason: {details.Reason}");
```

---

## 👁️ 변경 감지 (Watch)

Gatrix는 용도에 따라 두 가지 Watch 메서드 패밀리를 제공합니다:

### 리얼타임 감지 (Realtime)

**`WatchRealtimeFlag`** 는 `ExplicitSyncMode` 설정과 **무관하게**, 서버에서 플래그 변경을 가져오는 즉시 콜백을 호출합니다. 디버그 UI, 모니터링 대시보드, 또는 항상 최신 서버 값이 필요한 경우에 적합합니다.

```csharp
var features = GatrixBehaviour.Client.Features;

// 플래그 감지 — 서버 측 변경 시마다 콜백 호출
var unsubscribe = features.WatchRealtimeFlag("game-speed", proxy =>
{
    Debug.Log($"서버에서 game-speed 변경됨: {proxy.FloatVariation(1f)}");
});

// 감지 중단
unsubscribe();

// 초기 상태 포함 감지 (현재 값으로 즉시 콜백 호출 후, 변경 시마다 호출)
features.WatchRealtimeFlagWithInitialState("dark-mode", proxy =>
{
    ApplyTheme(proxy.Enabled ? "dark" : "light");
});
```

### 동기화 감지 (Synced)

**`WatchSyncedFlag`** 는 **동기화된** 플래그 저장소가 업데이트될 때만 콜백을 호출합니다. `ExplicitSyncMode`가 활성화된 경우, 동기화 감지자는 `SyncFlagsAsync()` 호출 시까지 변경 전달을 대기합니다. `ExplicitSyncMode`가 비활성화된 경우에는 리얼타임 감지와 동일하게 동작합니다.

```csharp
var features = GatrixBehaviour.Client.Features;

// 동기화 감지 — ExplicitSyncMode에서는 SyncFlagsAsync() 이후에만 콜백 호출
features.WatchSyncedFlagWithInitialState("difficulty", proxy =>
{
    SetDifficulty(proxy.StringVariation("normal"));
});

// 안전한 시점에 변경 적용 (예: 라운드 사이)
await features.SyncFlagsAsync();
// ↑ 이 시점에서 동기화 감지자의 콜백이 최신 값으로 호출됨
```

### 리얼타임 vs 동기화 — 언제 무엇을 사용할까?

| | 리얼타임 (Realtime) | 동기화 (Synced) |
|---|---|---|
| **콜백 타이밍** | 서버에서 가져오는 즉시 | `SyncFlagsAsync()` 호출 후 (ExplicitSyncMode 시) |
| **적합한 용도** | 디버그 UI, 모니터링, 방해되지 않는 변경 | 게임플레이에 영향을 주는 값, 타이밍 제어 필요 |
| **ExplicitSyncMode 비활성** | 변경 시 즉시 호출 | 변경 시 즉시 호출 (리얼타임과 동일) |
| **ExplicitSyncMode 활성** | 변경 시 즉시 호출 | `SyncFlagsAsync()` 호출 후에만 호출 |

### Watch 그룹

여러 플래그를 그룹으로 감지하고 한 번에 구독 해제할 수 있습니다:

```csharp
var features = GatrixBehaviour.Client.Features;

var group = features.CreateWatchGroup("ui-flags");
group.WatchRealtimeFlag("dark-mode",   p => { /* ... */ })
     .WatchRealtimeFlag("show-ads",    p => { /* ... */ })
     .WatchSyncedFlag("premium-ui",    p => { /* ... */ });

// 모두 한 번에 해제
group.Destroy();
```

---

## 🧩 제로 코드 컴포넌트

`MonoBehaviour` 컴포넌트를 GameObject에 추가하기만 하면 됩니다 — 코딩이 필요 없습니다.

### `GatrixFlagToggle`
**플래그에 따라 GameObject를 활성화/비활성화합니다.**

적합한 용도: 기능 게이팅, UI 패널 표시/숨기기, 디버그 도구 활성화.

```
Inspector:
  Flag Name: "new-shop-ui"
  When Enabled: [ShopV2Panel]
  When Disabled: [ShopV1Panel]
```

---

### `GatrixFlagValue`
**플래그의 문자열/숫자 값을 UI Text 또는 TextMeshPro 컴포넌트에 바인딩합니다.**

적합한 용도: 서버 주도 텍스트 표시, A/B 테스트 카피, 라이브 카운트다운 타이머.

```
Inspector:
  Flag Name: "welcome-message"
  Format: "{0}"          ← {0}이 플래그 값으로 대체됨
  Fallback Text: "Welcome!"
```

---

### `GatrixFlagImage`
**플래그의 배리언트 이름에 따라 스프라이트를 교체합니다.**

적합한 용도: 시즌 이벤트 배너, 버튼 아트 A/B 테스트, 캐릭터 스킨 롤아웃.

```
Inspector:
  Flag Name: "hero-skin"
  Default Sprite: [DefaultHero]
  Variant Maps:
    "winter" → [WinterHero]
    "summer" → [SummerHero]
```

---

### `GatrixFlagMaterial`
**플래그에 따라 머티리얼을 교체하거나 셰이더 속성을 설정합니다.**

적합한 용도: 비주얼 A/B 테스트, 시즌 셰이더 효과, 품질 단계 전환.

```
Inspector:
  Flag Name: "visual-quality"
  Mode: SwapMaterial
  Variant Maps:
    "high"   → [HighQualityMat]
    "medium" → [MediumQualityMat]
```

---

### `GatrixFlagTransform`
**플래그 값으로 위치, 회전, 스케일을 조정합니다.**

적합한 용도: 라이브 UI 레이아웃 튜닝, 스폰 위치 조정, 요소 배치 A/B 테스트.

```
Inspector:
  Flag Name: "button-scale"
  Mode: Scale
  Component: Y
```

---

### `GatrixFlagColor`
**플래그 상태 또는 배리언트에 따라 UI Graphics 또는 Renderer의 색상을 변경합니다.**

적합한 용도: UI 컬러 테마 A/B 테스트, 상태 표시기, 시즌 색상 변경.

```
Inspector:
  Flag Name: "ui-theme"
  Mode: ByVariant
  Variant Colors:
    "red"  → Color(1, 0.2, 0.2)
    "blue" → Color(0.2, 0.5, 1)
  Animate: true  ← 부드러운 색상 보간
```

---

### `GatrixFlagCanvas`
**CanvasGroup을 사용하여 UI 패널 전체를 페이드 인/아웃합니다.**

GatrixFlagToggle보다 강력한 UI 제어 — 숨기지 않고 알파 페이드 및 레이캐스트 비활성화를 지원합니다.

```
Inspector:
  Flag Name: "premium-hud"
  Enabled Alpha: 1.0
  Disabled Alpha: 0.0
  Animate: true  ← 부드러운 페이드
```

---

### `GatrixFlagAudio`
**플래그 상태 또는 배리언트에 따라 다른 AudioClip을 재생합니다.**

적합한 용도: 음악/SFX A/B 테스트, 시즌 오디오, 특수 사운드 이펙트 활성화.

```
Inspector:
  Flag Name: "background-music"
  Mode: ByVariant
  Variant Clips:
    "winter" → [WinterTheme]
    "summer" → [SummerTheme]
  Play On Change: true
```

---

### `GatrixFlagAnimator`
**플래그 상태 또는 배리언트에 따라 Animator 파라미터를 제어합니다.**

적합한 용도: 특수 애니메이션 활성화, 캐릭터 애니메이션 A/B 테스트, 컷신 트리거.

```
Inspector:
  Flag Name: "hero-animation"
  Bool Parameter: "IsSpecialMode"
  Enabled Trigger: "SpecialEnter"
  Disabled Trigger: "SpecialExit"
```

---

### `GatrixFlagParticles`
**플래그에 따라 ParticleSystem을 재생, 중지, 또는 일시정지합니다.**

적합한 용도: 시즌 파티클 이펙트, 특수 VFX 활성화, 비주얼 피드백 A/B 테스트.

```
Inspector:
  Flag Name: "snow-effect"
  On Enabled: Play
  On Disabled: Stop
  With Children: true
```

---

### `GatrixFlagEvent`
**플래그 변경 시 UnityEvent를 발생시킵니다.**

적합한 용도: 커스텀 게임 로직 트리거, 기존 이벤트 시스템과 통합.

```
Inspector:
  Flag Name: "tutorial-mode"
  On Enabled: [TutorialManager.StartTutorial()]
  On Disabled: [TutorialManager.StopTutorial()]
```

---

### `GatrixEventListener`
**SDK 라이프사이클 이벤트에 시각적으로 연결합니다.**

적합한 용도: SDK 초기화 중 로딩 스피너 표시, 오류의 우아한 처리.

```
Inspector:
  On Ready: [UIManager.HideLoadingScreen()]
  On Error: [UIManager.ShowErrorBanner()]
```

---

### `GatrixFlagLogger`
**플래그 변경을 Unity Console에 로깅합니다.**

적합한 용도: 개발 중 플래그 동작 디버깅.

---

### `GatrixVariantSwitch`
**배리언트 이름에 따라 다른 자식 GameObject를 활성화합니다.**

적합한 용도: 다중 배리언트 UI 레이아웃, 게임 모드 전환.

---

### `GatrixFlagSceneRedirect`
**플래그에 따라 다른 씬을 로드합니다.**

적합한 용도: 온보딩 플로우 A/B 테스트, 시즌 이벤트 씬, 새로운 영역의 점진적 롤아웃.

---

## 🛠️ 에디터 도구

### 모니터 윈도우
**Window → Gatrix → Monitor**

SDK 상태에 대한 실시간 대시보드:

| 탭 | 표시 내용 |
|-----|-------------|
| **Overview** | SDK 상태, 연결 ID, 페치 통계 (횟수, 오류, 복구), 스트리밍 통계 (이벤트, 오류, 복구, 전송 유형), 씬 구성 |
| **Flags** | 모든 플래그의 실시간 ON/OFF 상태, 배리언트, 값. 최근 변경된 플래그를 노란색으로 하이라이트 |
| **Events** | 실시간 이벤트 로그 — 타임스탬프와 상세 정보가 포함된 모든 SDK 이벤트 |
| **Context** | 현재 평가 컨텍스트 (userId, sessionId, 커스텀 속성) |
| **Metrics** | 이중 뷰 메트릭: 실시간 시계열 차트의 **Graph** 모드 또는 상세 테이블의 **Report** 모드. 플래그별 타임라인 차트 |
| **Stats** | 상세 카운터, 스트리밍 카운터, 플래그 접근 횟수, 배리언트 히트 횟수, 누락된 플래그, 이벤트 핸들러 누수 감지 |

#### 메트릭 그래프 뷰
**Metrics** 탭에는 에디터에서 직접 렌더링되는 인터랙티브 시계열 그래프가 포함됩니다:
- **Network Activity** — 시간에 따른 페치, 업데이트, 오류 표시
- **Impressions & Delivery** — 시간에 따른 노출 횟수와 메트릭 전송
- **Streaming** — 재연결 시도, 스트림 이벤트, 스트림 오류
- 플래그별 타임라인 차트로 boolean 및 배리언트 상태 변화 시각화
- 1초 간격 수집, 300초 데이터 보존
- 자동 스케일 Y축, 그리드 라인, 시간축 레이블, 컬러 코딩된 범례
- 시간 오프셋 슬라이더로 과거 데이터 스크롤
- **Graph**와 **Report** 뷰를 원클릭으로 전환

**툴바 빠른 동작:**
- **⚡ Sync** — 명시적 동기화 모드에서 보류 중인 변경이 있을 때 표시
- **↻** — 수동 새로고침
- **● Auto / ○ Auto** — 자동 새로고침 토글
- **Setup ↗** — Setup Wizard 열기
- **About** — SDK 버전 정보

---

### Setup Wizard
**Window → Gatrix → Setup Wizard**

최초 구성을 위한 가이드 설정. 사전 구성된 SDK Manager 프리팹을 생성합니다.

---

### 커스텀 인스펙터
모든 Gatrix 컴포넌트에는 다듬어진 커스텀 인스펙터가 있습니다:
- **◆ GATRIX** 파란색 강조가 있는 타이틀 바
- **● LIVE** 플레이 모드 중 배지
- **실시간 플래그 상태** — 현재 ON/OFF 상태와 배리언트 표시
- **Monitor ↗** — 모니터 윈도우로 바로 이동하는 빠른 접근 버튼
- 명확한 레이블이 있는 정리된 그룹

---

### 프로젝트 설정
**Edit → Project Settings → Gatrix SDK**

프로젝트 설정 윈도우에서 접근 가능한 전역 설정과 바로가기입니다.

---

## 🔄 컨텍스트 관리

컨텍스트는 각 플레이어에 대해 플래그가 어떻게 평가되는지를 결정합니다.

```csharp
var features = GatrixBehaviour.Client.Features;

// 전체 컨텍스트 업데이트 (재페치 트리거)
await features.UpdateContextAsync(new GatrixContext
{
    UserId    = "player-456",
    SessionId = "session-abc",
    Properties = new Dictionary<string, object>
    {
        { "plan",    "premium" },
        { "level",   42 },
        { "country", "KR" }
    }
});

// 단일 필드 업데이트
await features.SetContextFieldAsync("level", 43);

// 필드 제거
await features.RemoveContextFieldAsync("plan");
```

---

## ⏱️ 명시적 동기화 모드 (Explicit Sync Mode)

플래그 변경이 게임에 적용되는 시점을 정확히 제어합니다 — 세션 중간의 갑작스러운 변경을 방지하는 데 유용합니다.

```csharp
var config = new GatrixClientConfig
{
    Features = new FeaturesConfig { ExplicitSyncMode = true }
};

await GatrixBehaviour.InitializeAsync(config);

var features = GatrixBehaviour.Client.Features;

// 플래그가 백그라운드에서 업데이트되지만 게임플레이에는 아직 영향을 주지 않음.
// WatchSyncedFlag를 사용하여 변경 적용 시에만 반응:
features.WatchSyncedFlagWithInitialState("difficulty", proxy =>
{
    SetDifficulty(proxy.StringVariation("normal"));
});

// 안전한 시점에 변경 적용 (예: 라운드 사이):
if (features.CanSyncFlags())
{
    await features.SyncFlagsAsync(fetchNow: false);
}
```

**Monitor → Flags** 탭에서 명시적 동기화 모드일 때 활성 플래그와 보류 중인 변경을 나란히 보여줍니다.

---

## 📡 이벤트

```csharp
var client = GatrixBehaviour.Client;

client.On(GatrixEvents.Ready,       args => Debug.Log("SDK 준비 완료"));
client.On(GatrixEvents.Change,      args => Debug.Log("플래그 업데이트됨"));
client.On(GatrixEvents.Error,       args => Debug.LogError("SDK 오류"));
client.On(GatrixEvents.FetchEnd,    args => Debug.Log("페치 완료"));
client.On(GatrixEvents.Impression,  args => Debug.Log("노출 추적됨"));

// 스트리밍 이벤트
client.On(GatrixEvents.FlagsStreamingConnected,    args => Debug.Log("스트리밍 연결됨"));
client.On(GatrixEvents.FlagsStreamingDisconnected, args => Debug.Log("스트리밍 연결 끊김"));
client.On(GatrixEvents.FlagsStreamingReconnecting, args => Debug.Log("스트리밍 재연결 중"));
client.On(GatrixEvents.FlagsStreamingError,        args => Debug.LogWarning("스트리밍 오류"));

// 한 번만 구독
client.Once(GatrixEvents.Ready, args => ShowWelcomeScreen());

// 모든 이벤트 구독 (디버깅에 유용)
client.Events.OnAny((eventName, args) => Debug.Log($"[Gatrix] {eventName}"));
```

---

## 💾 저장소 및 오프라인 모드

```csharp
// 파일 기반 영속성 (프로덕션 권장)
config.StorageProvider = new FileStorageProvider("gatrix");

// 오프라인 모드 + 부트스트랩 데이터 (테스트 또는 네트워크 없는 시나리오)
config.OfflineMode = true;
config.Features.Bootstrap = cachedFlagData;
```

---

## ⚡ 성능 및 스레딩

SDK는 Unity의 단일 스레드 모델에 맞게 설계되었습니다:

- **동기적 플래그 읽기** — `IsEnabled()`, `BoolVariation()` 등은 인메모리 캐시에서 읽습니다. 비동기 오버헤드 없음.
- **메인 스레드 콜백** — 모든 이벤트 콜백과 플래그 변경 알림은 메인 스레드에서 호출됩니다.
- **ValueTask** — 비동기 메서드는 동기 코드 경로에서 힙 할당 없는 `ValueTask`/`ValueTask<T>` 사용.
- **스레드 안전 메트릭** — 메트릭 버킷은 잠금 사용; 이벤트는 `SynchronizationContext`를 통해 디스패치.
- **MainThreadDispatcher** — 백그라운드 작업 결과가 자동으로 메인 스레드로 전달됩니다.

---

## 📡 스트리밍 전송

SDK는 실시간 플래그 업데이트 수신을 위해 두 가지 스트리밍 전송 방식을 지원합니다:

| 전송 방식 | 플랫폼 | 상세 |
|-----------|-----------|-------------|
| **SSE** (Server-Sent Events) | 모든 플랫폼 | 기본값. 단방향 HTTP 스트리밍. |
| **WebSocket** | WebGL 포함 모든 플랫폼 | 전이중, 낮은 지연. 연결 유지를 위한 자동 핑. |

```csharp
var config = new GatrixClientConfig
{
    // ...
    Features = new FeaturesConfig
    {
        Streaming = new StreamingConfig
        {
            Transport = StreamingTransport.WebSocket  // 기본값: SSE
        }
    }
};
```

### WebGL 지원

SDK는 Unity **WebGL** 빌드를 완벽하게 지원합니다:

- WebSocket 전송은 WebGL에서 **JavaScript 인터롭 레이어** (`GatrixWebSocket.jslib`)를 자동 사용합니다 (`System.Net.WebSockets.ClientWebSocket`이 브라우저 샌드박스에서 사용 불가하므로).
- SDK가 `GatrixWebSocketFactory`를 통해 올바른 WebSocket 구현을 선택합니다 — 수동 구성 불필요.
- 지원 플랫폼: **Windows, macOS, Linux, Android, iOS, WebGL**.

### 크로스 플랫폼 WebSocket 추상화

| 클래스 | 플랫폼 | 구현 |
|-------|----------|----------------|
| `StandaloneWebSocket` | Desktop, Android, iOS | 이벤트 기반 폴링으로 `System.Net.WebSockets.ClientWebSocket` 래핑 |
| `WebGLWebSocket` | WebGL | `GatrixWebSocket.jslib`를 통한 JavaScript 인터롭, 브라우저의 네이티브 WebSocket API 사용 |
| `GatrixWebSocketFactory` | 전체 | 런타임에 올바른 구현을 자동 선택 |

---

## 🧹 정리

```csharp
// GatrixBehaviour가 애플리케이션 종료 시 자동 처리
GatrixBehaviour.Shutdown();

// 또는 수동 해제
GatrixBehaviour.Client.Dispose();
```

---

## 📖 API 레퍼런스

### FeaturesClient (`GatrixBehaviour.Client.Features`)

| 메서드 | 반환 타입 | 설명 |
|--------|---------|-------------|
| `IsEnabled(flagName)` | `bool` | 플래그 활성화 여부 확인 |
| `HasFlag(flagName)` | `bool` | 플래그가 캐시에 존재하는지 확인 |
| `GetVariant(flagName)` | `Variant` | 배리언트 가져오기 (null 아님) |
| `BoolVariation(flag, default)` | `bool` | Boolean 값 가져오기 |
| `StringVariation(flag, default)` | `string` | 문자열 값 가져오기 |
| `IntVariation(flag, default)` | `int` | 정수 값 가져오기 |
| `FloatVariation(flag, default)` | `float` | float 값 가져오기 |
| `NumberVariation(flag, default)` | `double` | double 값 가져오기 |
| `JsonVariation(flag, default)` | `Dictionary` | JSON을 Dictionary로 가져오기 |
| `BoolVariationDetails(flag, default)` | `VariationResult<bool>` | 평가 이유 포함 Boolean 값 |
| `StringVariationDetails(flag, default)` | `VariationResult<string>` | 평가 이유 포함 문자열 값 |
| `UpdateContextAsync(ctx)` | `UniTask` | 평가 컨텍스트 업데이트 |
| `SetContextFieldAsync(key, value)` | `UniTask` | 단일 컨텍스트 필드 업데이트 |
| `RemoveContextFieldAsync(key)` | `UniTask` | 컨텍스트 필드 제거 |
| `WatchRealtimeFlag(flag, callback)` | `Action` | 실시간 플래그 변경 감지 |
| `WatchRealtimeFlagWithInitialState(flag, cb)` | `Action` | 실시간 감지 + 즉시 호출 |
| `WatchSyncedFlag(flag, callback)` | `Action` | 동기화된 플래그 변경 감지 |
| `WatchSyncedFlagWithInitialState(flag, cb)` | `Action` | 동기화 감지 + 즉시 호출 |
| `CreateWatchGroup(name)` | `WatchFlagGroup` | 명명된 감시자 그룹 생성 |
| `SyncFlagsAsync()` | `UniTask` | 보류 중인 플래그 변경 적용 |
| `CanSyncFlags()` | `bool` | 보류 중인 동기화 변경이 있는지 확인 |
| `SetExplicitSyncMode(enabled)` | `void` | 런타임에 명시적 동기화 모드 토글 |
| `GetStats()` | `FeaturesStats` | SDK 통계 가져오기 |

### GatrixClient (`GatrixBehaviour.Client`)

| 메서드 | 반환 타입 | 설명 |
|--------|---------|-------------|
| `StartAsync()` | `UniTask` | SDK 초기화 및 시작 |
| `Stop()` | `void` | 폴링 및 메트릭 중지 |
| `On(event, callback)` | `GatrixClient` | SDK 이벤트 구독 |
| `Once(event, callback)` | `GatrixClient` | 일회성 구독 |
| `Off(event, callback?)` | `GatrixClient` | 구독 해제 |
| `OnAny(callback)` | `GatrixClient` | 모든 이벤트 구독 |
| `OffAny(callback)` | `GatrixClient` | 모든 이벤트 구독 해제 |
| `GetStats()` | `GatrixSdkStats` | 종합 SDK 통계 가져오기 |
| `Dispose()` | `void` | 리소스 정리 |

### GatrixEventEmitter (`GatrixBehaviour.Client.Events`)

| 메서드/속성 | 설명 |
|----------------|-------------|
| `On(event, callback)` | 이벤트 구독 |
| `Once(event, callback)` | 일회성 구독 |
| `Off(event, callback?)` | 구독 해제 |
| `OnAny(callback)` | 모든 이벤트 구독 |
| `OffAny(callback)` | 모든 이벤트 구독 해제 |
| `Emit(event, args)` | 이벤트 발생 |
| `ListenerCount(event)` | 특정 이벤트의 핸들러 수 |
| `TotalListenerCount` | 모든 이벤트의 총 핸들러 수 |
| `RemoveAllListeners()` | 모든 리스너 제거 |

---

## 🎯 자주 사용하는 레시피

### 게임 속도 튜닝
```csharp
var features = GatrixBehaviour.Client.Features;
features.WatchRealtimeFlagWithInitialState("game-speed", proxy =>
{
    Time.timeScale = proxy.FloatVariation(1f);
});
```

### 시즌 이벤트
```csharp
// GatrixFlagToggle 컴포넌트를 시즌 콘텐츠 루트에 사용
// 또는 코드로:
var features = GatrixBehaviour.Client.Features;
features.WatchRealtimeFlagWithInitialState("winter-event", proxy =>
{
    winterEventRoot.SetActive(proxy.Enabled);
});
```

### A/B 테스트 UI 카피
```csharp
// GatrixFlagValue 컴포넌트를 Text/TMP 컴포넌트에 사용
// 또는 코드로:
var features = GatrixBehaviour.Client.Features;
features.WatchRealtimeFlagWithInitialState("cta-button-text", proxy =>
{
    ctaButton.text = proxy.StringVariation("Play Now");
});
```

### 점진적 기능 롤아웃
```csharp
// 새 기능 표시 전 플래그 확인
var features = GatrixBehaviour.Client.Features;
if (features.IsEnabled("new-inventory-system"))
{
    newInventory.SetActive(true);
    legacyInventory.SetActive(false);
}
```

### 제어된 게임플레이 업데이트 (명시적 동기화)
```csharp
// 게임플레이에 영향을 주는 값에는 동기화 감지자 사용
var features = GatrixBehaviour.Client.Features;
features.WatchSyncedFlagWithInitialState("enemy-hp-multiplier", proxy =>
{
    enemyHpMultiplier = proxy.FloatVariation(1.0f);
});

// 안전한 시점에 적용 (예: 라운드 사이)
if (features.CanSyncFlags())
{
    await features.SyncFlagsAsync();
}
```

---

## 🔗 링크

- [Gatrix 대시보드](https://app.gatrix.io)
- [문서](https://docs.gatrix.io)
- [English README](./README.md)
- [알려진 이슈 & 주의사항](./ISSUES.md)
- [지원](mailto:support@gatrix.io)
