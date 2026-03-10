# Gatrix Java Server SDK

[Gatrix](https://gatrix.io) 피처 플래그 및 라이브 오퍼레이션 플랫폼을 위한 Kotlin 기반 서버 SDK입니다.

> 이 SDK는 게임 서버 또는 백엔드 서비스에서 실행됩니다.
> 플래그 정의를 가져와 **로컬에서 평가**합니다 — 평가 시 네트워크 지연이 전혀 없습니다.

## 설치

### Gradle (Kotlin DSL)

```kotlin
dependencies {
    implementation("com.gatrix:gatrix-java-server-sdk:1.0.0")
}
```

### Gradle (Groovy)

```groovy
dependencies {
    implementation 'com.gatrix:gatrix-java-server-sdk:1.0.0'
}
```

## 빠른 시작

```kotlin
import com.gatrix.server.sdk.GatrixServerSdk
import com.gatrix.server.sdk.config.GatrixSdkConfig
import com.gatrix.server.sdk.models.EvaluationContext

// 1. 설정
val config = GatrixSdkConfig(
    apiUrl = "https://your-gatrix-server.com",
    apiToken = "your-server-api-token",
    applicationName = "my-game-server"
)

// 2. 초기화
val sdk = GatrixServerSdk(config)
sdk.initialize()

// 3. 요청별 컨텍스트로 플래그 평가
val context = EvaluationContext(
    userId = "user-123",
    appVersion = "2.1.0",
    properties = mapOf("region" to "us-east", "level" to 42)
)

val enabled = sdk.features.isEnabled("new-ui", false, context)
val maxRetries = sdk.features.intVariation("max-retries", 3, context)
val bannerText = sdk.features.stringVariation("banner-text", "Welcome!", context)

// 4. 종료
sdk.shutdown()
```

## API 레퍼런스

모든 피처 플래그 관련 메서드는 `sdk.features`를 통해 접근합니다.

### 평가 메서드

| 메서드 | 반환 타입 | 설명 |
|--------|-----------|------|
| `isEnabled(flagName, fallback, context?)` | `Boolean` | 플래그 활성화 여부 확인 |
| `evaluate(flagName, context?)` | `EvaluationResult` | reason과 variant를 포함한 전체 평가 결과 |

### 타입별 Variation

| 메서드 | 반환 타입 | 설명 |
|--------|-----------|------|
| `boolVariation(flagName, fallback, context?)` | `Boolean` | Boolean variant 값 |
| `stringVariation(flagName, fallback, context?)` | `String` | String variant 값 |
| `intVariation(flagName, fallback, context?)` | `Int` | Integer variant 값 |
| `numberVariation(flagName, fallback, context?)` | `Double` | Double variant 값 |
| `jsonVariation(flagName, fallback, context?)` | `Map<String, Any?>` | JSON variant 값 |

### 상세 Variation

모든 타입별 variation에는 `*Detail` 변형이 있으며 (예: `boolVariationDetail`), `reason`과 `variantName`을 포함하는 `EvaluationDetail<T>`을 반환합니다.

## 설정

```kotlin
val config = GatrixSdkConfig(
    apiUrl = "https://your-gatrix-server.com",  // 필수
    apiToken = "your-server-api-token",          // 필수 (org/project/environment를 토큰으로 결정)
    applicationName = "my-game-server",          // 필수

    // 캐시 갱신 전략
    cache = CacheConfig(
        refreshMethod = "polling",  // "polling" | "event" | "manual"
        ttl = 15                    // 폴링 간격 (초)
    ),

    // Redis Pub/Sub ("event" 모드에 필요)
    redis = RedisConfig(
        host = "localhost",
        port = 6379,
        password = null,
        db = 0
    ),

    // HTTP 재시도
    retry = RetryConfig(
        enabled = true,
        maxRetries = 3,
        retryDelay = 1000
    )
)
```

### 캐시 갱신 방식

| 방식 | 설명 |
|------|------|
| `polling` (기본값) | 설정된 `ttl` 간격으로 주기적으로 플래그 정의를 가져옵니다 |
| `event` | Redis Pub/Sub을 구독하여 실시간 캐시 무효화를 수행합니다 |
| `manual` | 백그라운드 활동 없이 `sdk.refreshCache()`를 직접 호출해야 합니다 |

## EvaluationContext

컨텍스트는 **평가 시마다** 전달됩니다 (전역으로 저장하지 않습니다).

```kotlin
val context = EvaluationContext(
    userId = "user-123",        // 스티키 버킷팅 키
    sessionId = "session-abc",  // 세션 기반 스티키니스
    appName = "my-app",
    appVersion = "1.2.3",       // semver 제약 조건에 사용
    remoteAddress = "1.2.3.4",
    properties = mapOf(         // 제약 조건 평가를 위한 커스텀 속성
        "region" to "us-east",
        "level" to 42,
        "isPremium" to true,
        "tags" to listOf("beta", "vip")
    )
)
```

## 제약 조건 연산자

평가 엔진은 다음 제약 조건 연산자를 지원합니다:

| 카테고리 | 연산자 |
|----------|--------|
| 문자열 | `str_eq`, `str_contains`, `str_starts_with`, `str_ends_with`, `str_in`, `str_regex` |
| 숫자 | `num_eq`, `num_gt`, `num_gte`, `num_lt`, `num_lte`, `num_in` |
| 불리언 | `bool_is` |
| 날짜 | `date_eq`, `date_gt`, `date_gte`, `date_lt`, `date_lte` |
| 시맨틱 버전 | `semver_eq`, `semver_gt`, `semver_gte`, `semver_lt`, `semver_lte`, `semver_in` |
| 배열 | `arr_any`, `arr_all`, `arr_empty` |
| 존재 여부 | `exists`, `not_exists` |

모든 연산자는 `inverted`와 `caseInsensitive` 플래그를 지원합니다.

## 아키텍처

```
GatrixServerSdk
├── features: FeatureFlagService
│   ├── FlagDefinitionCache (환경별 플래그, 프로젝트별 세그먼트)
│   └── FeatureFlagEvaluator (로컬 평가 엔진)
├── GatrixApiClient (OkHttp, ETag, 재시도)
└── EventListener (Redis Pub/Sub, 실시간 캐시 무효화)
```

## 요구 사항

- JDK 17+
- Kotlin 1.9+

## 라이선스

Proprietary — Gatrix Platform
