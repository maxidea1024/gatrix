# Gatrix Docker Swarm 部署指南（云基础设施版）

此目录是 **Docker Swarm 专用** 部署环境。

MySQL 和 Redis 使用云基础设施（腾讯云、AWS RDS/ElastiCache 等），  
此文件夹仅包含 **应用服务** — 不包含基础设施容器。

---

## 📋 与 deploy/ 的区别

| 项目 | deploy/（原始） | deploy-swarm/（本目录） |
|------|----------------|----------------------|
| MySQL | 本地容器 | ❌ 使用云服务 |
| Redis | 本地容器 | ❌ 使用云服务 |
| etcd | 本地容器 | ❌ 已移除（由 Redis 替代） |
| event-lens | 包含 | ❌ 已移除 |
| chat-server | 包含 | ❌ 已移除 |
| 服务发现 | etcd 或 redis | 仅 Redis |
| 配置文件 | 引用 ../docker/ | ✅ config/ 内置（自包含） |

## 📦 包含的服务

- **backend** — Gatrix API 服务器
- **frontend** — Gatrix Web 前端（Nginx）
- **edge** — Edge 缓存服务器（Cloud LB 后面）
- **nginx** — 反向代理 *（可选，默认禁用）*
- **prometheus** — 指标采集
- **grafana** — 监控仪表板

---

## 🔧 前置要求

1. **Docker**（20.10 以上）并启用 **Docker Swarm** 模式
2. **云 MySQL** — 访问地址、账号、密码
3. **云 Redis** — 访问地址、密码
4. **Docker Registry 访问权限**（在 registry.env 中配置）

---

## 🐝 Swarm 集群配置

### 单节点（开发 / 小规模）

在单台服务器上初始化 Docker Swarm：

```bash
docker swarm init
```

该节点同时作为 **管理节点（Manager）** 和 **工作节点（Worker）**。适用于开发/测试或小规模生产环境。

### 多节点（生产环境）

#### 1. 初始化管理节点

在 **第一台服务器**（管理节点）上：

```bash
docker swarm init --advertise-addr <管理节点_IP>
```

此命令会输出一个 `docker swarm join` 命令和 Token，请保存。

#### 2. 添加工作节点

在每台 **工作节点服务器** 上，运行第 1 步输出的 join 命令：

```bash
docker swarm join --token <工作节点_TOKEN> <管理节点_IP>:2377
```

> 如需稍后查看 Token：
> ```bash
> docker swarm join-token worker    # 工作节点 Token
> docker swarm join-token manager   # 管理节点 Token（用于添加管理节点）
> ```

#### 3. 添加额外管理节点（高可用）

为实现容错，建议使用 **3 或 5 个管理节点**（Raft 共识要求奇数）：

```bash
# 在现有管理节点上获取管理节点 Token：
docker swarm join-token manager

# 在新管理节点上：
docker swarm join --token <管理节点_TOKEN> <管理节点_IP>:2377
```

#### 4. 验证集群

```bash
docker node ls
```

预期输出：
```
ID              HOSTNAME    STATUS    AVAILABILITY   MANAGER STATUS
abc123 *        manager-1   Ready     Active         Leader
def456          manager-2   Ready     Active         Reachable
ghi789          worker-1    Ready     Active
jkl012          worker-2    Ready     Active
```

### 节点标签（可选）

为服务部署约束设置节点标签：

```bash
# 为 Edge 服务标记节点
docker node update --label-add role=edge <节点_ID>

# 为监控服务标记节点
docker node update --label-add role=monitoring <节点_ID>
```

### 必要端口（防火墙）

确保 Swarm 节点 **之间** 以下端口已开放：

| 端口 | 协议 | 用途 |
|------|------|------|
| 2377 | TCP | 集群管理 & Raft 共识 |
| 7946 | TCP/UDP | 节点发现 & Gossip |
| 4789 | UDP | Overlay 网络 (VXLAN) |

### Docker Registry 认证

所有 Swarm 节点都需要能从仓库拉取镜像。在 **每个节点** 上运行：

