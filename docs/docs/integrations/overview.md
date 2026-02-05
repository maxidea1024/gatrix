---
sidebar_position: 1
sidebar_label: Overview
---

# Integrations Overview

Connect Gatrix with external services.

## Available Integrations

| Integration | Description |
|-------------|-------------|
| [Slack](./slack) | Send notifications to Slack channels |
| [Microsoft Teams](./teams) | Send notifications to Teams channels |
| [Webhook](./webhook) | Custom HTTP webhooks |
| [New Relic](./new-relic) | APM and monitoring |

## Integration Types

### Notification Integrations
Receive alerts and notifications when events occur in Gatrix:
- Feature flag changes
- Maintenance updates
- Error alerts

### Monitoring Integrations
Export metrics and traces to monitoring platforms.

## Setting Up Integrations

1. Navigate to **Settings** > **Integrations**
2. Click on the desired integration
3. Follow the setup instructions
4. Test the connection
5. Save configuration

## Events

Integrations can be triggered by:

| Event | Description |
|-------|-------------|
| `feature_flag.created` | New flag created |
| `feature_flag.updated` | Flag value changed |
| `feature_flag.deleted` | Flag deleted |
| `maintenance.started` | Maintenance began |
| `maintenance.ended` | Maintenance completed |
