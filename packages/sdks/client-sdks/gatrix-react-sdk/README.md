# @gatrix/react-sdk

React SDK for Gatrix feature flags.

## Installation

```bash
yarn add @gatrix/react-sdk @gatrix/js-client-sdk
# or
npm install @gatrix/react-sdk @gatrix/js-client-sdk
```

## Quick Start

### 1. Wrap your app with GatrixProvider

```tsx
import { GatrixProvider } from '@gatrix/react-sdk';

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

### 2. Use hooks to access feature flags

```tsx
import { useFlag, useBoolVariation, useFlags, useFlagsStatus } from '@gatrix/react-sdk';

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

## License

MIT
