# @gatrix/gatrix-angular-client-sdk

Angular SDK for the Gatrix platform.

## Installation

```bash
yarn add @gatrix/gatrix-angular-client-sdk @gatrix/gatrix-js-client-sdk
# or
npm install @gatrix/gatrix-angular-client-sdk @gatrix/gatrix-js-client-sdk
```

## Quick Start

### Option 1: Standalone API (Recommended for Angular 17+)

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

### Option 2: NgModule

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

### 2. Use inject functions to access feature flags

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
      <div>Loading...</div>
    } @else if (status.error()) {
      <div>Error: {{ status.error()!.message }}</div>
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

## API Reference

### Module / Providers

#### `GatrixModule.forRoot(config)`

NgModule-based setup. Provides `GatrixService` and starts the client.

```typescript
GatrixModule.forRoot({
  apiUrl: string,       // Required: Edge API base URL
  apiToken: string,     // Required: Client API token
  appName: string,      // Required: Application name
  features?: { ... },   // Optional: Features configuration
})
```

#### `provideGatrix(config, options?)`

Standalone API for Angular 14+.

```typescript
provideGatrix(config: GatrixClientConfig, options?: {
  startClient?: boolean, // Optional: Auto-start client (default: true)
})
```

#### `provideGatrixClient(client, options?)`

Provide a pre-created `GatrixClient` instance.

```typescript
provideGatrixClient(client: GatrixClient, options?: {
  startClient?: boolean,
})
```

### Service

#### `GatrixService`

Injectable service wrapping `GatrixClient`. Available after `GatrixModule.forRoot()` or `provideGatrix()`.

| Property | Type | Description |
|---|---|---|
| `client` | `GatrixClient` | The underlying GatrixClient instance |
| `ready$` | `BehaviorSubject<boolean>` | Emits when SDK is ready |
| `healthy$` | `BehaviorSubject<boolean>` | Emits current health status |
| `error$` | `BehaviorSubject<Error \| null>` | Emits latest error or null |

### Core Inject Functions

All inject functions must be called within an [injection context](https://angular.dev/guide/di/dependency-injection-context) (constructor, field initializer, or `runInInjectionContext`).

| Function | Return Type | Description |
|---|---|---|
| `injectGatrixClient()` | `GatrixClient` | Returns the `GatrixClient` instance |
| `injectGatrixService()` | `GatrixService` | Returns the `GatrixService` instance |
| `injectFlagsStatus()` | `{ ready: Signal, error: Signal, healthy: Signal }` | Returns SDK status signals |
| `injectUpdateContext()` | `(ctx) => Promise<void>` | Returns context update function |
| `injectSyncFlags()` | `(fetchNow?) => Promise<void>` | Returns sync flags function |
| `injectFetchFlags()` | `() => Promise<void>` | Returns fetch flags function |
| `injectTrack()` | `(name, props?) => void` | Returns event tracking function |

### Flag Access Inject Functions

All flag access functions accept an optional `forceRealtime` parameter (default: `true`). When `true`, reads from realtime flags regardless of explicit sync mode.

| Function | Return Type | Description |
|---|---|---|
| `injectFlag(flagName, forceRealtime?)` | `Signal<boolean>` | Flag enabled state |
| `injectFlagProxy(flagName, forceRealtime?)` | `Signal<FlagProxy \| null>` | Full FlagProxy |
| `injectVariant(flagName, forceRealtime?)` | `Signal<Variant \| undefined>` | Flag variant |
| `injectFlags(forceRealtime?)` | `Signal<EvaluatedFlag[]>` | All evaluated flags |

### Variation Inject Functions

All variation functions accept an optional `forceRealtime` parameter (default: `true`) as the third argument.

| Function | Return Type | Description |
|---|---|---|
| `injectBoolVariation(flagName, fallbackValue, forceRealtime?)` | `Signal<boolean>` | Boolean variation |
| `injectStringVariation(flagName, fallbackValue, forceRealtime?)` | `Signal<string>` | String variation |
| `injectNumberVariation(flagName, fallbackValue, forceRealtime?)` | `Signal<number>` | Number variation |
| `injectJsonVariation<T>(flagName, fallbackValue, forceRealtime?)` | `Signal<T>` | JSON object variation |

## Examples

### Conditional Rendering

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

### Dynamic Configuration

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

### Updating Context

```typescript
import { Component } from '@angular/core';
import { injectUpdateContext } from '@gatrix/gatrix-angular-client-sdk';

@Component({
  selector: 'app-login',
  template: `<button (click)="handleLogin('user-123')">Login</button>`,
})
export class LoginComponent {
  private readonly updateContext = injectUpdateContext();

  async handleLogin(userId: string) {
    await this.updateContext({ userId });
  }
}
```

## ⚠️ Essential Practices

### Test All Flag States

Every feature flag creates **at least two code paths** (on and off). Both must be tested. Untested paths are ticking time bombs that will eventually reach production.

| What to test | Why |
|---|---|
| Flag **ON** | Verify the new behavior works correctly |
| Flag **OFF** | Verify the original behavior still works — this is often forgotten |
| Flag **toggled mid-session** | If using real-time mode, verify no crashes or inconsistent state |
| **Default value** path | Verify behavior when the flag doesn't exist on the server (network error, new environment, etc.) |

### Handle Dependencies Carefully

Toggling a flag can change which objects, modules, or resources are used. If those dependencies aren't ready, you get crashes or undefined behavior.

**Common pitfall:** Flag A enables a feature that depends on an object initialized by Flag B. If A is on but B is off, the object doesn't exist → crash.

**How to prevent:**

- Initialize all resources that _might_ be needed regardless of flag state, or
- Use lazy initialization with null checks, or
- Use `ExplicitSyncMode` to apply flag changes only at safe points where all dependencies can be resolved together

### Document Every Flag

When creating a flag, clearly communicate the following to your team:

| Item | Description |
|---|---|
| **Purpose** | What does this flag control? Why does it exist? |
| **Affected areas** | Which screens, systems, or APIs are impacted? |
| **Side effects** | What changes when flipped? Any performance, data, or UX implications? |
| **Dependencies** | Does this flag depend on other flags or system state? |
| **Owner** | Who is responsible for this flag? |
| **Expiration** | When should this flag be removed? |

Undocumented flags become a source of confusion, and eventually, incidents.

## 📚 References

**Concepts:**

- [Feature Toggles (aka Feature Flags)](https://martinfowler.com/articles/feature-toggles.html) — Martin Fowler
- [What are Feature Flags?](https://www.atlassian.com/continuous-delivery/principles/feature-flags) — Atlassian

**Use Cases & Case Studies:**

- [How We Ship Code Faster and Safer with Feature Flags](https://github.blog/engineering/infrastructure/ship-code-faster-safer-feature-flags/) — GitHub Engineering
- [Deploys at Slack](https://slack.engineering/deploys-at-slack/) — Slack Engineering
- [Preparing the Netflix API for Deployment](https://netflixtechblog.com/preparing-the-netflix-api-for-deployment-786d8f58090d) — Netflix Tech Blog
- [Progressive Experimentation with Feature Flags](https://learn.microsoft.com/en-us/devops/operate/progressive-experimentation-feature-flags) — Microsoft

**Trunk-Based Development:**

- [Feature Flags in Trunk-Based Development](https://trunkbaseddevelopment.com/feature-flags/) — trunkbaseddevelopment.com
- [Trunk-Based Development Best Practices](https://www.atlassian.com/continuous-delivery/continuous-integration/trunk-based-development) — Atlassian

## License

This project is licensed under the MIT License - see the [LICENSE](../../../../LICENSE) file for details.
