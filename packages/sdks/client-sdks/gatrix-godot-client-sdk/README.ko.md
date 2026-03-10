# Gatrix Godot SDK

Godot Engine 4.x용 Gatrix 클라이언트 SDK입니다 — 피처 플래그, 폴링, 캐싱, 컨텍스트, 메트릭 리포팅을 지원합니다.

## 설치

1. `addons/gatrix_sdk/` 폴더를 Godot 프로젝트의 `addons/` 디렉토리에 복사합니다.
2. Godot 에디터에서 **Project → Project Settings → Plugins**로 이동하여 **Gatrix SDK**를 활성화합니다.
3. `GatrixClient`가 오토로드 싱글톤으로 자동 등록됩니다.

## 빠른 시작

```gdscript
func _ready() -> void:
    var config := GatrixTypes.GatrixClientConfig.new()
    config.api_url = "http://localhost:3400/api/v1"
    config.api_token = "your-client-api-token"
    config.app_name = "MyGame"
    config.environment = "development"

    # 선택: 사용자 컨텍스트 설정
    config.features.context.user_id = "player-123"
    config.features.context.session_id = "session-abc"
    config.features.context.properties = { "platform": "windows", "version": "1.0.0" }

    GatrixClient.start(config, null, func(success: bool, error_msg: String):
        print("SDK 시작! success=", success)
    )

    # 또는: 이벤트로 준비 대기
    GatrixClient.once_event(GatrixEvents.FLAGS_READY, func():
        var features = GatrixClient.get_features()
        print("SDK 준비 완료!")
        print("기능 활성화: ", features.is_enabled("my-feature"))
    )
```

## 플래그 접근

모든 플래그 작업은 `GatrixClient.get_features()`를 통해 수행합니다:

```gdscript
var features = GatrixClient.get_features()

# 불리언 확인
if features.is_enabled("dark-mode"):
    apply_dark_mode()

# 타입별 배리언트 (기본값 필수)
var speed := features.float_variation("game-speed", 1.0)
var welcome := features.string_variation("welcome-message", "Hello!")
var ui_config = features.json_variation("ui-config", { "theme": "default" })

# FlagProxy로 상세 접근
var flag := features.get_flag("my-feature")
if flag.exists and flag.enabled:
    print("배리언트: ", flag.variant.name)
    print("값: ", flag.string_variation("fallback"))
```

## 배리언트 상세

```gdscript
var features = GatrixClient.get_features()
var result := features.bool_variation_details("my-flag", false)
print("값: ", result.value)
print("이유: ", result.reason)      # 예: "targeting_match"
print("존재: ", result.flag_exists)
print("활성: ", result.enabled)
```

## 엄격 배리언트 (OrThrow)

```gdscript
var features = GatrixClient.get_features()
# 플래그 없거나 비활성화이면 assert/에러 발생
var speed := features.float_variation_or_throw("game-speed")
var cfg = features.json_variation_or_throw("game-config")
```

## Watch 패턴

```gdscript
var features = GatrixClient.get_features()

# 플래그 변경 감시
var unwatch := features.watch_realtime_flag("my-feature", func(flag: GatrixFlagProxy):
    print("플래그 변경! 활성: ", flag.enabled)
)

# 초기 상태 포함 즉시 감시
var unwatch2 := features.watch_realtime_flag_with_initial_state("speed", func(flag: GatrixFlagProxy):
    player.speed = flag.float_variation(5.0)
)

# 감시 중지
unwatch.call()
```

## Watch 그룹

```gdscript
var features = GatrixClient.get_features()

# 여러 워처 일괄 관리
var group := GatrixWatchFlagGroup.new(features, "gameplay")

group.watch_flag("speed", func(flag: GatrixFlagProxy):
    player.speed = flag.float_variation(5.0)
).watch_flag("dark-mode", func(flag: GatrixFlagProxy):
    apply_theme("dark" if flag.enabled else "light")
)

# 씬 떠날 때 등 한번에 모두 해제
group.unwatch_all()
```

## 컨텍스트 관리

```gdscript
var features = GatrixClient.get_features()

# 컨텍스트 업데이트 (서버에서 리페치 트리거)
var ctx := GatrixTypes.GatrixContext.new()
ctx.user_id = "new-player-456"
ctx.properties = { "level": 10, "region": "us-west" }
features.update_context(ctx)
```

## 명시적 동기화 모드

```gdscript
# 게임플레이 중 플래그 변경 방지
var config := GatrixTypes.GatrixClientConfig.new()
config.features.explicit_sync_mode = true
# ... 기타 설정 ...

GatrixClient.start(config)

var features = GatrixClient.get_features()

# 플래그는 백그라운드에서 페치되지만 아래 호출까지 적용 안 됨:
if features.has_pending_sync_flags():
    features.sync_flags()  # 안전한 시점에 보류 변경 적용
```

## 이벤트

