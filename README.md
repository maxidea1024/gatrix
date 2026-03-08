# Gatrix

Enterprise-grade online game operations platform — feature flags, remote config, live ops, and real-time management with multi-tenant support.

## Overview

Gatrix is a self-hosted feature management and live operations platform designed for online game studios. It provides a complete solution for managing feature rollouts, remote configuration, client updates, and real-time operations across multiple organizations, projects, and environments.

### Key Capabilities

- **Multi-tenant Architecture** — Organization → Project → Environment hierarchy for enterprise teams
- **Role-Based Access Control (RBAC)** — Granular permissions per org/project with wildcard support
- **Feature Flag Management** — Boolean/string/number/JSON flags with targeting, segments, and gradual rollouts
- **Edge Network** — Low-latency flag evaluation via Redis-cached edge servers
- **Multi-SDK Support** — Client SDKs (JS, C#, Dart) and Server SDKs (TypeScript, .NET) with real-time updates
- **Live Operations** — Maintenance mode, banners, service notices, client version control
- **Real-time Streaming** — SSE and WebSocket for instant flag change propagation
- **Service Discovery** — etcd-based automatic service registration and health monitoring

## Architecture

```
gatrix/
├── packages/
│   ├── backend/           # Express.js API server (admin, SDK endpoints)
│   ├── frontend/          # React + MUI admin dashboard
│   ├── edge/              # Edge server (low-latency SDK evaluation, Redis-cached)
│   ├── edge-dotnet/       # Edge server (.NET implementation)
│   ├── evaluator/         # Feature flag evaluation engine (shared core)
│   ├── shared/            # Shared types and utilities
│   ├── chat-server/       # Real-time chat (Socket.IO + Redis)
│   ├── event-lens/        # Analytics server (ClickHouse)
│   ├── sdks/
│   │   ├── client-sdks/   # Client SDKs (JS, C#, Dart, etc.)
│   │   ├── server-sdk/    # TypeScript Server SDK
│   │   └── server-sdks/   # Server SDKs (.NET, etc.)
│   └── tools/             # CLI and utility tools
├── docker/                # Docker configurations
├── scripts/               # Setup and deployment scripts
└── docs/                  # Documentation (Docusaurus)
```

## Feature Flags

### Flag Types
- **Boolean** — Simple on/off toggles
- **String / Number / JSON** — Rich value types for complex configurations

### Targeting & Evaluation
- **User Targeting** — Target individual users by ID or attributes
- **Segments** — Reusable user groups with AND/OR conditions
- **Strategies** — Percentage rollouts, gradual release, multi-variant distribution
- **Environment Overrides** — Per-environment flag values (dev/staging/production)
- **Default Values** — Flag-level and environment-level defaults

### Evaluation Flow
```
Client/Server SDK → Edge (Redis cache) → Evaluator Engine
                                              ↓
                              Strategies → Segments → User Context
                                              ↓
                                      Resolved Flag Value
```

### Real-time Updates
- **SSE Streaming** — Server-Sent Events for instant flag change notifications
- **WebSocket** — Bidirectional real-time communication
- **Redis Pub/Sub** — Cross-instance event propagation (org/project/env channels)

## RBAC & Multi-tenancy

### Hierarchy
```
Organization
  └── Project
       └── Environment (development, staging, production, ...)
```

### Permissions
- **Organization Level** — Member management, project creation, org settings
- **Project Level** — Feature flags, segments, environments, API tokens
- **Wildcard Support** — `*:*` for super admin access across all resources
- **Role Bindings** — Users are bound to specific roles per org/project scope

## Platform Features

| Category | Features |
|----------|----------|
| **Feature Flags** | Boolean/string/number/JSON, targeting, segments, strategies, gradual rollout |
| **Remote Config** | Key-value vars per environment with versioning |
| **Client Version** | Force update rules, maintenance bypass, platform-specific control |
| **Game Worlds** | Multi-world management with individual configurations |
| **Maintenance** | Scheduled maintenance with custom messages and IP whitelist bypass |
| **IP Whitelist** | CIDR-based access control per environment |
| **Banners** | In-app announcements with scheduling and targeting |
| **Crash Reports** | Client crash collection and analysis |
| **Job Scheduler** | Cron/one-time jobs (HTTP, email, SSH, log) |
| **Audit Log** | Comprehensive audit trails for all admin actions |
| **Chat** | Real-time messaging with Socket.IO and Redis clustering |
| **Service Discovery** | etcd-based service registration and health monitoring |
| **Analytics** | Event collection and analysis with ClickHouse (Event Lens) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, MUI v5, SWR, Vite, i18next (ko/en/zh) |
| Backend | Express.js, TypeScript, MySQL, Redis (ioredis), BullMQ, Objection.js |
| Edge | Express.js, Redis-cached evaluation, SSE/WebSocket streaming |
| Evaluator | TypeScript, shared flag evaluation logic |
| Chat | Socket.IO, Redis Adapter, BullMQ |
| Analytics | ClickHouse, Express.js |
| Auth | JWT + refresh tokens, Google/GitHub OAuth, RBAC |
| Infra | Docker Compose, Nginx, etcd, Prometheus, Grafana, Loki |
| SDKs | TypeScript (client/server), C# (client/server), Dart |

## Quick Start

### Prerequisites

- Node.js 22 LTS, Yarn 1.22+, Docker & Docker Compose

### Setup

```bash
# 1. Generate .env file
.\setup-env.ps1 -HostAddress localhost -Environment development    # Windows
./setup-env.sh localhost development                                # Linux/Mac

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
| ClickHouse | 48123 | http://localhost:48123 |
| etcd | 42379 | localhost:42379 |
| Grafana | 44000 | http://localhost:44000 |
| Prometheus | 49090 | http://localhost:49090 |

## Scripts

```bash
# Development
yarn dev                # Start all services
yarn dev:backend        # Backend only
yarn dev:frontend       # Frontend only

# Build & Quality
yarn build              # Build all packages
yarn lint               # Lint all packages
yarn typecheck          # Type checking

# Database
yarn migrate            # Run migrations
yarn seed               # Seed initial data
yarn db:reset           # Reset database

# Docker
yarn docker:dev         # Dev environment (hot reload)
yarn docker:dev:down    # Stop dev environment
yarn docker:up          # Production environment
```

## License

MIT License
