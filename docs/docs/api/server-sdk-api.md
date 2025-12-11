---
sidebar_position: 3
---

# Server SDK API Documentation

Server-side API endpoints for backend services and server applications.

## Features

- **API Token Authentication**: Secure server-to-server communication
- **High Performance**: Optimized for server-side usage
- **Rate Limiting**: Appropriate limits for server applications

## Authentication

All Server SDK endpoints require API token authentication:

```
Headers:
X-API-Token: your-server-api-token
X-Application-Name: your-application-name
```

## API Endpoints

### Environment-Specific Endpoints

All environment-specific endpoints follow the pattern:

```
GET /api/v1/server/:env/resource
```

Where `:env` is the environment ID (e.g., `development`, `production`, `qa`).

**Important:** Each endpoint returns data filtered by the specified environment. This ensures that:
- Development data is only returned for development environment requests
- Production data is only returned for production environment requests
- No cross-environment data leakage occurs

### 1. Game Worlds

```
GET /api/v1/server/:env/game-worlds
```

Get all visible game worlds for the specified environment.

#### Response

```json
{
  "success": true,
  "data": {
    "worlds": [
      {
        "id": 1,
        "worldId": "world-1",
        "name": "Main Server",
        "worldServerAddress": "world1.example.com:7777",
        "status": "active",
        "hasMaintenanceScheduled": false,
        "isMaintenanceActive": false
      }
    ]
  }
}
```

### 2. Popup Notices

```
GET /api/v1/server/:env/ingame-popup-notices
```

Get active popup notices for the specified environment.

### 3. Surveys

```
GET /api/v1/server/:env/surveys
```

Get active surveys for the specified environment.

### 4. Service Discovery

```
GET /api/v1/server/:env/service-discovery
```

Get service discovery data including whitelists for the specified environment.

#### Response

```json
{
  "success": true,
  "data": {
    "ipWhitelist": [
      { "ip": "192.168.1.0/24", "description": "Office network" }
    ],
    "accountWhitelist": [
      { "accountId": "admin123", "description": "Admin account" }
    ]
  }
}
```

### 5. Authentication Test

```
GET /api/v1/server/test
```

Test server SDK authentication.

#### Response

```json
{
  "success": true,
  "message": "SDK authentication successful",
  "data": {
    "tokenId": "token-id",
    "tokenName": "token-name",
    "tokenType": "server",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### 6. Get Server Templates

```
GET /api/v1/server/templates
```

Retrieve remote configuration templates for server-side usage.

#### Response

```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": 1,
        "key": "feature_flag",
        "name": "Feature Flag",
        "type": "boolean",
        "defaultValue": false,
        "description": "Enable/disable feature"
      }
    ],
    "etag": "abc123",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. Submit Metrics

```
POST /api/v1/server/metrics
```

Submit usage metrics from server applications.

#### Request Body

```json
{
  "metrics": [
    {
      "configKey": "feature_flag",
      "value": true,
      "timestamp": "2024-01-01T00:00:00.000Z",
      "metadata": {
        "server_id": "server-001",
        "environment": "production"
      }
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "message": "Metrics submitted successfully",
  "data": {
    "processed": 1,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Error Responses

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

### Common Error Codes

- `INVALID_API_TOKEN`: Invalid or missing API token
- `INSUFFICIENT_PERMISSIONS`: Token doesn't have required permissions
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `ENVIRONMENT_NOT_FOUND`: Environment not found
- `VALIDATION_ERROR`: Request validation failed

## Usage Examples

### Node.js Example

```javascript
const axios = require('axios');

const serverSDK = {
  baseURL: 'https://api.example.com/api/v1/server',
  apiKey: 'your-server-api-token',
  appName: 'your-app-name',

  async getTemplates() {
    try {
      const response = await axios.get(`${this.baseURL}/templates`, {
        headers: {
          'X-API-Key': this.apiKey,
          'X-Application-Name': this.appName,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching templates:', error.response?.data);
      throw error;
    }
  },

  async submitMetrics(metrics) {
    try {
      const response = await axios.post(`${this.baseURL}/metrics`, 
        { metrics },
        {
          headers: {
            'X-API-Key': this.apiKey,
            'X-Application-Name': this.appName,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error submitting metrics:', error.response?.data);
      throw error;
    }
  }
};

// Usage
async function main() {
  try {
    const templates = await serverSDK.getTemplates();
    console.log('Templates:', templates);

    await serverSDK.submitMetrics([
      {
        configKey: 'feature_flag',
        value: true,
        timestamp: new Date().toISOString(),
        metadata: { server_id: 'server-001' }
      }
    ]);
  } catch (error) {
    console.error('SDK Error:', error);
  }
}
```

### Python Example

```python
import requests
import json
from datetime import datetime

class ServerSDK:
    def __init__(self, base_url, api_key, app_name):
        self.base_url = base_url
        self.headers = {
            'X-API-Key': api_key,
            'X-Application-Name': app_name,
            'Content-Type': 'application/json'
        }
    
    def get_templates(self):
        response = requests.get(
            f"{self.base_url}/templates",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    def submit_metrics(self, metrics):
        response = requests.post(
            f"{self.base_url}/metrics",
            headers=self.headers,
            json={'metrics': metrics}
        )
        response.raise_for_status()
        return response.json()

# Usage
sdk = ServerSDK(
    'https://api.example.com/api/v1/server',
    'your-server-api-token',
    'your-app-name'
)

try:
    templates = sdk.get_templates()
    print(f"Templates: {templates}")
    
    sdk.submit_metrics([{
        'configKey': 'feature_flag',
        'value': True,
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'metadata': {'server_id': 'server-001'}
    }])
except requests.RequestException as e:
    print(f"SDK Error: {e}")
```

## Rate Limits

- **Templates**: 1000 requests per minute
- **Metrics**: 10000 requests per minute
- **Test**: 100 requests per minute

## Best Practices

1. **Cache Templates**: Cache template responses using ETags
2. **Batch Metrics**: Submit metrics in batches for better performance
3. **Error Handling**: Implement proper retry logic with exponential backoff
4. **Token Security**: Store API tokens securely and rotate regularly
5. **Monitoring**: Monitor API usage and response times
