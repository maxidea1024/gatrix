# @gatrix/gatrix-angular-client-sdk

Gatrix 플랫폼용 Angular SDK입니다.

## 설치

```bash
yarn add @gatrix/gatrix-angular-client-sdk @gatrix/gatrix-js-client-sdk
# 또는
npm install @gatrix/gatrix-angular-client-sdk @gatrix/gatrix-js-client-sdk
```

## 빠른 시작

### 방법 1: Standalone API (Angular 17+ 권장)

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { provideGatrix } from '@gatrix/gatrix-angular-client-sdk';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideGatrix({
      apiUrl: 'https://your-gatrix-server.com/api/v1',
      apiToken: 'your-client-api-token',
      appName: 'my-app',
    }),
  ],
});
```

### 방법 2: NgModule

```typescript
import { NgModule } from '@angular/core';
import { GatrixModule } from '@gatrix/gatrix-angular-client-sdk';

@NgModule({
  imports: [
    GatrixModule.forRoot({
      apiUrl: 'https://your-gatrix-server.com/api/v1',
      apiToken: 'your-client-api-token',
      appName: 'my-app',
    }),
  ],
})
export class AppModule {}
```

### 2. Inject 함수를 사용하여 피처 플래그에 접근합니다

```typescript
import { Component } from '@angular/core';
import {
  injectFlag,
  injectBoolVariation,
  injectFlags,
  injectFlagsStatus,
} from '@gatrix/gatrix-angular-client-sdk';

