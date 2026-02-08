---
sidebar_position: 2
---

# Installation Guide

Detailed instructions for installing Gatrix.

## Development Environment Setup

### 1. Prerequisites

- **Node.js 22+** - Install LTS version from [nodejs.org](https://nodejs.org/)
- **Yarn 1.22+** - `npm install -g yarn`
- **Docker Desktop** - Install from [docker.com](https://docker.com/)
- **Git** - Version control

### 2. Clone Repository

```bash
git clone https://github.com/your-org/gatrix.git
cd gatrix
```

### 3. Install Dependencies

```bash
yarn install
```

### 4. Configure Environment Variables

```bash
# Copy environment file
cp .env.example .env.local
```

Edit `.env.local` to configure settings:

```env
# Database (keep defaults when using Docker infrastructure)
DB_HOST=localhost
DB_PORT=43306
DB_NAME=gatrix
DB_USER=gatrix_user
DB_PASSWORD=gatrix_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=46379

# JWT Secrets (must change in production!)
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Admin Account
ADMIN_EMAIL=admin@gatrix.com
ADMIN_PASSWORD=admin123
```

### 5. Start Infrastructure

**Option A: Docker infrastructure only (recommended)**

```bash
yarn infra:up
```

**Option B: Full Docker environment**

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 6. Run Database Migrations

```bash
yarn migrate
```

### 7. Start Development Server

```bash
# Basic services (Backend + Frontend + Edge)
yarn dev

# All services included
yarn dev:all
```

## Full Docker Environment

To run all services in Docker:

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Included Services

| Service     | Container              | Port         |
| ----------- | ---------------------- | ------------ |
| MySQL       | gatrix-mysql-dev       | 43306        |
| Redis       | gatrix-redis-dev       | 46379        |
| etcd        | gatrix-etcd-dev        | (internal)   |
| ClickHouse  | gatrix-clickhouse-dev  | 48123, 49000 |
| Backend     | gatrix-backend-dev     | 45000        |
| Frontend    | gatrix-frontend-dev    | 43000        |
| Edge        | gatrix-edge-dev        | 3400         |
| Chat Server | gatrix-chat-server-dev | 45100        |
| Event Lens  | gatrix-event-lens-dev  | 45200        |
| Loki        | gatrix-loki-dev        | 43100        |
| Prometheus  | gatrix-prometheus-dev  | 49090        |
| Grafana     | gatrix-grafana-dev     | 44000        |

## Production Deployment

For production, build Docker images:

```bash
# Build
yarn build

# Build Docker images
docker build -t gatrix-backend -f packages/backend/Dockerfile .
docker build -t gatrix-frontend -f packages/frontend/Dockerfile .
docker build -t gatrix-edge -f packages/edge/Dockerfile .
docker build -t gatrix-chat-server -f packages/chat-server/Dockerfile .
docker build -t gatrix-event-lens -f packages/event-lens/Dockerfile .
```

For detailed deployment instructions, see [Docker Deployment Guide](../deployment/docker).