```bash
./login-registry.sh
```

或在部署时使用 `--with-registry-auth` 参数（部署脚本中已包含）。

---

## 🚀 快速开始

### 第 1 步：配置环境

```bash
cp .env.example .env
vi .env    # 填入云数据库/Redis 信息
```

**必须设置的项目：**
```
DB_HOST=your-cloud-mysql-host.com
DB_USER=gatrix_user
DB_PASSWORD=your-secure-password
REDIS_HOST=your-cloud-redis-host.com
REDIS_PASSWORD=your-redis-password
```

### 第 2 步：生成安全密钥

```bash
# 自动生成所有安全密钥，然后复制到 .env
./generate-secrets.sh --env
```

### 第 3 步：创建 registry.env

```bash
# 创建 Docker Registry 认证信息文件（包中不包含）
cat > registry.env << EOF
REGISTRY_HOST=uwocn.tencentcloudcr.com
REGISTRY_USER=your-registry-user
REGISTRY_PASS=your-registry-token
REGISTRY_NAMESPACE=uwocn
EOF
```

### 第 4 步：首次部署

```bash
chmod +x *.sh
# --init: 如果 Swarm 未初始化则自动初始化
# Docker Secrets 在每次部署时自动创建（已存在则跳过）
./deploy.sh -v 1.0.0 --init
```

PowerShell（Windows）：
```powershell
./deploy.ps1 -v 1.0.0 -i
```

### 第 5 步：健康检查

```bash
./health-check.sh              # 验证所有服务是否正常运行
```

---

## 📁 目录结构

```
deploy-swarm/
├── docker-compose.swarm.yml    # 主堆栈定义文件
├── .env.example                # 环境变量示例
├── .env                        # 实际环境变量（手动创建）
├── registry.env                # Docker Registry 认证信息
├── .gitignore                  # Git 排除规则
├── config/                     # 配置文件（自包含）
│   ├── nginx.conf              # Nginx 反向代理配置
│   ├── prometheus.yml          # Prometheus 采集配置
│   └── grafana/provisioning/   # Grafana 设置
├── deploy.sh / .ps1            # 部署脚本
├── teardown.sh / .ps1          # 堆栈移除脚本
├── health-check.sh / .ps1      # 部署后健康检查
├── build-and-push.sh / .ps1    # 镜像构建 & 推送（⚠️ 仅限开发环境，不含在包中）
├── update.sh / .ps1            # 滚动更新
├── rollback.sh / .ps1          # 回滚
├── scale.sh / .ps1             # 扩缩容（自动保存到 .env）
├── status.sh / .ps1            # 状态查看
├── list-images.sh / .ps1       # 仓库镜像列表
├── login-registry.sh / .ps1    # 仓库登录
├── generate-secrets.sh / .ps1  # 安全密钥生成
├── package.sh / .ps1           # 部署打包（tgz）
├── package-deploy.js           # 部署打包（Node.js）
├── README.md                   # 韩语文档
├── README.en.md                # 英语文档
└── README.zh.md                # 中文文档（本文件）
```

---

## 📝 环境变量说明

### 必填项

| 变量 | 说明 | 示例 |
|------|------|------|
| `DB_HOST` | 云 MySQL 主机 | `mysql.cloud.example.com` |
| `DB_PORT` | MySQL 端口 | `3306` |
| `DB_NAME` | 数据库名 | `gatrix` |
| `DB_USER` | 数据库用户名 | `gatrix_user` |
| `DB_PASSWORD` | 数据库密码 | `secure-password` |
| `REDIS_HOST` | 云 Redis 主机 | `redis.cloud.example.com` |
| `REDIS_PORT` | Redis 端口 | `6379` |
| `REDIS_PASSWORD` | Redis 密码 | `redis-password` |

### 安全项（生产环境必须修改）

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | JWT 令牌签名密钥 |
| `JWT_REFRESH_SECRET` | JWT 刷新令牌密钥 |
| `SESSION_SECRET` | 会话加密密钥 |
| `GRAFANA_ADMIN_PASSWORD` | Grafana 管理员密码 |

