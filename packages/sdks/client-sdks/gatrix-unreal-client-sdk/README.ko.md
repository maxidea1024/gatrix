# Gatrix Unreal SDK

> **피처 플래그, A/B 테스트, 원격 구성을 위한 Unreal Engine 공식 Gatrix SDK입니다.**

새 빌드를 배포하지 않고도 게임의 동작을 실시간으로 바꿀 수 있습니다. 피처 토글, A/B 실험, 게임 파라미터 튜닝, 점진적 롤아웃 — 모든 것을 Gatrix 대시보드에서 실행할 수 있습니다.

## 🚩 피처 플래그란?

피처 플래그는 두 가지 요소로 구성됩니다.

| 요소 | 타입 | 설명 |
|---|---|---|
| **상태** (`enabled`) | `bool` | 기능이 켜져 있는가, 꺼져 있는가 — `IsEnabled()`로 확인 |
| **값** (`variant`) | `boolean` `string` `number` `json` | 세부적인 구성 값 — `BoolVariation()`, `StringVariation()`, `FloatVariation()` 등으로 확인 |

플래그는 **활성화 상태임과 동시에 특정 값을 가질 수 있습니다** (예: `difficulty = "hard"`). 상태와 값은 독립적이므로 두 가지 모두 처리해야 합니다.

### 💡 퀵 스타트 예시

#### 1. 기능 전환 (`IsEnabled`)

```cpp
UGatrixClient* Client = UGatrixClient::Get();

if (Client->GetFeatures()->IsEnabled(TEXT("new-shop")))
{
    // 기능이 ON 상태 -> 새 상점 UI 표시
    ShowNewShop();
}
else
{
    // 기능이 OFF 상태 (또는 플래그 없음) -> 기존 상점 사용
    ShowLegacyShop();
}
```

#### 2. 원격 구성 (`Variation`)

```cpp
// float 값 가져오기 (매칭이 없으면 1.0 반환)
float speed = Client->GetFeatures()->FloatVariation(TEXT("game-speed"), 1.0f);

// string 값 가져오기
FString theme = Client->GetFeatures()->StringVariation(TEXT("app-theme"), TEXT("dark"));

// int 값 가져오기
int32 maxLevel = Client->GetFeatures()->IntVariation(TEXT("max-level"), 50);
```

#### 3. 조건부 타겟팅

```cpp
// 클라이언트는 값을 읽기만 합니다!
// 스크립트 분기 처리(Region별/Level별)는 서버의 원격 타겟팅 규칙이 대신 해줍니다.
FString difficulty = Client->GetFeatures()->StringVariation(TEXT("difficulty"), TEXT("Normal"));
```

---

## 🤔 Gatrix를 사용해야 하는 이유

| Gatrix 없이 | Gatrix와 함께 |
|---|---|
| 값을 하나 바꾸려면 새 빌드가 필요 | 대시보드에서 실시간 변경 |
| 모든 플레이어가 같은 경험 | A/B 테스트로 다양한 경험 제공 |
| 하드코딩된 피처 플래그 관리의 어려움 | 실시간 원격 구성 관리 |
| 버그 발생 시 핫픽스 빌드로 롤백 | 버그 기능만 원격에서 즉시 끄기 |

### 🔑 주요 사용 시나리오

- **📱 모바일 앱 스토어 심사** — 새 기능을 비활성화한 채로 제출하고, 앱스토어 승인 직후 라이브로 즉시 활성화하세요. 추가 심사가 필요 없습니다.
- **⚖️ 규제 및 법규 준수** — GDPR 등 특정 국가의 법률 변경에 맞춰 특정 지역에서만 기능을 즉시 비활성화할 수 있습니다.
- **🚨 긴급 킬 스위치** — 프로덕션 크래시를 유발하는 기능을 핫픽스 빌드 없이 단 몇 초 만에 차단합니다.
- **🔬 A/B 테스트** — 무기 대미지, 재화 드랍률 등을 그룹별로 나눠 적용하고 사용자 경험에 미치는 영향을 측정합니다.
- **📅 기능 출시 동기화** — 코드는 미리 배포해두고, 마케팅/비즈니스 팀이 원하는 시점에 정확히 기능을 오픈할 수 있습니다.

---

## 📐 평가 모델: 원격 평가 방식

1. SDK가 **컨텍스트**(userId, properties)를 서버로 전송합니다.
2. 서버가 모든 규칙을 평가하고 **최종 플래그 값만** 반환합니다.
3. 규칙은 클라이언트로 노출되지 않습니다.

