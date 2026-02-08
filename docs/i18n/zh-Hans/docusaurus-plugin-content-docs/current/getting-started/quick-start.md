---
sidebar_position: 1
---

# 快速入门

快速开始使用 Gatrix。

## 系统要求

- **Node.js 22+** (推荐 v22.16.0)
- **Yarn 1.22+** (包管理器)
- **Docker & Docker Compose** (用于基础设施)

:::info Docker Compose 服务
Docker Compose 开发环境会自动配置以下服务：

- MySQL 8.0 (数据库)
- Redis 7 Alpine (缓存和消息队列)
- etcd v3.5 (服务发现)
- ClickHouse (分析数据库)
- Prometheus / Grafana (监控)
- Loki / Fluent Bit (日志收集)
  :::

## 启动本地开发环境

### 1. 克隆仓库

```bash
git clone https://github.com/your-org/gatrix.git
cd gatrix
```

### 2. 安装依赖

```bash
yarn install
```

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

### 4. 启动基础设施 (Docker)

```bash
# 仅启动 MySQL, Redis (本地开发用)
yarn infra:up

# 或启动完整 Docker 环境
docker compose -f docker-compose.dev.yml up -d
```

### 5. 运行数据库迁移

```bash
yarn migrate
```

### 6. 启动开发服务器

```bash
# 基本 (Backend + Frontend + Edge)
yarn dev

# 或启动所有服务
yarn dev:all
```

## 访问地址

开发服务器启动后：

| 服务                   | URL                    | 端口  |
| ---------------------- | ---------------------- | ----- |
| **Frontend Dashboard** | http://localhost:43000 | 43000 |
| **Backend API**        | http://localhost:45000 | 45000 |
| **Edge Server**        | http://localhost:3400  | 3400  |
| **Chat Server**        | http://localhost:45100 | 45100 |
| **Event Lens**         | http://localhost:45200 | 45200 |
| **Grafana**            | http://localhost:44000 | 44000 |
| **Prometheus**         | http://localhost:49090 | 49090 |

## 默认管理员账户

首次运行时会创建默认管理员账户：

- **邮箱**: admin@gatrix.com
- **密码**: admin123

:::warning 安全提示
生产环境请务必在 `.env` 文件中更改默认密码！

```env
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=your-secure-password
```

:::

## 常用命令

```bash
# 开发服务器
yarn dev              # Backend + Frontend + Edge
yarn dev:all          # 所有服务 (包括 Chat, Event Lens)
yarn dev:backend      # 仅 Backend
yarn dev:frontend     # 仅 Frontend

# 构建
yarn build            # 完整构建
yarn build:backend    # Backend 构建
yarn build:frontend   # Frontend 构建

# 测试
yarn test             # 全部测试
yarn lint             # Lint 检查
yarn lint:fix         # 自动修复 Lint 问题

# 迁移
yarn migrate          # 运行迁移
yarn migrate:status   # 检查迁移状态

# 基础设施
yarn infra:up         # 启动基础设施
yarn infra:down       # 停止基础设施
```

## 下一步

- [安装指南](./installation) - 详细安装说明
- [配置指南](./configuration) - 环境配置
- [功能开关](../features/feature-flags) - 创建您的第一个功能开关
