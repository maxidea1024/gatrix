---
sidebar_position: 3
sidebar_label: Environments
---

# Environments

Manage feature flags across different environments.

## Overview

Environments allow you to have different feature flag values for development, staging, and production.

## Default Environments

- **development** - Local development
- **staging** - Pre-production testing
- **production** - Live environment

## Adding an Environment

1. Navigate to **Settings** > **Environments**
2. Click **Add Environment**
3. Enter name and description
4. Click **Create**

## Per-Environment Values

Each feature flag can have different values per environment:

| Flag          | Development | Staging | Production |
| ------------- | ----------- | ------- | ---------- |
| `new_feature` | true        | true    | false      |
| `max_items`   | 1000        | 100     | 50         |

## SDK Configuration

Specify environment when initializing the SDK:

```typescript
const gatrix = new GatrixServerSDK({
  apiKey: 'your-api-key',
  environment: 'production',
});
```

## Copying Environments

You can copy all flag values from one environment to another:

1. Click the **...** menu on the source environment
2. Select **Copy to...**
3. Choose the target environment
