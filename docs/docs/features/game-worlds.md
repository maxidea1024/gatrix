---
sidebar_position: 2
---

# Game World Management

Gatrix provides comprehensive game world management capabilities, allowing you to configure and manage multiple game worlds with individual settings and configurations.

## Overview

The game world management system enables:

- **Multi-World Support**: Manage multiple game worlds simultaneously
- **Individual Configuration**: Each world has its own settings and parameters
- **Visibility Control**: Show/hide worlds from public listings
- **Maintenance Mode**: Put individual worlds into maintenance
- **Display Ordering**: Control the order worlds appear to users
- **Real-time Updates**: Changes are immediately reflected across all clients

## World Properties

### Basic Properties

```typescript
interface GameWorld {
  id?: number; // Unique identifier
  worldId: string; // World identifier (unique)
  name: string; // Display name
  description?: string; // World description
  visible: boolean; // Visibility in public listings
  maintenance: boolean; // Maintenance mode status
  displayOrder: number; // Display order (ascending)
  createdAt?: Date; // Creation timestamp
  updatedAt?: Date; // Last update timestamp
}
```

### Configuration Options

Each game world can be configured with:

- **World Identifier**: Unique string identifier for the world
- **Display Name**: Human-readable name shown to users
- **Description**: Optional description of the world
- **Visibility**: Whether the world appears in public listings
- **Maintenance Status**: Whether the world is under maintenance
- **Display Order**: Numerical order for sorting (lower numbers appear first)

## World States

### Visibility States

1. **Visible (`visible: true`)**
   - World appears in public client API responses
   - Users can see and access the world
   - Included in game world listings

2. **Hidden (`visible: false`)**
   - World does not appear in public listings
   - Only accessible via admin interface
   - Useful for testing or preparation

### Maintenance States

1. **Active (`maintenance: false`)**
   - World is fully operational
   - Users can connect and play
   - All features are available

2. **Under Maintenance (`maintenance: true`)**
   - World is temporarily unavailable
   - Users cannot connect
   - Maintenance message displayed to users

## API Endpoints

### World Management

```bash
# Get all worlds (admin)
GET /api/v1/game-worlds

# Get public worlds (client)
GET /api/v1/client/game-worlds

# Get specific world
GET /api/v1/game-worlds/:id

# Create new world
POST /api/v1/game-worlds

# Update world
PUT /api/v1/game-worlds/:id

# Delete world
DELETE /api/v1/game-worlds/:id

# Toggle visibility
PATCH /api/v1/game-worlds/:id/toggle-visibility

# Toggle maintenance
PATCH /api/v1/game-worlds/:id/toggle-maintenance
```

### Response Examples

#### Admin World List

```json
{
  "success": true,
  "data": {
    "worlds": [
      {
        "id": 1,
        "worldId": "world001",
        "name": "Main World",
        "description": "Primary game world for all players",
        "visible": true,
        "maintenance": false,
        "displayOrder": 1,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": 2,
        "worldId": "world002",
        "name": "Test World",
        "description": "Testing environment",
        "visible": false,
        "maintenance": true,
        "displayOrder": 2,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 2
  }
}
```

#### Public World List (Client API)

```json
{
  "success": true,
  "data": {
    "worlds": [
      {
        "id": 1,
        "worldId": "world001",
        "name": "Main World",
        "description": "Primary game world for all players",
        "displayOrder": 1,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 1,
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "cached": false
}
```

## Cache Management

### Cache Keys

Game world data is cached for performance:

- **Public List**: `GAME_WORLDS.PUBLIC` (10 minutes TTL)
- **Admin List**: `GAME_WORLDS.ADMIN` (5 minutes TTL)
- **World Details**: `GAME_WORLDS.DETAIL(id)` (15 minutes TTL)
- **By World ID**: `GAME_WORLDS.BY_WORLD_ID(worldId)` (15 minutes TTL)

### Cache Invalidation

Cache is automatically invalidated when:

- World is created, updated, or deleted
- Visibility is toggled
- Maintenance status is changed
- Display order is modified

Invalidation is handled via BullMQ queue system for reliability.

## Usage Examples

### Creating a New World

```javascript
const newWorld = {
  worldId: 'world003',
  name: 'PvP Arena',
  description: 'Player vs Player combat world',
  visible: true,
  maintenance: false,
  displayOrder: 3,
};

const response = await fetch('/api/v1/game-worlds', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
  },
  body: JSON.stringify(newWorld),
});

const result = await response.json();
console.log('Created world:', result.data);
```

### Updating World Settings

```javascript
const updates = {
  name: 'PvP Arena - Updated',
  description: 'Enhanced PvP world with new features',
  displayOrder: 2,
};

const response = await fetch('/api/v1/game-worlds/3', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
  },
  body: JSON.stringify(updates),
});
```

### Toggling Maintenance Mode

```javascript
// Put world into maintenance
const response = await fetch('/api/v1/game-worlds/3/toggle-maintenance', {
  method: 'PATCH',
  headers: {
    Authorization: 'Bearer ' + token,
  },
});

const result = await response.json();
console.log('Maintenance status:', result.data.maintenance);
```