| | 원격 평가 (Gatrix) | 로컬 평가 |
|---|---|---|
| **보안** | ✅ 규칙이 서버 밖으로 나가지 않음 | ⚠️ 클라이언트에 규칙 노출 (데이터마이닝 위험) |
| **일관성** | ✅ 모든 SDK에서 정확히 동일 | ⚠️ 각 플랫폼 SDK마다 규칙 엔진 중복 구현 |
| **페이로드** | ✅ 소규모 (최종 평가 결과 맵핑) | ⚠️ 대규모 (전체 규칙 세트) |
| **오프라인** | ⚠️ 최소 1회 연결 혹은 Bootstrap 필요 | ✅ 처음부터 오프라인 동작 가능 |

> 🛡️ SDK는 마지막으로 수신한 값을 로컬에 캐시합니다. 네트워크 단절로 인해 게임이 중단되는 일은 발생하지 않으며, 이 경우 오프라인 fallback 값이 안전하게 사용됩니다.

---

## 📦 설치

1. `GatrixClientSDK` 폴더를 프로젝트의 `Plugins/` 디렉토리에 복사합니다.
2. 언리얼 엔진 프로젝트 파일을 재생성합니다.
3. 게임 모듈의 `.Build.cs`에 추가합니다.

```csharp
PublicDependencyModuleNames.AddRange(new string[] { "GatrixClientSDK" });
```

---

## 🚀 빠른 시작

### 옵션 A: C++ 설정

```cpp
#include "GatrixClient.h"
#include "GatrixEvents.h"

// 초기 설정
FGatrixClientConfig Config;
Config.ApiUrl = TEXT("https://your-api.example.com/api/v1");
Config.ApiToken = TEXT("your-client-api-token");
Config.AppName = TEXT("MyGame");


// 컨텍스트(사용자 정보) 설정 (선택 사항)
Config.Features.Context.UserId = TEXT("player-123");
Config.Features.Context.SessionId = TEXT("session-abc");

// SDK 시작
UGatrixClient* Client = UGatrixClient::Get();
Client->Start(Config);

// 이벤트 구독
Client->On(GatrixEvents::FlagsReady, [](const TArray<FString>& Args)
{
    UE_LOG(LogTemp, Log, TEXT("Gatrix SDK 준비 완료!"));
});

Client->On(GatrixEvents::FlagsChange, [Client](const TArray<FString>& Args)
{
    float GameSpeed = Client->GetFeatures()->FloatVariation(TEXT("game-speed"), 1.0f);
});
```

### 옵션 B: 블루프린트 설정

1. **"Get Gatrix Client"** 노드로 싱글톤 인스턴스를 가져옵니다.
2. **Init** 또는 **Start** 노드로 `GatrixClientConfig` 구조체를 전달하여 시작합니다.
3. 이벤트 그래프에서 **OnReady**, **OnChange**, **OnError** 등의 이벤트에 바인딩합니다.
4. 이후 런타임에 **Bool Variation**, **String Variation** 등을 활용합니다.

---

## 🏁 피처 플래그 읽기

```cpp
auto* Features = Client->GetFeatures();

// Boolean 체크
bool bNewUI = Features->IsEnabled(TEXT("new-ui"));

// 타입별 안전한 배리언트 읽기 (예외 발생 없음. 항상 폴백 제공)
bool bShowBanner = Features->BoolVariation(TEXT("show-banner"), false);
FString Theme = Features->StringVariation(TEXT("app-theme"), TEXT("dark"));
int32 MaxRetries = Features->IntVariation(TEXT("max-retries"), 3);
float GameSpeed = Features->FloatVariation(TEXT("game-speed"), 1.0f);
double DropRate = Client->GetFeatures()->DoubleVariation(TEXT("item-drop-rate"), 0.05);

// 상세 프록시 확인
UGatrixFlagProxy* Proxy = Features->GetFlag(TEXT("feature-x"));
if (Proxy)
{
    UE_LOG(LogTemp, Log, TEXT("Enabled: %s, Reason: %s"), 
        Proxy->IsEnabled() ? TEXT("true") : TEXT("false"), 
        *Proxy->GetReason());
}
```

---

## 🔁 변경 감지 (Watch)

Gatrix는 환경에 맞춘 두 가지 Watch 옵션을 제공합니다.

