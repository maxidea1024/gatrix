---
sidebar_position: 2
sidebar_label: Whitelist
---

# Whitelist

## Overview

Manage accounts and IPs that bypass maintenance and access restrictions.

**Navigation:** System Management → Whitelist

## Features

- Whitelist accounts by ID
- Whitelist IPs or IP ranges
- Enable/disable entries
- Add notes for each entry

## Adding an Account

1. Navigate to **System Management** > **Whitelist**
2. Click **Add Account** button
3. Enter account ID
4. Optionally add notes
5. Click **Add**

## Adding an IP

1. Navigate to **System Management** > **Whitelist**
2. Click **Add IP** button
3. Enter IP address or CIDR range
4. Optionally add notes
5. Click **Add**

## Use Cases

- QA team testing during maintenance
- Developer access
- VIP early access
- Partner accounts

## API Integration

Check whitelist status via SDK:

```typescript
const isWhitelisted = await gatrix.whitelist.isAccountWhitelisted(accountId);
const isIpWhitelisted = await gatrix.whitelist.isIpWhitelisted(ipAddress);
```
