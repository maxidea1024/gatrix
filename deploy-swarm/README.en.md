# Gatrix Docker Swarm Deployment Guide (Cloud Infra Edition)

This directory is a **Docker Swarm-only** deployment environment.

MySQL and Redis use Cloud infrastructure (Tencent Cloud, AWS RDS/ElastiCache, etc.).  
This folder contains **application services only** — no infrastructure containers.

---

## 📋 Differences from deploy/

| Item | deploy/ (original) | deploy-swarm/ (this) |
|------|-------------------|---------------------|
| MySQL | Local container | ❌ Cloud managed |
| Redis | Local container | ❌ Cloud managed |
| etcd | Local container | ❌ Removed (Redis replaces) |
| event-lens | Included | ❌ Removed |
| chat-server | Included | ❌ Removed |
| Service Discovery | etcd or redis | Redis only |
| Config files | References ../docker/ | ✅ Self-contained in config/ |

## 📦 Included Services

- **backend** — Gatrix API server
- **frontend** — Gatrix web frontend (Nginx)
- **edge** — Edge cache server (behind Cloud LB)
- **nginx** — Reverse proxy *(optional, disabled by default)*
- **prometheus** — Metrics collection
- **grafana** — Monitoring dashboard

---

## 🔧 Prerequisites

1. **Docker** (20.10+) with **Docker Swarm** mode
2. **Cloud MySQL** — host address, credentials
3. **Cloud Redis** — host address, password
4. **Docker Registry access** (configured in registry.env)

---

## 🐝 Swarm Cluster Setup

### Single-Node (Development / Small Scale)

Initialize Docker Swarm on a single server:

```bash
docker swarm init
```

This node becomes both a **manager** and a **worker**. Sufficient for dev/staging or small production deployments.

### Multi-Node (Production)

#### 1. Initialize Manager Node

On the **first server** (manager):

```bash
docker swarm init --advertise-addr <MANAGER_IP>
```

This outputs a `docker swarm join` command with a token. Save it.

#### 2. Add Worker Nodes

On each **worker server**, run the join command from step 1:

```bash
docker swarm join --token <WORKER_TOKEN> <MANAGER_IP>:2377
```

> To retrieve the join token later:
> ```bash
> docker swarm join-token worker    # Worker token
> docker swarm join-token manager   # Manager token (for additional managers)
> ```

#### 3. Add Additional Manager Nodes (High Availability)

For fault tolerance, use **3 or 5 manager nodes** (must be odd number for Raft consensus):

```bash
# On the existing manager, get the manager join token:
docker swarm join-token manager

# On the new manager node:
docker swarm join --token <MANAGER_TOKEN> <MANAGER_IP>:2377
```

#### 4. Verify Cluster

```bash
docker node ls
```

Expected output:
```
ID              HOSTNAME    STATUS    AVAILABILITY   MANAGER STATUS
abc123 *        manager-1   Ready     Active         Leader
def456          manager-2   Ready     Active         Reachable
ghi789          worker-1    Ready     Active
jkl012          worker-2    Ready     Active
```

### Node Labels (Optional)

Assign labels to nodes for service placement constraints:

```bash
# Label a node for edge services
docker node update --label-add role=edge <NODE_ID>

# Label a node for monitoring
docker node update --label-add role=monitoring <NODE_ID>
```

### Required Ports (Firewall)

Ensure the following ports are open **between Swarm nodes**:

| Port | Protocol | Purpose |
|------|----------|---------|
| 2377 | TCP | Cluster management & Raft |
| 7946 | TCP/UDP | Node discovery & gossip |
| 4789 | UDP | Overlay network (VXLAN) |

### Docker Registry Authentication

All Swarm nodes must be able to pull images from the registry. Run on **each node**:

```bash
./login-registry.sh
```

Or use `--with-registry-auth` flag during deploy (already included in deploy scripts).

---

## 🚀 Quick Start