```gdscript
GatrixClient.on_event(GatrixEvents.FLAGS_READY, func():
    print("SDK 준비 완료!")
)

GatrixClient.on_event(GatrixEvents.FLAGS_CHANGE, func(data):
    print("플래그 변경: ", data)
)

GatrixClient.on_event(GatrixEvents.FLAGS_FETCH_ERROR, func(data):
    print("페치 에러: ", data)
)

# 모든 이벤트 구독 (디버깅용)
GatrixClient.on_any(func(event_name, args):
    print("[Gatrix 이벤트] ", event_name, " -> ", args)
)
```

### 사용 가능한 이벤트

| 상수 | 이벤트 이름 | 설명 |
|----------|-----------|-------------|
| `GatrixEvents.FLAGS_INIT` | `flags.init` | 스토리지/부트스트랩에서 SDK 초기화됨 |
| `GatrixEvents.FLAGS_READY` | `flags.ready` | 첫 번째 성공적 페치 완료 |
| `GatrixEvents.FLAGS_FETCH` | `flags.fetch` | 플래그 페칭 시작 |
| `GatrixEvents.FLAGS_FETCH_START` | `flags.fetch_start` | 페칭 시작 (별칭) |
| `GatrixEvents.FLAGS_FETCH_SUCCESS` | `flags.fetch_success` | 페치 성공 |
| `GatrixEvents.FLAGS_FETCH_ERROR` | `flags.fetch_error` | 페치 실패 |
| `GatrixEvents.FLAGS_FETCH_END` | `flags.fetch_end` | 페치 완료 |
| `GatrixEvents.FLAGS_CHANGE` | `flags.change` | 서버에서 플래그 변경 |
| `GatrixEvents.SDK_ERROR` | `flags.error` | 일반 SDK 에러 |
| `GatrixEvents.FLAGS_RECOVERED` | `flags.recovered` | 에러 상태에서 복구됨 |
| `GatrixEvents.FLAGS_SYNC` | `flags.sync` | 플래그 동기화됨 |
| `GatrixEvents.FLAGS_IMPRESSION` | `flags.impression` | 임프레션 추적됨 |
| `GatrixEvents.FLAGS_METRICS_SENT` | `flags.metrics.sent` | 메트릭 서버 전송됨 |

## 통계

```gdscript
var stats := GatrixClient.get_stats()
print("플래그: ", stats.total_flag_count)
print("페치: ", stats.fetch_flags_count)
print("업데이트: ", stats.update_count)
print("에러: ", stats.error_count)
print("누락: ", stats.missing_flags)
```

## 스토리지 프로바이더

```gdscript
# 기본: InMemoryStorageProvider (영속성 없음)
GatrixClient.start(config)

# 파일 기반 영속성 (게임에 권장)
var storage := GatrixStorageProvider.FileStorageProvider.new("user://gatrix/")
GatrixClient.start(config, storage)
```

## 설정 옵션

| 속성 | 타입 | 기본값 | 설명 |
|----------|------|---------|-------------|
| `api_url` | String | `http://localhost:3400/api/v1` | Edge API 기본 URL |
| `api_token` | String | **필수** | 클라이언트 API 토큰 |
| `app_name` | String | **필수** | 애플리케이션 이름 |
| `environment` | String | **필수** | 환경 (예: "production") |
| `custom_headers` | Dictionary | `{}` | 커스텀 HTTP 헤더 |
| `features.context` | GatrixContext | `null` | 초기 평가 컨텍스트 |
| `features.offline_mode` | bool | `false` | 오프라인 모드 시작 |
| `features.cache_key_prefix` | String | `gatrix_cache` | 캐시 키 접두사 |
| `features.refresh_interval` | float | `30.0` | 폴링 간격 (초) |
| `features.disable_refresh` | bool | `false` | 자동 폴링 비활성화 |
| `features.explicit_sync_mode` | bool | `true` | 명시적 동기화 모드 |
| `features.bootstrap` | Array | `[]` | 즉시 사용을 위한 초기 플래그 |
| `features.bootstrap_override` | bool | `true` | 저장된 플래그를 부트스트랩으로 덮어쓰기 |
| `features.disable_metrics` | bool | `false` | 메트릭 수집 비활성화 |
| `features.disable_stats` | bool | `false` | 로컬 통계 추적 비활성화 |
| `features.impression_data_all` | bool | `false` | 모든 플래그 임프레션 추적 |

## 요구 사항

- Godot Engine 4.x
- HTTPS 지원 (Godot 기본 활성화)

## 라이선스

MIT

## 📚 참고자료

**개념:**

- [Feature Toggles (aka Feature Flags)](https://martinfowler.com/articles/feature-toggles.html) — Martin Fowler
- [What are Feature Flags?](https://www.atlassian.com/continuous-delivery/principles/feature-flags) — Atlassian

**사례 모음:**

- [Progressive Experimentation with Feature Flags](https://learn.microsoft.com/en-us/devops/operate/progressive-experimentation-feature-flags) — Microsoft
- [Feature Flag Use Cases and Benefits](https://www.optimizely.com/optimization-glossary/feature-flags/) — Optimizely
- [Feature Flag Best Practices](https://posthog.com/blog/feature-flag-best-practices) — PostHog

## License

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.
