---
sidebar_position: 2
---

# 安装指南

详细的 Gatrix 安装说明。

## 开发环境设置

### 1. 先决条件

- **Node.js 22+** - 从 [nodejs.org](https://nodejs.org/) 安装 LTS 版本
- **Yarn 1.22+** - `npm install -g yarn`
- **Docker Desktop** - 从 [docker.com](https://docker.com/) 安装
- **Git** - 版本控制

### 2. 克隆仓库

```bash
git clone https://github.com/your-org/gatrix.git
cd gatrix
```

### 3. 安装依赖

```bash
yarn install
```

### 4. 配置环境变量

```bash
# 复制环境文件
cp .env.example .env.local
```

编辑 `.env.local` 进行配置：

```env
# 数据库 (使用 Docker 基础设施时保持默认值)
DB_HOST=localhost
DB_PORT=43306
DB_NAME=gatrix
DB_USER=gatrix_user
DB_PASSWORD=gatrix_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=46379

# JWT 密钥 (生产环境必须更改！)
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# 管理员账户
ADMIN_EMAIL=admin@gatrix.com
ADMIN_PASSWORD=admin123
```

### 5. 启动基础设施

**选项 A: 仅 Docker 基础设施 (推荐)**

```bash
yarn infra:up
```

**选项 B: 完整 Docker 环境**

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 6. 运行数据库迁移

```bash
yarn migrate
```

### 7. 启动开发服务器

```bash
# 基本服务 (Backend + Frontend + Edge)
yarn dev

# 包含所有服务
yarn dev:all
```

## 完整 Docker 环境

在 Docker 中运行所有服务：

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 包含的服务

| 服务        | 容器                   | 端口         |
| ----------- | ---------------------- | ------------ |
| MySQL       | gatrix-mysql-dev       | 43306        |
| Redis       | gatrix-redis-dev       | 46379        |
| etcd        | gatrix-etcd-dev        | (内部)       |
| ClickHouse  | gatrix-clickhouse-dev  | 48123, 49000 |
| Backend     | gatrix-backend-dev     | 45000        |
| Frontend    | gatrix-frontend-dev    | 43000        |
| Edge        | gatrix-edge-dev        | 3400         |
| Chat Server | gatrix-chat-server-dev | 45100        |
| Event Lens  | gatrix-event-lens-dev  | 45200        |
| Loki        | gatrix-loki-dev        | 43100        |
| Prometheus  | gatrix-prometheus-dev  | 49090        |
| Grafana     | gatrix-grafana-dev     | 44000        |

## 生产部署

生产环境需要构建 Docker 镜像：

```bash
# 构建
yarn build

# 构建 Docker 镜像
docker build -t gatrix-backend -f packages/backend/Dockerfile .
docker build -t gatrix-frontend -f packages/frontend/Dockerfile .
docker build -t gatrix-edge -f packages/edge/Dockerfile .
docker build -t gatrix-chat-server -f packages/chat-server/Dockerfile .
docker build -t gatrix-event-lens -f packages/event-lens/Dockerfile .
```

详细部署说明请参阅 [Docker 部署指南](../deployment/docker)。
