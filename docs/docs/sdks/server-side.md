---
sidebar_position: 1
---

# Server-side SDKs

Gatrix provides various server-side SDKs to integrate feature flagging into your backend services with high performance and reliability.

## Available SDKs

- **Node.js**: [Docs](/docs/sdks/node)
- **Java**: [Docs](/docs/sdks/java)
- **Python**: [Docs](/docs/sdks/python)
- **Go**: [Docs](/docs/sdks/go)
- **.NET**: [Docs](/docs/sdks/dotnet)
- **Rust**: [Docs](/docs/sdks/rust)
- **Elixir**: [Docs](/docs/sdks/elixir)
- **C++**: [Docs](/docs/sdks/cpp)
- **Ruby**: [Docs](/docs/sdks/ruby)
- **PHP**: [Docs](/docs/sdks/php)

## Integration Workflow

1. **Install the SDK**: Add the Gatrix SDK package to your project.
2. **Initialize the Client**: Set up the SDK with your Environment Key.
3. **Evaluate Flags**: Use the client to evaluate feature flags for your users.

## Key Features

- **Local Evaluation**: Flags are evaluated within your application process for zero latency.
- **Streaming Updates**: Real-time flag updates via Server-Sent Events (SSE).
- **Offline Mode**: Support for fallback values and local configuration.
