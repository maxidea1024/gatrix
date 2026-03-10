# @gatrix/gatrix-vue-client-sdk

Gatrix 플랫폼용 Vue 3 SDK입니다.

## 설치

```bash
yarn add @gatrix/gatrix-vue-client-sdk @gatrix/gatrix-js-client-sdk
# 또는
npm install @gatrix/gatrix-vue-client-sdk @gatrix/gatrix-js-client-sdk
```

## 빠른 시작

### 1. GatrixPlugin 등록

```typescript
import { createApp } from 'vue';
import { GatrixPlugin } from '@gatrix/gatrix-vue-client-sdk';
import App from './App.vue';

const app = createApp(App);

app.use(GatrixPlugin, {
  config: {
    apiUrl: 'https://your-gatrix-server.com/api/v1',
    apiToken: 'your-client-api-token',
    appName: 'my-app',
  },
});

app.mount('#app');
```

### 2. 컴포저블로 피처 플래그 접근

```vue
<script setup>
import { useFlag, useBoolVariation, useFlags, useFlagsStatus } from '@gatrix/gatrix-vue-client-sdk';

// 준비 상태 확인
const { ready, error } = useFlagsStatus();

// 단순 불리언 확인
const isNewUIEnabled = useFlag('new-ui');

// 기본값 포함 불리언 배리에이션
const darkMode = useBoolVariation('dark-mode', false);

// 모든 플래그 가져오기
const allFlags = useFlags();
</script>

<template>
  <div v-if="!ready">로딩 중...</div>
  <div v-else-if="error">에러: {{ error.message }}</div>
  <div v-else :class="{ dark: darkMode }">
    <NewUI v-if="isNewUIEnabled" />
    <OldUI v-else />
  </div>
</template>
```

## API 레퍼런스

### 플러그인

#### `GatrixPlugin`

애플리케이션에 Gatrix 컨텍스트를 제공하는 Vue 플러그인.

```typescript
app.use(GatrixPlugin, {
  config: GatrixClientConfig, // 필수: SDK 설정
  client: GatrixClient,       // 선택: 미리 생성된 클라이언트 인스턴스
  startClient: true,           // 선택: 자동 시작 (기본: true)
});
```

### 코어 컴포저블

| 컴포저블 | 설명 |
|----------|------|
| `useGatrixClient()` | `GatrixClient` 인스턴스 반환 |
| `useFlagsStatus()` | `{ ready: Ref, error: Ref, healthy: Ref }` 반환 |
| `useUpdateContext()` | 컨텍스트 업데이트 함수 반환 |
| `useSyncFlags()` | 플래그 동기화 함수 반환 |
| `useFetchFlags()` | 플래그 페치 함수 반환 |

### 플래그 접근 컴포저블

모든 플래그 접근 컴포저블은 선택적 `forceRealtime` 매개변수를 지원합니다 (기본값: `true`). `true`일 경우, explicit sync mode와 관계없이 실시간 플래그 값을 읽습니다.

| 컴포저블 | 설명 |
|----------|------|
| `useFlag(flagName, forceRealtime?)` | `ComputedRef<boolean>` 반환 — 플래그 활성 상태 |
| `useFlagProxy(flagName, forceRealtime?)` | `Ref<FlagProxy | null>` 반환 — 전체 FlagProxy |
| `useVariant(flagName, forceRealtime?)` | `ComputedRef<Variant | undefined>` 반환 |
| `useFlags(forceRealtime?)` | `Ref<EvaluatedFlag[]>` 반환 — 모든 플래그 |
| `useTrack()` | 트래킹 함수 `(eventName, properties?) => void` 반환 |

### Variation 컴포저블

모든 variation 컴포저블은 세 번째 인자로 선택적 `forceRealtime` 매개변수를 지원합니다 (기본값: `true`).

| 컴포저블 | 설명 |
|----------|------|
| `useBoolVariation(flagName, fallbackValue, forceRealtime?)` | `ComputedRef<boolean>` 반환 |
| `useStringVariation(flagName, fallbackValue, forceRealtime?)` | `ComputedRef<string>` 반환 |
| `useNumberVariation(flagName, fallbackValue, forceRealtime?)` | `ComputedRef<number>` 반환 |
| `useJsonVariation<T>(flagName, fallbackValue, forceRealtime?)` | `ComputedRef<T>` (JSON 객체) 반환 |

## 예제

### 조건부 렌더링

```vue
<script setup>
import { useFlag } from '@gatrix/gatrix-vue-client-sdk';
const showNewFeature = useFlag('new-feature');
</script>

<template>
  <NewFeature v-if="showNewFeature" />
</template>
```

### 동적 설정

```vue
<script setup>
import { useJsonVariation } from '@gatrix/gatrix-vue-client-sdk';

const config = useJsonVariation('app-config', {
  maxItems: 10,
  theme: 'light',
});
</script>

<template>
  <div :class="`theme-${config.theme}`">
    <List :maxItems="config.maxItems" />
  </div>
</template>
```

### 컨텍스트 업데이트

```vue
<script setup>
import { useUpdateContext } from '@gatrix/gatrix-vue-client-sdk';
const updateContext = useUpdateContext();

const handleLogin = async (userId) => {
  await updateContext({ userId });
};
</script>
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
