---
sidebar_position: 4
sidebar_label: Client Versions
---

# Client Versions

## Overview

Manage game client versions and update requirements.

**Navigation:** System Management → Client Versions

## Features

- Define minimum required version
- Force update prompts
- Platform-specific versions (iOS, Android, PC)
- Update URL configuration

## Version Configuration

| Field               | Description                     |
| ------------------- | ------------------------------- |
| **Platform**        | iOS, Android, Windows, Mac      |
| **Minimum Version** | Oldest allowed version          |
| **Latest Version**  | Current version                 |
| **Force Update**    | Require update if below minimum |
| **Update URL**      | Store or download link          |

## Adding a Version

1. Navigate to **System Management** > **Client Versions**
2. Click **Add Version** button
3. Configure:

| Field        | Type   | Required | Description                  |
| ------------ | ------ | -------- | ---------------------------- |
| Platform     | Select | Required | Target platform              |
| Version      | Text   | Required | Version string (e.g., 1.2.3) |
| Min Version  | Text   | Required | Minimum required version     |
| Force Update | Switch | -        | Force update prompt          |
| Update URL   | Text   | -        | Download/store link          |

4. Click **Save**

## API Check

Clients check version on startup:

```bash
GET /api/v1/client-version?platform=android&version=1.2.0
```

Response:

```json
{
  "needsUpdate": true,
  "forceUpdate": false,
  "latestVersion": "1.3.0",
  "updateUrl": "https://play.google.com/store/apps/..."
}
```