@Component({
  selector: 'app-root',
  template: `
    @if (!status.ready()) {
      <div>로딩 중...</div>
    } @else if (status.error()) {
      <div>오류: {{ status.error()!.message }}</div>
    } @else {
      <div [class.dark]="darkMode()">
        @if (isNewUIEnabled()) {
          <app-new-ui />
        } @else {
          <app-old-ui />
        }
      </div>
    }
  `,
})
export class AppComponent {
  readonly status = injectFlagsStatus();
  readonly isNewUIEnabled = injectFlag('new-ui');
  readonly darkMode = injectBoolVariation('dark-mode', false);
  readonly allFlags = injectFlags();
}
```

## API 참조

### 모듈 / 프로바이더

#### `GatrixModule.forRoot(config)`

NgModule 기반 설정입니다. `GatrixService`를 제공하고 클라이언트를 시작합니다.

```typescript
GatrixModule.forRoot({
  apiUrl: string,       // 필수: Edge API 기본 URL
  apiToken: string,     // 필수: 클라이언트 API 토큰
  appName: string,      // 필수: 애플리케이션 이름
  features?: { ... },   // 선택: 피처 설정
})
```

#### `provideGatrix(config, options?)`

Angular 14+ Standalone API입니다.

```typescript
provideGatrix(config: GatrixClientConfig, options?: {
  startClient?: boolean, // 선택: 자동 시작 여부 (기본값: true)
})
```

#### `provideGatrixClient(client, options?)`

미리 생성한 `GatrixClient` 인스턴스를 제공합니다.

```typescript
provideGatrixClient(client: GatrixClient, options?: {
  startClient?: boolean,
})
```

### 서비스

#### `GatrixService`

`GatrixClient`를 래핑하는 Injectable 서비스입니다. `GatrixModule.forRoot()` 또는 `provideGatrix()` 이후에 사용할 수 있습니다.

| 속성 | 타입 | 설명 |
|---|---|---|
| `client` | `GatrixClient` | GatrixClient 인스턴스 |
| `ready$` | `BehaviorSubject<boolean>` | SDK 준비 완료 시 emit |
| `healthy$` | `BehaviorSubject<boolean>` | 현재 상태 emit |
| `error$` | `BehaviorSubject<Error \| null>` | 최신 오류 또는 null emit |

### 핵심 Inject 함수

모든 inject 함수는 [인젝션 컨텍스트](https://angular.dev/guide/di/dependency-injection-context) 내에서 호출해야 합니다 (생성자, 필드 초기화, 또는 `runInInjectionContext`).

| 함수 | 반환 타입 | 설명 |
|---|---|---|
| `injectGatrixClient()` | `GatrixClient` | `GatrixClient` 인스턴스 반환 |
| `injectGatrixService()` | `GatrixService` | `GatrixService` 인스턴스 반환 |
| `injectFlagsStatus()` | `{ ready: Signal, error: Signal, healthy: Signal }` | SDK 상태 시그널 반환 |
| `injectUpdateContext()` | `(ctx) => Promise<void>` | 컨텍스트 업데이트 함수 반환 |
| `injectSyncFlags()` | `(fetchNow?) => Promise<void>` | 플래그 동기화 함수 반환 |
| `injectFetchFlags()` | `() => Promise<void>` | 플래그 가져오기 함수 반환 |
| `injectTrack()` | `(name, props?) => void` | 이벤트 추적 함수 반환 |

### 플래그 접근 Inject 함수

모든 플래그 접근 함수는 선택적 `forceRealtime` 매개변수 (기본값: `true`)를 받습니다. `true`일 경우, 명시적 동기화 모드와 관계없이 실시간 플래그를 읽습니다.

| 함수 | 반환 타입 | 설명 |
|---|---|---|
| `injectFlag(flagName, forceRealtime?)` | `Signal<boolean>` | 플래그 활성화 상태 |
| `injectFlagProxy(flagName, forceRealtime?)` | `Signal<FlagProxy \| null>` | 전체 FlagProxy |
| `injectVariant(flagName, forceRealtime?)` | `Signal<Variant \| undefined>` | 플래그 배리언트 |
| `injectFlags(forceRealtime?)` | `Signal<EvaluatedFlag[]>` | 모든 평가된 플래그 |

### 배리에이션 Inject 함수

모든 배리에이션 함수는 세 번째 인자로 선택적 `forceRealtime` 매개변수 (기본값: `true`)를 받습니다.

| 함수 | 반환 타입 | 설명 |
|---|---|---|
| `injectBoolVariation(flagName, fallbackValue, forceRealtime?)` | `Signal<boolean>` | Boolean 배리에이션 |
| `injectStringVariation(flagName, fallbackValue, forceRealtime?)` | `Signal<string>` | String 배리에이션 |
| `injectNumberVariation(flagName, fallbackValue, forceRealtime?)` | `Signal<number>` | Number 배리에이션 |
| `injectJsonVariation<T>(flagName, fallbackValue, forceRealtime?)` | `Signal<T>` | JSON 객체 배리에이션 |

## 사용 예시

### 조건부 렌더링

```typescript
import { Component } from '@angular/core';
import { injectFlag } from '@gatrix/gatrix-angular-client-sdk';

@Component({
  selector: 'app-feature',
  template: `
    @if (showNewFeature()) {
      <app-new-feature />
    }
  `,
})
export class FeatureComponent {
  readonly showNewFeature = injectFlag('new-feature');
}
```

### 동적 설정

```typescript
import { Component } from '@angular/core';
import { injectJsonVariation } from '@gatrix/gatrix-angular-client-sdk';

@Component({
  selector: 'app-config',
  template: `
    <div [class]="'theme-' + config().theme">
      <app-list [maxItems]="config().maxItems" />
    </div>
  `,
})
export class ConfigComponent {
  readonly config = injectJsonVariation('app-config', {
    maxItems: 10,
    theme: 'light',
  });
}
```

### 컨텍스트 업데이트

```typescript
import { Component } from '@angular/core';
import { injectUpdateContext } from '@gatrix/gatrix-angular-client-sdk';

@Component({
  selector: 'app-login',
  template: `<button (click)="handleLogin('user-123')">로그인</button>`,
})
export class LoginComponent {
  private readonly updateContext = injectUpdateContext();

