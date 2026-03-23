---
sidebar_position: 4
sidebar_label: Client Versions
---

# Client Versions

## Overview

Manage game client versions and update requirements.

**Navigation:** System Management → Client Versions

## Features

- Platform-specific version management (PC, PC-WeGame, iOS, Android, HarmonyOS)
- Game server and patch server address configuration
- Status-based access control (Online, Offline, Maintenance, Forced Update, etc.)
- Minimum patch version enforcement
- Whitelist-specific server addresses
- Guest mode control

## Version Configuration

| Field                    | Description                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| **Platform**             | Target platform (pc, pc-wegame, ios, android, harmonyos)         |
| **Version**              | Client version string (e.g., 1.0.0)                             |
| **Status**               | Client status (Online, Offline, Maintenance, Forced Update, etc.)|
| **Game Server Address**  | Primary game server address                                      |
| **Patch Address**        | Primary patch server address                                     |
| **Min Patch Version**    | Minimum required patch version (optional)                        |
| **Guest Mode Allowed**   | Whether guest mode is allowed                                    |
| **External Click Link**  | External URL for click-through                                   |
| **Custom Payload**       | JSON payload passed to the client                                |

## Minimum Patch Version

When `minPatchVersion` is set on a client version record:

- Clients **must** send their current `patchVersion` as a query parameter.
- If `patchVersion` is **missing** or **lower** than `minPatchVersion`, the API responds with `FORCED_UPDATE` status.
- Version comparison splits by `.` and compares each segment numerically (supports formats like `1.0041` and semver).
- If the client version status is `MAINTENANCE`, the maintenance status takes priority and `minPatchVersion` is not checked.

## API Check

Clients check version on startup:

```
GET /api/v1/client/client-version?platform=android&clientVersion=1.0.0&patchVersion=1.0041
```

### Query Parameters

| Parameter       | Required | Description                                     |
| --------------- | -------- | ----------------------------------------------- |
| `platform`      | Yes      | Target platform                                 |
| `clientVersion` | Yes      | Client version string                            |
| `patchVersion`  | No       | Current patch version (for minPatchVersion check)|

### Response

```json
{
  "success": true,
  "data": {
    "platform": "android",
    "clientVersion": "1.0.0",
    "status": "ONLINE",
    "gameServerAddress": "https://auth.example.com",
    "patchAddress": "https://patch.example.com/cdn",
    "guestModeAllowed": true,
    "externalClickLink": null,
    "customPayload": null
  }
}
```

### Status Values

| Status                    | Description                                                |
| ------------------------- | ---------------------------------------------------------- |
| `ONLINE`                  | Normal operation                                           |
| `OFFLINE`                 | Service unavailable                                        |
| `MAINTENANCE`             | Under maintenance (includes maintenance message)           |
| `FORCED_UPDATE`           | Client must update (returned when below minPatchVersion)   |
| `RECOMMENDED_UPDATE`      | Update recommended but not required                        |
| `UNDER_REVIEW`            | Version under review                                      |
| `BLOCKED_PATCH_ALLOWED`   | Access blocked but patching allowed                        |
