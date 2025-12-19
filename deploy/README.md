# Gatrix Deploy Scripts

This directory contains scripts for building, deploying, and managing the Gatrix application stack.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Configuration](#configuration)
3. [Build & Push](#build--push)
4. [Deployment](#deployment)
5. [Operations](#operations)
6. [Registry Scripts](#registry-scripts)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Docker Desktop** (or Docker Engine) installed and running.
- **Docker Swarm** initialized (for deployment scripts).
- **PowerShell 5+** (Windows) or **Bash** (Linux/macOS).
- Access to the Tencent Cloud Registry (credentials in `registry.env`).

---

## Configuration

### `registry.env`

Contains registry credentials (do NOT commit to version control):

```bash
REGISTRY_HOST=uwocn.tencentcloudcr.com
REGISTRY_USER=<your_username>
REGISTRY_PASS=<your_password_or_token>
REGISTRY_NAMESPACE=uwocn/uwocn
```

### `.env` / `.env.example`

Contains environment variables for the stack (database, JWT secrets, etc.). Copy `.env.example` to `.env` and fill in your values.

---

## Build & Push

### `build_and_push.ps1` (PowerShell) / `build_and_push.sh` (Bash)

Builds Docker images and optionally pushes them to the registry.

**Options:**

| Parameter | Description |
|-----------|-------------|
| `-Tag <tag>` / `--tag <tag>` | Image tag (default: `latest`) |
| `-Push` / `--push` | Push images to registry after building |
| `-Service <name,...>` / `--service <name>` | Build specific service(s) only |

**Available Services:** `backend`, `frontend`, `edge`, `chat-server`, `event-lens`

**Examples:**

```powershell
# Build all services, tag as "latest"
.\build_and_push.ps1

# Build and push all services with a specific version tag
.\build_and_push.ps1 -Tag "v1.2.0" -Push

# Build only backend
.\build_and_push.ps1 -Service backend

# Build backend and frontend, then push
.\build_and_push.ps1 -Service backend,frontend -Tag "prod" -Push
```

```bash
# Bash equivalent
./build_and_push.sh --tag "v1.2.0" --push
./build_and_push.sh --service backend --service frontend --push
```

---

## Deployment

### `deploy.ps1` / `deploy.sh`

Deploys the Gatrix stack to Docker Swarm.

**Options:**

| Parameter | Description |
|-----------|-------------|
| `-Version` / `--version` | Version to deploy (default: `latest`) |
| `-EnvFile` / `--env-file` | Environment file path (default: `.env`) |
| `-Stack` / `--stack` | Stack name (default: `gatrix`) |
| `-Init` / `--init` | Initialize swarm and create secrets |
| `-Update` / `--update` | Perform rolling update |
| `-Prune` / `--prune` | Remove unused images after deployment |

**Examples:**

```powershell
# First-time deployment (init swarm + secrets)
.\deploy.ps1 -Version "v1.0.0" -Init

# Deploy with rolling update
.\deploy.ps1 -Version "v1.1.0" -Update

# Clean up old images after deploying
.\deploy.ps1 -Version "v1.2.0" -Prune
```

---

## Operations

### `update.ps1` / `update.sh`

Performs rolling updates on running services.

**Options:**

| Parameter | Description |
|-----------|-------------|
| `-Version` | Target version (required) |
| `-Service <name>` | Update specific service |
| `-All` | Update all application services |
| `-Force` | Force update even with same image |

**Examples:**

```powershell
# Update all services to v1.2.0
.\update.ps1 -Version "v1.2.0" -All

# Update only backend
.\update.ps1 -Version "v1.2.0" -Service backend

# Force re-deploy even if image is same
.\update.ps1 -Version "v1.2.0" -Service backend -Force
```

---

### `rollback.ps1` / `rollback.sh`

Rolls back services to their previous version.

**Options:**

| Parameter | Description |
|-----------|-------------|
| `-Service <name>` | Rollback specific service |
| `-All` | Rollback all application services |

**Examples:**

```powershell
# Rollback backend service
.\rollback.ps1 -Service backend

# Rollback all services
.\rollback.ps1 -All
```

---

### `scale.ps1` / `scale.sh`

Scales service replicas.

**Options:**

| Parameter | Description |
|-----------|-------------|
| `-Service <name>` | Service to scale |
| `-Replicas <n>` | Number of replicas |
| `-Preset <name>` | Use preset: `minimal`, `standard`, `high` |
| `-Status` | Show current scaling status |

**Presets:**

- `minimal`: 1 replica each
- `standard`: 2 replicas each (recommended)
- `high`: 4 replicas each (high traffic)

**Examples:**

```powershell
# Scale backend to 4 replicas
.\scale.ps1 -Service backend -Replicas 4

# Apply high-traffic preset
.\scale.ps1 -Preset high

# Show current status
.\scale.ps1 -Status
```

---

### `status.ps1` / `status.sh`

Shows status of the deployed stack.

**Options:**

| Parameter | Description |
|-----------|-------------|
| `-Services` | Show service list only |
| `-Tasks` | Show running tasks only |
| `-Logs <service>` | Stream logs for a service |
| `-Health` | Show health check status |

**Examples:**

```powershell
# Show all status
.\status.ps1

# Show only services
.\status.ps1 -Services

# Stream backend logs
.\status.ps1 -Logs backend

# Show health status
.\status.ps1 -Health
```

---

## Registry Scripts

### `login_registry.ps1` / `login_registry.sh`

Logs into the Tencent Cloud Registry using credentials from `registry.env`.

```powershell
.\login_registry.ps1
# Output: Login Succeeded
```

---

### `list_images.ps1` / `list_images.sh`

Lists all image tags in the registry namespace.

```powershell
.\list_images.ps1
# Output: Tags found:
#   backend-latest
#   backend-v1.0.0
#   frontend-latest
#   ...
```

If the repository is empty, you'll see:
```
Repository 'uwocn/uwocn' not found or has no images yet.
```

---

## Troubleshooting

### "Login Failed" Error

- Check that `registry.env` contains valid credentials.
- Ensure `REGISTRY_HOST` is correct.
- Try logging in manually: `docker login uwocn.tencentcloudcr.com`

### "Repository not found" When Listing Images

- This is normal if no images have been pushed yet.
- Push an image first using `build_and_push.ps1 -Push`

### Build Fails with "Docker build failed"

- Check Docker is running.
- Check Dockerfile syntax in `packages/<service>/Dockerfile`.
- Run `docker build` manually to see detailed errors.

### Swarm Not Initialized

- Run `docker swarm init` or use the `-Init` flag with `deploy.ps1`.

---

## File Reference

| File | Purpose |
|------|---------|
| `build_and_push.ps1/.sh` | Build and push Docker images |
| `deploy.ps1/.sh` | Deploy to Docker Swarm |
| `update.ps1/.sh` | Rolling update |
| `rollback.ps1/.sh` | Rollback services |
| `scale.ps1/.sh` | Scale replicas |
| `status.ps1/.sh` | Show stack status |
| `login_registry.ps1/.sh` | Registry login |
| `list_images.ps1/.sh` | List registry images |
| `registry.env` | Registry credentials |
| `.env.example` | Environment template |
| `docker-stack.yml` | Swarm stack definition |
