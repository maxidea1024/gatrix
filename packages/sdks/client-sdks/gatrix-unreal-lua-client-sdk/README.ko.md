# Gatrix Lua SDK for Unreal Engine

> **피처 플래그, A/B 테스트, 원격 구성을 위한 Unreal Engine 공식 Gatrix Lua 바인딩입니다.**

Gatrix Unreal SDK를 위한 Lua 바인딩 플러그인입니다. **순수 Lua C API**(`lua_State*`)를 통해 피처 플래그, 배리언트, 컨텍스트, 이벤트, Watch를 Lua 스크립트에 노출합니다.

> 💡 피처 플래그에 대한 자세한 내용은 하단의 [📚 참고자료](#-참고자료)를 참조하세요.

### 💡 Quick Examples

#### 1. 피처 전환 (`IsEnabled`)

코드 배포 없이 기능을 즉시 켜거나 끌 수 있습니다.

```lua
if gatrix.Features.IsEnabled("new-shop") then
    -- 기능이 ON → 새 상점 UI 표시
    ShowNewShop()
end
```

#### 2. 원격 구성 (Typed Variations)

게임 밸런스 수치 등을 원격에서 조정합니다.

```lua
local Speed   = gatrix.Features.FloatVariation("game-speed", 1.0)
local Message = gatrix.Features.StringVariation("welcome-msg", "환영합니다")
local Dark    = gatrix.Features.BoolVariation("dark-mode", false)
```

#### 3. 실시간 변경 감지 (Watch)

```lua
gatrix.Features.WatchSyncedFlagWithInitialState("difficulty", function(Proxy)
    SetDifficulty(Proxy.Variant.Value)
end)
```

> 빌드도, 배포도 없이 — Gatrix 대시보드에서 값을 바꾸면 즉시 반영됩니다.

---

## 🤔 Gatrix를 사용해야 하는 이유

| Gatrix 없이 | Gatrix와 함께 |
|---|---|
| 값을 바꾸면 새 빌드 배포 | 대시보드에서 실시간 변경 |
| 모든 플레이어가 같은 경험 | A/B 테스트로 다양한 경험 제공 |
| 하드코딩된 피처 플래그 | 실시간 원격 구성 |
| 위험한 빅뱅 릴리즈 | 즉시 롤백 가능한 점진적 배포 |

### 🔑 주요 시나리오

- **📱 모바일/콘솔 심사 대응** — 기능을 비활성화한 채로 제출하고, 심사 통과 후 즉시 활성화.
- **⚖️ 규제 및 법규 준수** — 법규가 바뀔 때 특정 지역에서 기능을 즉시 비활성화 (GDPR 등).
- **🚨 긴급 킬 스위치** — 크래시를 유발하는 기능을 수초 이내에 비활성화. 핫픽스 빌드 불필요.
- **🔬 A/B 테스트** — 그룹별로 다른 배리언트를 제공하고 영향을 측정.
- **📅 출시 시점 미정** — 코드는 항상 준비되어 있고, 비즈니스에서 런칭 시점을 결정.

### 🚀 배포(Deploy)와 릴리즈(Release)의 분리

전통적으로 **배포**와 **릴리즈**는 동일한 것이었습니다 — 코드를 배포하면 사용자가 즉시 변경사항을 볼 수 있었습니다. 피처 플래그는 이 두 가지를 분리합니다:

| | 배포 (Deploy) | 릴리즈 (Release) |
|---|---|---|
| **무엇** | 코드를 프로덕션 서버에 푸시 | 사용자에게 기능을 노출 |
| **누가** | 엔지니어링 팀 | 프로덕트 / 비즈니스 팀 |
| **언제** | 언제든 (CI/CD) | 비즈니스가 결정할 때 |
| **리스크** | 낮음 (코드는 비활성 상태) | 제어됨 (점진적 배포) |

이로써 **매일 배포**하되 아무것도 릴리즈하지 않다가, 대시보드를 통해 **기능을 독립적으로 릴리즈**할 수 있습니다 — 빌드도, 배포도, 앱 스토어 심사도 필요 없습니다.

---

## 📐 평가 모델: 원격 평가 방식

Gatrix 클라이언트 SDK는 **원격 평가** 방식만을 사용합니다:

1. SDK가 **컨텍스트**(userId, properties)를 Gatrix 서버로 전송.
2. 서버가 모든 타겟팅 규칙을 **원격에서** 평가.
3. SDK는 **최종 평가된 플래그 값만** 수신 — 규칙은 클라이언트에 노출되지 않습니다.

| | 원격 평가 (Gatrix) | 로컬 평가 |
|---|---|---|
| **보안** | ✅ 규칙이 서버 밖으로 나가지 않음 | ⚠️ 규칙이 클라이언트에 노출 |
| **일관성** | ✅ 모든 SDK에서 동일한 결과 | ⚠️ 각 SDK가 로직을 재구현해야 함 |
| **페이로드** | ✅ 최종 값만 (소용량) | ⚠️ 전체 규칙 세트 (대용량) |
| **오프라인** | ⚠️ 캐시된 값 또는 부트스트랩 | ✅ 다운로드 후 완전 오프라인 |

> 🛡️ SDK는 마지막으로 알려진 값을 로컬에 캐시합니다. 네트워크 문제로 게임이 중단되는 일은 없습니다.

---

## 🔀 플래그 값 결정 흐름

### 값 소스 우선순위 (원격)

| 우선순위 | 조건 | 값 소스 | `variant.name` |
|:---:|---|---|:---|
| 1 | 플래그 활성 + 전략 매칭 | `variant.value` | 배리언트 이름 (예: `"dark-theme"`) |
| 2 | 플래그 활성 + 미매칭 + env 오버라이드 | `env.enabledValue` | `$env-default-enabled` |
| 3 | 플래그 활성 + 미매칭 + 오버라이드 없음 | `flag.enabledValue` | `$flag-default-enabled` |
| 4 | 플래그 비활성 + env 오버라이드 | `env.disabledValue` | `$env-default-disabled` |
| 5 | 플래그 비활성 + 오버라이드 없음 | `flag.disabledValue` | `$flag-default-disabled` |
| 6 | 플래그 없음 | 응답 없음 | `$missing` |

### FallbackValue가 필수인 이유

`FallbackValue` 파라미터는 설계상 **필수**입니다 — 게임은 **항상** 사용 가능한 값을 받습니다:

1. **SDK 미초기화** — 아직 연결 중 — 폴백이 게임을 계속 실행
2. **플래그 없음** — 오타 또는 삭제된 플래그 — 크래시 없음
3. **네트워크 실패** — 서버 없음, 캐시 없음 — 여전히 작동
4. **타입 불일치** — string 플래그에 `BoolVariation` 호출 — 안전한 기본값
5. **플래그 비활성** — 플래그가 꺼짐 — 배리언트 값이 아닌 폴백 반환

```lua
-- ⚠️ 기본값 없는 오버로드는 없습니다. 항상 폴백을 지정하세요.
local Speed = gatrix.Features.FloatVariation("game-speed", 1.0)
```

### IsEnabled vs BoolVariation

| 함수 | 반환값 | 목적 |
|---|---|---|
| `gatrix.Features.IsEnabled("flag")` | `flag.enabled` | 피처 플래그가 **켜져 있는가**? |
| `gatrix.Features.BoolVariation("flag", false)` | `variant.value` as boolean | 플래그가 평가한 **boolean 값**은? |

```lua
-- 플래그가 활성화되어 있지만 boolean 값은 false일 수 있습니다!
local IsOn = gatrix.Features.IsEnabled("my-flag")             -- true (플래그 켜짐)
local Value = gatrix.Features.BoolVariation("my-flag", true)   -- false (설정된 값)
```

---

## 플러그인 구조

```
gatrix-unreal-lua-client-sdk/
├── GatrixLuaClientSDK.uplugin
├── README.md
├── README.ko.md
└── Source/GatrixLuaClientSDK/
    ├── GatrixLuaClientSDK.Build.cs
    ├── Public/
    │   ├── GatrixLuaClientSDKModule.h
    │   └── LuaGatrix.h
    └── Private/
        ├── GatrixLuaClientSDKModule.cpp
        └── LuaGatrix.cpp
```

## 통합 방법

### 1. 프로젝트에 플러그인 추가

`gatrix-unreal-lua-client-sdk` 폴더를 프로젝트의 `Plugins/` 디렉토리에 복사합니다.

### 2. 플러그인 의존성 추가

```csharp
PublicDependencyModuleNames.AddRange(new string[] {
    "GatrixClientSDK",
    "GatrixLuaClientSDK"
});
```

### 3. C++에서 등록

```cpp
#include "LuaGatrix.h"

FGatrixLuaBindings::Register(YourLuaState);   // Lua VM 준비 후
FGatrixLuaBindings::Unregister(YourLuaState); // lua_close() 전에 반드시 호출
```

---

## Lua API 레퍼런스

> **API 구조:**
> - `gatrix.*` — 라이프사이클, 컨텍스트, 이벤트 (SDK 레벨)
> - `gatrix.Features.*` — 피처 플래그, 배리언트, watch, sync

### 라이프사이클

```lua
gatrix.Init({
    ApiUrl          = "http://host/api/v1",
    ApiToken        = "your-client-token",
    AppName         = "my-game",

    EnableDevMode    = false,  -- 상세 디버그 로깅
    Features        = {        -- 피처 플래그 설정
        OfflineMode      = false,  -- 네트워크 요청 없이 시작
        RefreshInterval  = 30,     -- 폴링 간격 (초, 기본값: 30)
        DisableRefresh   = false,  -- 자동 폴링 비활성화
        ExplicitSyncMode = true,   -- 명시적 동기화 모드 (기본값: true)
        DisableMetrics   = false,  -- 메트릭 비활성화
        ImpressionDataAll = false, -- 모든 플래그 임프레션 추적
    }
})

gatrix.Start()  -- 페칭, 폴링, 메트릭 시작
gatrix.Stop()   -- 중지 및 정리
```

### Promise (Deferred) 체이닝

`deferred` Lua 모듈이 있을 때 `gatrix.Start()`와 `FetchFlags()`는 promise 객체를 반환합니다:

```lua
gatrix.Start()
    :next(function()
        print("SDK 준비 완료!")
        local speed = gatrix.Features.FloatVariation("game-speed", 1.0)
    end)
    :catch(function(err)
        print("시작 실패:", err)
    end)
```

> 💡 `deferred` 모듈이 없으면 `Start()`는 `nil`을 반환합니다. `gatrix.Once("flags.ready", ...)`를 폴백으로 사용하세요.

### 플래그 접근 (`gatrix.Features`)

```lua
local Enabled     = gatrix.Features.IsEnabled("my_flag")
local Enabled     = gatrix.Features.IsEnabled("my_flag", true)   -- forceRealtime
local VariantName = gatrix.Features.Variation("my_flag", "default")
local VariantName = gatrix.Features.Variation("my_flag", "default", true)
local Flag        = gatrix.Features.GetFlag("my_flag")
local Flag        = gatrix.Features.GetFlag("my_flag", true)
local Variant     = gatrix.Features.GetVariant("my_flag")
local Variant     = gatrix.Features.GetVariant("my_flag", true)
local AllFlags    = gatrix.Features.GetAllFlags()
local AllFlags    = gatrix.Features.GetAllFlags(true)
local Exists      = gatrix.Features.HasFlag("my_flag")
local Exists      = gatrix.Features.HasFlag("my_flag", true)
```

### Typed Variations (`gatrix.Features`)

```lua
local BoolVal  = gatrix.Features.BoolVariation("flag", false)
local BoolVal  = gatrix.Features.BoolVariation("flag", false, true)   -- forceRealtime
local StrVal   = gatrix.Features.StringVariation("flag", "default")
local StrVal   = gatrix.Features.StringVariation("flag", "default", true)
local IntVal   = gatrix.Features.IntVariation("flag", 0)
local IntVal   = gatrix.Features.IntVariation("flag", 0, true)
local FloatVal = gatrix.Features.FloatVariation("flag", 0.0)
local FloatVal = gatrix.Features.FloatVariation("flag", 0.0, true)

-- 상세 결과 (이유 포함)
local Result = gatrix.Features.BoolVariationDetails("flag", false)
local Result = gatrix.Features.BoolVariationDetails("flag", false, true)

-- 없거나 타입 불일치 시 Lua 에러
local MustExist = gatrix.Features.BoolVariationOrThrow("critical_flag")
local MustExist = gatrix.Features.BoolVariationOrThrow("critical_flag", true)
```

### 반환 테이블 형태

> **`Variant.Value`는 `ValueType`에 따라 네이티브 Lua 타입으로 자동 변환됩니다.**

**ValueType 열거형:**

| 값 | 타입 | `Value`의 Lua 타입 |
|---|---|---|
| `0` | string | `string` |
| `1` | number | `number` |
| `2` | boolean | `boolean` |
| `3` | json | `string` (JSON 인코딩, `json.decode(Value)` 사용) |

**Variant:**

| 필드 | 타입 | 설명 |
|---|---|---|
| `Name` | `string` | 배리언트 이름 (예: `"dark-theme"`, `"$flag-default-enabled"`) |
| `Enabled` | `boolean` | 활성 상태 여부 |
| `Value` | `boolean` / `number` / `string` | ValueType 기반 자동 타입 결정 |

**EvaluatedFlag:**

| 필드 | 타입 | 설명 |
|---|---|---|
| `Name` | `string` | 플래그 이름 |
| `Enabled` | `boolean` | 플래그 활성화 여부 |
| `Variant` | `Variant` | 배리언트 서브 테이블 |
| `ValueType` | `integer` | `0`=string, `1`=number, `2`=boolean, `3`=json |
| `Version` | `integer` | 플래그 버전 |
| `Reason` | `string` | 평가 이유 |
| `ImpressionData` | `boolean` | 임프레션 추적 여부 |

**FlagProxy** (watch 콜백):

| 필드 | 타입 | 설명 |
|---|---|---|
| `Name` | `string` | 플래그 이름 |
| `Enabled` | `boolean` | 활성화 여부 |
| `Exists` | `boolean` | 캐시 존재 여부 |
| `Realtime` | `boolean` | 리얼타임 저장소에서 읽는지 여부 |
| `Variant` | `Variant` | 배리언트 서브 테이블 |
| `ValueType` | `integer` | 값 타입 |
| `Version` | `integer` | 버전 |
| `Reason` | `string` | 평가 이유 |

### 예약된 배리언트 이름

| 배리언트 이름 | 의미 | `Enabled` | 발생 시점 |
|:---|---|:---:|---|
| `$missing` | 캐시에 플래그 없음 | `false` | 오타, 미생성, SDK 미초기화 |
| `$type-mismatch` | 타입 불일치 | `false` | string 플래그에 BoolVariation 등 |
| `$env-default-enabled` | 활성, 환경 레벨 enabledValue | `true` | 매칭 없음 + env 오버라이드 |
| `$flag-default-enabled` | 활성, 플래그 레벨 enabledValue | `true` | 매칭 없음 + 오버라이드 없음 |
| `$env-default-disabled` | 비활성, 환경 레벨 disabledValue | `false` | 비활성 + env 오버라이드 |
| `$flag-default-disabled` | 비활성, 플래그 레벨 disabledValue | `false` | 비활성 + 오버라이드 없음 |
| *(사용자 정의)* | 타겟팅 전략이 선택한 배리언트 | `true` | 전략 매칭됨 |

### 컨텍스트

#### 컨텍스트란 무엇인가요?

**컨텍스트(Context)**는 현재 사용자를 설명하는 속성 집합으로, SDK가 플래그 평가 요청 시 서버로 전송합니다. 서버는 컨텍스트를 기반으로 타겟팅 규칙을 평가하여 각 사용자에게 어떤 배리언트를 반환할지 결정합니다.

**컨텍스트가 사용되는 곳:**

- **사용자 타겟팅** — 한국 사용자에게 기능 A, 일본 사용자에게 기능 B를 표시
- **점진적 배포** — `UserId` 기준으로 10%의 사용자에게만 기능 활성화
- **A/B 테스트** — 사용자 속성에 따라 실험 그룹 배정
- **세그먼테이션** — `Properties`를 통해 무료/프리미엄 사용자에게 다른 경험 제공

> 💡 컨텍스트는 매 fetch 시 서버로 전송됩니다. 서버가 모든 타겟팅 규칙을 평가하고 최종 플래그 값만 반환합니다 — 규칙은 클라이언트에 노출되지 않습니다.

#### 컨텍스트 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `AppName` | `string` | 앱 이름 (초기화 시 결정, 변경 불가) |
| `UserId` | `string` | 고유 식별자 — 타겟팅에서 가장 중요한 ID |
| `SessionId` | `string` | 세션 범위 스코핑을 위한 임시 ID |
| `CurrentTime` | `string` | ISO 8601 형식의 현재 시각 |
| `Properties` | `table` | 타겟팅 규칙에 사용할 커스텀 키-값 쌍 |

#### 컨텍스트 업데이트

```lua
gatrix.UpdateContext({
    UserId      = "user123",
    SessionId   = "sess456",
    Properties  = { Role = "admin", Tier = "premium" },
})

local Ctx = gatrix.GetContext()
```

> ⚠️ 컨텍스트의 모든 업데이트는 자동 re-fetch를 유발합니다. Tick과 같은 빠른 루프에서 호출하지 마세요. 여러 필드를 업데이트할 때는 하나의 테이블로 한 번에 갱신하세요.

### 이벤트

```lua
local Handle = gatrix.On("flags.ready", function(Args)
    print("준비 완료!")
end)

gatrix.Once("flags.change", function(Args) end)
gatrix.Off(Handle)

local AnyHandle = gatrix.OnAny(function(EventName, Args)
    print("이벤트:", EventName)
end)
gatrix.OffAny(AnyHandle)
```

**사용 가능한 이벤트:**

| 이벤트 | 설명 |
|---|---|
| `flags.init` | SDK 초기화됨 |
| `flags.ready` | 첫 페치 완료 |
| `flags.fetch_start` / `flags.fetch_success` / `flags.fetch_error` / `flags.fetch_end` | 페치 상태 |
| `flags.change` | 서버에서 플래그 변경 |
| `flags.change:<flagName>` | 특정 플래그 변경 |
| `flags.error` | SDK 에러 |
| `flags.impression` | 플래그 접근 (impressionData 활성 시) |
| `flags.sync` | 플래그 동기화됨 |
| `flags.pending_sync` | 보류 중인 동기화 가능 |
| `flags.recovered` | 에러에서 복구됨 |
| `flags.streaming_connected` / `flags.streaming_disconnected` / `flags.streaming_error` | 스트리밍 상태 |
| `flags.invalidated` | 스트리밍에 의해 무효화됨 |

### Watch (`gatrix.Features`)

#### 리얼타임 Watch

서버 페치 즉시 콜백 실행. `ExplicitSyncMode`와 무관합니다.

```lua
local Handle = gatrix.Features.WatchRealtimeFlag("my_flag", function(Proxy)
    print("변경:", Proxy.Name, Proxy.Enabled)
end)

-- 초기 상태 포함 (현재 값으로 즉시 + 변경 시 재실행)
local Handle2 = gatrix.Features.WatchRealtimeFlagWithInitialState("my_flag", function(Proxy)
    print("초기 + 변경:", Proxy.Name, Proxy.Enabled)
end)
```

#### 동기화 Watch

`ExplicitSyncMode` 활성화 시 `SyncFlags()` 이후에만 콜백 실행.

```lua
local Handle3 = gatrix.Features.WatchSyncedFlag("my_flag", function(Proxy)
    print("동기화:", Proxy.Variant.Value)
end)

local Handle4 = gatrix.Features.WatchSyncedFlagWithInitialState("my_flag", function(Proxy)
    print("초기 동기화:", Proxy.Variant.Value)
end)

gatrix.Features.UnwatchFlag(Handle)
```

#### 리얼타임 vs 동기화 — 언제 무엇을 쓸 것인가?

| | 리얼타임 | 동기화 |
|---|---|---|
| **콜백 타이밍** | 페치 즉시 | `SyncFlags()` 이후 |
| **사용 사례** | 디버그 UI, 모니터링 | 타이밍 제어가 필요한 게임플레이 값 |
| **ExplicitSyncMode 꺼짐** | 변경 시 실행 | 변경 시 실행 (동일) |
| **ExplicitSyncMode 켜짐** | 변경 시 실행 | `SyncFlags()` 이후에만 |

#### ⏱️ ExplicitSyncMode

게임플레이 중 플래그 변경을 즉시 적용하면 문제가 생길 수 있습니다:

| 문제 | 예시 |
|---|---|
| **게임플레이 방해** | 보스 싸움 중 적 HP 변경 |
| **의존성 충돌** | 데이터 로드 전 UI 레이아웃 변경 |
| **경쟁 무결성** | 매치 중 파라미터 변경 |

```lua
gatrix.Init({ ExplicitSyncMode = true, --[[ ... ]] })

-- 게임플레이 중요 값: 동기화 Watch
gatrix.Features.WatchSyncedFlagWithInitialState("difficulty", function(Proxy)
    SetDifficulty(Proxy.Variant.Value)  -- SyncFlags() 이후에만 실행
end)

-- 디버그/모니터링: 리얼타임 Watch
gatrix.Features.WatchRealtimeFlagWithInitialState("debug_overlay", function(Proxy)
    ToggleDebugOverlay(Proxy.Enabled)
end)

-- 안전한 시점에 적용 (로딩 화면, 라운드 사이)
gatrix.Features.SyncFlags()
```

> 💡 플래그 변경이 플레이어 경험을 방해할 수 있다면 **동기화** 모드를 사용하고, 자연스러운 전환 시점에 `SyncFlags()`를 호출하세요.

> ⚠️ `ExplicitSyncMode`가 비활성화된 경우, 두 Watch 방식은 **동일하게** 동작합니다. 참고: `ExplicitSyncMode`는 **기본적으로 활성화**되어 있습니다.

### Watch Group (`gatrix.Features`)

```lua
local Group = gatrix.Features.CreateWatchGroup("ui-flags")

Group
    :WatchRealtimeFlag("dark-mode", function(Proxy) end)
    :WatchSyncedFlag("show-ads", function(Proxy) end)
    :WatchRealtimeFlagWithInitialState("new-ui", function(Proxy) end)

print(Group:GetName())  -- "ui-flags"
print(Group:Size())     -- 3

Group:UnwatchAll()  -- 모든 Watch 해제
Group:Destroy()     -- 해제 + 메모리 정리
```

### 상태 & 동기화 (`gatrix.Features`)

```lua
local Ready       = gatrix.Features.IsReady()
local Initialized = gatrix.Features.IsInitialized()

gatrix.Features.FetchFlags()      -- 서버에서 강제 페치
gatrix.Features.SyncFlags(true)   -- explicitSyncMode에서 동기화
```

---

## 메모리 안전성

모든 콜백은 `TSharedPtr<bool>` alive 플래그를 캡처합니다:

1. `Register()`가 `bAlive = true`인 세션 생성
2. 모든 콜백이 shared pointer 사본 보유
3. `Unregister()` / `Stop()`이 `*bAlive = false` 설정 후 정리
4. 진행 중인 콜백이 `lua_State*` 접근 전 alive 확인
5. 모든 `luaL_ref`가 추적되고 정리 시 `luaL_unref` 보장

---

## 🍳 자주 쓰는 패턴

### 게임 속도 조정

```lua
gatrix.Features.WatchRealtimeFlagWithInitialState("game-speed", function(Proxy)
    UE.SetTimeScale(Proxy.Variant.Value)
end)
```

### 시즌 이벤트 전환

```lua
gatrix.Features.WatchRealtimeFlagWithInitialState("winter-event", function(Proxy)
    SetWinterEventActive(Proxy.Enabled)
end)
```

### A/B 테스트 UI 텍스트

```lua
gatrix.Features.WatchRealtimeFlagWithInitialState("cta-button-text", function(Proxy)
    SetButtonText(Proxy.Variant.Value)
end)
```

### 제어된 게임플레이 업데이트 (Explicit Sync)

```lua
gatrix.Features.WatchSyncedFlagWithInitialState("enemy-hp-multiplier", function(Proxy)
    SetEnemyHpMultiplier(Proxy.Variant.Value)
end)
gatrix.Features.SyncFlags()
```

### Watch Group으로 다중 플래그 관리

```lua
local Group = gatrix.Features.CreateWatchGroup("shop-system")
Group
    :WatchSyncedFlagWithInitialState("new-shop-enabled", function(Proxy)
        SetShopEnabled(Proxy.Enabled)
    end)
    :WatchSyncedFlagWithInitialState("discount-rate", function(Proxy)
        SetDiscountRate(Proxy.Variant.Value)
    end)
-- 두 플래그가 동기화 시점에 함께 적용됨
```

---

## ❓ FAQ & 문제 해결

### 1. 플래그 변경이 실시간으로 감지되지 않음

| 원인 | 해결책 |
|-------|----------|
| 폴링 간격이 너무 김 | `RefreshInterval` 감소 (기본값: 30초) |
| `ExplicitSyncMode` 활성화됨 | `SyncFlags()` 호출 |
| `WatchSyncedFlag` 사용 중 | `WatchRealtimeFlag`로 변경 |
| `OfflineMode` 활성화됨 | `Features.OfflineMode = false` 설정 |

### 2. `WatchSyncedFlag` 콜백이 실행되지 않음

`ExplicitSyncMode = true` 설정 후 `SyncFlags()` 호출이 필요합니다.

```lua
gatrix.Init({ ExplicitSyncMode = true })
gatrix.Features.WatchSyncedFlagWithInitialState("my-flag", function(Proxy) end)
gatrix.Features.SyncFlags()
```

### 3. 초기화 후 플래그가 폴백 값을 반환함

| 원인 | 해결책 |
|-------|----------|
| SDK 아직 준비 안 됨 | `flags.ready` 이벤트 기다리기 |
| 잘못된 `AppName` | 대시보드 설정과 일치 확인 |
| 이 환경에 플래그 미할당 | 대시보드에서 확인 |

```lua
gatrix.Once("flags.ready", function()
    print("준비:", gatrix.Features.IsEnabled("my-flag"))
end)
```

### 4. 메모리 누수 (Lua 콜백)

`lua_close()` 전에 반드시 `Unregister()` 호출:

```cpp
FGatrixLuaBindings::Unregister(YourLuaState);
lua_close(YourLuaState);
```

### 5. WatchGroup 콜백이 계속 실행됨

```lua
Group:Destroy()  -- 명시적 정리 (권장, GC 의존 금지)
```

## 📚 참고자료

- [Feature Flags — What Are They?](https://launchdarkly.com/feature-flags/) — LaunchDarkly
- [Feature Flags Best Practices](https://www.flagship.io/feature-flags-best-practices/) — Flagship
- [Separating Deploys from Releases](https://devcycle.com/blog/separating-deployments-from-releases-with-feature-flags) — DevCycle
- [Feature Toggles (aka Feature Flags)](https://martinfowler.com/articles/feature-toggles.html) — Martin Fowler

## License

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](../../../../LICENSE) 파일을 참조하세요.
