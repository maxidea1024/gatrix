# Gatrix Deploy Scripts

This directory contains scripts for building, deploying, and managing the Gatrix application stack.

All scripts support **Linux-style arguments** (e.g., `-t`, `--tag`) for consistency between PowerShell and Bash.

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

### `build-and-push.ps1` / `build-and-push.sh`

Builds Docker images and optionally pushes them to the registry.

**Options:**

| Option | Description |
|--------|-------------|
| `-t, --tag <tag>` | Image tag (default: `latest`) |
| `-p, --push` | Push images to registry after building |
| `-l, --latest` | Also tag and push images as `latest` |
| `-s, --service <name>` | Build specific service(s) only (repeatable) |
| `-h, --help` | Show help |

**Available Services:** `backend`, `frontend`, `edge`, `chat-server`, `event-lens`

**Examples:**

```bash
# Build all services, tag as "latest"
./build-and-push.ps1
./build-and-push.sh

# Build and push all services with a specific version tag
./build-and-push.ps1 -t v1.2.0 -p
./build-and-push.sh --tag v1.2.0 --push

# Build with version tag AND also tag as latest
./build-and-push.ps1 -t v1.2.0 -l -p
./build-and-push.sh --tag v1.2.0 --latest --push

# Build only backend
./build-and-push.ps1 -s backend
./build-and-push.sh --service backend

# Build backend and frontend, then push
./build-and-push.ps1 -s backend -s frontend -p
./build-and-push.sh --service backend --service frontend --push
```

---

## Deployment

### `deploy.ps1` / `deploy.sh`

Deploys the Gatrix stack to Docker Swarm.

**Options:**

| Option | Description |
|--------|-------------|
| `-v, --version <version>` | Version to deploy (default: `latest`) |
| `-e, --env-file <file>` | Environment file path (default: `.env`) |
| `-n, --stack <name>` | Stack name (default: `gatrix`) |
| `-i, --init` | Initialize swarm and create secrets |
| `-u, --update` | Perform rolling update |
| `--prune` | Remove unused images after deployment |
| `-h, --help` | Show help |

**Examples:**

```bash
# First-time deployment (init swarm + secrets)
./deploy.ps1 -v v1.0.0 -i
./deploy.sh --version v1.0.0 --init

# Deploy with rolling update
./deploy.ps1 -v v1.1.0 -u
./deploy.sh --version v1.1.0 --update

# Clean up old images after deploying
./deploy.ps1 -v v1.2.0 --prune
./deploy.sh --version v1.2.0 --prune
```

---

## Operations

### `update.ps1` / `update.sh`

Performs rolling updates on running services.

**Options:**

| Option | Description |
|--------|-------------|
| `-v, --version <version>` | Target version (required) |
| `-s, --service <name>` | Update specific service |
| `-a, --all` | Update all application services |
| `-f, --force` | Force update even with same image |
| `-n, --stack <name>` | Stack name (default: `gatrix`) |
| `-h, --help` | Show help |

**Examples:**

```bash
# Update all services to v1.2.0
./update.ps1 -v v1.2.0 -a
./update.sh --version v1.2.0 --all

# Update only backend
./update.ps1 -v v1.2.0 -s backend
./update.sh --version v1.2.0 --service backend

# Force re-deploy even if image is same
./update.ps1 -v v1.2.0 -s backend -f
./update.sh --version v1.2.0 --service backend --force
```

---

### `rollback.ps1` / `rollback.sh`

Rolls back services to their previous version.

**Options:**

| Option | Description |
|--------|-------------|
| `-s, --service <name>` | Rollback specific service |
| `-a, --all` | Rollback all application services |
| `-n, --stack <name>` | Stack name (default: `gatrix`) |
| `-h, --help` | Show help |

**Examples:**

```bash
# Rollback backend service
./rollback.ps1 -s backend
./rollback.sh --service backend

# Rollback all services
./rollback.ps1 -a
./rollback.sh --all
```

---

### `scale.ps1` / `scale.sh`

Scales service replicas.

**Options:**

| Option | Description |
|--------|-------------|
| `-s, --service <name>` | Service to scale |
| `-r, --replicas <n>` | Number of replicas |
| `--preset <name>` | Use preset: `minimal`, `standard`, `high` |
| `--status` | Show current scaling status |
| `-n, --stack <name>` | Stack name (default: `gatrix`) |
| `-h, --help` | Show help |

**Presets:**

- `minimal`: 1 replica each
- `standard`: 2 replicas each (recommended)
- `high`: 4 replicas each (high traffic)

**Examples:**

```bash
# Scale backend to 4 replicas
./scale.ps1 -s backend -r 4
./scale.sh --service backend --replicas 4

# Apply high-traffic preset
./scale.ps1 --preset high
./scale.sh --preset high

# Show current status
./scale.ps1 --status
./scale.sh --status
```

---

### `status.ps1` / `status.sh`

Shows status of the deployed stack.

**Options:**

| Option | Description |
|--------|-------------|
| `-s, --services` | Show service list only |
| `-t, --tasks` | Show running tasks only |
| `-l, --logs <service>` | Stream logs for a service |
| `--health` | Show health check status |
| `-n, --stack <name>` | Stack name (default: `gatrix`) |
| `-h, --help` | Show help |

**Examples:**

```bash
# Show all status
./status.ps1
./status.sh

# Show only services
./status.ps1 -s
./status.sh --services

# Stream backend logs
./status.ps1 -l backend
./status.sh --logs backend

# Show health status
./status.ps1 --health
./status.sh --health
```

---

## Registry Scripts

### `login-registry.ps1` / `login-registry.sh`

Logs into the Tencent Cloud Registry using credentials from `registry.env`.

```bash
./login-registry.ps1
./login-registry.sh
# Output: Login Succeeded
```

---

### `list-images.ps1` / `list-images.sh`

Lists all image tags in the registry namespace.

```bash
./list-images.ps1
./list-images.sh
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
- Push an image first using `./build-and-push.ps1 -p`

### Build Fails with "Docker build failed"

- Check Docker is running.
- Check Dockerfile syntax in `packages/<service>/Dockerfile`.
- Run `docker build` manually to see detailed errors.

### Swarm Not Initialized

- Run `docker swarm init` or use the `--init` flag with `deploy.ps1`.

---

## File Reference

| File | Purpose |
|------|---------|
| `build-and-push.ps1/.sh` | Build and push Docker images |
| `deploy.ps1/.sh` | Deploy to Docker Swarm |
| `update.ps1/.sh` | Rolling update |
| `rollback.ps1/.sh` | Rollback services |
| `scale.ps1/.sh` | Scale replicas |
| `status.ps1/.sh` | Show stack status |
| `login-registry.ps1/.sh` | Registry login |
| `list-images.ps1/.sh` | List registry images |
| `update-lite.sh` | Update docker-compose.lite.yml deployment |
| `package-lite.sh` | Create deployment package (tgz) |
| `registry.env` | Registry credentials |
| `.env.example` | Environment template |
| `docker-stack.yml` | Swarm stack definition |
