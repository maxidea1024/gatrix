---
sidebar_position: 2
sidebar_label: 白名单
---

# 白名单

## 概述

管理在维护或访问受限期间允许绕过限制访问的账号和 IP。

**访问路径：** 系统管理 → 白名单

## 功能

- 按账号 ID 添加白名单
- 按 IP 或 IP 段添加白名单
- 启用/禁用条目
- 为每个条目添加备注

## 添加账号的方法

1. 前往 **系统管理** > **白名单**。
2. 点击 **添加账号** 按钮。
3. 输入账号 ID。
4. （可选）添加备注。
5. 点击 **添加**。

## 添加 IP 的方法

1. 前往 **系统管理** > **白名单**。
2. 点击 **添加 IP** 按钮。
3. 输入 IP 地址或 CIDR 网段。
4. （可选）添加备注。
5. 点击 **添加**。

## 使用场景

- 维护期间 QA 团队进行测试
- 开发人员访问
- VIP 抢先体验
- 合作伙伴账号

## API 集成

通过 SDK 检查白名单状态：

```typescript
const isWhitelisted = await medical.whitelist.isAccountWhitelisted(accountId);
const isIpWhitelisted = await medical.whitelist.isIpWhitelisted(ipAddress);
```
