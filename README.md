# Gatrix

Online game operations platform — feature flags, remote config, live ops, and real-time management.

## Architecture

```
gatrix/
├── packages/
│   ├── backend/           # Express.js API server (admin, SDK endpoints)
│   ├── frontend/          # React + MUI admin dashboard
│   ├── edge/              # Edge server (low-latency SDK endpoint, Redis-cached)
│   ├── edge-dotnet/       # Edge server (.NET implementation)
│   ├── evaluator/         # Feature flag evaluation engine (shared logic)
│   ├── shared/            # Shared types and utilities
│   ├── chat-server/       # Real-time chat (Socket.IO + Redis)
│   ├── event-lens/        # Analytics server (ClickHouse)
│   ├── sdks/
│   │   ├── client-sdks/   # Client SDKs (JS, C#, Dart, etc.)
│   │   ├── server-sdk/    # TypeScript Server SDK
│   │   └── server-sdks/   # Server SDKs (other languages)
│   └── tools/             # CLI and utility tools
├── docker/                # Docker configurations
├── scripts/               # Setup and deployment scripts
└── docs/                  # Documentation (Docusaurus)
```

## Features

- **Feature Flags** — Boolean/string/number/JSON flags with targeting rules, segments, and A/B testing
- **Remote Config (Vars)** — Key-value configuration per environment with versioning
- **Client Version Control** — Force update, maintenance bypass, platform-specific rules
- **Game World Management** — Multi-world support with individual configurations
- **Maintenance Mode** — Scheduled maintenance with custom messages and IP whitelist bypass
- **IP Whitelisting** — CIDR-based access control per environment
- **Banners & Service Notices** — In-app announcements with scheduling
- **Crash Reporting** — Client crash collection and analysis
- **Job Scheduler** — Cron/one-time jobs (HTTP, email, SSH, log)
- **Audit Logging** — Comprehensive audit trails for all admin actions
- **Real-time Chat** — High-performance messaging with Socket.IO
- **Service Discovery** — etcd-based service registration and health monitoring
- **Analytics** — Event collection and analysis with ClickHouse (Event Lens)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, MUI v5, SWR, Vite, i18next (ko/en/zh) |
| Backend | Express.js, TypeScript, MySQL, Redis (ioredis), BullMQ |
| Edge | Express.js, Redis-cached evaluation, SSE/WebSocket streaming |
| Evaluator | TypeScript, shared flag evaluation logic |
| Chat | Socket.IO, Redis Adapter, BullMQ |
| Analytics | ClickHouse, Express.js |
| Auth | JWT + refresh tokens, Google/GitHub OAuth, RBAC |
| Infra | Docker Compose, Nginx, etcd, Prometheus, Grafana, Loki |

## Quick Start

### Prerequisites

- Node.js 22 LTS, Yarn 1.22+, Docker & Docker Compose

### Setup

```bash
# 1. Generate .env file
# Windows
.\setup-env.ps1 -HostAddress localhost -Environment development

# Linux/Mac
./setup-env.sh localhost development

# 2. Start with Docker (recommended)
yarn docker:dev

# Or start locally
yarn install
yarn migrate
yarn seed
yarn dev
```

### Default Admin

- Email: `admin@gatrix.com` (configurable via `ADMIN_EMAIL`)
- Password: `admin123` (configurable via `ADMIN_PASSWORD`)

## Service Ports

Port strategy: internal port + 40000 offset.

| Service | Port | URL |
|---------|------|-----|
| Frontend | 43000 | http://localhost:43000 |
| Backend API | 45000 | http://localhost:45000 |
| Edge | 45300 | http://localhost:45300 |
| Chat Server | 45100 | http://localhost:45100 |
| Event Lens | 45200 | http://localhost:45200 |
| MySQL | 43306 | localhost:43306 |
| Redis | 46379 | localhost:46379 |
| Grafana | 44000 | http://localhost:44000 |
| Prometheus | 49090 | http://localhost:49090 |

## Scripts

```bash
yarn dev              # Start all services (dev)
yarn build            # Build all packages
yarn lint             # Lint all packages
yarn migrate          # Run DB migrations
yarn seed             # Seed initial data
yarn docker:dev       # Docker dev environment
yarn docker:dev:down  # Stop Docker dev
```

## License

Proprietary software. All rights reserved.
