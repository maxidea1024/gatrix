# Gatrix Cocos2d-x SDK (C++)

Cocos2d-x 게임 엔진을 위한 Gatrix 플랫폼 C++ SDK입니다.
[CLIENT_SDK_SPEC.md](../CLIENT_SDK_SPEC.md) 사양을 완전히 구현합니다.

## 주요 기능

- **CLIENT_SDK_SPEC 완전 준수**: 모든 필수 인터페이스 구현
- **Typed Variations**: `boolVariation`, `stringVariation`, `intVariation`, `floatVariation`, `doubleVariation`, `jsonVariation` (기본값 필수)
- **Variation Details**: `boolVariationDetails` 등 — 이유, 존재 여부, 활성화 여부 포함
- **OrThrow Variations**: 플래그 없거나 비활성화 시 예외 발생
- **FlagProxy**: 전체 속성 접근 (exists, enabled, name, variant 등)
- **Watch 패턴**: `watchFlag`, `watchFlagWithInitialState`, `WatchFlagGroup` 체인 API
- **명시적 동기화 모드**: `isExplicitSync`, `hasPendingSyncFlags`, `syncFlags`
- **이벤트 시스템**: `on`, `once`, `off`, `onAny`, `offAny` + 핸들러 통계 추적
- **스토리지 프로바이더**: `IStorageProvider` 인터페이스 + `InMemoryStorageProvider`
- **부트스트랩 지원**: 즉시 시작을 위한 사전 로드 플래그
- **ETag / 304 지원**: 대역폭 절감을 위한 조건부 페칭
- **임프레션 추적**: 플래그별 임프레션 이벤트
- **Cocos2d-x 통합**: 네트워킹에 `HttpClient`, 폴링에 `Scheduler` 사용

## 파일 구조

```
gatrix-cocos2dx-client-sdk/
├── include/
│   ├── GatrixClient.h          # 메인 엔트리 포인트 (싱글톤)
│   ├── GatrixFeaturesClient.h  # 피처 플래그 클라이언트 + WatchFlagGroup
│   ├── GatrixFlagProxy.h       # 플래그 접근 래퍼
│   ├── GatrixEventEmitter.h    # 이벤트 시스템 + 핸들러 통계
│   ├── GatrixEvents.h          # 이벤트 이름 상수 (EVENTS 구조체)
│   └── GatrixTypes.h           # 모든 데이터 타입, 설정, 에러, 스토리지
├── src/
│   ├── GatrixClient.cpp        # GatrixClient 구현
│   └── GatrixFeaturesClient.cpp # FeaturesClient + WatchFlagGroup 구현
├── test_stubs/                 # Cocos2d-x 없이 빌드 테스트용 스텁 헤더
│   └── build_verify.cpp        # API 표면 검증 테스트
├── CMakeLists.txt
└── README.md
```

## 설치

### 1. SDK 파일 복사
`include/`와 `src/` 디렉토리를 Cocos2d-x 프로젝트에 복사합니다.

### 2. CMakeLists.txt에 추가
```cmake
list(APPEND GAME_SOURCE
     Classes/gatrix/src/GatrixClient.cpp
     Classes/gatrix/src/GatrixFeaturesClient.cpp
)
list(APPEND GAME_HEADER
     Classes/gatrix/include/GatrixClient.h
     Classes/gatrix/include/GatrixFeaturesClient.h
     Classes/gatrix/include/GatrixFlagProxy.h
     Classes/gatrix/include/GatrixEventEmitter.h
     Classes/gatrix/include/GatrixEvents.h
     Classes/gatrix/include/GatrixTypes.h
)
```

## 빠른 시작

### 초기화 (AppDelegate.cpp)

```cpp
#include "GatrixClient.h"

bool AppDelegate::applicationDidFinishLaunching() {
    gatrix::GatrixClientConfig config;
    config.apiUrl = "https://edge.your-api.com/api/v1";
    config.apiToken = "your-client-token";
    config.appName = "my-game";
    config.environment = "production";
    config.features.refreshInterval = 30;

    auto* client = gatrix::GatrixClient::getInstance();
    client->init(config);
    client->start();

    return true;
}
```

### 피처 플래그 사용

```cpp
#include "GatrixClient.h"

auto* features = gatrix::GatrixClient::getInstance()->features();

// 기본 확인
if (features->isEnabled("new-boss")) {
    spawnBoss();
}

// 타입별 배리언트 (기본값 필수)
bool showTutorial = features->boolVariation("show-tutorial", true);
std::string theme = features->stringVariation("holiday-theme", "default");
double speed = features->floatVariation("game-speed", 1.0f);
int level = features->intVariation("start-level", 1);
double gravity = features->doubleVariation("gravity", 9.8);

// 배리언트 상세 (평가 이유 포함)
auto details = features->boolVariationDetails("premium-feature", false);
if (details.flagExists && details.enabled) {
    enablePremium();
}

// 엄격 모드 (플래그 없으면 GatrixFeatureError 발생)
try {
    double discount = features->doubleVariationOrThrow("discount-rate");
} catch (const gatrix::GatrixFeatureError& e) {
    // 누락/무효 플래그 처리
}
```

