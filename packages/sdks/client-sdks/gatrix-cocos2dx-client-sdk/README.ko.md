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
  flag.valueType();      // ValueType enum
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

## 🎮 게임에서의 피처 플래그 활용

### 업계 사례

**Riot Games (League of Legends)**는 피처 플래그를 사용하여 실험적인 게임플레이 메커니즘을 특정 지역 서버에서 먼저 테스트한 후 글로벌로 배포합니다. 새로운 챔피언이나 밸런스 변경사항을 플래그 뒤에 배포하여, 전체 플레이어에게 노출하기 전에 데이터 기반으로 의사결정을 합니다.

**Supercell (Clash Royale, Brawl Stars)**은 피처 플래그 기반의 라이브 운영을 통해 시즌 이벤트, 한정 콘텐츠, IP 콜라보레이션을 관리합니다. 콘텐츠를 미리 배포해두고 정확한 시점에 활성화하며, 클라이언트 업데이트 없이 플레이어 데이터 기반으로 빠르게 반복합니다.

**GitHub**은 피처 플래그로 [코드를 더 빠르고 안전하게 배포하는 방법](https://github.blog/engineering/infrastructure/ship-code-faster-safer-feature-flags/)을 공개했습니다 — 배포 위험 감소, 내부 사용자 우선 테스트, 비율 기반 롤아웃 등. 게임 회사는 아니지만 이 패턴은 라이브 서비스 게임에 직접 적용할 수 있습니다.

**Slack**은 단계적 롤아웃(staging → dogfood → canary → percentage production)을 사용하는 [배포 프로세스를 공개](https://slack.engineering/deploys-at-slack/)했습니다. 이 패턴은 실제 플레이어 트래픽으로 변경사항을 검증해야 하는 멀티플레이어 게임에 매우 적합합니다.

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

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.