> **注意**：`EDGE_API_TOKEN` / `EDGE_BYPASS_TOKEN` 是用于内部服务间通信的固定约定值。  
> 请勿重新生成或更改。默认值已在 `.env.example` 中设置。

### 可选项

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `GATRIX_VERSION` | `latest` | 部署的镜像标签 |
| `NGINX_REPLICAS` | `0` | Nginx 副本数 (0=禁用, 1=启用) |
| `HTTP_PORT` | `80` | Nginx HTTP 端口 |
| `HTTPS_PORT` | `443` | Nginx HTTPS 端口 |
| `BACKEND_REPLICAS` | `2` | Backend 副本数 |
| `FRONTEND_REPLICAS` | `2` | Frontend 副本数 |
| `EDGE_REPLICAS` | `2` | Edge 副本数 |
| `GRAFANA_PORT` | `3000` | Grafana 仪表板端口 |
| `PROMETHEUS_PORT` | `9090` | Prometheus UI 端口 |
| `DEFAULT_LANGUAGE` | `zh` | 默认语言 |

---

## 🛠️ 运维指南

### 构建 & 推送镜像（⚠️ 仅限开发环境）

> **注意**：镜像构建需要**完整源代码**，仅在**开发环境**中可用。  
> `build-and-push.sh` **不包含**在 `package.sh` 生成的部署包中。  
> 生产服务器使用 `deploy.sh` 部署开发团队已推送到仓库的镜像。

```bash
# 在开发环境中运行：
./build-and-push.sh -t v1.0.0 -l -p           # 所有服务
./build-and-push.sh -s backend -t v1.0.0 -p    # 特定服务
```

### 滚动更新

```bash
./update.sh -v 1.1.0 --all                     # 更新所有服务
./update.sh -v 1.1.0 --service backend          # 更新特定服务
```

### 回滚

```bash
./rollback.sh --service backend                 # 回滚特定服务
./rollback.sh --all                             # 回滚所有服务
```

### 扩缩容

```bash
./scale.sh --preset minimal                     # backend:1  frontend:1  edge:1
./scale.sh --preset standard                    # backend:2  frontend:1  edge:2
./scale.sh --preset high                        # backend:4  frontend:2  edge:8
./scale.sh --service backend --replicas 4       # 单独扩容
```

### 状态检查

```bash
./status.sh                                     # 全部状态
./status.sh --services                          # 服务列表
./status.sh --health                            # 健康状态
./status.sh --logs backend                      # 服务日志
```

### 健康检查

```bash
./health-check.sh                               # 全面健康检查（含 HTTP）
./health-check.sh --timeout 180                 # 自定义超时
```

### 生成安全密钥

> **注意**：以下命令仅将密钥**输出到终端**（不会自动修改 `.env`）。  
> 请**复制输出内容并手动粘贴到 `.env` 文件**中。

```bash
./generate-secrets.sh --env                     # 生成所有安全密钥（复制输出）
./generate-secrets.sh                           # 单个密钥（32字节 base64）
./generate-secrets.sh -l 64 -e hex              # 64字节 hex 密钥
./generate-secrets.sh -l 48 -e alphanumeric     # 48字符字母数字密钥
```

### 堆栈移除 (Teardown)

```bash
./teardown.sh                                   # 仅移除堆栈
./teardown.sh --all                             # 移除堆栈 + 卷 + 密钥
./teardown.sh --all -y                          # 无确认直接移除
```

### 打包部署文件（用于传输到服务器）

```bash
./package.sh                                    # 生成 gatrix-swarm-YYYYMMDD-HHMMSS.tgz
./package.sh -o /tmp                            # 输出到指定目录
```

---

## 📋 .env 管理指南

### Docker Swarm 如何使用 .env

> **关键**：Docker Swarm **仅在部署时**读取 `.env`（`docker stack deploy`）。  
> 仅编辑 `.env` 不会影响正在运行的服务。必须重新部署才能生效。

