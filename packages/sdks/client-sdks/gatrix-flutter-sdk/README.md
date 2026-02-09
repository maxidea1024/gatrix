# gatrix_flutter_sdk

Flutter SDK for Gatrix feature flags. Supports real-time flag updates, context-based evaluation, and impression tracking.

## Installation

Add this to your `pubspec.yaml`:

```yaml
dependencies:
  gatrix_flutter_sdk:
    path: ../gatrix-flutter_sdk # or git url
```

Then run `flutter pub get`.

## Quick Start

### 1. Initialize and Provide the Client

```dart
import 'package:flutter/material.dart';
import 'package:gatrix_flutter_sdk/gatrix_flutter_sdk.dart';

void main() async {
  final client = GatrixClient(
    GatrixClientConfig(
      apiUrl: 'https://your-gatrix-server.com/api/v1',
      apiToken: 'your-client-api-token',
      appName: 'my-app',
      environment: 'production',
    ),
  );

  runApp(
    GatrixProvider(
      client: client,
      child: const MyApp(),
    ),
  );
}
```

### 2. Use GatrixFlagBuilder for UI updates

```dart
GatrixFlagBuilder(
  flagName: 'new-ui-feature',
  builder: (context, enabled) {
    return enabled ? const NewUI() : const OldUI();
  },
)
```

### 3. Access Variations Directly

```dart
final client = GatrixProvider.of(context);
bool isDark = client.features.boolVariation('dark-mode', false);
String theme = client.features.variation('theme-color', 'blue');
```

## Features

- **Real-time updates**: Automatically rebuilds UI when flags change via `GatrixFlagBuilder`.
- **Type-safe variations**: Dedicated methods for boolean, string, number, and JSON.
- **Context support**: Easily update user context to trigger re-evaluations.
- **Observability**: Built-in statistics for event handlers and missing flags.

## License

MIT
