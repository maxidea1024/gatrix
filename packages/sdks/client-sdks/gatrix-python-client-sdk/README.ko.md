# Gatrix Python Client SDK

[Gatrix](https://github.com/your-org/gatrix) 피처 플래그를 위한 Python 클라이언트 SDK입니다.

**런타임 의존성 제로** — Python 표준 라이브러리만 사용합니다 (`urllib`, `json`, `threading`, `dataclasses`).

## 요구 사항

- Python 3.9+

## 설치

```bash
pip install gatrix-python-client-sdk
```

## 빠른 시작

```python
from gatrix import GatrixClient, GatrixClientConfig, FeaturesConfig

client = GatrixClient(GatrixClientConfig(
    api_url="https://edge.example.com/api/v1",
    api_token="your-client-token",
    app_name="my-app",
))

client.start()

# 기능 활성화 여부 확인
if client.features.is_enabled("new-dashboard"):
    print("새 대시보드가 켜져 있습니다!")

# 타입별 배리언트 값 가져오기
color = client.features.string_variation("theme-color", "blue")
rate = client.features.number_variation("rate-limit", 100.0)
config = client.features.json_variation("ui-config", {"sidebar": True})

client.stop()
```

## 부트스트랩 / 오프라인 모드

```python
from gatrix import (
    GatrixClient, GatrixClientConfig, FeaturesConfig,
    EvaluatedFlag, Variant,
)

bootstrap_flags = [
    EvaluatedFlag(
        name="my-feature",
        enabled=True,
        variant=Variant(name="v1", enabled=True, payload="hello"),
        variant_type="string",
        version=1,
    ),
]

client = GatrixClient(GatrixClientConfig(
    api_url="https://edge.example.com/api/v1",
    api_token="your-token",
    app_name="my-app",
    offline_mode=True,
    features=FeaturesConfig(bootstrap=bootstrap_flags),
))

assert client.features.is_enabled("my-feature") is True
```

## 변경 감지 (Watch)

```python
from gatrix import EVENTS

# 특정 플래그 감시
unwatch = client.features.watch_flag("my-feature", lambda proxy: print(f"변경: {proxy.enabled}"))

# 초기 상태 포함 감시
client.features.watch_flag_with_initial_state("my-feature", lambda proxy: print(f"상태: {proxy.enabled}"))

# Watch 그룹
group = client.features.create_watch_flag_group("ui-flags")
group.watch_flag("sidebar", handler1)
group.watch_flag("theme", handler2)
group.unwatch_all()

# 글로벌 이벤트
client.on(EVENTS.FLAGS_READY, lambda: print("SDK 준비 완료!"))
client.on(EVENTS.FLAGS_CHANGE, lambda data: print(f"플래그 변경: {len(data['flags'])}개"))
```

## 명시적 동기화 모드

```python
client = GatrixClient(GatrixClientConfig(
    api_url="https://edge.example.com/api/v1",
    api_token="your-token",
    app_name="my-app",
    features=FeaturesConfig(explicit_sync_mode=True),
))

client.start()

# 플래그는 백그라운드에서 페치되지만 아직 적용되지 않음
# 안전한 시점에 적용 (예: 게임 라운드 사이)
if client.features.has_pending_sync_flags():
    client.features.sync_flags()
```

## 컨텍스트

```python
from gatrix import GatrixContext

client.features.update_context(GatrixContext(
    user_id="user-123",
    session_id="session-abc",
    properties={"plan": "premium", "level": 42},
))
```

## 통계

```python
stats = client.get_stats()
print(f"상태: {stats['sdk_state']}")
print(f"플래그: {stats['features']['total_flag_count']}")
print(f"누락: {stats['features']['missing_flags']}")
```

## 테스트 실행

```bash
pip install pytest
python -m pytest tests/ -v
```

## 라이선스

MIT

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

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.
