# Feature Flag Evaluation API

## Endpoint

```
POST /api/v1/client/features/evaluate
GET  /api/v1/client/features/evaluate
```

- **POST**: Pass `context` object in the JSON body.
- **GET**:
  - Pass context fields as individual query parameters (recommended for simple use cases).
  - OR pass `context` query parameter (Base64 encoded JSON).
  - OR pass `X-Gatrix-Feature-Context` header.

Example GET Query (Individual Params):

```
GET /api/v1/client/features/evaluate?userId=user123&sessionId=abc&properties[region]=asia
```

Example GET Query (Base64 Context):

```
GET /api/v1/client/features/evaluate?context=eyJ1c2VySWQiOiAidXNlcjEifQ==
```

Example GET Header:

```
X-Gatrix-Feature-Context: eyJ1c2VySWQiOiAidXNlci0xMjM0NSIsICJzZXNzaW9uSWQiOiAiYWJjZGUifQ==
```

(Decoded: `{"userId": "user-12345", "sessionId": "abcde"}`)

## Headers

| Header                     | Required | Description                                                                                |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `X-API-Token`              | Yes      | Client API Token                                                                           |
| `X-Application-Name`       | No       | Name of the application                                                                    |
| `X-Environment`            | No\*     | Environment name (e.g., `development`, `production`). Required if not inferred from token. |
| `Content-Type`             | Yes      | `application/json` (for POST)                                                              |
| `X-Gatrix-Feature-Context` | No       | Base64 encoded JSON context for GET requests.                                              |

## Request Body (POST)

```json
{
  "flagNames": ["flag-1", "flag-2"], // Optional: specific flags to evaluate
  "context": {
    "userId": "user-123",
    "sessionId": "session-456",
    "appVersion": "1.2.3",
    "country": "KR",
    "properties": {
      "customField": "value"
    }
  }
}
```

## Response

```json
{
  "success": true,
  "data": {
    "my-flag": {
      "name": "my-flag",
      "enabled": true,
      "variant": {
        "name": "variant-a",
        "payload": "{\"key\": \"value\"}",
        "enabled": true
      },
      "variantType": "json",
      "version": 3,
      "impressionData": true // Only included when true
    },
    "disabled-flag": {
      "name": "disabled-flag",
      "enabled": false,
      "variant": {
        "name": "disabled",
        "enabled": false,
        "payload": "baseline-value" // baselinePayload if defined
      },
      "variantType": "string",
      "version": 1
    },
    "not-found-flag": {
      "name": "not-found-flag",
      "enabled": false,
      "variant": {
        "name": "disabled",
        "enabled": false
      },
      "variantType": "string",
      "version": 1,
      "impressionData": false,
      "reason": "not_found"
    }
  },
  "meta": {
    "environment": "development",
    "evaluatedAt": "2026-02-02T10:00:00.000Z"
  }
}
```

## Evaluation Logic

### Strategy-based Evaluation

| Scenario                             | Result                                    |
| ------------------------------------ | ----------------------------------------- |
| No strategies defined                | Flag's `isEnabled` value is used directly |
| All strategies are disabled          | `enabled: false` (no matching strategy)   |
| At least one enabled strategy passes | `enabled: true`                           |
| All enabled strategies fail          | `enabled: false`                          |

### Flowchart

```
┌─────────────────────────────────┐
│ Is flag enabled in environment? │
└───────────────┬─────────────────┘
                │
           No ──┴── Yes
           │        │
           ▼        ▼
      ┌────────┐  ┌────────────────────┐
      │ false  │  │ Are there strategies? │
      └────────┘  └──────────┬─────────┘
                             │
                        No ──┴── Yes
                        │        │
                        ▼        ▼
                   ┌────────┐  ┌─────────────────────────┐
                   │ true   │  │ For each enabled strategy │
                   └────────┘  └──────────────┬──────────┘
                                              │
                               ┌──────────────┴──────────────┐
                               │ Does strategy pass?          │
                               │ (constraints + rollout)      │
                               └──────────────┬──────────────┘
                                              │
                                         Yes ─┴─ No
                                         │       │
                                         ▼       ▼
                                    ┌────────┐ (try next strategy)
                                    │ true   │
                                    └────────┘

                               If no strategy passes:
                                    ┌────────┐
                                    │ false  │
                                    └────────┘
```

### Variant Selection

- **Flag enabled + variant selected**: Returns the variant with `variant.enabled: true`
- **Flag enabled + no variants defined**: Returns `variant: { name: "disabled", enabled: false }`
- **Flag disabled**: Returns `variant: { name: "disabled", enabled: false }` with `baselinePayload` if defined

### Sticky Consistency (Important)

If you use strategy rollouts or variants, the result depends on the **stickiness**.

- By default, stickiness is based on `userId`, then `sessionId`, then `random`.
- If you do not provide `userId` or `sessionId` in the `context`, evaluation will be **random on every request**.
- To ensure consistent results for a user, always provide a unique identifier.

## Request Body Context Parameters

The `context` object supports the following standard Unleash fields:

| Field           | Description                                                                               |
| --------------- | ----------------------------------------------------------------------------------------- |
| `userId`        | Unique identifier for the user. Primary key for stickiness.                               |
| `sessionId`     | Session identifier. Used if `userId` is missing.                                          |
| `ip`            | IP address of the client (automatically detected if not provided, but can be overridden). |
| `remoteAddress` | Alias for `ip`.                                                                           |
| `properties`    | Custom properties for constraints (e.g., `{ "region": "asia" }`).                         |

## Version Field

Each flag has a `version` field that increments whenever:

- Flag settings are updated (isEnabled, variantType, baselinePayload, etc.)
- Variants are added/modified/deleted
- Strategies are added/modified/deleted

This allows clients to detect changes and refresh their local state.

## Caching

- Flag definitions are cached for efficiency
- Cache is automatically invalidated when flags/variants/strategies are modified
- Use the `version` field for client-side cache validation

## Example: PowerShell

```powershell
$headers = @{
    "X-API-Token" = "your-client-api-token"
    "X-Application-Name" = "my-app"
    "X-Environment" = "production"
    "Content-Type" = "application/json"
}

$body = @{
    context = @{
        userId = "user-123"
    }
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri "http://localhost:45000/api/v1/client/features/evaluate" -Method POST -Headers $headers -Body $body
$result | ConvertTo-Json -Depth 10
```

## Example: curl

```bash
curl -X POST http://localhost:45000/api/v1/client/features/evaluate \
  -H "X-API-Token: your-client-api-token" \
  -H "X-Application-Name: my-app" \
  -H "X-Environment: production" \
  -H "Content-Type: application/json" \
  -d '{"context": {"userId": "user-123"}}'
```
