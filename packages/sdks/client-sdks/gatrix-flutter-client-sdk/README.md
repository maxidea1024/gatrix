# @gatrix/flutter-sdk

Flutter SDK for the Gatrix platform. Supports real-time flag updates, offline caching, and robust impression tracking.

## Installation

Add this to your `pubspec.yaml`:

```yaml
dependencies:
  gatrix_flutter_client_sdk:
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
    features: FeaturesConfig(
      refreshInterval: 60,    // Auto-poll every 60 seconds
      explicitSyncMode: true, // Buffer changes until syncFlags() is called
      context: GatrixContext(userId: 'user-123'),
    ),
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
- **Polling & Real-time**: Automatically refreshes flags in the background based on `features.refreshInterval`.
- **Explicit Sync**: Buffer changes until `client.features.syncFlags()` is called (optional).
- **Type-safe Variations**: Dedicated methods for `bool`, `string`, `number`, and `json`.
- **Advanced Metadata**: Access evaluation reasons and variant details via `boolVariationDetails()`.

## API Reference

### GatrixClientConfig

| Parameter       | Default            | Description                        |
| --------------- | ------------------ | ---------------------------------- |
| `apiUrl`        | (required)         | Gatrix server base URL             |
| `apiToken`      | (required)         | Client SDK token                   |
| `appName`       | (required)         | Application name                   |
| `environment`   | (required)         | Environment name (e.g. production) |
| `customHeaders` | `null`             | Extra HTTP headers                 |
| `enableDevMode` | `false`            | Enable debug logging               |
| `features`      | `FeaturesConfig()` | Feature flag configuration         |

### FeaturesConfig

| Parameter           | Default          | Description                                       |
| ------------------- | ---------------- | ------------------------------------------------- |
| `context`           | `null`           | Initial evaluation context                        |
| `offlineMode`       | `false`          | Start in offline mode (no network requests)       |
| `refreshInterval`   | `30.0`           | Polling interval in seconds                       |
| `disableRefresh`    | `false`          | Disable automatic polling                         |
| `explicitSyncMode`  | `true`           | Buffer flag changes until `syncFlags()` is called |
| `bootstrap`         | `null`           | Initial flags for instant startup                 |
| `bootstrapOverride` | `true`           | Override stored flags with bootstrap data         |
| `disableMetrics`    | `false`          | Disable metrics/impressions collection            |
| `metricsInterval`   | `60.0`           | Metrics reporting interval in seconds             |
| `impressionDataAll` | `false`          | Track impressions for all flag accesses           |
| `cacheKeyPrefix`    | `'gatrix_cache'` | Storage key prefix                                |
| `streaming`         | `null`           | Streaming configuration (SSE or WebSocket)        |

### Flag Access (via `client.features`)

All variation methods accept an optional `forceRealtime: bool` parameter (default: `true`).
When `forceRealtime: true`, the method reads directly from the realtime flag state, bypassing the synchronized snapshot used in explicit sync mode.

| Method                   | Signature                                                         | Description                              |
| ------------------------ | ----------------------------------------------------------------- | ---------------------------------------- |
| `isEnabled`              | `isEnabled(flagName, {forceRealtime})`                            | Returns `bool` — whether flag is enabled |
| `boolVariation`          | `boolVariation(flagName, defaultValue, {forceRealtime})`          | Returns `bool`                           |
| `stringVariation`        | `stringVariation(flagName, defaultValue, {forceRealtime})`        | Returns `String`                         |
| `intVariation`           | `intVariation(flagName, defaultValue, {forceRealtime})`           | Returns `int`                            |
| `doubleVariation`        | `doubleVariation(flagName, defaultValue, {forceRealtime})`        | Returns `double`                         |
| `jsonVariation<T>`       | `jsonVariation<T>(flagName, defaultValue, {forceRealtime})`       | Returns `T`                              |
| `boolVariationDetails`   | `boolVariationDetails(flagName, defaultValue, {forceRealtime})`   | Returns `VariationResult<bool>`          |
| `stringVariationDetails` | `stringVariationDetails(flagName, defaultValue, {forceRealtime})` | Returns `VariationResult<String>`        |
| `getFlag`                | `getFlag(flagName, {forceRealtime})`                              | Returns `EvaluatedFlag?`                 |

### Watch for Changes (via `client.features`)

Two watch modes available:

| Method              | Callback timing                                                                     |
| ------------------- | ----------------------------------------------------------------------------------- |
| `watchSyncedFlag`   | In `explicitSyncMode`: fires after `syncFlags()`. In normal mode: fires immediately |
| `watchRealtimeFlag` | Always fires immediately when server fetch brings new data                          |

```dart
// Synced watch (recommended for game logic / UI rendering)
final unwatch = client.features.watchSyncedFlag('my-feature', (flag) {
  print('changed: ${flag.enabled}');
});

// Synced watch with immediate initial state callback
client.features.watchSyncedFlagWithInitialState('my-feature', (flag) {
  applyFeature(flag.enabled);
});

// Realtime watch - fires immediately regardless of explicitSyncMode
final unwatchRt = client.features.watchRealtimeFlag('debug-flag', (flag) {
  updateDebugUI(flag.enabled);
});

// Watch group (batch management)
final group = client.features.createWatchFlagGroup('scene-group');
group
  .watchRealtimeFlag('flagA', handlerA)
  .watchSyncedFlag('flagB', handlerB)
  .watchSyncedFlagWithInitialState('flagC', handlerC);

// Unwatch all at once
group.unwatchAll();
unwatch();
```

### FlagProxy Properties

- `enabled`: `bool` — whether the flag is on
- `variant.name`: `String` — variant name
- `variant.value`: `dynamic` — variant payload value
- `reason`: evaluation reason string
- `exists`: `bool` — whether flag was found on server

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
