# Gatrix Unreal SDK

Client SDK for the Gatrix platform in Unreal Engine 4.27+.

## Features

- **Feature Flags**: Real-time flag evaluation with polling and streaming
- **Streaming**: SSE and WebSocket real-time flag invalidation with auto-reconnect
- **Variations**: Bool, String, Float, Int, Double, JSON variation methods
- **Context**: Dynamic evaluation context with custom properties
- **ETag Caching**: Conditional requests to minimize bandwidth
- **Explicit Sync Mode**: Control when flag changes are applied
- **Watch Pattern**: Subscribe to per-flag changes
- **Metrics**: Automatic usage statistics reporting
- **Impressions**: Track flag access events
- **Blueprint Support**: Full Blueprint integration via UCLASS/USTRUCT/UFUNCTION
- **Thread Safe**: Lock-free counters, atomic booleans, FCriticalSection on shared maps

## Installation

1. Copy the `GatrixSDK` folder to your project's `Plugins/` directory
2. Regenerate project files
3. Add `"GatrixSDK"` to your game module's `.Build.cs`:

```csharp
PublicDependencyModuleNames.AddRange(new string[] { "GatrixSDK" });
```

## Quick Start (C++)

```cpp
#include "GatrixClient.h"
#include "GatrixEvents.h"

// Initialize
FGatrixClientConfig Config;
Config.ApiUrl = TEXT("http://localhost:45000/api/v1");
Config.ApiToken = TEXT("your-client-api-token");
Config.AppName = TEXT("MyGame");
Config.Environment = TEXT("production");

// Optional context
Config.Context.UserId = TEXT("player-123");
Config.Context.SessionId = TEXT("session-abc");

UGatrixClient* Client = UGatrixClient::Get();
Client->Init(Config);
Client->Start();

// Subscribe to events (C++)
Client->On(GatrixEvents::FlagsReady, [](const TArray<FString>& Args)
{
    UE_LOG(LogTemp, Log, TEXT("Gatrix SDK ready!"));
});

Client->On(GatrixEvents::FlagsChange, [Client](const TArray<FString>& Args)
{
    float GameSpeed = Client->FloatVariation(TEXT("game-speed"), 1.0f);
    int32 Difficulty = Client->IntVariation(TEXT("difficulty"), 1);
    double Gravity = Client->DoubleVariation(TEXT("gravity"), 9.8);
});

// Direct flag access
bool bFeatureOn = Client->IsEnabled(TEXT("new-feature"));
bool bBool = Client->BoolVariation(TEXT("my-flag"), false);
FString Str = Client->StringVariation(TEXT("theme"), TEXT("default"));
float Num = Client->FloatVariation(TEXT("speed"), 1.0f);
int32 Level = Client->IntVariation(TEXT("level"), 1);

// Watch a specific flag
UGatrixFeaturesClient* Features = Client->GetFeatures();
FGatrixFlagWatchDelegate WatchCallback;
WatchCallback.BindLambda([](UGatrixFlagProxy* Proxy)
{
    UE_LOG(LogTemp, Log, TEXT("Flag changed: %s = %s"),
           *Proxy->GetName(), Proxy->IsEnabled() ? TEXT("ON") : TEXT("OFF"));
});
int32 WatchHandle = Features->WatchFlag(TEXT("my-flag"), WatchCallback);

// Later: unsubscribe
Features->UnwatchFlag(WatchHandle);

// Update context
FGatrixContext NewContext;
NewContext.UserId = TEXT("player-456");
NewContext.Properties.Add(TEXT("level"), TEXT("5"));
Client->UpdateContext(NewContext);

// Stop when done
Client->Stop();
```

### Streaming Configuration

Enable SSE or WebSocket streaming for near-instant flag updates:

```cpp
// SSE streaming (default)
Config.Features.Streaming.bEnabled = true;
Config.Features.Streaming.Transport = EGatrixStreamingTransport::Sse;
Config.Features.Streaming.Sse.ReconnectBase = 1;  // seconds
Config.Features.Streaming.Sse.ReconnectMax = 30;   // seconds

// Or WebSocket streaming
Config.Features.Streaming.Transport = EGatrixStreamingTransport::WebSocket;
Config.Features.Streaming.WebSocket.PingInterval = 30;   // seconds
Config.Features.Streaming.WebSocket.ReconnectBase = 1;
Config.Features.Streaming.WebSocket.ReconnectMax = 30;

// Custom streaming URL (optional, auto-derived from ApiUrl by default)
Config.Features.Streaming.Sse.Url = TEXT("https://example.com/streaming/sse");

// Listen for streaming events
Client->On(GatrixEvents::FlagsStreamingConnected, [](const TArray<FString>& Args)
{
    UE_LOG(LogTemp, Log, TEXT("Streaming connected!"));
});

Client->On(GatrixEvents::FlagsStreamingError, [](const TArray<FString>& Args)
{
    UE_LOG(LogTemp, Warning, TEXT("Streaming error: %s"),
           Args.Num() > 0 ? *Args[0] : TEXT("unknown"));
});
```

### POST Method for Flag Fetching

Use POST requests to send context in the request body (for large contexts):

```cpp
Config.Features.bUsePOSTRequests = true;
```

