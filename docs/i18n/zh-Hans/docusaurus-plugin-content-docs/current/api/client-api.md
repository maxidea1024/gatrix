---
sidebar_position: 1
sidebar_label: 客户端 API
---

# 客户端 API

这些是游戏客户端可以直接调用的公共 API 端点。

## 特点

- **无需身份验证**: 可由客户端直接访问
- **访问限制**: 应用了速率限制以处理过量请求
- **高性能缓存**: 通过本地内存缓存实现快速响应
- **实时刷新**: 管理员更改设置时，通过 Pub/Sub 立即更新缓存

## API 端点

### 1. 客户端版本信息

```
GET /api/v1/client/client-version
```

查询游戏客户端的版本信息。

#### 查询参数

| 参数       | 类型   | 说明                                   |
| ---------- | ------ | -------------------------------------- |
| channel    | string | 渠道筛选（例如：PC, Mobile）           |
| subChannel | string | 子渠道筛选（例如：Steam, Google, iOS） |

### 2. 游戏世界列表

```
GET /api/v1/client/game-worlds
```

获取可用的游戏服务器（世界）列表。

### 3. 服务公告

```
GET /api/v1/client/notices
```

获取当前有效的服务公告。