### Step 1: Configure Environment

```bash
cp .env.example .env
vi .env    # Enter your Cloud DB/Redis connection info
```

**Required settings:**
```
DB_HOST=your-cloud-mysql-host.com
DB_USER=gatrix_user
DB_PASSWORD=your-secure-password
REDIS_HOST=your-cloud-redis-host.com
REDIS_PASSWORD=your-redis-password
```

### Step 2: Generate Security Keys

```bash
# Auto-generate all security keys, then copy to .env
./generate-secrets.sh --env
```

### Step 3: Create registry.env

```bash
# Create Docker Registry credentials file (not included in package)
cat > registry.env << EOF
REGISTRY_HOST=uwocn.tencentcloudcr.com
REGISTRY_USER=your-registry-user
REGISTRY_PASS=your-registry-token
REGISTRY_NAMESPACE=uwocn
EOF
```

### Step 4: First Deployment

```bash
chmod +x *.sh
# --init: Initializes Swarm if not already initialized
# Docker Secrets are auto-created on every deploy (skips existing ones)
./deploy.sh -v 1.0.0 --init
```

PowerShell (Windows):
```powershell
./deploy.ps1 -v 1.0.0 -i
```

### Step 5: Health Check

```bash
./health-check.sh              # Verify all services are running
```

---

## 📁 Directory Structure

```
deploy-swarm/
├── docker-compose.swarm.yml    # Main stack definition
├── .env.example                # Environment variable template
├── .env                        # Actual environment (create manually)
├── registry.env                # Docker Registry credentials
├── .gitignore                  # Git exclusion rules
├── config/                     # Config files (self-contained)
│   ├── nginx.conf              # Nginx reverse proxy
│   ├── prometheus.yml          # Prometheus scrape config
│   └── grafana/provisioning/   # Grafana settings
├── deploy.sh / .ps1            # Deployment script
├── teardown.sh / .ps1          # Stack removal script
├── health-check.sh / .ps1      # Post-deploy health check
├── build-and-push.sh / .ps1    # Build & push to registry (⚠️ dev environment only, not in package)
├── update.sh / .ps1            # Rolling update
├── rollback.sh / .ps1          # Rollback
├── scale.sh / .ps1             # Scaling (auto-persists to .env)
├── status.sh / .ps1            # Status check
├── list-images.sh / .ps1       # List registry images
├── login-registry.sh / .ps1    # Registry login
├── generate-secrets.sh / .ps1  # Security key generator
├── package.sh / .ps1           # Package for transfer (tgz)
├── package-deploy.js           # Package for transfer (Node.js)
├── README.md                   # Korean docs
├── README.en.md                # English docs (this file)
└── README.zh.md                # Chinese docs
```

---

## 📝 Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | Cloud MySQL host | `mysql.cloud.example.com` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_NAME` | Database name | `gatrix` |
| `DB_USER` | DB username | `gatrix_user` |
| `DB_PASSWORD` | DB password | `secure-password` |
| `REDIS_HOST` | Cloud Redis host | `redis.cloud.example.com` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | `redis-password` |

### Security (must change in production)

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | JWT token signing key |
| `JWT_REFRESH_SECRET` | JWT refresh token key |
| `SESSION_SECRET` | Session encryption key |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin password |

> **Note**: `EDGE_API_TOKEN` / `EDGE_BYPASS_TOKEN` are hardcoded convention values for internal  
> service-to-service communication. Do NOT regenerate or change them. Defaults are set in `.env.example`.

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `GATRIX_VERSION` | `latest` | Image tag to deploy |
| `NGINX_REPLICAS` | `0` | Nginx replicas (0=disabled, 1=enable) |
| `HTTP_PORT` | `80` | Nginx HTTP port |
| `HTTPS_PORT` | `443` | Nginx HTTPS port |
| `BACKEND_REPLICAS` | `2` | Backend replica count |
| `FRONTEND_REPLICAS` | `2` | Frontend replica count |
| `EDGE_REPLICAS` | `2` | Edge replica count |
| `GRAFANA_PORT` | `3000` | Grafana dashboard port |
| `PROMETHEUS_PORT` | `9090` | Prometheus UI port |
| `DEFAULT_LANGUAGE` | `zh` | Default language |