### FlagProxy

```cpp
features->watchFlagWithInitialState("special-offer", [](FlagProxy flag) {
  flag.exists();          // bool
  flag.enabled();         // bool
  flag.name();            // const string&
  flag.variant();         // Variant (null이 아님 - 폴백 반환)
  flag.variantType();     // VariantType enum
  flag.version();         // int
  flag.reason();          // const string&
  flag.impressionData();  // bool
  flag.raw();             // const EvaluatedFlag*

  // 프록시에서 배리언트 접근
  flag.boolVariation(false);
  flag.stringVariation("default");
  flag.intVariation(0);
  flag.floatVariation(0.0f);
  flag.doubleVariation(0.0);
  flag.jsonVariation("{}");

  // 프록시에서 상세 정보
  auto details = flag.boolVariationDetails(false);
  // details.value, details.reason, details.flagExists, details.enabled

  // 프록시에서 OrThrow
  flag.boolVariationOrThrow();
}, "special_offer_watcher");
```

### Watch 패턴

```cpp
// 변경 감시 (초기 상태 제외)
auto unwatch = features->watchFlag("my-feature", [](gatrix::FlagProxy flag) {
    updateUI(flag.enabled());
});

// 초기 상태 포함 감시
auto unwatchInit = features->watchFlagWithInitialState("my-feature", [](gatrix::FlagProxy flag) {
    updateUI(flag.enabled());
});

// 감시 중지
unwatch();
unwatchInit();

// Watch 그룹 (일괄 관리)
auto* group = features->createWatchFlagGroup("scene-flags");
group->watchFlag("flag-1", handler1)
     .watchFlag("flag-2", handler2)
     .watchFlagWithInitialState("flag-3", handler3);

// 한번에 모두 구독 해제
group->unwatchAll();
```

### 이벤트

```cpp
using namespace gatrix;

auto* client = GatrixClient::getInstance();

// 특정 이벤트 구독
client->on(EVENTS::FLAGS_READY, [](const std::vector<std::string>&) {
    CCLOG("SDK 준비 완료!");
});

client->on(EVENTS::FLAGS_CHANGE, [](const std::vector<std::string>&) {
    CCLOG("플래그 변경됨!");
});

// 모든 이벤트 구독 (디버깅용)
client->onAny([](const std::string& event, const std::vector<std::string>&) {
    CCLOG("이벤트: %s", event.c_str());
});

// 구독 해제
client->off(EVENTS::FLAGS_READY);
client->offAny();
```

### 명시적 동기화 모드

```cpp
gatrix::GatrixClientConfig config;
config.features.explicitSyncMode = true;
// ...

auto* features = client->features();

// 플래그는 백그라운드에서 페치되지만 아직 적용 안 됨
bool canSync = features->hasPendingSyncFlags(); // 보류 변경 있으면 true

// 안전한 시점에 적용 (예: 씬 전환)
features->syncFlags();

// 모드 확인
features->isExplicitSync(); // true
```

### 통계

```cpp
auto stats = features->getStats();
stats.totalFlagCount;       // 캐시의 총 플래그 수
stats.fetchFlagsCount;      // 페치 호출 횟수
stats.updateCount;          // 성공적 업데이트 횟수
stats.notModifiedCount;     // 304 응답 횟수
stats.errorCount;           // 총 에러 횟수
stats.recoveryCount;        // 에러 복구 횟수
stats.impressionCount;      // 전송된 임프레션 수
stats.contextChangeCount;   // 컨텍스트 업데이트 횟수
stats.syncFlagsCount;       // syncFlags 호출 횟수
stats.sdkState;             // SdkState enum
stats.missingFlags;         // map<string, int>
stats.flagEnabledCounts;    // map<string, FlagEnabledCount>
stats.flagVariantCounts;    // map<string, map<string, int>>
```

## 이벤트 상수

| 상수 | 값 |
|----------|-------|
| `EVENTS::FLAGS_INIT` | `"flags.init"` |
| `EVENTS::FLAGS_READY` | `"flags.ready"` |
| `EVENTS::FLAGS_FETCH` | `"flags.fetch"` |
| `EVENTS::FLAGS_FETCH_START` | `"flags.fetch_start"` |
| `EVENTS::FLAGS_FETCH_SUCCESS` | `"flags.fetch_success"` |
| `EVENTS::FLAGS_FETCH_ERROR` | `"flags.fetch_error"` |
| `EVENTS::FLAGS_FETCH_END` | `"flags.fetch_end"` |
| `EVENTS::FLAGS_CHANGE` | `"flags.change"` |
| `EVENTS::SDK_ERROR` | `"flags.error"` |
| `EVENTS::FLAGS_RECOVERED` | `"flags.recovered"` |
| `EVENTS::FLAGS_SYNC` | `"flags.sync"` |
| `EVENTS::FLAGS_IMPRESSION` | `"flags.impression"` |
| `EVENTS::FLAGS_METRICS_SENT` | `"flags.metrics.sent"` |
| `EVENTS::flagChange("name")` | `"flags.name.change"` |

## 라이선스

MIT
