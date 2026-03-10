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
    environment="production",
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
    environment="production",
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
    environment="production",
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