---

## 🛠️ Operations Guide

### Build & Push Images (⚠️ Dev Environment Only)

> **Note**: Image building requires the **full source code** and is only possible in the **development environment**.  
> `build-and-push.sh` is **NOT included** in packages created by `package.sh`.  
> On production servers, use `deploy.sh` to deploy images that the dev team has already pushed to the registry.

```bash
# Run from development environment:
./build-and-push.sh -t v1.0.0 -l -p           # All services
./build-and-push.sh -s backend -t v1.0.0 -p    # Specific service
```

### Rolling Update

```bash
./update.sh -v 1.1.0 --all                     # Update all services
./update.sh -v 1.1.0 --service backend          # Update specific service
```

### Rollback

```bash
./rollback.sh --service backend                 # Rollback specific service
./rollback.sh --all                             # Rollback all services
```

### Scaling

```bash
./scale.sh --preset minimal                     # backend:1  frontend:1  edge:1
./scale.sh --preset standard                    # backend:2  frontend:1  edge:2
./scale.sh --preset high                        # backend:4  frontend:2  edge:8
./scale.sh --service backend --replicas 4       # Scale individual service
```

### Status Check

```bash
./status.sh                                     # Full status
./status.sh --services                          # Service list
./status.sh --health                            # Health status
./status.sh --logs backend                      # Service logs
```

### Health Check

```bash
./health-check.sh                               # Full health check (incl. HTTP)
./health-check.sh --timeout 180                 # Custom timeout
```

### Generate Security Keys

> **Note**: These commands only **print keys to stdout** (they do NOT auto-update `.env`).  
> **Copy the output and paste it into your `.env` file** manually.

```bash
./generate-secrets.sh --env                     # Generate all security keys (copy-paste output)
./generate-secrets.sh                           # Single key (32-byte base64)
./generate-secrets.sh -l 64 -e hex              # 64-byte hex key
./generate-secrets.sh -l 48 -e alphanumeric     # 48-char alphanumeric key
```

### Teardown (Clean Removal)

```bash
./teardown.sh                                   # Remove stack only
./teardown.sh --all                             # Remove stack + volumes + secrets
./teardown.sh --all -y                          # Remove without confirmation
```

### Package for Transfer

```bash
./package.sh                                    # Creates gatrix-swarm-YYYYMMDD-HHMMSS.tgz
./package.sh -o /tmp                            # Output to specific directory
```

---

## 📋 .env Management Guide

### How Docker Swarm Uses .env

> **Critical**: Docker Swarm reads `.env` **only at deploy time** (`docker stack deploy`).  
> Editing `.env` alone does NOT affect running services. You must redeploy for changes to take effect.

```
.env file ──(read at deploy time)──> docker stack deploy ──> running containers
                                     ↑                        ↑
                              ONLY reads here          env vars are baked in
```

### Variable Categories

There are **3 categories** of configuration, each with different update procedures:

| Category | Examples | Stored In | How to Update |
|----------|----------|-----------|--------------|
| **Environment Variables** | `DB_HOST`, `REDIS_HOST`, `DEFAULT_LANGUAGE` | `.env` → container env | Edit `.env` + redeploy |
| **Docker Secrets** | `JWT_SECRET`, `SESSION_SECRET` | Docker secret store | Delete + recreate secret + redeploy |
| **Deploy-only Variables** | `GATRIX_VERSION`, `BACKEND_REPLICAS` | `.env` → compose file | Edit `.env` + redeploy |

### Procedure: Changing Environment Variables

