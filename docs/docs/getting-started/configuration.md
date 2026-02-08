---
sidebar_position: 3
---

# Configuration Guide

Guide to configuring Gatrix.

## Environment Variables

### Database Settings

| Variable           | Description         | Default             |
| ------------------ | ------------------- | ------------------- |
| `DB_HOST`          | MySQL host          | localhost           |
| `DB_PORT`          | MySQL port          | 43306               |
| `DB_NAME`          | Database name       | gatrix              |
| `DB_USER`          | MySQL user          | gatrix_user         |
| `DB_PASSWORD`      | MySQL password      | gatrix_password     |
| `DB_ROOT_PASSWORD` | MySQL root password | gatrix_rootpassword |

### Redis Settings

| Variable         | Description     | Default   |
| ---------------- | --------------- | --------- |
| `REDIS_HOST`     | Redis host      | localhost |
| `REDIS_PORT`     | Redis port      | 46379     |
| `REDIS_PASSWORD` | Redis password  | (none)    |
| `REDIS_DB`       | Redis DB number | 0         |

### Service Ports

| Variable          | Description      | Default |
| ----------------- | ---------------- | ------- |
| `BACKEND_PORT`    | Backend API port | 45000   |
| `FRONTEND_PORT`   | Frontend port    | 43000   |
| `EDGE_PORT`       | Edge Server port | 3400    |
| `CHAT_PORT`       | Chat Server port | 45100   |
| `EVENT_LENS_PORT` | Event Lens port  | 45200   |
| `GRAFANA_PORT`    | Grafana port     | 44000   |
| `PROMETHEUS_PORT` | Prometheus port  | 49090   |

### Security Settings

| Variable             | Description            | Default                           |
| -------------------- | ---------------------- | --------------------------------- |
| `JWT_SECRET`         | JWT signing key        | dev-jwt-secret                    |
| `JWT_REFRESH_SECRET` | JWT refresh token key  | dev-refresh-secret                |
| `SESSION_SECRET`     | Session encryption key | dev-session-secret                |
| `API_TOKEN`          | Internal API token     | gatrix-unsecured-server-api-token |

### Admin Account

| Variable         | Description    | Default          |
| ---------------- | -------------- | ---------------- |
| `ADMIN_EMAIL`    | Admin email    | admin@gatrix.com |
| `ADMIN_PASSWORD` | Admin password | admin123         |
| `ADMIN_NAME`     | Admin name     | Administrator    |

### OAuth Settings (Optional)

| Variable               | Description                |
| ---------------------- | -------------------------- |
| `GITHUB_CLIENT_ID`     | GitHub OAuth Client ID     |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret |
| `GOOGLE_CLIENT_ID`     | Google OAuth Client ID     |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |

### Logging Settings

| Variable              | Description      | Default                           |
| --------------------- | ---------------- | --------------------------------- |
| `LOG_LEVEL`           | Log level        | debug                             |
| `LOG_FORMAT`          | Log format       | json                              |
| `GATRIX_LOKI_ENABLED` | Loki integration | true                              |
| `GATRIX_LOKI_URL`     | Loki Push URL    | http://loki:3100/loki/api/v1/push |

## Environments

Gatrix supports multiple environments. Feature flags can be managed independently per environment.

### Default Environments

- **development** - Development environment
- **staging** - Staging environment
- **production** - Production environment

### Adding Environments

Add new environments from the **Settings > Environments** menu in the dashboard.

## Locale Settings

Dashboard and API responses support multiple languages:

| Variable                | Description               | Default |
| ----------------------- | ------------------------- | ------- |
| `DEFAULT_LANGUAGE`      | Default language          | ko      |
| `VITE_DEFAULT_LANGUAGE` | Frontend default language | ko      |

Supported languages:

- `ko` - Korean
- `en` - English
- `zh` - Simplified Chinese

## Service Discovery

Service discovery settings for game server integration:

| Variable                          | Description    | Default          |
| --------------------------------- | -------------- | ---------------- |
| `SERVICE_DISCOVERY_MODE`          | Discovery mode | etcd             |
| `ETCD_HOSTS`                      | etcd hosts     | http://etcd:2379 |
| `SERVICE_DISCOVERY_HEARTBEAT_TTL` | Heartbeat TTL  | 30               |