| 메서드 | 콜백 발생 시점 |
|---|---|
| `WatchRealtimeFlag` | 서버 페치 시 **즉시** 변동사항 적용 (디버그/비게임 UI) |
| `WatchSyncedFlag` | `SyncFlags()` 호출 후 동기적으로 발생 (게임플레이에 안전) |

```cpp
auto* Features = Client->GetFeatures();

// 리얼타임 감지 — 수신 즉시 변경됨 (디버그 UI 등에 유리)
FGatrixFlagWatchDelegate RealtimeCallback;
RealtimeCallback.BindLambda([](UGatrixFlagProxy* Proxy)
{
    ApplyDarkMode(Proxy->IsEnabled());
});
int32 WatchHandle = Features->WatchRealtimeFlag(TEXT("dark-mode"), RealtimeCallback);

// 초기 상태 발생 기능 (등록 즉시 1회 실행 후 이후 변동사항만 수신)
Features->WatchRealtimeFlagWithInitialState(TEXT("game-speed"), SpeedCallback);

// 동기식 감지 — SyncFlags() 호출 이후에만 발생되므로 보스전 도중 데이터가 변하지 않음
Features->WatchSyncedFlagWithInitialState(TEXT("difficulty"), DiffCallback);

// 리스너 해제 (메모리 릭 방지)
Features->UnwatchFlag(WatchHandle);
```

---

## 🌍 컨텍스트 관리

### 컨텍스트란 무엇인가요?

**컨텍스트(Context)**는 현재 사용자를 설명하는 속성 집합으로, SDK가 플래그 평가 요청 시 서버로 전송합니다. 서버는 컨텍스트를 기반으로 타겟팅 규칙을 평가하여 각 사용자에게 어떤 배리언트를 반환할지 결정합니다.

**컨텍스트가 사용되는 곳:**

- **사용자 타겟팅** — 한국 사용자에게 기능 A, 일본 사용자에게 기능 B를 표시
- **점진적 배포** — `UserId` 기준으로 10%의 사용자에게만 기능 활성화
- **A/B 테스트** — 사용자 속성에 따라 실험 그룹 배정
- **세그먼테이션** — `Properties`를 통해 무료/프리미엄 사용자에게 다른 경험 제공

> 💡 컨텍스트는 매 fetch 시 서버로 전송됩니다. 서버가 모든 타겟팅 규칙을 평가하고 최종 플래그 값만 반환합니다 — 규칙은 클라이언트에 노출되지 않습니다.

### 컨텍스트 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `AppName` | `FString` | 앱 이름 (초기화 시 결정, 변경 불가) |

| `UserId` | `FString` | 고유 식별자 — 타겟팅에서 가장 중요한 ID |
| `SessionId` | `FString` | 세션 범위 스코핑을 위한 임시 ID |
| `Properties` | `TMap<FString, FString>` | 자유롭게 전달할 게임 내 변수 (Level 등) |

### 컨텍스트 업데이트 방법

```cpp
// 풀 컨텍스트 업데이트 (호출 즉시 플래그를 자동으로 다시 fetch 시작함)
FGatrixContext NewContext;
NewContext.UserId = TEXT("player-456");
NewContext.Properties.Add(TEXT("level"), TEXT("42"));
NewContext.Properties.Add(TEXT("country"), TEXT("KR"));
Client->UpdateContext(NewContext);
```

> ⚠️ **주의:** 컨텍스트의 모든 업데이트는 네트워크 Re-fetch 통신을 유발합니다. Tick과 같은 빠른 루프에서 호출하지 않도록 주의하시고, 여러 개를 업데이트할 때는 배열/구조체를 통해 한 번에 갱신하세요.

---

## ⏱️ 명시적 동기화 모드 (Explicit Sync Mode)

게임플레이에서 플래그 변경사항이 유저 화면에 **적용되는 시점을 안전할 때로 강제**합니다. 타이밍에 민감한 실시간/경쟁 게임에 가장 중요한 모드입니다.

```cpp
// 설정에서 키기 (기본적으로 켜져있음)
Config.Features.bExplicitSyncMode = true;

// Synced watcher는 플래그를 변경 대기 상태(pending)로만 바꿔둡니다.
Features->WatchSyncedFlagWithInitialState(TEXT("difficulty"), DiffCallback);

// 로딩 화면이나 매치 종료 화면 등 가장 "안전한 전환점"에서 Sync() 호출
if (Features->HasPendingSyncFlags())
{
    // 여기서 대기 중이던 Watch 콜백들이 일제히 최신값으로 업데이트됨
    Features->SyncFlags(false);
}
```