```
.env 文件 ──(部署时读取)──> docker stack deploy ──> 运行中的容器
                             ↑                        ↑
                        仅在此处读取              环境变量已固化
```

### 变量分类

配置分为 **3 个类别**，每个类别的更新方式不同：

| 类别 | 示例 | 存储位置 | 更新方法 |
|------|------|----------|----------|
| **环境变量** | `DB_HOST`, `REDIS_HOST`, `DEFAULT_LANGUAGE` | `.env` → 容器 env | 编辑 `.env` + 重新部署 |
| **Docker Secrets** | `JWT_SECRET`, `SESSION_SECRET` | Docker secret 存储 | 删除 + 重建 secret + 重新部署 |
| **部署变量** | `GATRIX_VERSION`, `BACKEND_REPLICAS` | `.env` → compose 文件 | 编辑 `.env` + 重新部署 |

### 操作：更改环境变量

更改 `DB_HOST`、`REDIS_HOST`、`DEFAULT_LANGUAGE`、`EDGE_*` 等：

```bash
# 1. 编辑 .env
vi .env

# 2. 重新部署（Swarm 自动执行滚动更新）
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix

# 3. 验证更改已生效
docker service inspect gatrix_backend --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep DB_HOST

# 4. 健康检查
./health-check.sh
```

**重新部署时的行为：**
- Swarm 比较新配置与运行中的配置
- 仅重启配置已更改的服务
- 使用滚动更新重启（replicas > 1 时零停机）
- 未更改的服务不会重启

### 操作：更改安全密钥（JWT、Session 等）

更改 `JWT_SECRET`、`JWT_REFRESH_SECRET`、`SESSION_SECRET`：

> ⚠️ **警告**：更改 JWT Secret 将使所有现有用户会话失效。  
> 请在维护窗口期间进行此操作。

> **注意**：服务从**环境变量**（通过 `.env` 设置）读取安全值，
> 而不是从 Docker secret 文件挂载读取。Docker secrets 在每次部署时自动创建（已存在则跳过），
> 仅供参考/备份。请同时更新 `.env` 和 Docker secrets 以保持一致。

```bash
# 1. 更新 .env 中的值
vi .env    # 修改 JWT_SECRET=new-value

# 2. 重新部署（Swarm 滚动更新应用新的环境变量）
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix

# 3. 验证
./health-check.sh

# 4.（可选）同时更新 Docker secrets 以保持一致
docker stack rm gatrix
sleep 15
docker secret rm jwt_secret
echo -n "new-value" | docker secret create jwt_secret -
./deploy.sh -v latest
```

### 操作：扩缩容（更改副本数）

```bash
# 方法 A：编辑 .env 后重新部署（永久生效）
vi .env    # 修改 EDGE_REPLICAS=8
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix

# 方法 B：使用 scale 脚本（立即生效 + 自动保存到 .env）
./scale.sh --service edge --replicas 8

# 方法 C：临时扩缩容（不修改 .env）
./scale.sh --service edge --replicas 8 --no-persist
```

> **注意**：使用 `--no-persist` 时不会修改 `.env`，  
> 因此下次部署时会恢复为 `.env` 中的值。

### 操作：更改镜像版本

```bash
# 1. 修改 .env
vi .env    # 修改 GATRIX_VERSION=1.2.0

# 2. 重新部署
./deploy.sh -v 1.2.0

# 或使用更新脚本：
./update.sh -v 1.2.0 --all
```

### 常见错误

| 错误 | 结果 | 解决方法 |
|------|------|----------|
| 编辑 `.env` 后未重新部署 | 无变化，旧值仍在运行 | 运行 `docker stack deploy ...` |
| 仅在 `.env` 中更改 `JWT_SECRET` | Docker Secret 仍为旧值 | 需删除 + 重建 Docker Secret |
| 使用 `scale.sh --no-persist` 后未更新 `.env` | 下次部署时恢复为 `.env` 值 | 不加 `--no-persist` 运行即可自动保存 |
| 设置 `DB_HOST=your-cloud-...`（占位符） | `deploy.sh` 验证失败阻止部署 | 替换为实际云 DB 地址 |
| 仅在一个管理节点修改 `.env` | 其他管理节点可能使用不同的 `.env` | 同步 `.env` 到所有管理节点 |