### Client-side World Fetching

```javascript
// Get available worlds for game client
async function getAvailableWorlds() {
  try {
    const response = await fetch('/api/v1/client/game-worlds');
    const data = await response.json();

    if (data.success) {
      return data.data.worlds.filter((world) => world.visible && !world.maintenance);
    }

    throw new Error('Failed to fetch worlds');
  } catch (error) {
    console.error('Error fetching worlds:', error);
    return [];
  }
}

// Use in game client
const availableWorlds = await getAvailableWorlds();
console.log('Available worlds:', availableWorlds);
```

## Frontend Integration

### World Selection Component

```typescript
import React, { useState, useEffect } from 'react';
import { GameWorld } from '../types/gameWorld';

interface WorldSelectorProps {
  onWorldSelect: (world: GameWorld) => void;
}

export const WorldSelector: React.FC<WorldSelectorProps> = ({ onWorldSelect }) => {
  const [worlds, setWorlds] = useState<GameWorld[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorlds();
  }, []);

  const fetchWorlds = async () => {
    try {
      const response = await fetch('/api/v1/client/game-worlds');
      const data = await response.json();

      if (data.success) {
        setWorlds(data.data.worlds);
      }
    } catch (error) {
      console.error('Failed to fetch worlds:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading worlds...</div>;
  }

  return (
    <div className="world-selector">
      <h3>Select Game World</h3>
      {worlds.map(world => (
        <div
          key={world.id}
          className="world-option"
          onClick={() => onWorldSelect(world)}
        >
          <h4>{world.name}</h4>
          <p>{world.description}</p>
        </div>
      ))}
    </div>
  );
};
```

### Admin World Management

```typescript
import React, { useState } from 'react';
import { GameWorld } from '../types/gameWorld';

interface WorldManagementProps {
  worlds: GameWorld[];
  onUpdate: (world: GameWorld) => void;
}

export const WorldManagement: React.FC<WorldManagementProps> = ({
  worlds,
  onUpdate
}) => {
  const toggleMaintenance = async (world: GameWorld) => {
    try {
      const response = await fetch(
        `/api/v1/game-worlds/${world.id}/toggle-maintenance`,
        { method: 'PATCH' }
      );

      const result = await response.json();
      if (result.success) {
        onUpdate(result.data);
      }
    } catch (error) {
      console.error('Failed to toggle maintenance:', error);
    }
  };

  const toggleVisibility = async (world: GameWorld) => {
    try {
      const response = await fetch(
        `/api/v1/game-worlds/${world.id}/toggle-visibility`,
        { method: 'PATCH' }
      );

      const result = await response.json();
      if (result.success) {
        onUpdate(result.data);
      }
    } catch (error) {
      console.error('Failed to toggle visibility:', error);
    }
  };

  return (
    <div className="world-management">
      <h2>Game World Management</h2>
      {worlds.map(world => (
        <div key={world.id} className="world-item">
          <h3>{world.name}</h3>
          <p>{world.description}</p>

          <div className="world-controls">
            <button
              onClick={() => toggleVisibility(world)}
              className={world.visible ? 'visible' : 'hidden'}
            >
              {world.visible ? 'Hide' : 'Show'}
            </button>

            <button
              onClick={() => toggleMaintenance(world)}
              className={world.maintenance ? 'maintenance' : 'active'}
            >
              {world.maintenance ? 'End Maintenance' : 'Start Maintenance'}
            </button>
          </div>

          <div className="world-status">
            <span>Visible: {world.visible ? 'Yes' : 'No'}</span>
            <span>Maintenance: {world.maintenance ? 'Yes' : 'No'}</span>
            <span>Order: {world.displayOrder}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
```

## Best Practices

### World Configuration

1. **Unique World IDs**: Use descriptive, unique identifiers
2. **Clear Naming**: Use clear, user-friendly world names
3. **Logical Ordering**: Order worlds by importance or player level
4. **Maintenance Planning**: Schedule maintenance during off-peak hours

### Performance Optimization

1. **Cache Utilization**: Leverage caching for frequently accessed data
2. **Minimal Updates**: Only update necessary fields to reduce cache invalidation
3. **Batch Operations**: Group multiple world updates when possible
4. **Monitor Usage**: Track world popularity and adjust resources accordingly

### User Experience

1. **Clear Status**: Provide clear maintenance and availability status
2. **Graceful Degradation**: Handle world unavailability gracefully
3. **Progress Indicators**: Show loading states during world operations
4. **Error Handling**: Provide meaningful error messages to users

## Monitoring and Analytics

### Key Metrics

- World popularity (connection counts)
- Maintenance frequency and duration
- Cache hit rates for world data
- API response times for world endpoints

### Logging

All world operations are logged including:

- World creation, updates, and deletion
- Visibility and maintenance toggles
- Cache invalidation events
- API access patterns

### Alerts

Set up monitoring for:

- Unexpected world downtime
- High cache miss rates
- Slow API response times
- Failed world operations
