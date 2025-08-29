# Client API Documentation

Public API endpoints that can be called directly from game clients.

## Features

- **No Authentication Required**: Can be called directly from clients
- **No Rate Limiting**: Handles high-volume requests
- **High-Performance Caching**: Fast response with local memory caching
- **Automatic Cache Invalidation**: Real-time cache updates via pub/sub when admin makes changes

## API Endpoints

### 1. Client Version Information

```
GET /api/v1/client/client-version
```

Retrieves version information for game clients.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| channel | string | 채널 필터 (예: A1, PC) |
| subChannel | string | 서브채널 필터 (예: QQ, WeChat, iOS) |

#### Response

```json
{
  "success": true,
  "data": {
    "versions": [
      {
        "id": 1,
        "channel": "PC",
        "subChannel": "Steam",
        "clientVersion": "1.0.0",
        "gameServerAddress": "https://game.example.com",
        "gameServerAddressForWhiteList": "https://game-vip.example.com",
        "patchAddress": "https://patch.example.com",
        "patchAddressForWhiteList": "https://patch-vip.example.com",
        "guestModeAllowed": true,
        "externalClickLink": "https://website.example.com",
        "customPayload": {
          "feature1": true,
          "setting1": "value1"
        },
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

#### Cache Information

- **Cache Key**: `CLIENT_VERSION.BY_CHANNEL(channel, subChannel)`
- **Cache TTL**: 5 minutes (`DEFAULT_CONFIG.CLIENT_VERSION_TTL`)
- **Invalidation**: When client versions are created/updated/deleted

### 2. Game World List

```
GET /api/v1/client/game-worlds
```

Retrieves available game world list.

#### Response

```json
{
  "success": true,
  "data": {
    "worlds": [
      {
        "id": 1,
        "worldId": "world001",
        "name": "Main World",
        "description": "Default game world",
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

#### Filtering

- **visible**: Only returns worlds with `visible: true`
- **maintenance**: Only returns worlds with `maintenance: false` (not under maintenance)
- **sorting**: Ordered by `displayOrder` ascending

#### Cache Information

- **Cache Key**: `GAME_WORLDS.PUBLIC`
- **Cache TTL**: 10 minutes (`DEFAULT_CONFIG.GAME_WORLDS_PUBLIC_TTL`)
- **Invalidation**: When game worlds are created/updated/deleted

### 3. Cache Statistics

```
GET /api/v1/client/cache-stats
```

Retrieves cache performance statistics (for monitoring purposes).

#### Response

```json
{
  "success": true,
  "data": {
    "totalItems": 10,
    "validItems": 8,
    "expiredItems": 2,
    "memoryUsage": {
      "rss": 50331648,
      "heapTotal": 20971520,
      "heapUsed": 15728640,
      "external": 1048576,
      "arrayBuffers": 524288
    }
  }
}
```

## Cache System

### Local Memory Caching

- **CacheService**: In-memory cache management
- **Automatic Expiration**: TTL-based automatic cleanup
- **Pattern Matching**: Bulk deletion via regex patterns

### BullMQ-based Queue System

- **PubSubService**: Reliable cache invalidation queue via BullMQ
- **QueueService**: General-purpose queue system for email, audit logs, cleanup tasks
- **Real-time Synchronization**: Immediate cache invalidation across all instances when admin makes changes
- **Retry Mechanism**: Automatic retry for failed jobs (exponential backoff)
- **Fault Tolerance**: Local cache continues to work even if Redis connection fails

### Cache Invalidation Scenarios

1. **Client Version Changes**
   - On create/update/delete/status change
   - Pattern: `client_version:.*`
   - Processed asynchronously via queue

2. **Game World Changes**
   - On create/update/delete
   - Key: `game_worlds:public`
   - Processed asynchronously via queue

### Queue System Features

- **High Priority**: Cache invalidation jobs processed with priority 10
- **Automatic Cleanup**: Keeps 100 completed jobs, 50 failed jobs
- **Concurrency Control**: Maximum 5 concurrent jobs per worker
- **Monitoring**: Real-time queue status monitoring available

## Performance Optimization

### Response Times

- **Cache Hit**: ~1ms
- **Cache Miss**: ~50-100ms (database query)
- **Cache Invalidation**: ~2-5ms (BullMQ queue addition)
- **Queue Processing**: ~10-50ms (background processing)

### Memory Usage

- **Expected Usage**: ~1-5KB per item
- **Automatic Cleanup**: Expired items cleaned every minute
- **Queue Cleanup**: Automatic cleanup of completed/failed jobs
- **Memory Monitoring**: Check via `/api/v1/client/cache-stats`

## Usage Examples

### JavaScript (Game Client)

```javascript
// Get client version information
async function getClientVersion(channel, subChannel) {
  const params = new URLSearchParams();
  if (channel) params.append('channel', channel);
  if (subChannel) params.append('subChannel', subChannel);

  const response = await fetch(`/api/v1/client/client-version?${params}`);
  const data = await response.json();

  if (data.success) {
    return data.data.versions;
  }
  throw new Error('Failed to get client version');
}

// Get game world list
async function getGameWorlds() {
  const response = await fetch('/api/v1/client/game-worlds');
  const data = await response.json();

  if (data.success) {
    return data.data.worlds;
  }
  throw new Error('Failed to get game worlds');
}
```

### Unity C# (게임 클라이언트)

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class ClientAPI : MonoBehaviour
{
    private const string BASE_URL = "https://api.example.com/api/v1/client";
    
    public IEnumerator GetClientVersion(string channel, string subChannel)
    {
        string url = $"{BASE_URL}/client-version";
        if (!string.IsNullOrEmpty(channel))
            url += $"?channel={channel}";
        if (!string.IsNullOrEmpty(subChannel))
            url += $"&subChannel={subChannel}";
            
        using (UnityWebRequest request = UnityWebRequest.Get(url))
        {
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                string json = request.downloadHandler.text;
                // JSON 파싱 및 처리
                Debug.Log($"Client version data: {json}");
            }
        }
    }
}
```

## 모니터링

### 로그 확인

```bash
# 캐시 관련 로그 확인
tail -f logs/app.log | grep -i cache

# PubSub 관련 로그 확인
tail -f logs/app.log | grep -i pubsub
```

### 캐시 및 큐 통계 모니터링

```bash
# 캐시 및 큐 통계 API 호출
curl http://localhost:3000/api/v1/client/cache-stats
```

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "cache": {
      "totalItems": 10,
      "validItems": 8,
      "expiredItems": 2,
      "memoryUsage": { ... }
    },
    "queue": {
      "waiting": 0,
      "active": 1,
      "completed": 150,
      "failed": 2,
      "total": 153
    },
    "pubsub": {
      "connected": true,
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### BullMQ 대시보드 (선택사항)

BullMQ UI를 통한 큐 모니터링:

```bash
# BullMQ UI 설치 (개발 환경)
npm install -g @bull-board/ui

# 대시보드 실행
bull-board
```