### 验证运行中的配置

```bash
# 查看服务实际运行的环境变量：
docker service inspect gatrix_backend --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}' | python3 -m json.tool

# 查看已挂载的 Secret：
docker service inspect gatrix_backend --format '{{json .Spec.TaskTemplate.ContainerSpec.Secrets}}'

# 检查特定变量：
docker service inspect gatrix_backend --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep REDIS_HOST
```

### 多节点 Swarm 注意事项

使用多个管理/工作节点运行 Docker Swarm 时：

1. **`.env` 必须在运行 `docker stack deploy` 的节点上** — 通常是主管理节点
2. **`config/` 目录必须可访问** — nginx/prometheus/grafana 需要 bind-mount
3. **Docker Secrets 自动复制** — 跨所有 Swarm 节点
4. **镜像拉取需要所有节点认证** — 使用 `--with-registry-auth`（已包含在部署脚本中）

### 备份与恢复

```bash
# 更改前备份 .env
cp .env .env.backup.$(date +%Y%m%d-%H%M%S)

# 列出所有备份
ls -la .env.backup.*

# 从备份恢复
cp .env.backup.20260415-103000 .env
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix
```

---

## 🔍 服务架构

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

## 🔀 Nginx 反向代理（可选）

Nginx **默认禁用**（`NGINX_REPLICAS=0`）。

### 何时需要 Nginx？

| 环境 | Nginx | 原因 |
|------|-------|------|
| **生产环境（使用 Cloud LB）** | ❌ 禁用 | Cloud LB（腾讯 CLB / AWS ALB）处理路由、SSL 终止、健康检查 |
| **开发/测试（无 LB）** | ✅ 启用 | 通过单一端口 (:80) 访问所有服务 |
| **本地部署（无 Cloud LB）** | ✅ 启用 | Nginx 作为轻量级反向代理 / 负载均衡器 |

### 如何启用 Nginx

```bash
# 1. 在 .env 中设置 NGINX_REPLICAS=1
vi .env
# NGINX_REPLICAS=1

# 2. 重新部署
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix

# 3. 验证
curl http://localhost:80/health
```

启用后，可通过单一端口访问所有服务：

| 路径 | 路由到 |
|------|--------|
| `http://localhost/` | Frontend（管理界面） |
| `http://localhost/api/v1/` | Backend API |
| `http://localhost/grafana/` | Grafana 仪表板 |
| `http://localhost/health` | Nginx 健康检查 |

### 如何禁用 Nginx（默认）

```bash
# 1. 在 .env 中设置 NGINX_REPLICAS=0
vi .env
# NGINX_REPLICAS=0

# 2. 重新部署
docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix
```

禁用后，通过直接端口访问各服务：

| 服务 | 直接端口 |
|------|---------|
| Frontend | `:43000` |
| Backend | `:45000` |
| Edge | `:3400` |
| Grafana | `:3000` |
| Prometheus | `:9090` |

### Nginx 配置文件

Nginx 配置位于 `config/nginx.conf`。修改后重新部署即可生效。

> ⚠️ **注意**：即使启用了 Nginx，直接端口访问仍然可用。在生产环境中，如果只想通过 Nginx 接收流量，请通过防火墙阻止内部端口。

---

## ⚠️ 注意事项

### 安全

1. **不要将 `.env` 提交到 Git** — 包含真实密码。
2. **不要将 `registry.env` 提交到 Git** — 包含仓库认证令牌。
3. **安全密钥是环境变量**：服务从 `.env` 读取 `JWT_SECRET`、`SESSION_SECRET` 等（不是从 Docker secret 文件挂载）。要更改这些值，请修改 `.env` 并重新部署：
   ```bash
   # 修改 .env 后：
   docker stack deploy -c docker-compose.swarm.yml --with-registry-auth gatrix
   ```
