# @gatrix/flutter-sdk

Gatrix 플랫폼용 Flutter SDK입니다. 실시간 플래그 업데이트, 오프라인 캐싱, 임프레션 추적을 지원합니다.

## 설치

`pubspec.yaml`에 추가:

```yaml
dependencies:
  gatrix_flutter_client_sdk:
    path: ../gatrix-flutter_sdk
  shared_preferences: ^2.2.0
  http: ^1.1.0
```

## 빠른 시작

### 1. 클라이언트 초기화

```dart
final client = GatrixClient(
  GatrixClientConfig(
    apiUrl: 'https://your-gatrix-server.com/api/v1',
    apiToken: 'your-client-api-token',
    appName: 'my-app',
    refreshIntervalSeconds: 60, // 1분마다 자동 폴링
  ),
);
```

### 2. 위젯 트리에 클라이언트 제공

```dart
runApp(
  GatrixProvider(
    client: client,
    child: const MyApp(),
  ),
);
```

### 3. GatrixFlagBuilder로 반응형 UI

```dart
GatrixFlagBuilder(
  flagName: 'new-feature',
  builder: (context, flag) {
    // flag은 FlagProxy 객체
    return flag.enabled ? const NewWidget() : const OldWidget();
  },
)
```

## 주요 기능

- **오프라인 지원**: `shared_preferences`에 플래그를 자동 캐싱하여 즉시 시작.
- **임프레션 추적**: 플래그 접근을 Gatrix 서버에 자동 보고.
- **폴링 & 실시간**: `refreshIntervalSeconds` 기반 백그라운드 자동 갱신.
- **명시적 동기화**: `client.features.syncFlags()` 호출까지 변경 버퍼링 (선택).
- **타입 안전 Variations**: `bool`, `string`, `number`, `json` 전용 메서드.
- **상세 메타데이터**: `boolVariationDetails()` 등으로 평가 이유, 배리언트 상세 접근.

## API 레퍼런스

### GatrixClientConfig

| 파라미터 | 기본값 | 설명 |
|-----------|---------|-------------|
| `apiUrl` | (필수) | Gatrix 서버 기본 URL |
| `apiToken` | (필수) | 클라이언트 SDK 토큰 |
| `refreshIntervalSeconds` | 60 | 플래그 업데이트 폴링 간격 |
| `metricsIntervalSeconds` | 30 | 임프레션/누락 메트릭 보고 간격 |
| `explicitSyncMode` | true | true일 경우 수동 동기화까지 업데이트 버퍼링 |

### 플래그 접근 (`client.features`)

- `boolVariation(flagName, defaultValue)`
- `stringVariation(flagName, defaultValue)`
- `numberVariation(flagName, defaultValue)`
- `jsonVariation<T>(flagName, defaultValue)`
- `getFlag(flagName)` → `FlagProxy` 반환

### FlagProxy 속성

- `enabled`: boolean
- `variant.name`: string
- `variant.payload`: dynamic
- `reason`: 평가 이유
- `exists`: 서버에서 플래그 찾았는지 여부

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
