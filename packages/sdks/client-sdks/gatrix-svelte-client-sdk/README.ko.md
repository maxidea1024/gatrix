# Gatrix Svelte SDK

Gatrix 플랫폼용 Svelte SDK — 자동 정리 기능을 갖춘 반응형 피처 플래그 스토어입니다.

`@gatrix/gatrix-js-client-sdk` 위에 구축되어 플래그 접근, 배리에이션, 상태 추적을 위한 관용적 Svelte 스토어를 제공합니다.

## 설치

```bash
yarn add @gatrix/gatrix-svelte-client-sdk @gatrix/gatrix-js-client-sdk
```

## 빠른 시작

### 1. 루트 레이아웃에서 초기화

```svelte
<!-- +layout.svelte -->
<script>
  import { initGatrix } from '@gatrix/gatrix-svelte-client-sdk';

  initGatrix({
    config: {
      apiUrl: 'http://localhost:3400/api/v1',
      apiToken: 'your-client-api-token',
      appName: 'MyApp',
      context: {
        userId: 'user-123',
        properties: { platform: 'web' },
      },
    },
  });
</script>

<slot />
```

### 2. 자식 컴포넌트에서 플래그 사용

```svelte
<script>
  import { flag, numberVariation } from '@gatrix/gatrix-svelte-client-sdk';

  const darkMode = flag('dark-mode');
  const speed = numberVariation('game-speed', 1.0);
</script>

{#if $darkMode}
  <DarkTheme />
{/if}

<p>속도: {$speed}x</p>
```

## API 레퍼런스

### Provider

#### `initGatrix(options)`

루트/레이아웃 컴포넌트에서 초기화 시 호출해야 합니다.

```typescript
interface GatrixInitOptions {
  config?: GatrixClientConfig;
  client?: GatrixClient;     // 기존 클라이언트 인스턴스 사용
  startClient?: boolean;     // 자동 시작, 기본: true
}
```

### 플래그 스토어

#### `flag(flagName): Readable<boolean>`

플래그 활성화 상태를 위한 반응형 불리언 스토어.

```svelte
<script>
  import { flag } from '@gatrix/gatrix-svelte-client-sdk';
  const isEnabled = flag('my-feature');
</script>
{#if $isEnabled}
  <NewFeature />
{/if}
```

#### `flagProxy(flagName): Readable<FlagProxy>`

모든 배리에이션 메서드에 접근 가능한 전체 FlagProxy 스토어.

```svelte
<script>
  import { flagProxy } from '@gatrix/gatrix-svelte-client-sdk';
  const myFlag = flagProxy('my-feature');
</script>
{#if $myFlag.enabled}
  <p>배리언트: {$myFlag.variant.name}</p>
  <p>값: {$myFlag.stringVariation('default')}</p>
{/if}
```

#### `allFlags(): Readable<EvaluatedFlag[]>`

모든 평가된 플래그의 스토어.

```svelte
<script>
  import { allFlags } from '@gatrix/gatrix-svelte-client-sdk';
  const flags = allFlags();
</script>
{#each $flags as f}
  <p>{f.name}: {f.enabled ? 'ON' : 'OFF'}</p>
{/each}
```

### Variation 스토어

모든 variation 스토어는 `Readable<T>`를 반환합니다 — 템플릿에서 `$` 접두사로 사용합니다.

```svelte
<script>
  import { boolVariation, stringVariation, numberVariation, jsonVariation, variant } from '@gatrix/gatrix-svelte-client-sdk';

  const darkMode = boolVariation('dark-mode', false);
  const welcome = stringVariation('welcome-text', 'Hello!');
  const speed = numberVariation('game-speed', 1.0);
  const uiConfig = jsonVariation('ui-config', { theme: 'default' });
  const myVariant = variant('my-flag');
</script>

<p>다크 모드: {$darkMode}</p>
<p>환영: {$welcome}</p>
<p>속도: {$speed}x</p>
<p>테마: {$uiConfig.theme}</p>
<p>배리언트: {$myVariant.name}</p>
```

### 상태

#### `flagsStatus(): FlagsStatus`

SDK 상태를 위한 반응형 스토어를 반환합니다.

```svelte
<script>
  import { flagsStatus } from '@gatrix/gatrix-svelte-client-sdk';
  const { ready, healthy, error } = flagsStatus();
</script>

{#if !$ready}
  <LoadingSpinner />
{:else if $error}
  <ErrorBanner message={$error.message} />
{:else}
  <App />
{/if}
```

### 액션

```svelte
<script>
  import { updateContext, syncFlags, fetchFlags } from '@gatrix/gatrix-svelte-client-sdk';

  const setContext = updateContext();
  const sync = syncFlags();
  const fetch = fetchFlags();
</script>

<button on:click={() => setContext({ userId: 'new-user' })}>
  사용자 전환
</button>
<button on:click={() => sync()}>플래그 동기화</button>
<button on:click={() => fetch()}>새로고침</button>
```

### 직접 클라이언트 접근

```svelte
<script>
  import { getGatrixClient } from '@gatrix/gatrix-svelte-client-sdk';
  const client = getGatrixClient();

  client.on(EVENTS.FLAGS_CHANGE, (data) => {
    console.log('플래그 변경:', data);
  });
</script>
```

## 주요 기능

| 기능 | 설명 |
|------|------|
| **반응형 스토어** | 모든 값이 Svelte `Readable` 스토어 — 플래그 변경 시 자동 업데이트 |
| **자동 정리** | 컴포넌트 파괴 시 스토어 구독 자동 해제 |
| **타입 배리에이션** | `boolVariation`, `stringVariation`, `numberVariation`, `jsonVariation` |
| **FlagProxy** | 플래그 상세, 배리언트, 모든 배리에이션 메서드에 대한 완전한 접근 |
| **상태 추적** | SDK 상태를 위한 `ready`, `healthy`, `error` 스토어 |
| **컨텍스트 관리** | `updateContext()`가 자동 리페치 트리거 |
| **명시적 동기화** | 안전한 게임플레이 중 플래그 적용을 위한 `syncFlags()` |
| **개별 플래그 감시** | 각 스토어가 특정 플래그를 감시하여 세밀한 업데이트 |

## 요구 사항

- Svelte 4.x 또는 5.x
- `@gatrix/gatrix-js-client-sdk`

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
