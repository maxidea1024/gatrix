---
sidebar_position: 3
sidebar_label: Coupons
---

# Coupons

## Overview

Create and manage reward coupons for players.

**Navigation:** Game Operations → Coupons

## Features

- Generate unique coupon codes
- Set usage limits (per coupon, per user)
- Configure expiration dates
- Define rewards (items, currency, etc.)
- Track redemption history

## Creating a Coupon

1. Navigate to **Game Operations** > **Coupons**
2. Click **Add Coupon** button
3. Configure the coupon:

| Field             | Type          | Required | Description               |
| ----------------- | ------------- | -------- | ------------------------- |
| Code              | Text          | Required | Unique coupon code        |
| Description       | Textarea      | -        | Admin notes               |
| Start Date        | DateTime      | -        | When coupon becomes valid |
| End Date          | DateTime      | -        | When coupon expires       |
| Max Uses          | Number        | -        | Total redemption limit    |
| Max Uses Per User | Number        | -        | Per-user limit            |
| Rewards           | Reward Config | Required | Items/currency to give    |

4. Click **Create** to save

## Reward Configuration

Rewards can include:

- In-game items
- Virtual currency
- Premium time
- Special titles/badges

## Coupon Redemption

Players redeem coupons via the game client. The API endpoint:

```bash
POST /api/v1/coupons/redeem
{
  "code": "SUMMER2024"
}
```

## Tracking

View redemption history including:

- Redemption time
- User ID
- Rewards granted
- Status (success/failed)
