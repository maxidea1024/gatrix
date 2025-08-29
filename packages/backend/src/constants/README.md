# Cache Keys Constants

This directory provides centralized management of all cache keys used in the application.

## 📁 File Structure

```
constants/
├── cacheKeys.ts    # Cache key constants definition
└── README.md       # This file
```

## 🎯 Purpose

### ❌ **Previous Issues**
```typescript
// Hard-coded cache keys - difficult to maintain
await pubSubService.invalidateKey('game_worlds:public');
cacheService.set('game_worlds:public', data, 10 * 60 * 1000);

// Potential typos in different files
await pubSubService.invalidateKey('game_world:public'); // Typo!
```

### ✅ **Improved Approach**
```typescript
import { GAME_WORLDS, DEFAULT_CONFIG } from '../constants/cacheKeys';

// Type-safe and consistent cache key usage
await pubSubService.invalidateKey(GAME_WORLDS.PUBLIC);
cacheService.set(GAME_WORLDS.PUBLIC, data, DEFAULT_CONFIG.GAME_WORLDS_PUBLIC_TTL);
```

## 🔧 Usage

### 1. **Basic Cache Key Usage**

```typescript
import { GAME_WORLDS, CLIENT_VERSION, USER } from '../constants/cacheKeys';

// Game world public list
const cacheKey = GAME_WORLDS.PUBLIC; // 'game_worlds:public'

// Client version (dynamic key)
const versionKey = CLIENT_VERSION.BY_CHANNEL('stable', 'main');
// 'client_version:stable:main'

// User profile (dynamic key)
const profileKey = USER.PROFILE(123); // 'user:123:profile'
```

### 2. **TTL Constants Usage**

```typescript
import { TTL, DEFAULT_CONFIG } from '../constants/cacheKeys';

// Use basic TTL
cacheService.set(key, data, TTL.TEN_MINUTES);

// Use configured defaults
cacheService.set(GAME_WORLDS.PUBLIC, data, DEFAULT_CONFIG.GAME_WORLDS_PUBLIC_TTL);
```

### 3. **Pattern-based Cache Invalidation**

```typescript
import { PATTERNS } from '../constants/cacheKeys';

// Delete all game world related cache
await pubSubService.invalidateByPattern(PATTERNS.GAME_WORLDS);

// Delete all cache for specific user
await pubSubService.invalidateByPattern(PATTERNS.USER(123));
```

## 📋 Cache Key Categories

### 🎮 **Game World Related**
- `GAME_WORLDS.PUBLIC` - Public game world list
- `GAME_WORLDS.ADMIN` - Admin game world list
- `GAME_WORLDS.DETAIL(id)` - Specific game world details
- `GAME_WORLDS.BY_WORLD_ID(worldId)` - Query by world ID

### 📱 **Client Version Related**
- `CLIENT_VERSION.BY_CHANNEL(channel, subChannel)` - Version by channel
- `CLIENT_VERSION.ALL` - All version list
- `CLIENT_VERSION.ACTIVE` - Active versions only

### 👤 **User Related**
- `USER.PROFILE(userId)` - User profile
- `USER.PERMISSIONS(userId)` - User permissions
- `USER.SESSION(sessionId)` - Session information

### 🏷️ **Tag Related**
- `TAG.ALL` - All tag list
- `TAG.BY_ENTITY(entityType, entityId)` - Tags by entity

### 🛡️ **Whitelist Related**
- `WHITELIST.ALL` - All whitelist
- `WHITELIST.ACTIVE` - Active items only
- `WHITELIST.BY_IP(ip)` - Status by IP

### 🔧 **Maintenance Related**
- `MAINTENANCE.STATUS` - Current maintenance status
- `MAINTENANCE.TEMPLATES` - Maintenance templates

### 💬 **Message Template Related**
- `MESSAGE_TEMPLATE.ALL` - All templates
- `MESSAGE_TEMPLATE.BY_TYPE(type)` - Templates by type

### 📋 **Job Related**
- `JOB.ALL` - All job list
- `JOB.TYPES` - Job type list
- `JOB.DETAIL(jobId)` - Job details