For changes to `DB_HOST`, `REDIS_HOST`, `DEFAULT_LANGUAGE`, `EDGE_*`, etc:

```bash
# 1. Edit .env
vi .env

# 2. Redeploy (Swarm performs a rolling update automatically)
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix

# 3. Verify the change was applied
docker service inspect gatrix_backend --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep DB_HOST

# 4. Run health check
./health-check.sh
```

**What happens during redeploy:**
- Swarm compares the new config with the running config
- Only services with changed configuration are restarted
- Restart uses rolling update (zero-downtime if replicas > 1)
- Services without changes are NOT restarted

### Procedure: Changing Security Keys (JWT, Session, etc.)

For changes to `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`:

> ⚠️ **Warning**: Changing JWT secrets will invalidate ALL existing user sessions.  
> Plan this change during a maintenance window.

> **Note**: Services read security values from **environment variables** (set via `.env`), 
> not from Docker secret file mounts. Docker secrets are auto-created on every deploy (skipped if they already exist)
> for reference/backup purposes. You must update **both** `.env` and Docker secrets to stay consistent.

```bash
# 1. Update .env with the new value
vi .env    # Change JWT_SECRET=new-value

# 2. Redeploy (Swarm rolling update applies the new env var)
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix

# 3. Verify
./health-check.sh

# 4. (Optional) Also update Docker secrets for consistency
docker stack rm gatrix
sleep 15
docker secret rm jwt_secret
echo -n "new-value" | docker secret create jwt_secret -
./deploy.sh -v latest
```

### Procedure: Scaling (Replica Count Changes)

```bash
# Option A: Edit .env and redeploy
vi .env    # Change EDGE_REPLICAS=8
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix

# Option B: Use scale script (immediate + auto-saves to .env)
./scale.sh --service edge --replicas 8

# Option C: Ephemeral scaling (.env NOT updated)
./scale.sh --service edge --replicas 8 --no-persist
```

> **Note**: With `--no-persist`, `.env` is NOT updated, so the change  
> will revert to `.env` values on the next deploy.

### Procedure: Changing Image Version

```bash
# 1. Update .env
vi .env    # Change GATRIX_VERSION=1.2.0

# 2. Redeploy
./deploy.sh -v 1.2.0

# Or use the update script for targeted updates:
./update.sh -v 1.2.0 --all
```

### Common Mistakes

| Mistake | What Happens | Fix |
|---------|-------------|-----|
| Edit `.env` but don't redeploy | Nothing changes, old values still running | Run `docker stack deploy ...` |
| Change `JWT_SECRET` in `.env` only | Secret in Docker secret store is still the old value | Must delete + recreate Docker secret |
| Use `scale.sh --no-persist` without updating `.env` | Next `docker stack deploy` reverts replicas to `.env` value | Run `scale.sh` without `--no-persist` to auto-save |
| Set `DB_HOST=your-cloud-...` (placeholder) | `deploy.sh` blocks deployment with validation error | Replace with actual Cloud DB host |
| Edit `.env` on one manager node | Other manager nodes may have different `.env` | Sync `.env` to all manager nodes |

### Verifying Running Configuration

```bash
# Check what env vars a service is actually running with:
docker service inspect gatrix_backend --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}' | python3 -m json.tool

# Check which secrets are attached:
docker service inspect gatrix_backend --format '{{json .Spec.TaskTemplate.ContainerSpec.Secrets}}'

# Compare .env with running config:
docker service inspect gatrix_backend --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}'

# Check if a specific variable matches:
docker service inspect gatrix_backend --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep REDIS_HOST
```

### Multi-Node Swarm Considerations

If running Docker Swarm with multiple manager/worker nodes:

1. **`.env` must be on the node where you run `docker stack deploy`** — typically the primary manager
2. **`config/` directory must be accessible** — the `docker-compose.swarm.yml` bind-mounts config files, so they must exist on nodes running nginx/prometheus/grafana
3. **Docker Secrets are replicated** automatically across all swarm nodes
4. **Image pull** requires registry auth on all nodes — run `./login-registry.sh` on each node, or use `--with-registry-auth` (already included in deploy script)

### Backup and Restore

```bash
# Backup current .env (before making changes)
cp .env .env.backup.$(date +%Y%m%d-%H%M%S)

# List all backups
ls -la .env.backup.*

# Restore from backup
cp .env.backup.20260415-103000 .env
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix
```

---

## 🔍 Service Architecture

```
                     ┌──────────────┐
                     │   Internet   │
                     └──────┬───────┘
                            │
                   ┌────────┴────────┐
                   │    Cloud LB     │  (Tencent CLB / AWS ALB)
                   └────────┬────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
  ┌──────┴───────┐  ┌──────┴───────┐  ┌───────┴──────┐
  │   Edge ×N    │  │  Frontend    │  │   Backend    │
  │    :3400     │  │   :43000     │  │   :45000     │
  │ (Client API) │  │  (Admin UI)  │  │ (Admin API)  │
  └──────────────┘  └──────────────┘  └──────┬───────┘
                                             │
                   ┌─────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
  ┌──────┴──────┐    ┌──────┴──────┐
  │ Cloud MySQL │    │ Cloud Redis │
  │ (External)  │    │ (External)  │
  └─────────────┘    └─────────────┘

  ┌─────────────┐    ┌─────────────┐
  │ Prometheus  │───→│   Grafana   │
  │   :9090     │    │    :3000    │
  └─────────────┘    └─────────────┘

  ┌─────────────────────────────────────┐
  │ Nginx (optional, NGINX_REPLICAS=1)  │
  │ Dev/staging unified gateway :80     │
  └─────────────────────────────────────┘
```

---

## 🔀 Nginx Reverse Proxy (Optional)

Nginx is **disabled by default** (`NGINX_REPLICAS=0`).

### When Do You Need Nginx?

| Environment | Nginx | Reason |
|-------------|-------|--------|
| **Production (with Cloud LB)** | ❌ Disabled | Cloud LB (Tencent CLB / AWS ALB) handles routing, SSL termination, health checks |
| **Dev/Staging (no LB)** | ✅ Enabled | Access all services through a single port (:80) |
| **On-premises (no Cloud LB)** | ✅ Enabled | Nginx acts as a lightweight reverse proxy / load balancer |

### How to Enable Nginx

```bash
# 1. Set NGINX_REPLICAS=1 in .env
vi .env
# NGINX_REPLICAS=1

# 2. Redeploy
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix

# 3. Verify
curl http://localhost:80/health
```

When enabled, all services are accessible through a single port:

| Path | Routes To |
|------|-----------|
| `http://localhost/` | Frontend (Admin UI) |
| `http://localhost/api/v1/` | Backend API |
| `http://localhost/grafana/` | Grafana Dashboard |
| `http://localhost/health` | Nginx health check |

### How to Disable Nginx (Default)

```bash
# 1. Set NGINX_REPLICAS=0 in .env
vi .env
# NGINX_REPLICAS=0

# 2. Redeploy
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix
```

When disabled, access each service via its direct port:

| Service | Direct Port |
|---------|-------------|
| Frontend | `:43000` |
| Backend | `:45000` |
| Edge | `:3400` |
| Grafana | `:3000` |
| Prometheus | `:9090` |

### Nginx Configuration

The Nginx config is at `config/nginx.conf`. Changes take effect after redeploying.

> ⚠️ **Note**: Even with Nginx enabled, direct port access is still available. In production, if you only want traffic through Nginx, block the internal ports via firewall.

---

## ⚠️ Important Notes

### Security