### 권장되는 동기화 지점

| 동기화 지점 | 예시 |
|---|---|
| **로딩 화면** | 씬 전환 시나 비동기 레벨 로딩 중 |
| **타임아웃 / 다운타임** | 매치가 종료된 후, 다음 라운드 진입 전 |
| **로비 및 UI** | 로비 인벤토리 화면 등으로 나오는 시점 |
| **리스폰** | 사망 후 대기 상태 |

---

## 📡 운영 모드 비교

### 모드 비교표

| 모드 | 레이턴시 | 트래픽 소모량 | 용도 |
|---|---|---|---|
| 스트리밍 + 폴링 | 근실시간 | 적음 | 대부분의 프로덕션 단계 게임 (PC/Mobile/Console) |
| 폴링 전용 | 약 30초 내외 | 소형 | 오진단 테스트, WebGL 빌드용 |
| 오프라인 | N/A | 없음 | CI/CD 테스트, 보안 특수환경 |

### 모드 1: 스트리밍 + 폴링 (기본/권장)

```cpp
// SSE 스트리밍
Config.Features.Streaming.bEnabled = true;
Config.Features.Streaming.Transport = EGatrixStreamingTransport::Sse;
Config.Features.Streaming.Sse.ReconnectBase = 1;
Config.Features.Streaming.Sse.ReconnectMax = 30;

// 혹은 WebSocket
Config.Features.Streaming.Transport = EGatrixStreamingTransport::WebSocket;
Config.Features.Streaming.WebSocket.PingInterval = 30;
```

### 모드 2: 폴링 전용 모드

```cpp
Config.Features.Streaming.bEnabled = false;
Config.Features.RefreshInterval = 30.0f; // 30초 주기로 다시 받음
```

### 모드 3: 완전 오프라인

```cpp
Config.Features.bOfflineMode = true;
// 서버와 통신하지 않고 순수 폴백값으로 구동됩니다.
```

---

## 🔔 이벤트 시스템

```cpp
Client->On(GatrixEvents::FlagsReady, [](const TArray<FString>& Args)
{
    UE_LOG(LogTemp, Log, TEXT("SDK Initialized and Connected!"));
});

Client->On(GatrixEvents::FlagsChange, [](const TArray<FString>& Args)
{
    UE_LOG(LogTemp, Log, TEXT("플래그 업데이트 발생"));
});

// 한 번만 체크 (Once)
Client->Once(GatrixEvents::FlagsReady, [](const TArray<FString>& Args)
{
    ShowWelcomeScreen();
});
```

**제공되는 이벤트 상수:**

| 이벤트 이름 | 설명 |
|---|---|
| `flags.init` | SDK 초기화됨 |
| `flags.ready` | 첫 번째 성공적인 Fetch 성공 |
| `flags.fetch_start` / `fetch_success` / `fetch_error` | 페치 처리 상태별 주기 |
| `flags.change` | 플래그 변경 발생 |
| `flags.error` | SDK 에러 발생 시 |
| `flags.sync` | Explicit 모드에서 동기화가 반영될 때 |
| `flags.recovered` | 오류 상태에서 복구됨 |
| `flags.streaming_connected` / `disconnected` / `error` | 스트리밍 소켓 상태 로그 |

---

## 🔒 성능 제어 & 스레드 처리 (Thread Safety)

- 플래그 읽기 작업은 모두 `FCriticalSection` 없이 락-프리(Lock-Free) 원자성을 보장합니다. **가장 빠른 읽기 성능**을 제공합니다.
- 게임 엔진과의 충돌을 피하기 위해 모든 HTTP는 백그라운드 스레드에서 수행되고, 최종 콜백 수신만 메인(GameThread)에 Dispatch 됩니다.
- 이벤트 Emission 시스템은 교착 상태(Dead-lock)를 회피하기 위해 콜백들을 락 내부에서 배열로 취합한 후 순수 외부로 벗어나 수행합니다.
- 통계 카운터 역시 `FThreadSafeCounter`가 사용되어 락 경합 리스크를 제거했습니다.

---

## 🧹 메모리 수집 및 정리

```cpp
// 게임 인스턴스가 닫힐 시
UGatrixClient::Get()->Stop();
```

---

## 📖 API 레퍼런스 가이드

### FeaturesClient (`UGatrixClient::Get()->GetFeatures()`)

