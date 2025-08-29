---
sidebar_position: 1
---

# Gatrix 入门指南

欢迎使用 **Gatrix**，这是一个专为 **UWO (Uncharted Waters Online)** 游戏管理而构建的综合在线游戏平台管理系统。

## 什么是 Gatrix？

Gatrix 是一个现代化的全栈平台，为在线游戏平台提供强大的用户管理、身份验证和管理功能。使用 TypeScript、React、MUI 和 Express.js 构建，为游戏平台运营提供完整的解决方案。

### 主要功能

- 🎮 **游戏平台管理**：在线游戏管理的综合平台
- 🌍 **游戏世界管理**：支持多世界，每个世界都有独立配置
- 📱 **客户端版本管理**：版本控制和分发管理
- 🔧 **维护模式**：带有自定义消息的系统级维护控制
- 🏷️ **标签系统**：用于内容组织的灵活标签
- 📝 **消息模板**：多语言消息模板管理
- 🛡️ **IP 白名单**：高级 IP 访问控制和管理
- ⚙️ **作业调度器**：具有类似 cron 语法的高级作业调度
- 📊 **队列监控**：通过 Bull Board 进行实时作业队列监控

## 前置要求

开始之前，请确保已安装以下软件：

- [Node.js](https://nodejs.org/en/download/) 版本 18.0 或更高
- [MySQL](https://dev.mysql.com/downloads/) 版本 8.0 或更高
- [Redis](https://redis.io/download) 版本 6.0 或更高

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/motifgames/gatrix.git
cd gatrix
```

### 2. 环境设置

```bash
# 复制环境变量
cp .env.example .env

# 根据您的配置更新 .env 文件
```

### 3. 安装依赖

```bash
npm install
```

### 4. 数据库设置

```bash
# 运行数据库迁移
npm run migrate

# 填充初始数据
npm run seed
```

### 5. 启动开发服务器

```bash
# 同时启动前端和后端
npm run dev
```

应用程序将在以下地址可用：
- 前端：http://localhost:3000
- 后端 API：http://localhost:5001
- API 文档：http://localhost:5001/api-docs
- 队列监控：http://localhost:5001/admin/queues

## 下一步

- 📖 [阅读 API 文档](./api/client-api.md)
- 🔧 [了解缓存系统](./backend/cache-keys.md)
- 🚀 [探索作业管理](./features/job-management.md)
- 🌍 [配置游戏世界](./features/game-worlds.md)