1. **Do not commit `.env` to Git** — it contains real passwords.
2. **Do not commit `registry.env` to Git** — it contains registry auth tokens.
3. **Security keys are environment variables**: Services read `JWT_SECRET`, `SESSION_SECRET` etc. from `.env` (not from Docker secret file mounts). To change them, update `.env` and redeploy:
   ```bash
   # Update .env, then:
   docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix
   ```
4. **Change the default Grafana password** — Set `GRAFANA_ADMIN_PASSWORD` in `.env` to a strong password.

### Network & Firewall

5. **Cloud DB/Redis Firewall**: Ensure Docker Swarm nodes can access your Cloud DB/Redis by configuring security groups/firewall rules.
6. **Redis Pub/Sub Access**: Gatrix communicates with game servers in real-time via Redis Pub/Sub (feature flag changes, config sync, etc.). Cloud Redis must be accessible **not only from Gatrix services but also from game servers**. If game servers are on a separate network, add their IPs to the Cloud Redis security group as well.
7. **Swarm inter-node ports**: In multi-node environments, ports `2377` (management), `7946` (discovery), `4789` (VXLAN) must be open between nodes.
8. **Cloud LB health check paths**: When configuring your Cloud LB, use these endpoints:
   | Service | Health Check Path | Port |
   |---------|------------------|------|
   | Edge | `/health` | 3400 |
   | Frontend | `/health` | 43000 |
   | Backend | `/health` | 45000 |

### Deployment & Operations

9. **Docker images must be pushed to the registry first**: `build-and-push.sh` **requires source code and is only available in the dev environment** — it is NOT included in the deploy package. The dev team pushes images to the registry first, then production servers use `deploy.sh` to pull and deploy those images.
10. **`registry.env` is NOT included in the package**: You must create it manually on the deploy server. Request registry credentials from the dev team.
11. **`.env` is only read at deploy time**: After editing `.env`, you must redeploy for changes to take effect. Editing alone does NOT affect running services.
12. **`scale.sh` auto-persists to `.env` by default**: Scaling changes are automatically saved to `.env` so they survive redeployments. Use `--no-persist` for temporary scaling only.
13. **SSL/TLS should be terminated at the Cloud LB**: Services only serve HTTP. Configure HTTPS certificates on your Cloud LB (Tencent CLB / AWS ALB).

### Data & Volumes

14. **Volume data is node-local**: Prometheus and Grafana data is stored only on the node where the container runs. Node failure may cause monitoring data loss. Critical data uses Cloud DB/Redis (by design).
15. **`teardown.sh` does NOT delete volumes by default**: To fully clean up Prometheus/Grafana data, use the `--volumes` flag:
    ```bash
    ./teardown.sh --volumes    # Remove volumes too
    ```
16. **Docker log disk space**: Docker doesn't rotate logs by default, which can fill disks. This stack configures `json-file` logger with `max-size: 10m`, `max-file: 3`, limiting each service to ~30MB max.

### Multi-Node

17. **Config files only need to be on the manager node**: `docker-compose.swarm.yml`, `.env`, `config/` etc. only need to exist on the manager node. No need to copy to worker nodes.
18. **All nodes need registry login**: The `--with-registry-auth` flag is included in deploy scripts, but `docker login` must be run on each node first.
19. **Time synchronization (NTP)**: All Swarm nodes must have synchronized clocks. Time drift affects JWT token validation and Raft consensus:
    ```bash
    timedatectl status    # Check time sync status
    ```

### Troubleshooting

20. **When a service fails to start**:
    ```bash
    docker service ps gatrix_backend --no-trunc    # See failure reason
    docker service logs gatrix_backend             # Check logs
    ```
21. **Image pull failures**: Check `registry.env` credentials and verify `docker login` works on the affected node.
22. **Port conflicts**: If a port is already in use, change it in `.env` (`BACKEND_PORT`, `FRONTEND_PORT`, `GRAFANA_PORT`, etc.).

---

## 📖 Other Languages

- [한국어](README.md)
- [中文](README.zh.md)
