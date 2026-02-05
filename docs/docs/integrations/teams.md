---
sidebar_position: 3
sidebar_label: Microsoft Teams
---

# Microsoft Teams Integration

Send Gatrix notifications to Microsoft Teams.

## Setup

### 1. Create an Incoming Webhook in Teams

1. In Microsoft Teams, go to the channel where you want notifications
2. Click **...** > **Connectors**
3. Find **Incoming Webhook** and click **Configure**
4. Enter a name and optional icon
5. Click **Create**
6. Copy the webhook URL

### 2. Add to Gatrix

1. Navigate to **Settings** > **Integrations** > **Microsoft Teams**
2. Paste the webhook URL
3. Configure which events to send
4. Click **Save**

## Notification Events

| Event | Description |
|-------|-------------|
| Feature flag changes | Notified when flags are created/updated/deleted |
| Maintenance | Notified when maintenance starts/ends |
| Errors | Notified on system errors |

## Test

Click **Send Test Message** to verify the integration works.