### 📊 **Audit Log Related**
- `AUDIT_LOG.RECENT(page, limit)` - Recent logs
- `AUDIT_LOG.BY_USER(userId, page)` - Logs by user

## ⏱️ TTL Constants

```typescript
// Time constants
TTL.ONE_MINUTE      // 1 minute
TTL.FIVE_MINUTES    // 5 minutes
TTL.TEN_MINUTES     // 10 minutes
TTL.THIRTY_MINUTES  // 30 minutes
TTL.ONE_HOUR        // 1 hour
TTL.ONE_DAY         // 1 day

// Default configurations
DEFAULT_CONFIG.GAME_WORLDS_PUBLIC_TTL  // Game world public list TTL
DEFAULT_CONFIG.CLIENT_VERSION_TTL      // Client version TTL
DEFAULT_CONFIG.USER_PROFILE_TTL        // User profile TTL
DEFAULT_CONFIG.TAGS_TTL                // Tag list TTL
DEFAULT_CONFIG.WHITELIST_TTL           // Whitelist TTL
DEFAULT_CONFIG.MAINTENANCE_TTL         // Maintenance status TTL
```

## 🔄 Pattern Constants

```typescript
// For pattern-based cache invalidation
PATTERNS.GAME_WORLDS        // 'game_world*'
PATTERNS.CLIENT_VERSIONS    // 'client_version*'
PATTERNS.USER(userId)       // 'user:123*'
PATTERNS.TAGS               // 'tags*'
PATTERNS.WHITELIST          // 'whitelist*'
PATTERNS.MAINTENANCE        // 'maintenance*'
PATTERNS.MESSAGE_TEMPLATES  // 'message_template*'
PATTERNS.JOBS               // 'job*'
PATTERNS.AUDIT_LOGS         // 'audit_log*'
```

## 📝 Adding New Cache Keys

### 1. **Adding Simple Keys**
```typescript
export const NEW_FEATURE = {
  ALL: 'new_feature:all',
  ACTIVE: 'new_feature:active',
} as const;
```

### 2. **Adding Dynamic Keys**
```typescript
export const NEW_FEATURE = {
  BY_ID: (id: number) => `new_feature:${id}`,
  BY_TYPE: (type: string) => `new_feature:type:${type}`,
} as const;
```

### 3. **Adding Patterns**
```typescript
export const PATTERNS = {
  // ... existing patterns
  NEW_FEATURE: 'new_feature*',
} as const;
```

### 4. **Adding TTL Configuration**
```typescript
export const DEFAULT_CONFIG = {
  // ... existing configurations
  NEW_FEATURE_TTL: TTL.FIVE_MINUTES,
} as const;
```

## ✅ Best Practices

### 1. **Consistent Naming**
- Entity names use uppercase and underscores: `GAME_WORLDS`, `CLIENT_VERSION`
- Key types are clear: `ALL`, `BY_ID`, `DETAIL`, `ACTIVE`
- Patterns include wildcards: `game_world*`

### 2. **Type Safety**
- Use `as const` for all objects
- Define dynamic keys as functions for type checking

### 3. **Documentation**
- Document purpose and TTL for each key with comments
- Specify invalidation conditions

### 4. **Migration**
- Gradually replace existing hard-coded keys
- Update related test code when making changes

## 🧪 Testing

Verify cache key constants work properly:

```bash
# Test visibility toggle (check cache invalidation)
curl -X PATCH http://localhost:5001/api/v1/game-worlds/12/toggle-visibility \
  -H "Authorization: Bearer $TOKEN"

# Test client API cache
curl http://localhost:5001/api/v1/client/game-worlds
```

Check server logs for `Cache delete attempted but key not found: game_worlds:public` message

## 🔗 Related Files

- `src/services/GameWorldService.ts` - Game world cache invalidation
- `src/controllers/ClientController.ts` - Client API cache
- `src/services/CacheService.ts` - Cache service
- `src/services/PubSubService.ts` - Distributed cache invalidation
- `CLIENT_API.md` - Client API documentation
