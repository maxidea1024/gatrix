---
sidebar_position: 1
sidebar_label: Client API
---

# Client API

API for game clients to access Gatrix features.

## Base URL

```
https://your-edge-server:3400/api/v1
```

## Authentication

Include the API key in the request header:

```
X-API-Key: your-client-api-key
```

## Endpoints

### Get Feature Flags

```http
GET /flags
```

Query parameters:
- `context` - JSON-encoded context object

Response:
```json
{
  "flags": {
    "dark_mode": true,
    "max_items": 50,
    "welcome_message": "Hello!"
  }
}
```

### Get Notices

```http
GET /notices
```

Query parameters:
- `category` - Filter by category (optional)
- `limit` - Max results (default: 20)

Response:
```json
{
  "notices": [
    {
      "id": "1",
      "title": "Maintenance Notice",
      "content": "...",
      "category": "maintenance",
      "startDate": "2024-01-15T00:00:00Z",
      "endDate": "2024-01-15T06:00:00Z"
    }
  ]
}
```

### Redeem Coupon

```http
POST /coupons/redeem
```

Request:
```json
{
  "code": "SUMMER2024",
  "userId": "user123"
}
```

Response:
```json
{
  "success": true,
  "rewards": [
    { "type": "item", "id": "item_001", "quantity": 1 }
  ]
}
```

### Check Version

```http
GET /client-version
```

Query parameters:
- `platform` - ios, android, windows, mac
- `version` - Current client version

Response:
```json
{
  "needsUpdate": true,
  "forceUpdate": false,
  "latestVersion": "1.3.0",
  "updateUrl": "https://..."
}
```

### Get Status

```http
GET /status
```

Response:
```json
{
  "maintenance": false,
  "message": null
}
```
