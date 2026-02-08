---
sidebar_position: 2
sidebar_label: 服务器 SDK API
---

# 服务器 SDK API

用于游戏服务器与 Gatrix 通信的 SDK API 文档。

## 初始化

```typescript
import { GatrixClient } from '@gatrix/server-sdk';

const client = new GatrixClient({
  apiKey: '你的 API 秘钥',
  environment: 'production',
});
```

## 核心功能

### 1. 功能开关评估

```typescript
const isEnabled = await client.getFeatureFlag('new_battle_mode', {
  userId: 'player_1',
  level: 50,
});
```

### 2. 获取维护状态

```typescript
const maintenance = await client.getCurrentMaintenance();
if (maintenance.isActive) {
  console.log('维护中:', maintenance.message);
}
```

### 3. 白名单检查

```typescript
const isWhitelisted = await client.whitelist.isIpWhitelisted('1.2.3.4');
```
