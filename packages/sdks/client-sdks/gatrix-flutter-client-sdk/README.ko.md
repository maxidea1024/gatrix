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
    environment: 'production',
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
| `explicitSyncMode` | false | true일 경우 수동 동기화까지 업데이트 버퍼링 |

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
