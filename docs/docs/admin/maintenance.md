---
sidebar_position: 1
sidebar_label: Maintenance
---

# Maintenance Management

## Overview

Schedule and manage server maintenance windows.

**Navigation:** System Management → Maintenance

## Features

- Schedule regular maintenance
- Emergency maintenance mode
- Whitelist bypass for testers
- Customizable maintenance messages

## Creating a Maintenance Window

1. Navigate to **System Management** > **Maintenance**
2. Click **Schedule Maintenance** button
3. Configure:

| Field       | Type      | Required | Description         |
| ----------- | --------- | -------- | ------------------- |
| Title       | Text      | Required | Maintenance title   |
| Description | Textarea  | -        | Description         |
| Start Time  | DateTime  | Required | Maintenance start   |
| End Time    | DateTime  | Required | Expected end        |
| Message     | Rich Text | -        | User-facing message |
| Emergency   | Switch    | -        | Mark as emergency   |

4. Click **Create** to save

## Emergency Maintenance

For urgent issues, use **Emergency Maintenance** to immediately block all access:

1. Click **Emergency Maintenance** button
2. Confirm the action
3. All non-whitelisted users will be blocked

## Whitelist Bypass

Whitelisted accounts and IPs can access the game during maintenance. See [Whitelist](./whitelist).

## API Status

Check maintenance status:

```bash
GET /api/v1/status
```
