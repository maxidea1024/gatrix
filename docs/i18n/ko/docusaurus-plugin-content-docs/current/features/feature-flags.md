---
sidebar_position: 1
sidebar_label: 피처 플래그
---

# 피처 플래그

실시간 토글, 환경별 타겟팅, 세그먼트 기반 롤아웃, 멀티 플랫폼 SDK를 활용하여 안전하게 기능을 배포할 수 있습니다.

## 개요

Gatrix 피처 플래그를 사용하면 코드 배포 없이 기능의 가용성을 제어할 수 있습니다. 플래그는 **글로벌**로 정의되며 **환경별** 설정(활성화/비활성화, 값 오버라이드)을 가질 수 있습니다. 평가는 **서버 측**에서 수행됩니다 — 클라이언트 SDK가 컨텍스트를 전송하면, 사전 평가된 결과를 수신하여 로컬에 캐시하여 지연 없이 읽을 수 있습니다.

### 주요 기능

- **실시간 토글** — 연결된 모든 클라이언트에서 즉시 기능 활성화/비활성화
- **환경별 타겟팅** — 환경별 on/off 및 값 오버라이드 (development, staging, production)
- **세그먼트 타겟팅** — 컨텍스트 조건 기반의 재사용 가능한 사용자 그룹
- **전략 기반 롤아웃** — 비율, 세그먼트 조건, 스티키니스를 활용한 점진적 배포
- **멀티 플랫폼 SDK** — JavaScript/TypeScript, Unity (C#), Unreal Engine (C++), Cocos2d-x (C++), Flutter (Dart), Godot (GDScript), Python
- **노출 추적** — 분석을 위한 플래그 접근 모니터링
- **명시적 동기화 모드** — 플래그 변경을 버퍼링하고 통제된 동기화 지점에서 적용 (게임에 필수)
- **코드 참조** — 정적 분석을 통한 코드베이스 내 플래그 사용 추적

## 아키텍처

### 평가 모델

```
┌────────────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Client SDK       │─context─▶   Edge API       │─eval──▶ │  Evaluator   │
│   (cache + poll)   │◀─result─│   (or Backend)   │◀───────│  (shared)    │
└────────────────────┘         └──────────────────┘         └──────────────┘
```

1. 클라이언트 SDK가 **컨텍스트** (userId, sessionId, properties)를 Edge API로 전송
2. 서버가 **전략**, **조건**, **세그먼트**를 사용하여 모든 플래그를 평가
3. 사전 평가된 결과가 클라이언트에 반환
4. 클라이언트가 결과를 로컬에 캐시하여 지연 없이 읽기
5. SDK가 주기적으로 폴링 (기본값: 30초)

### 핵심 설계 원칙

- **플래그는 글로벌** — 플래그는 환경별이 아닌 한 번만 정의
- **환경이 활성화를 제어** — 각 환경은 자체 `isEnabled`, `enabledValue`, `disabledValue` 오버라이드를 가짐
- **전략은 환경별** — 타겟팅 규칙은 환경별로 구성
- **변형은 환경별** — A/B 테스트 분배가 환경마다 다를 수 있음
- **세그먼트는 글로벌** — 모든 플래그와 환경에서 재사용 가능
- **`isArchived`는 관리 전용** — 아카이브된 플래그도 정상적으로 평가됨; 아카이브는 UI/거버넌스 개념

## 피처 플래그 생성

1. 관리 콘솔에서 **Feature Flags**로 이동합니다
2. **Create Flag**를 클릭합니다
3. 플래그를 구성합니다:

| 필드                  | 타입     | 필수 | 설명                                              |
| --------------------- | -------- | ---- | ------------------------------------------------- |
| 키 (`flagName`)       | 텍스트   | ✅   | 고유 식별자 (예: `new-checkout-flow`)              |
| 표시 이름              | 텍스트   | ✅   | 사람이 읽을 수 있는 표시 이름                       |
| 설명                  | 텍스트영역| —    | 목적 및 맥락 설명                                  |
| 플래그 타입 (`flagType`)| 선택   | ✅   | 목적 분류 (아래 참조)                               |
| 값 타입 (`valueType`)  | 선택    | ✅   | `boolean`, `string`, `number`, `json`              |
| 활성화 값              | 동적    | ✅   | 플래그가 활성화로 평가될 때 반환되는 값               |
| 비활성화 값            | 동적    | ✅   | 플래그가 비활성화로 평가될 때 반환되는 값              |
| 노출 데이터            | 토글    | —    | 이 플래그에 대한 노출 추적 활성화                    |
| 비활성 기간 (일)       | 숫자    | —    | 이 일수 이후 플래그를 비활성으로 간주                 |
| 태그                  | 태그    | —    | 분류 태그                                          |

4. **Create**를 클릭합니다

:::tip 플래그 키 네이밍
플래그 키에 **kebab-case**를 사용하세요: `dark-mode`, `new-checkout-flow`, `max-retry-count`.
플래그 키는 대소문자를 구분합니다. 정적 분석 호환성을 위해 코드에서 문자열 리터럴을 사용하세요.
:::

### 플래그 타입 (목적)

플래그 타입은 데이터 타입이 아닌 플래그의 **목적**을 설명합니다:

| 플래그 타입     | 설명                                                     |
| -------------- | -------------------------------------------------------- |
| `release`      | 사용자에게 기능 롤아웃 제어                                |
| `experiment`   | A/B 테스트 및 실험                                        |
| `operational`  | 운영 제어 (요율 제한, 서킷 브레이커)                       |
| `killSwitch`   | 기능을 비활성화하는 긴급 토글                              |
| `permission`   | 사용자 속성 기반 접근 제어                                 |
| `remoteConfig` | 원격 설정 값 (게임 밸런스, UI 설정 등)                     |

### 값 타입

| 값 타입    | 설명              | 기본 폴백 | 예시                                      |
| ---------- | ----------------- | --------- | ----------------------------------------- |
| `boolean`  | 참/거짓 토글       | `false`   | `true`                                     |
| `string`   | 텍스트 값          | `""`      | `"dark-theme"`                             |
| `number`   | 숫자 값           | `0`       | `100`                                      |
| `json`     | 복합 객체          | `{}`      | `{ "limit": 10, "theme": "modern" }`      |

## 환경별 설정

각 플래그는 환경별로 다른 설정을 가질 수 있습니다:

| 설정             | 설명                                        |
| ---------------- | ------------------------------------------- |
| `isEnabled`      | 이 환경에서 플래그 활성화 여부                |
| `enabledValue`   | 글로벌 활성화 값 오버라이드 (선택)            |
| `disabledValue`  | 글로벌 비활성화 값 오버라이드 (선택)          |
| `strategies`     | 이 환경에 특화된 타겟팅 규칙                  |
| `variants`       | 이 환경에 특화된 변형 분배                    |

### 예시: 환경별 설정

```
Flag: "new-checkout-flow" (boolean)
├── Global: enabledValue=true, disabledValue=false
├── development: isEnabled=true  (전략 없음 → 항상 활성화)
├── staging:     isEnabled=true  (전략: userId IN ["tester-1", "tester-2"])
└── production:  isEnabled=true  (전략: rollout 10%, stickiness=userId)
```

## 전략

전략은 어떤 사용자가 활성화 값을 받을지 결정하는 **환경별** 타겟팅 규칙입니다. 전략은 `sortOrder` 순으로 평가됩니다.

### 전략 평가 흐름

```
플래그 isEnabled?
  ├─ NO  → disabledValue 반환 (reason: "disabled")
  └─ YES → 활성 전략이 존재?
       ├─ NO  → enabledValue 반환 (reason: "default")
       └─ YES → 각 전략을 순서대로 평가:
            1. 세그먼트 조건 확인 (모두 통과해야 함)
            2. 전략 조건 확인 (모두 통과해야 함)
            3. 롤아웃 비율 확인
            └─ 모두 통과 → enabledValue 반환 (reason: "strategy_match")
       └─ 일치하는 전략 없음 → disabledValue 반환 (reason: "default")
```

### 전략 파라미터

| 파라미터     | 타입   | 설명                                                           |
| ------------ | ------ | -------------------------------------------------------------- |
| `rollout`    | number | 활성화 값을 받는 사용자 비율 (0–100)                            |
| `stickiness` | string | 일관된 버킷팅을 위한 컨텍스트 필드 (`userId`, `sessionId`, `random`, 또는 커스텀) |
| `groupId`    | string | 롤아웃 버킷팅을 위한 그룹 식별자 (기본값: 플래그 이름)           |

### 롤아웃 버킷팅

롤아웃은 결정적 버킷팅을 위해 **MurmurHash v3**을 사용합니다:

```
seed = "{groupId}:{stickinessValue}"
hash = murmurhash_v3(seed)
percentage = (hash % 10000) / 100   // 0.00 ~ 99.99
```

이를 통해:
- 동일 사용자는 동일 플래그에 대해 항상 같은 결과를 받음
- 사용자 간 균일한 분배
- 롤아웃 비율 증가 시 기존 사용자의 재버킷팅 없음

## 조건 (Constraints)

조건은 전략이 매칭되기 위해 충족되어야 하는 규칙입니다. 전략 내 모든 조건은 **AND** 로직을 사용합니다 (모두 통과해야 함).

### 조건 구조

```typescript
interface Constraint {
  contextName: string;       // 확인할 컨텍스트 필드 (예: "userId", "country")
  operator: ConstraintOperator;
  value?: string;           // 단일 값 연산자용
  values?: string[];        // 다중 값 연산자용 (IN 등)
  caseInsensitive?: boolean; // 문자열 비교 대소문자 구분
  inverted?: boolean;       // 결과 반전
}
```

### 타입별 연산자

#### 문자열 연산자

| 연산자            | 설명                 | 값 타입  | 예시                                 |
| ----------------- | -------------------- | -------- | ------------------------------------ |
| `str_eq`          | 같음                 | 단일     | `country str_eq "KR"`               |
| `str_contains`    | 부분 문자열 포함      | 단일     | `email str_contains "@company.com"`  |
| `str_starts_with` | 접두사로 시작         | 단일     | `userId str_starts_with "test_"`     |
| `str_ends_with`   | 접미사로 끝남         | 단일     | `email str_ends_with ".kr"`          |
| `str_in`          | 목록에 포함           | 다중     | `country str_in ["KR", "JP", "US"]` |
| `str_regex`       | 정규식 매칭           | 단일     | `email str_regex "^admin@.*"`        |

#### 숫자 연산자

| 연산자     | 설명          | 값 타입  | 예시                      |
| ---------- | ------------- | -------- | ------------------------- |
| `num_eq`   | 같음          | 단일     | `level num_eq 10`         |
| `num_gt`   | 초과          | 단일     | `level num_gt 50`         |
| `num_gte`  | 이상          | 단일     | `level num_gte 50`        |
| `num_lt`   | 미만          | 단일     | `age num_lt 18`           |
| `num_lte`  | 이하          | 단일     | `age num_lte 18`          |
| `num_in`   | 목록에 포함    | 다중     | `level num_in [1, 5, 10]` |

#### 불리언 연산자

| 연산자    | 설명          | 값 타입  | 예시                     |
| --------- | ------------- | -------- | ------------------------ |
| `bool_is` | 참/거짓 확인   | 단일     | `isPremium bool_is true` |

#### 날짜 연산자

| 연산자     | 설명       | 값 타입  | 예시                                 |
| ---------- | ---------- | -------- | ------------------------------------ |
| `date_eq`  | 같음       | 단일     | `registerDate date_eq "2025-01-01"`  |
| `date_gt`  | 이후       | 단일     | `registerDate date_gt "2025-01-01"`  |
| `date_gte` | 이후(포함)  | 단일     | `registerDate date_gte "2025-01-01"` |
| `date_lt`  | 이전       | 단일     | `registerDate date_lt "2025-06-01"`  |
| `date_lte` | 이전(포함)  | 단일     | `registerDate date_lte "2025-06-01"` |

#### Semver 연산자

| 연산자       | 설명       | 값 타입  | 예시                                       |
| ------------ | ---------- | -------- | ------------------------------------------ |
| `semver_eq`  | 같음       | 단일     | `appVersion semver_eq "2.0.0"`             |
| `semver_gt`  | 초과       | 단일     | `appVersion semver_gt "1.5.0"`             |
| `semver_gte` | 이상       | 단일     | `appVersion semver_gte "1.5.0"`            |
| `semver_lt`  | 미만       | 단일     | `appVersion semver_lt "3.0.0"`             |
| `semver_lte` | 이하       | 단일     | `appVersion semver_lte "3.0.0"`            |
| `semver_in`  | 목록에 포함 | 다중     | `appVersion semver_in ["2.0.0", "2.1.0"]`  |

#### 공통 연산자 (타입 무관)

| 연산자       | 설명          | 값 타입 | 예시                |
| ------------ | ------------- | ------- | ------------------- |
| `exists`     | 값이 있음      | 없음    | `userId exists`     |
| `not_exists` | 값이 없음      | 없음    | `userId not_exists` |

#### 배열 연산자

| 연산자      | 설명                          | 값 타입 | 예시                              |
| ----------- | ----------------------------- | ------- | --------------------------------- |
| `arr_any`   | 대상 값 중 하나라도 포함       | 다중    | `tags arr_any ["vip", "beta"]`    |
| `arr_all`   | 대상 값 모두 포함              | 다중    | `tags arr_all ["vip", "premium"]` |
| `arr_empty` | 배열이 비어있거나 존재하지 않음 | 없음    | `tags arr_empty`                  |

### `inverted` 플래그

모든 조건은 `inverted` 불리언을 지원합니다. `true`일 때 조건 결과가 반전됩니다:

```
str_eq + inverted:true  → 같지 않음 (≠)
str_in + inverted:true  → 목록에 없음
exists + inverted:true  → 존재하지 않음
```

## 세그먼트

세그먼트는 **글로벌**이며 재사용 가능한 조건 집합입니다. 모든 환경의 모든 전략에서 참조할 수 있습니다.

### 세그먼트 구조

```typescript
interface FeatureSegment {
  name: string;
  constraints: Constraint[];  // 모두 통과해야 함 (AND 로직)
  isActive: boolean;          // UI 표시 전용, 평가에 사용되지 않음
}
```

:::warning `isActive`는 UI 전용
세그먼트의 `isActive` 필드는 **관리 UI의 표시 여부만** 제어합니다. 평가에는 **영향을 미치지 않습니다**. 비활성 세그먼트도 전략에서 참조되면 정상적으로 평가됩니다.
:::

### 세그먼트 생성

1. **Feature Flags** > **Segments**로 이동합니다
2. **Create Segment**를 클릭합니다
3. 조건을 정의합니다 (예: `country str_in ["KR", "JP"]` AND `isPremium bool_is true`)
4. 저장합니다

### 전략에서 세그먼트 사용

전략은 세그먼트를 참조할 수 있습니다. 평가 시 세그먼트 조건이 전략 조건 **이전에** 확인됩니다:

```
전략 평가 순서:
1. 세그먼트 조건 (참조된 모든 세그먼트가 통과해야 함)
2. 전략 조건 (모두 통과해야 함)
3. 롤아웃 비율 확인
```

### 예시: 베타 테스터 세그먼트

```json
{
  "segmentName": "beta-testers",
  "constraints": [
    { "contextName": "userId", "operator": "str_in", "values": ["user-001", "user-002", "user-003"] }
  ]
}
```

## 컨텍스트

컨텍스트는 현재 사용자/세션을 나타내며 모든 타겟팅 규칙을 구동합니다.

### 평가 컨텍스트 구조

```typescript
interface EvaluationContext {
  userId?: string;
  sessionId?: string;
  appName?: string;
  appVersion?: string;
  remoteAddress?: string;
  environment?: string;
  currentTime?: Date;
  properties?: Record<string, string | number | boolean | string[]>;
}
```

### 내장 컨텍스트 필드

| 필드            | 타입   | 설명                                                      |
| --------------- | ------ | --------------------------------------------------------- |
| `userId`        | string | 고유 사용자 식별자 — 주요 스티키니스 키                     |
| `sessionId`     | string | 세션 식별자 — 미제공 시 자동 생성                           |
| `appName`       | string | SDK 설정의 애플리케이션 이름                                |
| `appVersion`    | string | 애플리케이션 버전 (semver 비교 지원)                        |
| `remoteAddress` | string | 클라이언트 IP 주소 (평가 시 서버가 제공)                    |

### 커스텀 컨텍스트 필드 (Properties)

커스텀 속성은 4가지 타입을 지원합니다:

| 타입      | 설명                | 예시 연산자                                          |
| --------- | ------------------- | ---------------------------------------------------- |
| `string`  | 텍스트 값            | `str_eq`, `str_contains`, `str_in`, `str_regex`      |
| `number`  | 숫자 값             | `num_eq`, `num_gt`, `num_lt`, `num_in`               |
| `boolean` | 참/거짓 값           | `bool_is`                                            |
| `array`   | 문자열 목록          | `arr_any`, `arr_all`, `arr_empty`                    |

### 기본 제공 커스텀 필드

Gatrix는 자주 사용되는 컨텍스트 필드를 기본 제공합니다:

| 키                | 타입    | 설명                               |
| ----------------- | ------- | ---------------------------------- |
| `userLevel`       | number  | 게임 내 사용자 현재 레벨            |
| `country`         | string  | 국가 코드 (ISO 3166-1 alpha-2)      |
| `platform`        | string  | 디바이스 플랫폼 (ios, android, web, windows, mac, linux) |
| `language`        | string  | 선호 언어 (ko, en, ja, zh, ...)     |
| `isPremium`       | boolean | 프리미엄 구독 상태                  |
| `registrationDate`| number  | 가입 후 경과 일수                   |
| `lastLoginDate`   | number  | 마지막 로그인 후 경과 일수           |
| `totalPurchases`  | number  | 총 구매 금액 (USD)                  |
| `gameMode`        | string  | 현재 게임 모드                      |
| `tags`            | array   | 사용자에게 할당된 커스텀 태그        |

## 변형 (Variants)

변형은 가중치 분배를 통한 **A/B 테스트**를 가능하게 합니다. 변형은 **환경별**로 정의됩니다.

### 변형 구조

```typescript
interface FeatureVariant {
  variantName: string;     // 플래그 내 고유 식별자
  weight: number;          // 분배 가중치 (0–100)
  value?: any;             // 변형별 값
  valueType: ValueType;    // 플래그의 valueType과 동일
  weightLock?: boolean;    // 재분배 시 가중치 고정
}
```

### 변형 선택

플래그에 변형이 있으면 사용자 컨텍스트를 기반으로 하나가 선택됩니다:

```
percentage = murmurhash_v3("{flagName}-variant:{stickinessValue}") % 10000 / 100
targetWeight = percentage / 100 * totalWeight

누적 가중치 확인:
  Variant A (weight: 50) → 0–50%
  Variant B (weight: 30) → 50–80%
  Variant C (weight: 20) → 80–100%
```

### 예약된 변형 이름

| 이름        | 의미                              |
| ----------- | --------------------------------- |
| `$default`  | 기본 변형 (변형 미정의 시)         |
| `$disabled` | 플래그 비활성화                    |
| `$missing`  | 캐시에 플래그가 존재하지 않음       |
| `$config`   | 플래그가 설정 값을 사용             |

## SDK 사용법

### 사용 가능한 클라이언트 SDK

| SDK                       | 언어          | 패키지                            |
| ------------------------- | ------------- | --------------------------------- |
| **JavaScript/TypeScript** | JS/TS         | `@gatrix/js-client-sdk`           |
| **React**                 | JS/TS         | `@gatrix/react-sdk`               |
| **Vue**                   | JS/TS         | `@gatrix/vue-sdk`                 |
| **Svelte**                | JS/TS         | `@gatrix/svelte-sdk`              |
| **Unity**                 | C#            | `gatrix-unity-client-sdk`         |
| **Unreal Engine**         | C++           | `gatrix-unreal-client-sdk`        |
| **Cocos2d-x**             | C++           | `gatrix-cocos2dx-client-sdk`      |
| **Flutter**               | Dart          | `gatrix-flutter-client-sdk`       |
| **Godot**                 | GDScript      | `gatrix-godot-client-sdk`         |
| **Python**                | Python        | `gatrix-python-client-sdk`        |

### SDK 라이프사이클

모든 클라이언트 SDK는 동일한 라이프사이클 패턴을 따릅니다:

```
Constructor → init() → start() → [polling loop] → stop()
                │          │
                │          └─ 첫 번째 fetch → "flags.ready" 이벤트
                └─ 캐시/부트스트랩에서 로드 → "flags.init" 이벤트
```

### 초기화

```typescript
import { GatrixClient } from '@gatrix/js-client-sdk';

const client = new GatrixClient({
  // 필수
  apiUrl: 'https://edge.your-api.com/api/v1',
  apiToken: 'your-client-api-token',
  appName: 'my-app',
  environment: 'production',

  // 선택
  refreshInterval: 30,        // 폴링 간격 (초, 기본값: 30)
  explicitSyncMode: false,    // syncFlags()까지 변경 버퍼링 (기본값: false)
  disableRefresh: false,      // 자동 폴링 비활성화 (기본값: false)
  offlineMode: false,         // 네트워크 요청 없음 (기본값: false)
  disableMetrics: false,      // 메트릭 수집 비활성화 (기본값: false)

  // 초기 컨텍스트
  context: {
    userId: 'user-123',
    properties: {
      country: 'KR',
      level: 42,
      isPremium: true,
    },
  },
});

await client.start();
```

### 플래그 접근 방법

#### 기본 접근

```typescript
const features = client.features;

// 플래그 활성화 여부 확인 (flag.enabled 반환, 변형 값이 아님)
const isEnabled = features.isEnabled('dark-mode');

// 캐시에 플래그 존재 여부 확인
const exists = features.hasFlag('dark-mode');

// 모든 플래그 가져오기
const allFlags = features.getAllFlags();
```

#### 타입별 Variation (폴백 값 필수)

모든 variation 메서드는 **폴백 값이 필수**입니다. 이는 장애 시에도 항상 유효한 값을 수신하도록 보장합니다.

```typescript
// 불리언 값 (variant.value에서, flag.enabled가 아님)
const darkMode = features.boolVariation('dark-mode', false);

// 문자열 값
const theme = features.stringVariation('theme-name', 'light');

// 숫자 값 (JS/TS SDK 전용 — 아래 참조)
const maxItems = features.numberVariation('max-items', 10);

// JSON 값
const config = features.jsonVariation('feature-config', { enabled: false });
```

:::warning `isEnabled()` vs `boolVariation()`
이 둘은 **완전히 다른** 목적을 가집니다:
- **`isEnabled('flag')`** → 플래그가 **켜져 있는지** 여부 반환 (`flag.enabled`)
- **`boolVariation('flag', false)`** → 변형의 **불리언 값** 반환 (`variant.value`)

변형이 없는 단순 불리언 플래그에서는 같은 결과를 반환할 수 있지만, 의미적으로 다릅니다.
:::

:::important 비JS SDK의 숫자 타입
JavaScript/TypeScript SDK는 `numberVariation()`을 제공합니다.

**다른 모든 SDK**는 타입별 함수를 사용합니다:
- `intVariation(flagName, fallbackValue)` — 정수 반환
- `floatVariation(flagName, fallbackValue)` — 부동소수점 반환

| SDK        | 정수 함수             | 부동소수점 함수         |
| ---------- | -------------------- | ---------------------- |
| Unity (C#) | `IntVariation()`     | `FloatVariation()`     |
| Unreal     | `IntVariation()`     | `FloatVariation()`     |
| Cocos2d-x  | `intVariation()`     | `floatVariation()`     |
| Flutter    | `intVariation()`     | `doubleVariation()`    |
| Godot      | `int_variation()`    | `float_variation()`    |
| Python     | `int_variation()`    | `float_variation()`    |
:::

#### FlagProxy

`getFlag()` 메서드는 모든 variation 메서드를 포함하는 편의 래퍼인 `FlagProxy`를 반환합니다:

```typescript
const flag = features.getFlag('dark-mode');

flag.exists;                    // boolean: 플래그 존재 여부
flag.enabled;                   // boolean: 플래그 활성화 여부
flag.name;                      // string: 플래그 이름
flag.variant;                   // Variant: null이 아님 ($missing 센티넬 사용)
flag.boolVariation(false);      // 내부적으로 FeaturesClient에 위임
```

### 컨텍스트 관리

```typescript
// 현재 컨텍스트 가져오기
const ctx = features.getContext();

// 전체 컨텍스트 업데이트 (재요청 트리거)
await features.updateContext({
  userId: 'user-456',
  properties: { country: 'JP' },
});

// 단일 컨텍스트 필드 업데이트 (재요청 트리거)
await features.setContextField('level', 42);

// 컨텍스트 필드 제거 (재요청 트리거)
await features.removeContextField('tempFlag');
```

:::caution 컨텍스트 업데이트 성능
모든 `updateContext()` / `setContextField()` / `removeContextField()` 호출은 플래그를 재평가하기 위한 **네트워크 요청**을 트리거합니다. 자주 변경되는 값을 컨텍스트에 넣는 것을 피하세요.

**컨텍스트에 적합:** userId, country, plan, platform, appVersion
**컨텍스트에 부적합:** 타임스탬프, 애니메이션 프레임, 카운터, 빠르게 변하는 게임 상태
:::

### Watch 패턴 (반응형 업데이트)

개별 플래그 변경을 구독하여 반응형 UI 업데이트:

```typescript
// 플래그 변경 감시 (변경 시에만 실행)
const unwatch = features.watchFlag('dark-mode', (flag) => {
  console.log('다크 모드 변경:', flag.boolVariation(false));
});

// 초기 상태와 함께 감시 (현재 값으로 즉시 실행 후 변경 시 실행)
const unwatch = features.watchFlagWithInitialState('dark-mode', (flag) => {
  applyTheme(flag.boolVariation(false) ? 'dark' : 'light');
});

// 감시 중지
unwatch();
```

### 명시적 동기화 모드

플래그 변경이 현재 게임 루프나 세션을 방해하지 않아야 하는 **게임 및 실시간 애플리케이션**에 필수적입니다.

```typescript
const client = new GatrixClient({
  // ...config
  explicitSyncMode: true,
});

// 플래그가 백그라운드에서 fetch되지만 syncFlags()까지 적용되지 않음
client.on('flags.pending_sync', () => {
  showNotification('새로운 설정을 사용할 수 있습니다!');
});

// 안전한 시점에서 변경 적용 (씬 전환, 로비, 로딩 화면)
await features.syncFlags();
```

#### 동작 방식

| 저장소              | 설명                                        |
| ------------------- | ------------------------------------------- |
| `realtimeFlags`     | 서버의 최신 플래그 (항상 최신)                |
| `synchronizedFlags` | 앱이 읽는 플래그 (syncFlags로 업데이트)       |

- 기본 읽기는 `synchronizedFlags`에서 수행
- `forceRealtime: true`를 사용하면 `realtimeFlags`에서 읽기 (디버그 UI에 유용)

```typescript
// 동기화된 저장소에서 읽기 (기본)
const enabled = features.isEnabled('my-feature');

// 실시간 저장소에서 읽기 (디버그/대시보드용)
const realtimeEnabled = features.isEnabled('my-feature', true);
```

### 이벤트

| 이벤트                   | 설명                                       | 페이로드                         |
| ------------------------ | ------------------------------------------ | -------------------------------- |
| `flags.init`             | 스토리지/부트스트랩에서 SDK 초기화           | —                                |
| `flags.ready`            | 첫 번째 fetch 성공 완료                     | —                                |
| `flags.fetch_start`      | fetch 시작                                 | `{ etag }`                       |
| `flags.fetch_success`    | fetch 성공                                 | —                                |
| `flags.fetch_error`      | fetch 실패                                 | `{ status?, error? }`            |
| `flags.fetch_end`        | fetch 완료 (성공 또는 오류)                 | —                                |
| `flags.change`           | 서버에서 플래그 변경                        | `{ flags }`                      |
| `flags.{name}.change`    | 개별 플래그 변경                            | `(newFlag, oldFlag, changeType)` |
| `flags.removed`          | 서버에서 플래그 제거                        | `string[]` (플래그 이름)          |
| `flags.pending_sync`     | 대기 중인 동기화 가능 (명시적 동기화 모드)   | —                                |
| `flags.impression`       | 플래그 접근 (노출 추적 활성화 시)           | `ImpressionEvent`                |
| `flags.error`            | 일반 SDK 오류                              | `{ type, error }`                |
| `flags.recovered`        | 오류 상태에서 복구                          | —                                |
| `flags.metrics.sent`     | 메트릭 전송 성공                            | `{ count }`                      |

### 폴링 및 오류 복원력

SDK는 지수 백오프를 통한 강건한 폴링을 구현합니다:

| 시나리오                  | 동작                                                           |
| ------------------------- | -------------------------------------------------------------- |
| 성공적인 fetch            | `refreshInterval` 초 후 다음 fetch 예약                        |
| 재시도 가능한 오류         | 지수 백오프: `min(initialBackoffMs * 2^(n-1), maxBackoffMs)`    |
| 재시도 불가 (401, 403)    | 폴링 중지. `fetchFlags()`를 수동 호출하여 재개                  |
| 오류 후 복구              | `consecutiveFailures` 리셋, 정상 폴링 재개                     |

:::info 폴링은 오류로 중단되지 않음
폴링은 오류 후에도 **항상** 계속됩니다 (401/403 제외). SDK는 지수 백오프를 사용하지만 영구적으로 중단되지 않습니다.
:::

## 플랫폼별 예시

### Unity (C#)

```csharp
var config = new GatrixClientConfig {
    ApiUrl = "https://edge.your-api.com/api/v1",
    ApiToken = "your-token",
    AppName = "my-game",
    Environment = "production",
    ExplicitSyncMode = true, // 게임에 권장
};

var client = new GatrixClient(config);
await client.Start();

int maxRetries = client.Features.IntVariation("max-retries", 3);
float gameSpeed = client.Features.FloatVariation("game-speed", 1.0f);
bool darkMode = client.Features.BoolVariation("dark-mode", false);

// 씬 전환 시 플래그 변경 적용
if (client.Features.HasPendingSyncFlags()) {
    await client.Features.SyncFlags();
}
```

### Unreal Engine (C++)

```cpp
FGatrixClientConfig Config;
Config.ApiUrl = TEXT("https://edge.your-api.com/api/v1");
Config.ApiToken = TEXT("your-token");
Config.AppName = TEXT("my-game");
Config.Environment = TEXT("production");
Config.bExplicitSyncMode = true;

TSharedPtr<FGatrixClient> Client = MakeShared<FGatrixClient>(Config);
Client->Start();

bool bDarkMode = Client->GetFeatures()->BoolVariation("dark-mode", false);
int32 MaxRetries = Client->GetFeatures()->IntVariation("max-retries", 3);
float GameSpeed = Client->GetFeatures()->FloatVariation("game-speed", 1.0f);
```

### Flutter (Dart)

```dart
final client = GatrixClient(GatrixClientConfig(
  apiUrl: 'https://edge.your-api.com/api/v1',
  apiToken: 'your-token',
  appName: 'my-app',
  environment: 'production',
));

await client.start();

bool darkMode = client.features.boolVariation('dark-mode', false);
int maxItems = client.features.intVariation('max-items', 10);
double speed = client.features.doubleVariation('game-speed', 1.0);
```

### Godot (GDScript)

```gdscript
var config = GatrixClientConfig.new()
config.api_url = "https://edge.your-api.com/api/v1"
config.api_token = "your-token"
config.app_name = "my-game"
config.environment = "production"
config.explicit_sync_mode = true

var client = GatrixClient.new(config)
client.start()

var dark_mode = client.features.bool_variation("dark-mode", false)
var max_retries = client.features.int_variation("max-retries", 3)
var game_speed = client.features.float_variation("game-speed", 1.0)
```

### Python

```python
from gatrix import GatrixClient, GatrixClientConfig, GatrixContext

config = GatrixClientConfig(
    api_url="https://edge.your-api.com/api/v1",
    api_token="your-token",
    app_name="my-app",
    environment="production",
    context=GatrixContext(
        user_id="user-123",
        properties={"country": "KR", "level": 42},
    ),
)

client = GatrixClient(config)
await client.start()

dark_mode = client.features.bool_variation("dark-mode", False)
max_items = client.features.int_variation("max-items", 10)
speed = client.features.float_variation("game-speed", 1.0)
```

## 모범 사례

### 플래그 설계

1. **kebab-case 사용** — 일관적이고 정적 분석에 친화적
2. **적절한 플래그 타입 선택** — 기능 롤아웃은 `release`, 긴급 토글은 `killSwitch`, 튜닝 값은 `remoteConfig`
3. **의미 있는 비활성화 값 설정** — 플래그가 꺼져도 사용자가 합리적인 기본값을 보도록
4. **`staleAfterDays` 사용** — 비활성 임계값을 설정하여 제거해야 할 플래그 식별
5. **플래그에 태그 지정** — 분류 및 필터링에 태그 사용

### SDK 사용

1. **항상 폴백 값 제공** — 네트워크 장애 시 복원력 보장
2. **`isEnabled` 대신 `boolVariation` 사용** — 활성 상태가 아닌 실제 변형 값 획득
3. **게임에는 명시적 동기화 모드 사용** — 프레임/세션 중 플래그 변경 방지
4. **컨텍스트 최소화** — 자주 변경되는 값을 컨텍스트에 넣지 않기
5. **`start()` 한 번, `stop()` 한 번** — SDK 라이프사이클은 앱 라이프사이클과 일치
6. **반응형 UI에는 `watchFlag` 사용** — 수동 폴링 금지
7. **렌더링 전 `flags.ready` 처리** — 로드되지 않은 플래그로 인한 깜빡임 방지

### 성능

1. **플래그 읽기는 인메모리** — `isEnabled`, `*Variation`, `getVariant`는 핫 패스에 안전 (게임 루프, 렌더 함수)
2. **컨텍스트 업데이트는 네트워크 트리거** — 사용자 입력 기반이면 디바운싱
3. **플래그 워처 배치화** — 깔끔한 라이프사이클 관리를 위해 `WatchFlagGroup` 사용
4. **즉시 로딩을 위해 부트스트랩 사용** — 첫 fetch 전 로딩 갭 제거

## 참고

- [세그먼트](./segments) — 재사용 가능한 사용자 그룹 타겟팅
- [환경](./environments) — 환경별 설정 관리
- [클라이언트 SDK](../sdks/client-side) — 플랫폼별 SDK 문서
- [게임 엔진 SDK](../sdks/game-engines) — Unity, Unreal, Godot, Cocos2d-x
