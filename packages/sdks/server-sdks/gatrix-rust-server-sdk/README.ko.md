# Gatrix Rust Server SDK

[Gatrix](https://github.com/gatrix) 기능 관리 플랫폼을 위한 공식 Rust 서버 SDK입니다.

## 설치

`Cargo.toml`에 추가:

```toml
[dependencies]
gatrix-rust-server-sdk = { path = "../gatrix-rust-server-sdk" }
tokio = { version = "1", features = ["full"] }
```

## 빠른 시작

```rust
use gatrix_rust_server_sdk::{GatrixServerSDK, GatrixSDKConfig, UsesConfig, EvaluationContext};

#[tokio::main]
async fn main() {
    let mut config = GatrixSDKConfig::new(
        "http://localhost:45000",       // Gatrix 백엔드 URL
        "unsecured-server-api-token",       // 서버 API 토큰
        "my-game-server",              // 애플리케이션 이름
    );
    config.uses = UsesConfig {
        feature_flag: true,
        game_world: true,
        ..Default::default()
    };

    let mut sdk = GatrixServerSDK::new(config).expect("SDK 생성 실패");
    sdk.initialize().await.expect("SDK 초기화 실패");

    // 피처 플래그 평가
    let ctx = EvaluationContext {
        user_id: Some("user-123".to_string()),
        ..Default::default()
    };
    let enabled = sdk.feature_flag.is_enabled("my-feature", false, Some(&ctx), None).await;
    println!("기능 활성화: {}", enabled);

    sdk.shutdown().await;
}
```

## 설정

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `api_url` | `String` | ✅ | Gatrix 백엔드 URL |
| `api_token` | `String` | ✅ | 서버 API 토큰 |
| `app_name` | `String` | ✅ | 애플리케이션 이름 |
| `meta` | `Option<MetaConfig>` | | 서비스 메타데이터 (service, group, version) |
| `world_id` | `Option<String>` | | 점검 확인용 월드 ID |
| `redis` | `Option<RedisConfig>` | | 이벤트 모드용 Redis 설정 |
| `cache` | `CacheConfig` | | 캐시 갱신 설정 (기본값: polling, 300초 TTL) |
| `logger` | `LoggerConfig` | | 로그 레벨 (debug, info, warn, error) |
| `retry` | `RetryConfig` | | HTTP 재시도 설정 (기본값: 10회, 지수 백오프) |
| `uses` | `UsesConfig` | | 활성화할 서비스 선택 |
| `feature_flags` | `FeatureFlagConfig` | | 피처 플래그 설정 (compact 모드) |

### 캐시 갱신 방법

| 방법 | 설명 |
|------|------|
| `Polling` (기본값) | 주기적 갱신 (`cache.ttl`로 간격 설정) |
| `Event` | Redis Pub/Sub을 통한 실시간 갱신 (`gatrix-sdk-events` 채널) |
| `Manual` | 자동 갱신 없음; `sdk.refresh_cache()`를 명시적으로 호출 |

### Uses 설정

필요한 서비스만 활성화합니다:

```rust
config.uses = UsesConfig {
    feature_flag: true,        // 피처 플래그
    game_world: true,          // 게임 월드
    popup_notice: true,        // 팝업 공지
    survey: false,             // 설문
    whitelist: false,          // 화이트리스트
    service_maintenance: true, // 점검
    ..Default::default()
};
```

## 서비스 API

### 피처 플래그 서비스

```rust
let ctx = EvaluationContext {
    user_id: Some("user-123".to_string()),
    ..Default::default()
};

// 활성화 여부 확인
let enabled = sdk.feature_flag.is_enabled("flag-name", false, Some(&ctx), None).await;

// 타입별 변형 값 가져오기
let s = sdk.feature_flag.string_variation("flag-name", "default", Some(&ctx), None).await;
let n = sdk.feature_flag.number_variation("flag-name", 0.0, Some(&ctx), None).await;
let b = sdk.feature_flag.bool_variation("flag-name", false, Some(&ctx), None).await;
let j = sdk.feature_flag.json_variation("flag-name", serde_json::json!({}), Some(&ctx), None).await;

// 평가 상세 정보 포함
let detail = sdk.feature_flag.string_variation_detail("flag-name", "default", Some(&ctx), None).await;
println!("value={}, reason={}, variant={:?}", detail.value, detail.reason, detail.variant_name);

// Or-throw (폴백 대신 Result 반환)
let val = sdk.feature_flag.string_variation_or_throw("flag-name", Some(&ctx), None).await?;
```

### 게임 월드 서비스

```rust
let worlds = sdk.game_world.get_cached(None).await;
let world = sdk.game_world.get_by_world_id("world-1", None).await;
let is_maint = sdk.game_world.is_world_maintenance_active("world-1", None).await;
let msg = sdk.game_world.get_world_maintenance_message("world-1", None, Some("ko")).await;
```

### 쿠폰 서비스

```rust
use gatrix_rust_server_sdk::types::api::RedeemCouponRequest;

let result = sdk.coupon.redeem(&RedeemCouponRequest {
    code: "PROMO2024".to_string(),
    user_id: "user-123".to_string(),
    user_name: "Player".to_string(),
    character_id: "char-1".to_string(),
    world_id: "world-1".to_string(),
    platform: "pc".to_string(),
    channel: "steam".to_string(),
    sub_channel: "".to_string(),
}, None).await?;
```

### 서비스 디스커버리

```rust
use gatrix_rust_server_sdk::types::api::*;

let instance = sdk.service_discovery.register(RegisterServiceInput {
    instance_id: None,
    labels: ServiceLabels {
        service: "world-server".to_string(),
        group: Some("kr".to_string()),
        environment: None,
        region: None,
        extra: Default::default(),
    },
    hostname: None,
    internal_address: None,
    ports: ServicePorts([("game".to_string(), 7777)].into()),
    status: Some(ServiceStatus::Ready),
    stats: None,
    meta: None,
}).await?;
```

### 기타 서비스

```rust
// 화이트리스트
let allowed = sdk.whitelist.is_ip_whitelisted("192.168.1.1", None).await;
let allowed = sdk.whitelist.is_account_whitelisted("account-123", None).await;

// 점검
let active = sdk.service_maintenance.is_active(None).await;
let msg = sdk.service_maintenance.get_message(None, Some("ko")).await;

// 팝업 공지
let notices = sdk.popup_notice.get_cached(None).await;

// 설문
let surveys = sdk.survey.get_cached(None).await;

// 상점 상품
let products = sdk.store_product.get_cached(None).await;

// 배너
let banners = sdk.banner.get_cached(None).await;

// 클라이언트 버전
let versions = sdk.client_version.get_cached(None).await;

// 서비스 공지
let notices = sdk.service_notice.get_cached(None).await;

// Vars (KV)
let value = sdk.vars.get_value("my-key", None).await;
let parsed: Option<i32> = sdk.vars.get_parsed_value("max-retries", None).await;

// 임팩트 메트릭스
sdk.impact_metrics.define_counter("logins", "총 로그인 수").await;
sdk.impact_metrics.increment_counter("logins").await;
```

## 이벤트 처리

```rust
use std::sync::Arc;

// 이벤트 리스너 등록
sdk.on("feature_flag.changed", Arc::new(|event| {
    println!("플래그 변경: {:?}", event.data);
})).await;

// 와일드카드 리스너
sdk.on("*", Arc::new(|event| {
    println!("이벤트: {}", event.event_type);
})).await;

// 리스너 제거
sdk.off("feature_flag.changed").await;
```

## 라이프사이클

```rust
let mut sdk = GatrixServerSDK::new(config)?;
sdk.initialize().await?;    // 초기 데이터 조회, 폴링/이벤트 시작
// ... 애플리케이션 실행 ...
sdk.shutdown().await;        // 메트릭 플러시, 폴링 중지, 서비스 등록 해제
```

## 기능 플래그 (Cargo Features)

- `redis-pubsub` (기본값): Redis Pub/Sub 이벤트 리스너 활성화

Redis 지원 비활성화:

```toml
[dependencies]
gatrix-rust-server-sdk = { path = "...", default-features = false }
```

## 라이선스

MIT
