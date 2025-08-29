---
sidebar_position: 1
---

# 客户端 API 文档

可以从游戏客户端直接调用的公共 API 端点。

## 特性

- **无需身份验证**：可以从客户端直接调用
- **无速率限制**：处理大量请求
- **高性能缓存**：本地内存缓存快速响应
- **自动缓存失效**：管理员修改时通过 pub/sub 实时更新缓存

## API 端点

### 1. 客户端版本信息

```
GET /api/v1/client/client-version
```

检索游戏客户端的版本信息。

#### 查询参数

| 参数 | 类型 | 描述 |
|------|------|------|
| channel | string | 频道过滤器（例如：A1, PC） |
| subChannel | string | 子频道过滤器（例如：QQ, WeChat, iOS） |

#### 响应

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

#### 缓存信息

- **缓存键**：`CLIENT_VERSION.BY_CHANNEL(channel, subChannel)`
- **缓存 TTL**：5分钟（`DEFAULT_CONFIG.CLIENT_VERSION_TTL`）
- **失效**：创建/更新/删除客户端版本时

### 2. 游戏世界列表

```
GET /api/v1/client/game-worlds
```

检索可用的游戏世界列表。

#### 响应

```json
{
  "success": true,
  "data": {
    "worlds": [
      {
        "id": 1,
        "worldId": "world001",
        "name": "主世界",
        "description": "默认游戏世界",
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

#### 过滤

- **visible**：仅返回 `visible: true` 的世界
- **maintenance**：仅返回 `maintenance: false` 的世界（非维护中）
- **排序**：按 `displayOrder` 升序排列

#### 缓存信息

- **缓存键**：`GAME_WORLDS.PUBLIC`
- **缓存 TTL**：10分钟（`DEFAULT_CONFIG.GAME_WORLDS_PUBLIC_TTL`）
- **失效**：创建/更新/删除游戏世界时

### 3. 缓存统计

```
GET /api/v1/client/cache-stats
```

检索缓存性能统计信息（用于监控）。

#### 响应

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

## 缓存系统

### 本地内存缓存

- **CacheService**：内存缓存管理
- **自动过期**：基于 TTL 的自动清理
- **模式匹配**：通过正则表达式批量删除

### 基于 BullMQ 的队列系统

- **PubSubService**：通过 BullMQ 的可靠缓存失效队列
- **QueueService**：用于邮件、审计日志、清理任务的通用队列系统
- **实时同步**：管理员修改时立即在所有实例中失效缓存
- **重试机制**：失败作业的自动重试（指数退避）
- **容错性**：即使 Redis 连接失败，本地缓存仍继续工作

### 缓存失效场景

1. **客户端版本更改**
   - 创建/更新/删除/状态更改时
   - 模式：`client_version:.*`
   - 通过队列异步处理

2. **游戏世界更改**
   - 创建/更新/删除时
   - 键：`game_worlds:public`
   - 通过队列异步处理

### 队列系统特性

- **高优先级**：缓存失效作业以优先级 10 处理
- **自动清理**：保留 100 个已完成作业，50 个失败作业
- **并发控制**：每个工作器最多 5 个并发作业
- **监控**：可用的实时队列状态监控

## 性能优化

### 响应时间

- **缓存命中**：~1ms
- **缓存未命中**：~50-100ms（数据库查询）
- **缓存失效**：~2-5ms（BullMQ 队列添加）
- **队列处理**：~10-50ms（后台处理）

### 内存使用

- **预期使用量**：每项 ~1-5KB
- **自动清理**：每分钟清理过期项
- **队列清理**：自动清理已完成/失败的作业
- **内存监控**：通过 `/api/v1/client/cache-stats` 检查

## 使用示例

### JavaScript（游戏客户端）

```javascript
// 获取客户端版本信息
async function getClientVersion(channel, subChannel) {
  const params = new URLSearchParams();
  if (channel) params.append('channel', channel);
  if (subChannel) params.append('subChannel', subChannel);
  
  const response = await fetch(`/api/v1/client/client-version?${params}`);
  const data = await response.json();
  
  if (data.success) {
    return data.data.versions;
  }
  throw new Error('获取客户端版本失败');
}

// 获取游戏世界列表
async function getGameWorlds() {
  const response = await fetch('/api/v1/client/game-worlds');
  const data = await response.json();
  
  if (data.success) {
    return data.data.worlds;
  }
  throw new Error('获取游戏世界失败');
}
```

### Unity C#（游戏客户端）

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
                // JSON 解析和处理
                Debug.Log($"客户端版本数据：{json}");
            }
        }
    }
}
```

## 监控

### 日志检查

```bash
# 检查缓存相关日志
tail -f logs/app.log | grep -i cache

# 检查 PubSub 相关日志
tail -f logs/app.log | grep -i pubsub
```

### 缓存和队列统计监控

```bash
# 调用缓存和队列统计 API
curl http://localhost:3000/api/v1/client/cache-stats
```

**响应示例：**
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

### BullMQ 仪表板（可选）

通过 BullMQ UI 进行队列监控：

```bash
# 安装 BullMQ UI（开发环境）
npm install -g @bull-board/ui

# 运行仪表板
bull-board
```
