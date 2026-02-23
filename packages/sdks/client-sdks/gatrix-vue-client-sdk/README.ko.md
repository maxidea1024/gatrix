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
    environment: 'production',
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

| 컴포저블 | 설명 |
|----------|------|
| `useFlag(flagName)` | `Ref<FlagProxy>` 반환 |
| `useFlags()` | `Ref<EvaluatedFlag[]>` 반환 — 모든 플래그 |

### Variation 컴포저블

| 컴포저블 | 설명 |
|----------|------|
| `useBoolVariation(flagName, defaultValue)` | `ComputedRef<boolean>` 반환 |
| `useStringVariation(flagName, defaultValue)` | `ComputedRef<string>` 반환 |
| `useNumberVariation(flagName, defaultValue)` | `ComputedRef<number>` 반환 |
| `useJsonVariation<T>(flagName, defaultValue)` | `ComputedRef<T>` (JSON 객체) 반환 |

## 예제

### 조건부 렌더링

```vue
<script setup>
import { useFlag } from '@gatrix/gatrix-vue-client-sdk';
const showNewFeature = useFlag('new-feature');
</script>

<template>
  <NewFeature v-if="showNewFeature.enabled" />
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
