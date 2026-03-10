# @gatrix/gatrix-react-client-sdk

React SDK for the Gatrix platform.

## Installation

```bash
yarn add @gatrix/gatrix-react-client-sdk @gatrix/gatrix-js-client-sdk
# or
npm install @gatrix/gatrix-react-client-sdk @gatrix/gatrix-js-client-sdk
```

## Quick Start

### 1. Wrap your app with GatrixProvider

```tsx
import { GatrixProvider } from '@gatrix/gatrix-react-client-sdk';

function App() {
  return (
    <GatrixProvider
      config={{
        apiUrl: 'https://your-gatrix-server.com/api/v1',
        apiToken: 'your-client-api-token',
        appName: 'my-app',
      }}
    >
      <MyApp />
    </GatrixProvider>
  );
}
```

### 2. Use hooks to access feature flags

```tsx
import { useFlag, useBoolVariation, useFlags, useFlagsStatus } from '@gatrix/gatrix-react-client-sdk';

function MyComponent() {
  // Check if ready
  const { flagsReady, flagsError } = useFlagsStatus();

  // Simple boolean check
  const isNewUIEnabled = useFlag('new-ui');

  // Boolean variation with default
  const darkMode = useBoolVariation('dark-mode', false);

  // Get all flags
  const allFlags = useFlags();

  if (!flagsReady) {
    return <Loading />;
  }

  return (
    <div className={darkMode ? 'dark' : 'light'}>{isNewUIEnabled ? <NewUI /> : <OldUI />}</div>
  );
}
```

## API Reference

### Provider

#### `<GatrixProvider>`

Wraps your application to provide Gatrix context.

```tsx
<GatrixProvider
  config={GatrixClientConfig} // Required: SDK configuration
  gatrixClient={GatrixClient} // Optional: Pre-created client instance
  startClient={true} // Optional: Auto-start client (default: true)
  stopClient={true} // Optional: Auto-stop on unmount (default: true)
>
  {children}
</GatrixProvider>
```

### Core Hooks

| Hook                 | Description                                        |
| -------------------- | -------------------------------------------------- |
| `useGatrixClient()`  | Returns the `GatrixClient` instance                |
| `useFlagsStatus()`   | Returns `{ flagsReady: boolean, flagsError: any }` |
| `useUpdateContext()` | Returns function to update context                 |

### Flag Access Hooks

| Hook                   | Description                                 |
| ---------------------- | ------------------------------------------- |
| `useFlag(flagName)`    | Returns `boolean` - whether flag is enabled |
| `useFlags()`           | Returns `EvaluatedFlag[]` - all flags       |
| `useVariant(flagName)` | Returns `Variant` - variant object          |

### Variation Hooks

| Hook                                          | Description               |
| --------------------------------------------- | ------------------------- |
| `useBoolVariation(flagName, defaultValue)`    | Returns `boolean`         |
| `useStringVariation(flagName, defaultValue)`  | Returns `string`          |
| `useNumberVariation(flagName, defaultValue)`  | Returns `number`          |
| `useJsonVariation<T>(flagName, defaultValue)` | Returns `T` (JSON object) |

## Examples

### Conditional Rendering

```tsx
function FeatureComponent() {
  const showNewFeature = useFlag('new-feature');

  if (!showNewFeature) {
    return null;
  }

  return <NewFeature />;
}
```

### Dynamic Configuration

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

### Updating Context

```tsx
function UserLogin() {
  const updateContext = useUpdateContext();

  const handleLogin = async (userId: string) => {
    await updateContext({ userId });
  };

  return <LoginForm onLogin={handleLogin} />;
}
```

### Waiting for Flags

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
