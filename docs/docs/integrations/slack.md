---
sidebar_position: 2
sidebar_label: Slack
---

# Slack Integration

Send Gatrix notifications to Slack.

## Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App**
3. Choose **From scratch**
4. Enter app name and select workspace

### 2. Configure Incoming Webhooks

1. In your Slack app settings, go to **Incoming Webhooks**
2. Toggle **Activate Incoming Webhooks** to On
3. Click **Add New Webhook to Workspace**
4. Select the channel for notifications
5. Copy the webhook URL

### 3. Add to Gatrix

1. Navigate to **Settings** > **Integrations** > **Slack**
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
