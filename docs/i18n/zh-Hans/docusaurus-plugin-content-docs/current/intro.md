---
sidebar_position: 1
---

# Gatrix 简介

**Gatrix** 是一个用于在线游戏服务的集成管理系统。

## 🎯 核心功能

### 功能开关 (Feature Flags)
无需重新发布代码即可实时控制功能。
- 环境/群组分步发布
- A/B 测试支持
- 立即回滚

### 游戏运营工具
- **服务公告** - 游戏内和外部公告管理
- **弹窗公告** - 针对性游戏内弹窗
- **优惠券** - 奖励优惠券生成与管理
- **问卷调查** - 收集玩家意见
- **横幅** - 宣传横幅管理
- **商店商品** - 应用内商品管理
- **策划数据** - 游戏平衡和配置数据

### 系统管理
- **维护管理** - 定期/紧急维护调度
- **白名单** - 测试账号/IP 管理
- **游戏世界** - 服务器状态监控
- **客户端版本** - 应用版本管理

### 外部集成
支持 Slack, Microsoft Teams, Webhook, New Relic, Lark 等多种服务集成

### 监控分析
- **Event Lens** - 事件分析和统计
- **Grafana 仪表板** - 实时指标监控
- **审计日志** - 追踪所有变更记录

## 🏗️ 架构

Gatrix 是一个采用 Monorepo 结构的微服务架构：

| 包名 | 说明 |
|--------|------|
| `@gatrix/backend` | 主 API 服务器 |
| `@gatrix/frontend` | 管理员仪表板 (React + MUI) |
| `@gatrix/edge` | 边缘服务器 (用于缓存/CDN) |
| `@gatrix/chat-server` | 实时聊天服务器 |
| `@gatrix/event-lens` | 事件分析服务器 |
| `@gatrix/server-sdk` | 游戏服务器 SDK |
| `@gatrix/shared` | 共享类型和工具 |

## 🚀 快速开始

```bash
# 1. 安装依赖
yarn install

# 2. 启动基础设施 (MySQL, Redis)
yarn infra:up

# 3. 运行数据库迁移
yarn migrate

# 4. 启动开发服务器
yarn dev
```

访问地址: http://localhost:43000

## 🌐 支持语言

- 🇰🇷 한국어 (韩语)
- 🇺🇸 English (英语)
- 🇨🇳 简体中文 (中文)

## 📚 文档结构

| 章节 | 说明 |
|------|------|
| [快速开始](./getting-started/quick-start) | 安装和初始设置 |
| [功能开关](./features/feature-flags) | 如何使用功能开关 |
| [游戏运营](./guide/service-notices) | 运营工具指南 |
| [系统管理](./admin/maintenance) | 系统管理指南 |
| [外部集成](./integrations/overview) | 设置集成指南 |
| [API 参考](./api/client-api) | API 文档 |
