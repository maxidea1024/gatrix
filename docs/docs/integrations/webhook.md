---
sidebar_position: 4
sidebar_label: Webhook
---

# Webhook Integration

Send Gatrix events to custom HTTP endpoints.

## Setup

1. Navigate to **Settings** > **Integrations** > **Webhook**
2. Enter your webhook URL
3. Select events to send
4. Configure authentication (optional)
5. Click **Save**

## Authentication

Webhooks support:

- **None** - No authentication
- **Basic Auth** - Username and password
- **Bearer Token** - Authorization header with token
- **Custom Header** - Custom header name and value

## Payload Format

```json
{
  "event": "feature_flag.updated",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "flagKey": "new_feature",
    "oldValue": false,
    "newValue": true,
    "environment": "production",
    "changedBy": "admin@example.com"
  }
}
```

## Events

| Event                  | Description         |
| ---------------------- | ------------------- |
| `feature_flag.created` | Flag created        |
| `feature_flag.updated` | Flag updated        |
| `feature_flag.deleted` | Flag deleted        |
| `maintenance.started`  | Maintenance started |
| `maintenance.ended`    | Maintenance ended   |

## Retry Policy

Failed webhooks are retried up to 3 times with exponential backoff.