  async handleLogin(userId: string) {
    await this.updateContext({ userId });
  }
}
```

## ⚠️ 필수 사항

### 모든 플래그 상태를 테스트하세요

모든 피처 플래그는 **최소 두 개의 코드 경로** (켜짐과 꺼짐)를 만들어냅니다. 두 경로 모두 테스트해야 합니다. 테스트되지 않은 경로는 결국 프로덕션에 도달하는 시한폭탄과 같습니다.

| 테스트 항목 | 이유 |
|---|---|
| 플래그 **ON** | 새로운 동작이 올바르게 작동하는지 확인합니다 |
| 플래그 **OFF** | 원래 동작이 여전히 작동하는지 확인합니다 — 이 항목은 종종 잊혀집니다 |
| 세션 중 플래그 **전환** | 실시간 모드를 사용하는 경우, 크래시나 일관성 없는 상태가 없는지 확인합니다 |
| **기본값** 경로 | 서버에 플래그가 없을 때의 동작을 확인합니다 (네트워크 오류, 새 환경 등) |

### 의존성을 신중하게 처리하세요

플래그를 전환하면 사용되는 객체, 모듈 또는 리소스가 변경될 수 있습니다. 해당 의존성이 준비되지 않으면 크래시나 정의되지 않은 동작이 발생합니다.

**일반적인 함정:** 플래그 A가 플래그 B에 의해 초기화된 객체에 의존하는 기능을 활성화합니다. A는 켜져 있지만 B가 꺼져 있으면, 객체가 존재하지 않아 크래시가 발생합니다.

**예방 방법:**

- 플래그 상태와 관계없이 _필요할 수 있는_ 모든 리소스를 초기화하거나,
- null 체크와 함께 지연 초기화를 사용하거나,
- `ExplicitSyncMode`를 사용하여 모든 의존성을 함께 해결할 수 있는 안전한 시점에서만 플래그 변경을 적용합니다

### 모든 플래그를 문서화하세요

플래그를 만들 때, 팀에게 다음 사항을 명확히 전달하세요:

| 항목 | 설명 |
|---|---|
| **목적** | 이 플래그는 무엇을 제어합니까? 왜 존재합니까? |
| **영향 범위** | 어떤 화면, 시스템 또는 API가 영향을 받습니까? |
| **부작용** | 전환 시 무엇이 변경됩니까? 성능, 데이터 또는 UX에 영향이 있습니까? |
| **의존성** | 이 플래그가 다른 플래그나 시스템 상태에 의존합니까? |
| **담당자** | 이 플래그의 담당자는 누구입니까? |
| **만료일** | 이 플래그는 언제 제거해야 합니까? |

문서화되지 않은 플래그는 혼란의 원인이 되고, 결국 인시던트로 이어집니다.

## 📚 참고 자료

**개념:**

- [Feature Toggles (aka Feature Flags)](https://martinfowler.com/articles/feature-toggles.html) — Martin Fowler
- [What are Feature Flags?](https://www.atlassian.com/continuous-delivery/principles/feature-flags) — Atlassian

**사례 연구:**

- [How We Ship Code Faster and Safer with Feature Flags](https://github.blog/engineering/infrastructure/ship-code-faster-safer-feature-flags/) — GitHub Engineering
- [Deploys at Slack](https://slack.engineering/deploys-at-slack/) — Slack Engineering
- [Preparing the Netflix API for Deployment](https://netflixtechblog.com/preparing-the-netflix-api-for-deployment-786d8f58090d) — Netflix Tech Blog
- [Progressive Experimentation with Feature Flags](https://learn.microsoft.com/en-us/devops/operate/progressive-experimentation-feature-flags) — Microsoft

**트렁크 기반 개발:**

- [Feature Flags in Trunk-Based Development](https://trunkbaseddevelopment.com/feature-flags/) — trunkbaseddevelopment.com
- [Trunk-Based Development Best Practices](https://www.atlassian.com/continuous-delivery/continuous-integration/trunk-based-development) — Atlassian

## 라이선스

이 프로젝트는 MIT 라이선스에 따라 배포됩니다 - 자세한 내용은 [LICENSE](../../../../LICENSE) 파일을 참조하세요.
