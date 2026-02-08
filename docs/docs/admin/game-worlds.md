---
sidebar_position: 3
sidebar_label: Game Worlds
---

# Game Worlds

## Overview

Monitor and manage game server instances (worlds/channels).

**Navigation:** System Management → Game Worlds

## Features

- Real-time server status
- Player count monitoring
- Maintenance mode per world
- Server capacity management

## World Status

| Status          | Description                 |
| --------------- | --------------------------- |
| **Online**      | Server is running normally  |
| **Maintenance** | Server is under maintenance |
| **Offline**     | Server is not running       |
| **Full**        | Server is at capacity       |

## Managing a World

1. Navigate to **System Management** > **Game Worlds**
2. Click on a world to view details
3. Available actions:
   - Toggle maintenance mode
   - Restart server (if integrated)
   - View connected players
   - Adjust capacity

## API Integration

Register and update world status via SDK:

```typescript
await gatrix.gameWorlds.register({
  worldId: 'world-1',
  name: 'World 1',
  region: 'KR',
  capacity: 1000,
  currentPlayers: 500,
  status: 'online',
});
```
