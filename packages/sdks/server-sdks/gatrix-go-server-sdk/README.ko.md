# Gatrix Go Server SDK

[Gatrix](https://github.com/gatrix) 피처 관리 플랫폼을 위한 공식 Go 서버 SDK입니다.

## 설치

```bash
go get github.com/gatrix/gatrix-go-server-sdk
```

## 빠른 시작

```go
package main

import (
    gatrix "github.com/gatrix/gatrix-go-server-sdk"
    "github.com/gatrix/gatrix-go-server-sdk/types"
)

func main() {
    sdk, err := gatrix.NewGatrixServerSDK(gatrix.GatrixSDKConfig{
        APIURL:          "http://localhost:3000",
        APIToken:        "서버-API-토큰",
        ApplicationName: "my-game-server",
        Environment:     "환경-ID",
    })
    if err != nil {
        panic(err)
    }
    defer sdk.Shutdown()

    if err := sdk.Initialize(); err != nil {
        panic(err)
    }

    // 피처 플래그 평가
    ctx := &types.EvaluationContext{UserID: "user-123"}
    enabled := sdk.FeatureFlag.IsEnabled("my-feature", false, ctx, "")
}
```

## 설정

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `APIURL` | string | ✅ | Gatrix 백엔드 URL |
| `APIToken` | string | ✅ | 서버 API 토큰 |
| `ApplicationName` | string | ✅ | 애플리케이션 이름 |
| `Service` | string | | 서비스 이름 |
| `Group` | string | | 서비스 그룹 |
| `Environment` | string | | 환경 ID (`"*"` = 멀티환경) |
| `WorldID` | string | | 월드별 점검 확인용 월드 ID |
| `Redis` | *RedisConfig | | 이벤트 모드용 Redis 설정 |
| `Cache` | *CacheConfig | | 캐시 갱신 설정 |
| `Logger` | *LoggerConfig | | 로그 레벨 (`debug`, `info`, `warn`, `error`) |
| `Retry` | *RetryConfig | | HTTP 재시도 설정 |
| `Uses` | *UsesConfig | | 캐싱할 서비스 선택 |

### 캐시 갱신 방식

| 방식 | 설명 |
|------|------|
| `polling` | 주기적 갱신 (기본값, `Cache.TTL`로 주기 설정) |
| `event` | Redis Pub/Sub를 통한 실시간 갱신 (`gatrix-sdk-events` 채널) |
| `manual` | 자동 갱신 없음. `sdk.RefreshCache()` 직접 호출 |

## 서비스 API

### 피처 플래그 서비스

```go
// 활성화 여부 확인
enabled := sdk.FeatureFlag.IsEnabled("flag-name", false, ctx, "")

// 타입별 변형 값 조회
str := sdk.FeatureFlag.StringVariation("flag-name", "기본값", ctx, "")
num := sdk.FeatureFlag.IntVariation("flag-name", 0, ctx, "")
flt := sdk.FeatureFlag.FloatVariation("flag-name", 0.0, ctx, "")
bol := sdk.FeatureFlag.BoolVariation("flag-name", false, ctx, "")  // 변형 값(활성화 상태 아님)
jsn := sdk.FeatureFlag.JsonVariation("flag-name", map[string]interface{}{}, ctx, "")

// 평가 상세 정보 포함
detail := sdk.FeatureFlag.StringVariationDetails("flag-name", "기본값", ctx, "")

// OrThrow (값 없으면 에러 반환)
val, err := sdk.FeatureFlag.StringVariationOrThrow("flag-name", ctx, "")
```

### 게임 월드 서비스

```go
worlds := sdk.GameWorld.GetAll("")
world := sdk.GameWorld.GetByWorldID("world-1", "")
isMaintenance := sdk.GameWorld.IsWorldMaintenanceActive("world-1", "")
msg := sdk.GameWorld.GetWorldMaintenanceMessage("world-1", "", "ko")
```

### 쿠폰 서비스

```go
result, err := sdk.Coupon.Redeem(types.RedeemCouponRequest{
    Code:   "PROMO2024",
    UserID: "user-123",
    WorldID: "world-1",
}, "env-id")
```

### 서비스 디스커버리

```go
resp, err := sdk.ServiceDiscovery.Register(types.RegisterServiceInput{
    Labels: types.ServiceLabels{Service: "world-server", Group: "kr"},
    Ports:  types.ServicePorts{"game": 7777, "http": 8080},
})
defer sdk.ServiceDiscovery.Unregister()

services, err := sdk.ServiceDiscovery.FetchServices(&types.GetServicesParams{
    Service: "world-server",
    Status:  types.ServiceStatusReady,
})
```

### 기타 서비스

```go
// 화이트리스트
sdk.Whitelist.IsIPWhitelisted("192.168.1.1", "")
sdk.Whitelist.IsAccountWhitelisted("account-123", "")

// 서비스 점검
sdk.ServiceMaintenance.IsActive("")
sdk.ServiceMaintenance.GetMessage("", "ko")

// 팝업 공지
notices := sdk.PopupNotice.GetActive("", "ios", "ch1", "world-1", "user-1")

// 설문조사
surveys := sdk.Survey.GetAll("")

// 스토어 상품
products := sdk.StoreProduct.GetAll("")

// 임팩트 메트릭
sdk.ImpactMetrics.DefineCounter("logins", "총 로그인 수")
sdk.ImpactMetrics.IncrementCounter("logins")
```

## 이벤트 처리

```go
// 특정 이벤트 리스너
sdk.On("feature_flag.changed", func(e types.SdkEvent) {
    fmt.Printf("플래그 변경: %v\n", e.Data)
})

// 와일드카드 리스너
sdk.On("*", func(e types.SdkEvent) {
    fmt.Printf("이벤트: %s\n", e.Type)
})

// 리스너 제거
sdk.Off("feature_flag.changed")
```

## 라이프사이클

```go
sdk, _ := gatrix.NewGatrixServerSDK(config)
sdk.Initialize()  // 초기 데이터 가져오기, 폴링/이벤트 시작
// ... 애플리케이션 실행 ...
sdk.Shutdown()     // 메트릭 전송, 폴링 중지, 등록 해제
```

## 라이선스

MIT
