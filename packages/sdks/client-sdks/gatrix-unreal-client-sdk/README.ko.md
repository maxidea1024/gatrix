# Gatrix Unreal SDK

> **피처 플래그, A/B 테스트, 원격 구성을 위한 Unreal Engine 공식 Gatrix SDK입니다.**

새 빌드를 배포하지 않고도 게임의 동작을 실시간으로 바꿀 수 있습니다. 피처 토글, A/B 실험, 게임 파라미터 튜닝, 점진적 롤아웃 — 모든 것을 Gatrix 대시보드에서 실행할 수 있습니다.

## 🚩 피처 플래그란?

피처 플래그는 두 가지 요소로 구성됩니다.

| 요소 | 타입 | 설명 |
|---|---|---|
| **상태** (`enabled`) | `bool` | 기능이 켜져 있는가, 꺼져 있는가 — `IsEnabled()`로 확인 |
| **값** (`variant`) | `boolean` `string` `number` `json` | 세부적인 구성 값 — `BoolVariation()`, `StringVariation()`, `FloatVariation()` 등으로 확인 |

플래그는 **활성화 상태와 값을 동시에 가질 수 있습니다** (예: `difficulty = "hard"`). 상태와 값은 독립적이므로, 둘 다 확인해야 합니다.

> 💡 피처 플래그에 대한 자세한 내용은 하단의 [📚 참고자료](#-참고자료)를 참조하세요.

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

### 🚀 배포(Deploy)와 릴리즈(Release)의 분리

전통적으로 **배포**와 **릴리즈**는 동일한 것이었습니다 — 코드를 배포하면 사용자가 즉시 변경사항을 볼 수 있었습니다. 피처 플래그는 이 두 가지를 분리합니다:

| | 배포 (Deploy) | 릴리즈 (Release) |
|---|---|---|
| **무엇** | 코드를 프로덕션 서버에 푸시 | 사용자에게 기능을 노출 |
| **누가** | 엔지니어링 팀 | 프로덕트 / 비즈니스 팀 |
| **언제** | 언제든 (CI/CD) | 비즈니스가 결정할 때 |
| **리스크** | 낮음 (코드는 비활성 상태) | 제어됨 (점진적 배포) |

이로써 **매일 배포**하되 아무것도 릴리즈하지 않다가, 대시보드를 통해 **기능을 독립적으로 릴리즈**할 수 있습니다 — 빌드도, 배포도, 앱 스토어 심사도 필요 없습니다.

### 🌳 Trunk-Based Development와 피처 플래그

피처 플래그는 모든 개발자가 하나의 메인 브랜치에 커밋하는 브랜칭 전략인 **Trunk-Based Development(TBD)**의 자연스러운 동반자입니다.

| 전통적 브랜칭 | Trunk-Based + 피처 플래그 |
|---|---|
| 장기 피처 브랜치 유지 | 모든 커밋은 main/trunk으로 |
| 고통스러운 머지 충돌 | 작고 빈번한 머지 |
| 브랜치 머지 전까지 기능 차단 | 미완성 기능은 플래그 뒤에 숨김 |
| 릴리즈 = 브랜치 머지 | 릴리즈 = 대시보드에서 플래그 켜기 |

피처 플래그를 사용하면 개발자들이 미완성된 기능을 플래그로 감싸서 메인 브랜치에 직접 커밋할 수 있습니다. 코드는 배포되지만 비활성 상태로 유지되어, 장기 브랜치와 머지 충돌을 피하면서도 기능 노출 시점을 제어할 수 있습니다.

> 💡 피처 플래그는 **진정한 지속적 통합(CI)**을 가능하게 합니다 — 매일 trunk에 커밋하고, 언제든 배포하고, 준비되면 릴리즈하세요.

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

## 🎮 게임에서의 피처 플래그 활용

### 업계 사례

**GitHub** — 피처 플래그로 [코드를 더 빠르고 안전하게 배포하는 방법](https://github.blog/engineering/infrastructure/ship-code-faster-safer-feature-flags/)을 공개했습니다 — 배포 위험 감소, 내부 사용자 우선 테스트, 비율 기반 롤아웃 등. 게임 회사는 아니지만 이 패턴은 라이브 서비스 게임에 직접 적용할 수 있습니다.

**Slack** — 단계적 롤아웃(staging → dogfood → canary → percentage production)을 사용하는 [배포 프로세스를 공개](https://slack.engineering/deploys-at-slack/)했습니다. 이 패턴은 실제 플레이어 트래픽으로 변경사항을 검증해야 하는 멀티플레이어 게임에 매우 적합합니다.

### 실제 활용 시나리오

| 시나리오 | 피처 플래그가 도움이 되는 방법 |
|---|---|
| **라이브 밸런스 튜닝** | 무기 데미지, 드롭률, 적 HP 등을 패치 없이 원격으로 조정 |
| **시즌 이벤트** | 홀리데이 콘텐츠를 미리 배포해두고, 정확한 시점에 활성화 |
| **앱 스토어 / 콘솔 심사** | 새 기능을 숨긴 채로 제출하고, 승인 후 활성화 — 추가 심사 불필요 |
| **긴급 킬 스위치** | 크래시를 유발하는 기능을 수초 내에 비활성화, 핫픽스 빌드 불필요 |
| **A/B 테스트** | 두 가지 난이도 커브를 다른 플레이어 그룹으로 테스트하고 리텐션 측정 |
| **점진적 배포** | 새 게임 모드를 5% 플레이어에게 먼저 배포하고, 크래시 모니터링 후 확대 |
| **토너먼트 / e스포츠** | 경콁 매치 중 게임 파라미터 고정, 매치 중 변경 방지 |

### ⚠️ 게임 개발 시 주의사항

| 함정 | 권장사항 |
|---|---|
| **게임플레이 중 플래그 변경** | `ExplicitSyncMode`를 사용하여 변경을 버퍼링하고 안전한 시점(로딩 화면, 라운드 사이)에 적용 |
| **네트워크 의존성** | SDK는 마지막으로 알려진 값을 로컬에 캐시 — 서버에 연결할 수 없어도 게임은 계속 작동 |
| **너무 많은 플래그** | 영향력이 큰 값(난이도, 경제, 기능)부터 시작. 모든 상수를 플래그로 만들지 말 것 |
| **플래그 정리** | 영구 적용 후에는 플래그 제거. 남은 플래그는 기술 부채가 됨 |
| **결정적 멀티플레이어** | 동일 세션의 모든 클라이언트가 같은 플래그 값을 보도록 보장. `UserId`로 일관된 할당 |
| **성능 민감 경로** | 타이트 루프(Update/Tick)에서 플래그 조회 피할 것. 세션 시작 또는 싱크 시점에 값을 캐시 |

### 💻 코드 베스트 프랙티스

플래그 체크를 코드 곳곳에 흐려놓으면 코드가 난잡해지고 유지보수가 어려워집니다. Martin Fowler는 [Feature Toggles](https://martinfowler.com/articles/feature-toggles.html)에서 플래그 로직을 깔끔하게 유지하는 패턴들을 설명합니다:

| 실천 항목 | 설명 |
|---|---|
| **토글 포인트 최소화** | 각 플래그는 [가능한 적은 곳에서만 체크](https://posthog.com/blog/feature-flag-best-practices)하세요. 여러 곳에서 반복 체크하지 말고, 하나의 함수로 감싸세요 |
| **결정과 로직 분리** | 게임 로직에 플래그 체크를 직접 넣지 마세요. 플래그를 이름이 있는 결정으로 매핑하는 `FeatureDecisions` 레이어를 만드세요 (예: `ShouldUseBetaUI()`) |
| **Strategy / Proxy 패턴 사용** | `if (flag) doA() else doB()`를 곳곳에 두지 말고, 초기화 시 플래그에 따라 구현체를 교체하세요. 호출 지점마다가 아닌 한 번만 |
| **엣지에서 토글** | 플래그 체크는 가장 바깥 레이어(UI, 씨 초기화)에 두세요. 코어 게임 로직은 플래그 없이 유지하세요 |
| **플래그 재고 관리** | 플래그는 유지 비용이 드는 재고로 취급하세요. 만료일을 정하고, 영구 적용 후에는 제거하세요 — [Knight Capital의 4억5천만 달러 손실](http://dougseven.com/2014/04/17/knightmare-a-devops-cautionary-tale/)은 관리되지 않은 플래그의 위험을 보여줍니다 |
| **세션 시작 시 캐싱** | 안전한 시점(세션 시작, 로딩 화면)에 플래그 값을 한 번 읽고, 해당 값을 시스템에 전달하세요. 핫 경로에서 SDK를 반복 호출하지 마세요 |

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

## 📚 참고자료

**개념:**

- [Feature Toggles (aka Feature Flags)](https://martinfowler.com/articles/feature-toggles.html) — Martin Fowler
- [What are Feature Flags?](https://www.atlassian.com/continuous-delivery/principles/feature-flags) — Atlassian

**사례 모음:**

- [How We Ship Code Faster and Safer with Feature Flags](https://github.blog/engineering/infrastructure/ship-code-faster-safer-feature-flags/) — GitHub Engineering
- [Deploys at Slack](https://slack.engineering/deploys-at-slack/) — Slack Engineering
- [Preparing the Netflix API for Deployment](https://netflixtechblog.com/preparing-the-netflix-api-for-deployment-786d8f58090d) — Netflix Tech Blog
- [Progressive Experimentation with Feature Flags](https://learn.microsoft.com/en-us/devops/operate/progressive-experimentation-feature-flags) — Microsoft

**Trunk-Based Development:**

- [Feature Flags in Trunk-Based Development](https://trunkbaseddevelopment.com/feature-flags/) — trunkbaseddevelopment.com
- [Trunk-Based Development Best Practices](https://www.atlassian.com/continuous-delivery/continuous-integration/trunk-based-development) — Atlassian

## License

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](../../../../LICENSE) 파일을 참조하세요.