## Quick Start (Blueprint)

1. Use **"Get Gatrix Client"** node to get the singleton
2. Call **Init** with a `GatrixClientConfig` struct
3. Call **Start** to begin fetching
4. Use **Bool Variation**, **String Variation**, etc. for flag values
5. Bind to **OnReady**, **OnChange**, **OnError** events

### Blueprint Events

| Event | Description |
|-------|-------------|
| `OnReady` | First successful fetch completed |
| `OnChange` | Flags changed from server |
| `OnSync` | Flags synchronized (explicit sync mode) |
| `OnRecovered` | SDK recovered from error state |
| `OnError` | SDK error occurred |
| `OnImpression` | Flag impression recorded |

## Architecture

```
UGatrixClient (Singleton)
├── FGatrixEventEmitter (thread-safe on/once/off/onAny)
├── IGatrixStorageProvider (pluggable storage)
└── UGatrixFeaturesClient
    ├── HTTP Fetching (FHttpModule + ETag)
    ├── Flag Storage (FCriticalSection protected)
    ├── Polling (UWorld TimerManager + jitter)
    ├── Streaming
    │   ├── FGatrixSseConnection (SSE via FHttpModule progress)
    │   ├── FGatrixWebSocketConnection (IWebSocket + ping/pong)
    │   ├── Gap Recovery (globalRevision tracking)
    │   └── Auto-Reconnect (exponential backoff + jitter)
    ├── Metrics (batched POST with retry)
    ├── Watch Pattern (per-flag events)
    └── Blueprint Delegates
```

## Thread Safety

- Flag read/write operations are protected by `FCriticalSection`
- Statistics counters use lock-free `FThreadSafeCounter` (no lock contention)
- Boolean state flags use `std::atomic<bool>` for lock-free access
- HTTP callbacks are handled on the game thread (UE4 FHttpModule behavior)
- Streaming callbacks are dispatched to game thread via `AsyncTask`
- Event emission collects callbacks under lock, then invokes outside lock to prevent deadlocks
- Storage provider (InMemory) uses its own `FCriticalSection`

## Event Constants

All events use the `flags.` prefix namespace:

| Constant | Value |
|----------|-------|
| `GatrixEvents::FlagsInit` | `flags.init` |
| `GatrixEvents::FlagsReady` | `flags.ready` |
| `GatrixEvents::FlagsFetchStart` | `flags.fetch_start` |
| `GatrixEvents::FlagsFetchSuccess` | `flags.fetch_success` |
| `GatrixEvents::FlagsFetchError` | `flags.fetch_error` |
| `GatrixEvents::FlagsFetchEnd` | `flags.fetch_end` |
| `GatrixEvents::FlagsChange` | `flags.change` |
| `GatrixEvents::SdkError` | `flags.error` |
| `GatrixEvents::FlagsImpression` | `flags.impression` |
| `GatrixEvents::FlagsSync` | `flags.sync` |
| `GatrixEvents::FlagsRecovered` | `flags.recovered` |
| `GatrixEvents::FlagsMetricsSent` | `flags.metrics_sent` |
| `GatrixEvents::FlagsMetricsError` | `flags.metrics_error` |
| `GatrixEvents::FlagsStreamingConnected` | `flags.streaming_connected` |
| `GatrixEvents::FlagsStreamingDisconnected` | `flags.streaming_disconnected` |
| `GatrixEvents::FlagsStreamingError` | `flags.streaming_error` |
| `GatrixEvents::FlagsStreamingReconnecting` | `flags.streaming_reconnecting` |
| `GatrixEvents::FlagsInvalidated` | `flags.invalidated` |

## Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ApiUrl` | FString | - | Base API URL (required) |
| `ApiToken` | FString | - | Client API token (required) |
| `AppName` | FString | - | Application name (required) |
| `Environment` | FString | - | Environment name (required) |
| `bOfflineMode` | bool | false | Start in offline mode |
| `Features.RefreshInterval` | float | 30.0 | Seconds between polls |
| `Features.bDisableRefresh` | bool | false | Disable automatic polling |
| `Features.bExplicitSyncMode` | bool | false | Manual flag sync |
| `Features.bDisableMetrics` | bool | false | Disable metrics |
| `Features.bUsePOSTRequests` | bool | false | Use POST for fetching |
| `Features.Streaming.bEnabled` | bool | false | Enable streaming |
| `Features.Streaming.Transport` | enum | Sse | SSE or WebSocket |
| `Features.Streaming.Sse.Url` | FString | auto | Custom SSE endpoint |
| `Features.Streaming.Sse.ReconnectBase` | int32 | 1 | Base reconnect delay (s) |
| `Features.Streaming.Sse.ReconnectMax` | int32 | 30 | Max reconnect delay (s) |
| `Features.Streaming.WebSocket.Url` | FString | auto | Custom WS endpoint |
| `Features.Streaming.WebSocket.PingInterval` | int32 | 30 | Ping interval (s) |
| `Features.Streaming.WebSocket.ReconnectBase` | int32 | 1 | Base reconnect delay (s) |
| `Features.Streaming.WebSocket.ReconnectMax` | int32 | 30 | Max reconnect delay (s) |

## License

Copyright Gatrix. All Rights Reserved.
