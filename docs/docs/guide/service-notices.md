---
sidebar_position: 1
sidebar_label: Service Notices
---

# Service Notices

## Overview

Create and manage service notices for your game.

**Navigation:** Game Operations → Service Notices

## Features

- Create and edit service announcements
- Schedule start and end times
- Categorize notices
- Rich text editor support
- Multi-language support

## Creating a Notice

1. Navigate to **Game Operations** > **Service Notices**
2. Click **Add Notice** button
3. Fill in the form:

| Field          | Type            | Required | Description                                          |
| -------------- | --------------- | -------- | ---------------------------------------------------- |
| Enabled        | Switch          | -        | Toggle notice visibility                             |
| Multi-language | Option          | -        | Enable multi-language content                        |
| Start Date     | DateTime Picker | -        | When notice becomes visible                          |
| End Date       | DateTime Picker | -        | When notice expires                                  |
| Category       | Select          | Required | Notice type (Announcement, Maintenance, Event, etc.) |
| Title          | Text            | Required | Notice title                                         |
| Sub Title      | Text            | -        | Short title for list display                         |
| Content        | Rich Text       | Required | Notice body content                                  |
| Description    | Textarea        | -        | Internal admin notes                                 |

4. Click **Create** to save

## Notice Categories

- **Announcement** - General announcements
- **Maintenance** - Server maintenance notices
- **Event** - In-game events
- **Update** - Game updates and patches
- **Emergency** - Urgent notifications

## API Access

Notices can be fetched via the Edge API:

```bash
GET /api/v1/notices
```

See [Client API](../api/client-api) for details.
