---
sidebar_position: 1
---

# Quick Start

Get started with Gatrix quickly.

## Requirements

- **Node.js 22+** (v22.16.0 recommended)
- **Yarn 1.22+** (package manager)
- **Docker & Docker Compose** (for infrastructure)

:::info Docker Compose Services
In the Docker Compose development environment, the following services are automatically configured:

- MySQL 8.0 (database)
- Redis 7 Alpine (cache and message queue)
- etcd v3.5 (service discovery)
- ClickHouse (analytics database)
- Prometheus / Grafana (monitoring)
- Loki / Fluent Bit (log aggregation)
  :::

## Starting Local Development Environment

### 1. Clone Repository

```bash
git clone https://github.com/your-org/gatrix.git
cd gatrix
```

### 2. Install Dependencies

```bash
yarn install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env.local
```

### 4. Start Infrastructure (Docker)

```bash
# Start MySQL, Redis only (for local dev)
yarn infra:up

# Or start full Docker environment
docker compose -f docker-compose.dev.yml up -d
```

### 5. Run Database Migrations

```bash
yarn migrate
```

### 6. Start Development Server

```bash
# Basic (Backend + Frontend + Edge)
yarn dev

# Or start all services
yarn dev:all
```

## Access Points

Once the development server starts:

| Service                | URL                    | Port  |
| ---------------------- | ---------------------- | ----- |
| **Frontend Dashboard** | http://localhost:43000 | 43000 |
| **Backend API**        | http://localhost:45000 | 45000 |
| **Edge Server**        | http://localhost:3400  | 3400  |
| **Chat Server**        | http://localhost:45100 | 45100 |
| **Event Lens**         | http://localhost:45200 | 45200 |
| **Grafana**            | http://localhost:44000 | 44000 |
| **Prometheus**         | http://localhost:49090 | 49090 |

## Default Admin Account

A default admin account is created on first run:

- **Email**: admin@gatrix.com
- **Password**: admin123

:::warning Security Notice
Be sure to change the default password in your `.env` file for production!

```env
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=your-secure-password
```

:::

## Key Commands

```bash
# Development servers
yarn dev              # Backend + Frontend + Edge
yarn dev:all          # All services (Chat, Event Lens included)
yarn dev:backend      # Backend only
yarn dev:frontend     # Frontend only

# Build
yarn build            # Full build
yarn build:backend    # Backend build
yarn build:frontend   # Frontend build

# Testing
yarn test             # All tests
yarn lint             # Lint check
yarn lint:fix         # Auto-fix lint issues

# Migrations
yarn migrate          # Run migrations
yarn migrate:status   # Check migration status

# Infrastructure
yarn infra:up         # Start infrastructure
yarn infra:down       # Stop infrastructure
```

## Next Steps

- [Installation Guide](./installation) - Detailed installation
- [Configuration Guide](./configuration) - Environment setup
- [Feature Flags](../features/feature-flags) - Create your first feature flag
