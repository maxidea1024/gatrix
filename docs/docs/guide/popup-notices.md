---
sidebar_position: 2
sidebar_label: Popup Notices
---

# Popup Notices

## Overview

Create in-game popup notices that appear when players log in or during gameplay.

**Navigation:** Game Operations → Popup Notices

## Features

- Display popups on game login
- Target specific user segments
- Schedule display periods
- Support images and rich content
- Track view counts

## Creating a Popup Notice

1. Navigate to **Game Operations** > **Popup Notices**
2. Click **Add Popup** button
3. Configure the popup:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Enabled | Switch | - | Toggle popup visibility |
| Title | Text | Required | Popup title |
| Content | Rich Text | Required | Popup body content |
| Image | Image Upload | - | Optional popup image |
| Start Date | DateTime | - | When popup starts showing |
| End Date | DateTime | - | When popup stops showing |
| Display Frequency | Select | - | Once, Daily, Every login |
| Target Segment | Select | - | Specific user segment |

4. Click **Create** to save

## Display Frequency Options

- **Once** - Show only once per user
- **Daily** - Show once per day
- **Every Login** - Show on every game login

## Targeting

You can target popups to specific user segments:
- New users
- Returning users
- VIP users
- Specific regions/countries