| 메서드 | 설명 |
|---|---|
| `IsEnabled(flagName)` | `flag.enabled` 검증 |
| `BoolVariation(flagName, fallback)` | Boolean 배리언트 읽기 |
| `StringVariation(flagName, fallback)` | String 배리언트 읽기 |
| `IntVariation(flagName, fallback)` | Integer 배리언트 읽기 |
| `FloatVariation(flagName, fallback)` | Float 배리언트 읽기 |
| `GetVariant(flagName)` | 전체 Variant 구조체 가져들이기 |
| `GetFlag(flagName)` | `UGatrixFlagProxy` 객체로 접근 |
| `GetAllFlags()` | 모든 평가된 플래그 목록 쿼리 |
| `HasFlag(flagName)` | 특정 플래그가 캐시 상에 존재하는가 |
| `WatchRealtimeFlag...` | 실시간 변경 콜백 주입 |
| `WatchSyncedFlag...` | 동기화 후 안전한 콜백 주입 |
| `UnwatchFlag(handle)` | 핸들을 입력해 리스너 파기 |
| `CreateWatchGroup(name)` | 여러 개의 Watch를 동시에 관리 제어 |
| `SyncFlags(fetchNow)` | 대기 중인 모든 Pending 싱크 한 번에 반영 |
| `FetchFlags()` | 명시적 서버 Re-Fetch 지시 |

---

## 🍳 자주 쓰는 패턴

### 게임 속도 실시간 조작
```cpp
Features->WatchRealtimeFlagWithInitialState(TEXT("game-speed"), 
    FGatrixFlagWatchDelegate::CreateLambda([](UGatrixFlagProxy* Proxy)
{
    UGameplayStatics::SetGlobalTimeDilation(GetWorld(), Proxy->GetFloatValue(1.0f));
}));
```

### 로그인 흐름과 결합된 속성 변경 (Properties)
```cpp
void OnLoginComplete(FString UserId, int32 Level)
{
    FGatrixContext Ctx;
    Ctx.UserId = UserId;
    Ctx.Properties.Add(TEXT("level"), FString::FromInt(Level));
    
    UGatrixClient::Get()->GetFeatures()->UpdateContext(Ctx);
    // UserId와 Properties가 갱신되어, 변경된 규칙의 플래그들을 가져옵니다.
}
```

### 다중 플래그 간 의존성 그룹 묶기 (Watch Group)
```cpp
UGatrixWatchFlagGroup* Group = Features->CreateWatchGroup(TEXT("shop-system"));

FGatrixFlagWatchDelegate ShopCb;
ShopCb.BindLambda([](UGatrixFlagProxy* P){ SetShopEnabled(P->IsEnabled()); });
Group->WatchSyncedFlagWithInitialState(TEXT("new-shop-enabled"), ShopCb);

FGatrixFlagWatchDelegate DiscountCb;
DiscountCb.BindLambda([](UGatrixFlagProxy* P){ SetDiscount(P->GetFloatValue(0)); });
Group->WatchSyncedFlagWithInitialState(TEXT("shop-discount"), DiscountCb);

// 모두 반영 준비 완료! -> 로딩 지점과 같은 곳에서 Sync
Features->SyncFlags(false);

// 사용 완료된 그룹 통째로 파괴
Group->DestroyGroup();
```

---

## ❓ FAQ 및 트러블슈팅

### 1. 플래그가 변경되었지만 반영되지 않습니다.
- 혹시 `ExplicitSyncMode` 가 켜져있다면, 변경사항만 다운로드 된 채 `SyncFlags()` 메서드의 호출을 기다립니다. 반영 지점에서 호출해주세요!
- RefreshInterval(폴링) 주기가 길게 설정되어있다면 스트리밍을 켜거나, 폴링 주기를 줄이세요.

### 2. 콜백 메서드가 절대 동작하지 않습니다.
- `WatchSyncedFlag`를 사용했다면 (질문 1처럼) `Features->SyncFlags(false)` 를 호출해야 발동합니다.

### 3. 언리얼 에디터에 메모리 릭(Memory Leak)이 출력됩니다.
- 엑터가 파괴(Destroy)되는 시점에 반드시 `UnwatchFlag`나 그룹 해제(`DestroyGroup()`)를 사용해서 해당 리스너를 파기해주어야 메모리 누수가 발생하지 않습니다.
```cpp
void AMyActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (UGatrixClient* Client = UGatrixClient::Get())
        Client->GetFeatures()->UnwatchFlag(WatchHandle);

    Super::EndPlay(EndPlayReason);
}
```

---

## License

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](../../../../LICENSE) 파일을 참조하세요.
