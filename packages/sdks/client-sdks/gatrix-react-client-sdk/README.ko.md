# @gatrix/gatrix-react-client-sdk

Gatrix 플랫폼용 React SDK입니다.

## 설치

```bash
yarn add @gatrix/gatrix-react-client-sdk @gatrix/gatrix-js-client-sdk
# 또는
npm install @gatrix/gatrix-react-client-sdk @gatrix/gatrix-js-client-sdk
```

## 빠른 시작

### 1. GatrixProvider로 앱 감싸기

```tsx
import { GatrixProvider } from '@gatrix/gatrix-react-client-sdk';

function App() {
  return (
    <GatrixProvider
      config={{
        apiUrl: 'https://your-gatrix-server.com/api/v1',
        apiToken: 'your-client-api-token',
        appName: 'my-app',
        environment: 'production',
      }}
    >
      <MyApp />
    </GatrixProvider>
  );
}
```

### 2. 훅으로 피처 플래그 접근

```tsx
import { useFlag, useBoolVariation, useFlags, useFlagsStatus } from '@gatrix/gatrix-react-client-sdk';

function MyComponent() {
  // 준비 상태 확인
  const { flagsReady, flagsError } = useFlagsStatus();

  // 단순 불리언 확인
  const isNewUIEnabled = useFlag('new-ui');

  // 기본값 포함 불리언 배리언트
  const darkMode = useBoolVariation('dark-mode', false);

  // 모든 플래그 가져오기
  const allFlags = useFlags();

  if (!flagsReady) {
    return <Loading />;
  }

  return (
    <div className={darkMode ? 'dark' : 'light'}>{isNewUIEnabled ? <NewUI /> : <OldUI />}</div>
  );
}
```

## API 레퍼런스

### Provider

#### `<GatrixProvider>`

애플리케이션에 Gatrix 컨텍스트를 제공합니다.

```tsx
<GatrixProvider
  config={GatrixClientConfig}    // 필수: SDK 설정
  gatrixClient={GatrixClient}    // 선택: 미리 생성된 클라이언트 인스턴스
  startClient={true}             // 선택: 자동 시작 (기본: true)
  stopClient={true}              // 선택: 언마운트 시 자동 중지 (기본: true)
>
  {children}
</GatrixProvider>
```

### 코어 훅

| 훅 | 설명 |
|----|------|
| `useGatrixClient()` | `GatrixClient` 인스턴스 반환 |
| `useFlagsStatus()` | `{ flagsReady: boolean, flagsError: any }` 반환 |
| `useUpdateContext()` | 컨텍스트 업데이트 함수 반환 |

### 플래그 접근 훅

| 훅 | 설명 |
|----|------|
| `useFlag(flagName)` | `boolean` 반환 — 플래그 활성화 여부 |
| `useFlags()` | `EvaluatedFlag[]` 반환 — 모든 플래그 |
| `useVariant(flagName)` | `Variant` 반환 — 배리언트 객체 |

### Variation 훅

| 훅 | 설명 |
|----|------|
| `useBoolVariation(flagName, defaultValue)` | `boolean` 반환 |
| `useStringVariation(flagName, defaultValue)` | `string` 반환 |
| `useNumberVariation(flagName, defaultValue)` | `number` 반환 |
| `useJsonVariation<T>(flagName, defaultValue)` | `T` (JSON 객체) 반환 |

## 예제

### 조건부 렌더링

```tsx
function FeatureComponent() {
  const showNewFeature = useFlag('new-feature');

  if (!showNewFeature) {
    return null;
  }

  return <NewFeature />;
}
```

### 동적 설정

```tsx
interface Config {
  maxItems: number;
  theme: string;
}

function ConfiguredComponent() {
  const config = useJsonVariation<Config>('app-config', {
    maxItems: 10,
    theme: 'light',
  });

  return (
    <div className={`theme-${config.theme}`}>
      <List maxItems={config.maxItems} />
    </div>
  );
}
```

### 컨텍스트 업데이트

```tsx
function UserLogin() {
  const updateContext = useUpdateContext();

  const handleLogin = async (userId: string) => {
    await updateContext({ userId });
  };

  return <LoginForm onLogin={handleLogin} />;
}
```

### 플래그 대기

```tsx
function App() {
  const { flagsReady, flagsError } = useFlagsStatus();

  if (flagsError) {
    return <ErrorPage error={flagsError} />;
  }

  if (!flagsReady) {
    return <LoadingSpinner />;
  }

  return <MainApp />;
}
```

## 라이선스

MIT

## License

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.
