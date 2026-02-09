# @gatrix/flutter-sdk

Flutter SDK for the Gatrix platform. Supports real-time flag updates, offline caching, and robust impression tracking.

## Installation

Add this to your `pubspec.yaml`:

```yaml
dependencies:
  gatrix_flutter_sdk:
    path: ../gatrix-flutter_sdk
  shared_preferences: ^2.2.0
  http: ^1.1.0
```

## Quick Start

### 1. Initialize the Client

```dart
final client = GatrixClient(
  GatrixClientConfig(
    apiUrl: 'https://your-gatrix-server.com/api/v1',
    apiToken: 'your-client-api-token',
    appName: 'my-app',
    environment: 'production',
    refreshIntervalSeconds: 60, // Auto-poll every minute
  ),
);
```

### 2. Provide the Client to the Widget Tree

```dart
runApp(
  GatrixProvider(
    client: client,
    child: const MyApp(),
  ),
);
```

### 3. Use GatrixFlagBuilder for Reactive UI

```dart
GatrixFlagBuilder(
  flagName: 'new-feature',
  builder: (context, flag) {
    // flag is a FlagProxy object
    return flag.enabled ? const NewWidget() : const OldWidget();
  },
)
```

## Features

- **Offline Support**: Automatically caches flags in `shared_preferences` for instant startup.
- **Impression Tracking**: Automatically reports flag access to the Gatrix server for analytics.
- **Polling & Real-time**: Automatically refreshes flags in the background based on `refreshIntervalSeconds`.
- **Explicit Sync**: Buffer changes until `client.features.syncFlags()` is called (optional).
- **Type-safe Variations**: Dedicated methods for `bool`, `string`, `number`, and `json`.
- **Advanced Metadata**: Access evaluation reasons and variant details via `boolVariationDetails()`.

## API Reference

### GatrixClientConfig

| Parameter | Default | Description |
|-----------|---------|-------------|
| `apiUrl` | (required) | Gatrix server base URL |
| `apiToken` | (required) | Client SDK token |
| `refreshIntervalSeconds` | 60 | How often to poll for flag updates |
| `metricsIntervalSeconds` | 30 | How often to report impressions/missing metrics |
| `explicitSyncMode` | false | If true, updates are buffered until manually synced |

### Flag Access (via `client.features`)

- `boolVariation(flagName, defaultValue)`
- `stringVariation(flagName, defaultValue)`
- `numberVariation(flagName, defaultValue)`
- `jsonVariation<T>(flagName, defaultValue)`
- `getFlag(flagName)` -> returns `FlagProxy`

### FlagProxy Properties

- `enabled`: boolean
- `variant.name`: string
- `variant.payload`: dynamic
- `reason`: evaluation reason
- `exists`: whether flag was found on server

## License

MIT
