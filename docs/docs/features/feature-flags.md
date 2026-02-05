---
sidebar_position: 1
sidebar_label: Feature Flags
---

# Feature Flags

Deploy features safely using feature flags.

## Overview

Feature Flags allow you to turn features on/off without code deployment.

## Key Features

- **Real-time toggling** - Enable/disable features instantly
- **Environment targeting** - Different values per environment
- **Segment targeting** - Target specific user groups
- **Gradual rollout** - Roll out features progressively

## Creating a Feature Flag

1. Navigate to **Feature Flags**
2. Click **Create Flag** button
3. Configure:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Key | Text | Required | Unique identifier (e.g., `new_checkout`) |
| Name | Text | Required | Display name |
| Description | Textarea | - | Purpose description |
| Type | Select | Required | Boolean, String, Number, or JSON |

4. Click **Create**

## Flag Types

### Boolean
Simple on/off toggle.

```json
{ "key": "dark_mode", "value": true }
```

### String
Return a string value.

```json
{ "key": "welcome_text", "value": "Hello!" }
```

### Number
Return a numeric value.

```json
{ "key": "max_items", "value": 100 }
```

### JSON
Return complex configuration.

```json
{ "key": "feature_config", "value": { "enabled": true, "limit": 10 } }
```

## SDK Usage

```typescript
const isEnabled = await gatrix.featureFlags.getBoolValue('dark_mode');
const config = await gatrix.featureFlags.getJsonValue('feature_config');
```

See [Server SDK API](../api/server-sdk-api) for more details.
