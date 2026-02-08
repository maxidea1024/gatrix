---
sidebar_position: 5
sidebar_label: Store Products
---

# Store Products

## Overview

Manage in-app purchase products and virtual items.

**Navigation:** Game Operations → Store Products

## Features

- Define product catalog
- Set pricing (real money, virtual currency)
- Configure purchase limits
- Schedule availability
- Track sales

## Creating a Product

1. Navigate to **Game Operations** > **Store Products**
2. Click **Add Product** button
3. Configure the product:

| Field           | Type     | Required | Description               |
| --------------- | -------- | -------- | ------------------------- |
| Product ID      | Text     | Required | Unique product identifier |
| Name            | Text     | Required | Display name              |
| Description     | Textarea | -        | Product description       |
| Price           | Number   | Required | Price in cents/points     |
| Currency        | Select   | Required | USD, KRW, Gems, etc.      |
| Icon            | Image    | -        | Product image             |
| Max Purchases   | Number   | -        | Per-user limit            |
| Available From  | DateTime | -        | Start availability        |
| Available Until | DateTime | -        | End availability          |

4. Click **Create** to save

## Product Types

- **Consumable** - Items that can be purchased multiple times
- **Non-Consumable** - One-time purchases
- **Subscription** - Recurring purchases
