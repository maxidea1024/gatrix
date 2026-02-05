---
sidebar_position: 6
sidebar_label: Banners
---

# Banners

## Overview

Manage promotional banners displayed in the game.

**Navigation:** Game Operations → Banners

## Features

- Create image banners
- Set display positions
- Schedule display periods
- Configure click actions
- Track impressions and clicks

## Creating a Banner

1. Navigate to **Game Operations** > **Banners**
2. Click **Add Banner** button
3. Configure the banner:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Name | Text | Required | Banner name |
| Image | Image Upload | Required | Banner image |
| Position | Select | Required | Display position |
| Action Type | Select | - | What happens on click |
| Action URL | Text | - | URL or deep link |
| Start Date | DateTime | - | Start showing |
| End Date | DateTime | - | Stop showing |
| Priority | Number | - | Display order |

4. Click **Create** to save

## Banner Positions

- **Main** - Main screen banner
- **Event** - Event page banner
- **Store** - Store page banner
- **Login** - Login screen banner

## Action Types

- **None** - No action
- **URL** - Open external URL
- **Deep Link** - Navigate in-game
- **Notice** - Show a notice
