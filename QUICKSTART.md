# Gatrix Lite Deployment Guide

A lightweight Docker Compose deployment package for Gatrix.

---

## Table of Contents

1. [First-Time Setup](#first-time-setup)
2. [Updating to a New Version](#updating-to-a-new-version)
3. [Resetting Everything](#resetting-everything)
4. [Common Operations](#common-operations)
5. [Troubleshooting](#troubleshooting)

---

## First-Time Setup

### Step 1: Create Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

Or use the setup script:

```bash
# Linux/macOS
./setup-env.sh

# Windows
./setup-env.ps1
```

### Step 2: Configure Environment Variables

Edit `.env` and set the required values:

```bash
# Open in your preferred editor
vim .env
# or
nano .env
```

**Required settings:**
- `JWT_SECRET` - Secret key for JWT signing (use a random string)
- `JWT_REFRESH_SECRET` - Secret key for refresh tokens
- `DB_PASSWORD` - Database password (if using local DB)

### Step 3: Start Services

```bash
# Linux/macOS
./update-lite.sh -t v0.0.1

# Windows
./update-lite.ps1 -t v0.0.1
```

### Step 4: Verify Services

```bash
docker compose -f docker-compose.lite.yml ps
```

All services should show "running" status.

---

## Updating to a New Version

When a new version is released:

```bash
# Linux/macOS
./update-lite.sh -t v0.0.2

# Windows
./update-lite.ps1 -t v0.0.2
```

This will:
1. Stop running services
2. Pull new images with the specified tag
3. Start services with the new version

---

## Resetting Everything

> ⚠️ **DANGER: DATA LOSS WARNING** ⚠️
>
> The `-v` flag will **permanently delete ALL data** including:
> - Database contents (users, settings, all records)
> - Uploaded files and media
> - Cache and session data
> - Any other persisted data
>
> **This action cannot be undone!** Make sure you have backups before proceeding.

Only use this when you need to completely start fresh:

```bash
# Linux/macOS
./update-lite.sh -t v0.0.1 -v

# Windows
./update-lite.ps1 -t v0.0.1 -v
```

**When to use:**
- Initial development environment setup
- After major schema changes that require fresh data
- When explicitly instructed by the development team

**When NOT to use:**
- Regular version updates (just omit the `-v` flag)
- Production environments with real data
- When you're unsure

---

## Common Operations

### Check Service Status

```bash
docker compose -f docker-compose.lite.yml ps
```

### View Logs

```bash
# All services
docker compose -f docker-compose.lite.yml logs -f

# Specific service (e.g., backend)
docker compose -f docker-compose.lite.yml logs -f backend

# Last 100 lines
docker compose -f docker-compose.lite.yml logs --tail 100 backend
```

### Stop Services

```bash
docker compose -f docker-compose.lite.yml down
```

### Restart a Single Service

```bash
docker compose -f docker-compose.lite.yml restart backend
```

### Access Service Shell

```bash
docker compose -f docker-compose.lite.yml exec backend sh
```

---

## Troubleshooting

### Problem: "Permission denied" when running scripts

**Cause:** Script doesn't have execute permission.

**Solution:**
```bash
chmod +x update-lite.sh setup-env.sh
```

---

### Problem: "Cannot connect to Docker daemon"

**Cause:** Docker is not running or you need sudo.

**Solution:**
```bash
# Check Docker status
sudo systemctl status docker

# Start Docker
sudo systemctl start docker

# Or run with sudo
sudo ./update-lite.sh -t v0.0.1
```

---

### Problem: Services won't start (port already in use)

**Cause:** Another application is using the same port.

**Solution:**
1. Check which ports are in use:
   ```bash
   docker compose -f docker-compose.lite.yml ps
   ```

2. Either stop the conflicting application or edit `.env` to change the port:
   ```env
   FRONTEND_PORT=3001  # Change from default 3000
   ```

---

### Problem: Database connection failed

**Cause:** Database container not ready or wrong credentials.

**Solution:**
1. Check if database is running:
   ```bash
   docker compose -f docker-compose.lite.yml ps mysql
   ```

2. Check database logs:
   ```bash
   docker compose -f docker-compose.lite.yml logs mysql
   ```

3. Verify `.env` has correct database settings.

---

### Problem: "Image not found" when pulling

**Cause:** Wrong tag or not logged into registry.

**Solution:**
1. Verify the tag exists in the registry
2. Login to registry if required:
   ```bash
   docker login uwocn.tencentcloudcr.com
   ```

---

### Problem: Out of disk space

**Cause:** Docker images/volumes consuming disk space.

**Solution:**
```bash
# Remove unused Docker resources
docker system prune -a

# Check disk usage
docker system df
```

---

### Problem: Services start but application doesn't work

**Cause:** Missing or wrong environment variables.

**Solution:**
1. Check logs for error messages:
   ```bash
   docker compose -f docker-compose.lite.yml logs backend
   ```

2. Verify all required environment variables are set in `.env`

3. Restart services after fixing:
   ```bash
   docker compose -f docker-compose.lite.yml down
   docker compose -f docker-compose.lite.yml up -d
   ```

---

## File Structure

```
gatrix/
├── .env                      # Your environment config (create this)
├── .env.example              # Example environment config
├── docker-compose.lite.yml   # Docker Compose configuration
├── update-lite.sh            # Update script (Linux/macOS)
├── update-lite.ps1           # Update script (Windows)
├── setup-env.sh              # Setup script (Linux/macOS)
├── setup-env.ps1             # Setup script (Windows)
├── QUICKSTART.md             # This file
└── deploy/                   # Production deployment scripts
```

---

## About the `deploy/` Folder

The `deploy/` folder contains **advanced scripts for large-scale production deployments** using **Docker Swarm**.

> 💡 **Note:** For simple single-server deployments, you only need `update-lite.sh` and `docker-compose.lite.yml`. The `deploy/` folder is for DevOps teams managing production infrastructure.

### When to Use Docker Swarm Scripts

| Scenario | Use |
|----------|-----|
| Development / Testing | `update-lite.sh` (this guide) |
| Single production server | `update-lite.sh` (this guide) |
| Multi-node cluster | `deploy/` scripts (Docker Swarm) |
| High availability required | `deploy/` scripts (Docker Swarm) |
| Auto-scaling needed | `deploy/` scripts (Docker Swarm) |

### Docker Swarm Features (deploy/ folder)

- **Rolling updates** with zero downtime
- **Auto-rollback** on deployment failures
- **Service scaling** across multiple nodes
- **Load balancing** built-in
- **Secret management** for sensitive data
- **Health checks** with automatic recovery

### Scripts in deploy/

| Script | Purpose |
|--------|---------|
| `build-and-push.sh/.ps1` | Build Docker images and push to registry |
| `deploy.sh/.ps1` | Deploy stack to Docker Swarm |
| `update.sh/.ps1` | Rolling update services |
| `rollback.sh/.ps1` | Rollback to previous version |
| `scale.sh/.ps1` | Scale service replicas |
| `status.sh/.ps1` | Check stack and service status |

See `deploy/README.md` for detailed Docker Swarm deployment instructions.

---

## Getting Help

If you encounter issues not covered here:

1. Check service logs: `docker compose -f docker-compose.lite.yml logs`
2. Verify `.env` configuration
3. Try resetting with `-v` flag (warning: deletes data)
4. Contact the development team