4. **务必更改 Grafana 默认密码** — 在 `.env` 中将 `GRAFANA_ADMIN_PASSWORD` 设置为强密码。

### 网络 & 防火墙

5. **云 DB/Redis 防火墙**：确保 Docker Swarm 节点可以访问您的云 DB/Redis，配置安全组/防火墙规则。
6. **Redis Pub/Sub 访问**：Gatrix 通过 Redis Pub/Sub 与游戏服务器实时通信（Feature Flag 变更、配置同步等）。云 Redis 不仅需要 **Gatrix 服务可访问，还需要游戏服务器也可访问**。如果游戏服务器在不同网络中，需要在云 Redis 安全组中添加游戏服务器的 IP。
7. **Swarm 节点间端口**：多节点环境中，节点间 `2377`（管理）、`7946`（发现）、`4789`（VXLAN）端口必须开放。
8. **Cloud LB 健康检查路径**：配置 Cloud LB 时使用以下端点：
   | 服务 | 健康检查路径 | 端口 |
   |------|-------------|------|
   | Edge | `/health` | 3400 |
   | Frontend | `/health` | 43000 |
   | Backend | `/health` | 45000 |

### 部署 & 运维

9. **Docker 镜像必须先推送到仓库**：`build-and-push.sh` **需要源代码，仅限开发环境使用**，不包含在部署包中。开发团队将镜像上传到仓库后，生产服务器使用 `deploy.sh` 拉取并部署镜像。
10. **`registry.env` 不包含在包中**：必须在部署服务器上手动创建。请向开发团队索取仓库认证信息。
11. **`.env` 仅在部署时读取**：修改 `.env` 后必须重新部署才能生效。仅编辑不会影响正在运行的服务。
12. **`scale.sh` 默认自动保存到 `.env`**：扩缩容更改会自动保存到 `.env`，因此在重新部署后仍然有效。使用 `--no-persist` 仅进行临时扩缩容。
13. **SSL/TLS 应在 Cloud LB 终止**：服务本身仅提供 HTTP。请在 Cloud LB（腾讯 CLB / AWS ALB）上配置 HTTPS 证书。

### 数据 & 卷

14. **卷数据是节点本地的**：Prometheus 和 Grafana 的数据仅存储在容器运行的节点上。节点故障可能导致监控数据丢失。关键数据使用云 DB/Redis（已在设计中考虑）。
15. **`teardown.sh` 默认不删除卷**：要完全清理 Prometheus/Grafana 数据，请使用 `--volumes` 参数：
    ```bash
    ./teardown.sh --volumes    # 同时删除卷
    ```
16. **Docker 日志磁盘空间**：Docker 默认不轮换日志，可能导致磁盘满。此堆栈将 `json-file` 日志器配置为 `max-size: 10m`、`max-file: 3`，每个服务最多约 30MB。

### 多节点环境

17. **配置文件只需在管理节点上**：`docker-compose.swarm.yml`、`.env`、`config/` 等只需存在于管理节点上。无需复制到工作节点。
18. **所有节点都需要仓库登录**：虽然部署脚本包含 `--with-registry-auth` 参数，但每个节点必须先运行 `docker login`。
19. **时间同步（NTP）**：所有 Swarm 节点的时钟必须同步。时间偏差会影响 JWT 令牌验证和 Raft 共识：
    ```bash
    timedatectl status    # 检查时间同步状态
    ```

### 故障排除

20. **服务无法启动时**：
    ```bash
    docker service ps gatrix_backend --no-trunc    # 查看失败原因
    docker service logs gatrix_backend             # 查看日志
    ```
21. **镜像拉取失败**：检查 `registry.env` 的认证信息，验证在受影响的节点上 `docker login` 是否有效。
22. **端口冲突**：如果端口已被占用，在 `.env` 中更改端口（`BACKEND_PORT`、`FRONTEND_PORT`、`GRAFANA_PORT` 等）。

---

## 📖 其他语言

- [한국어](README.md)
- [English](README.en.md)
