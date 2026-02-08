---
sidebar_position: 5
sidebar_label: New Relic
---

# New Relic Integration

Export metrics and traces to New Relic.

## Setup

### 1. Get New Relic License Key

1. Log in to New Relic
2. Go to **API Keys**
3. Copy your **License Key**

### 2. Configure in Gatrix

1. Navigate to **Settings** > **Integrations** > **New Relic**
2. Enter your License Key
3. Select data to export:
   - Metrics
   - Custom events
   - Feature flag changes
4. Click **Save**

## Exported Data

### Metrics

- API response times
- Request counts
- Error rates
- Feature flag evaluation counts

### Custom Events

- Feature flag changes
- User actions
- System events

## Dashboard

After integration, you can create New Relic dashboards to visualize:

- Feature flag usage
- Rollout progress
- Error correlation with flag changes

## Troubleshooting

If data is not appearing:

1. Verify the License Key is correct
2. Check the connection status in Gatrix
3. Allow 5 minutes for initial data to appear
