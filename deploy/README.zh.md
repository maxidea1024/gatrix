# Gatrix 部署脚本

本目录包含用于构建、部署和管理 Gatrix 应用程序栈的脚本。

所有脚本都支持 **Linux 风格参数**（如 `-t`、`--tag`），以确保 PowerShell 和 Bash 之间的一致性。

---

## 目录

1. [前置要求](#前置要求)
2. [配置](#配置)
3. [构建与推送](#构建与推送)
4. [部署](#部署)
5. [运维](#运维)
6. [镜像仓库脚本](#镜像仓库脚本)
7. [故障排除](#故障排除)

---

## 前置要求

- 已安装并运行 **Docker Desktop**（或 Docker Engine）
- 已初始化 **Docker Swarm**（用于部署脚本）
- **PowerShell 5+**（Windows）或 **Bash**（Linux/macOS）
- 腾讯云容器镜像服务访问权限（凭证在 `registry.env` 中）

---

## 配置

### `registry.env`

镜像仓库凭证（请勿提交到版本控制）：

```bash
REGISTRY_HOST=uwocn.tencentcloudcr.com
REGISTRY_USER=<用户名>
REGISTRY_PASS=<密码或令牌>
REGISTRY_NAMESPACE=uwocn/uwocn
```

### `.env` / `.env.example`

栈的环境变量（数据库、JWT 密钥等）。将 `.env.example` 复制为 `.env` 并填写相应值。

---

## 构建与推送

### `build-and-push.ps1` / `build-and-push.sh`

构建 Docker 镜像，可选择推送到镜像仓库。

**选项：**

| 选项                   | 说明                         |
| ---------------------- | ---------------------------- |
| `-t, --tag <tag>`      | 镜像标签（默认：`latest`）   |
| `-p, --push`           | 构建后推送到镜像仓库         |
| `-l, --latest`         | 同时添加并推送 `latest` 标签 |
| `-s, --service <name>` | 仅构建指定服务（可重复使用） |
| `-h, --help`           | 显示帮助                     |

**可用服务：** `backend`、`frontend`、`edge`、`chat-server`、`event-lens`

**示例：**

```bash
# 构建所有服务，标签为 "latest"
./build-and-push.ps1
./build-and-push.sh

# 使用指定版本标签构建并推送所有服务
./build-and-push.ps1 -t v1.2.0 -p
./build-and-push.sh --tag v1.2.0 --push

# 同时添加版本标签和 latest 标签
./build-and-push.ps1 -t v1.2.0 -l -p
./build-and-push.sh --tag v1.2.0 --latest --push

# 仅构建 backend
./build-and-push.ps1 -s backend
./build-and-push.sh --service backend

# 构建 backend 和 frontend 后推送
./build-and-push.ps1 -s backend -s frontend -p
./build-and-push.sh --service backend --service frontend --push
```

---

## 部署

### `deploy.ps1` / `deploy.sh`

将 Gatrix 栈部署到 Docker Swarm。

**选项：**

| 选项                      | 说明                         |
| ------------------------- | ---------------------------- |
| `-v, --version <version>` | 部署版本（默认：`latest`）   |
| `-e, --env-file <file>`   | 环境文件路径（默认：`.env`） |
| `-n, --stack <name>`      | 栈名称（默认：`gatrix`）     |
| `-i, --init`              | 初始化 Swarm 并创建密钥      |
| `-u, --update`            | 执行滚动更新                 |
| `--prune`                 | 部署后移除未使用的镜像       |
| `-h, --help`              | 显示帮助                     |

**示例：**

```bash
# 首次部署（初始化 Swarm + 密钥）
./deploy.ps1 -v v1.0.0 -i
./deploy.sh --version v1.0.0 --init

# 滚动更新部署
./deploy.ps1 -v v1.1.0 -u
./deploy.sh --version v1.1.0 --update

# 部署后清理旧镜像
./deploy.ps1 -v v1.2.0 --prune
./deploy.sh --version v1.2.0 --prune
```

---

## 运维

### `update.ps1` / `update.sh`

对运行中的服务执行滚动更新。

**选项：**

| 选项                      | 说明                     |
| ------------------------- | ------------------------ |
| `-v, --version <version>` | 目标版本（必需）         |
| `-s, --service <name>`    | 仅更新指定服务           |
| `-a, --all`               | 更新所有应用服务         |
| `-f, --force`             | 强制更新（即使镜像相同） |
| `-n, --stack <name>`      | 栈名称（默认：`gatrix`） |
| `-h, --help`              | 显示帮助                 |

**示例：**

```bash
# 将所有服务更新到 v1.2.0
./update.ps1 -v v1.2.0 -a
./update.sh --version v1.2.0 --all

# 仅更新 backend
./update.ps1 -v v1.2.0 -s backend
./update.sh --version v1.2.0 --service backend

# 强制重新部署（即使镜像相同）
./update.ps1 -v v1.2.0 -s backend -f
./update.sh --version v1.2.0 --service backend --force
```

---

### `rollback.ps1` / `rollback.sh`

将服务回滚到上一版本。

**选项：**

| 选项                   | 说明                     |
| ---------------------- | ------------------------ |
| `-s, --service <name>` | 回滚指定服务             |
| `-a, --all`            | 回滚所有应用服务         |
| `-n, --stack <name>`   | 栈名称（默认：`gatrix`） |
| `-h, --help`           | 显示帮助                 |

**示例：**

```bash
# 回滚 backend 服务
./rollback.ps1 -s backend
./rollback.sh --service backend

# 回滚所有服务
./rollback.ps1 -a
./rollback.sh --all
```

---

### `scale.ps1` / `scale.sh`

调整服务副本数量。

**选项：**

| 选项                   | 说明                                    |
| ---------------------- | --------------------------------------- |
| `-s, --service <name>` | 要扩展的服务                            |
| `-r, --replicas <n>`   | 副本数量                                |
| `--preset <name>`      | 使用预设：`minimal`、`standard`、`high` |
| `--status`             | 显示当前扩展状态                        |
| `-n, --stack <name>`   | 栈名称（默认：`gatrix`）                |
| `-h, --help`           | 显示帮助                                |

**预设：**

- `minimal`：每个服务 1 个副本
- `standard`：每个服务 2 个副本（推荐）
- `high`：每个服务 4 个副本（高流量）

**示例：**

```bash
# 将 backend 扩展到 4 个副本
./scale.ps1 -s backend -r 4
./scale.sh --service backend --replicas 4

# 应用高流量预设
./scale.ps1 --preset high
./scale.sh --preset high

# 查看当前状态
./scale.ps1 --status
./scale.sh --status
```

---

### `status.ps1` / `status.sh`

显示已部署栈的状态。

**选项：**

| 选项                   | 说明                     |
| ---------------------- | ------------------------ |
| `-s, --services`       | 仅显示服务列表           |
| `-t, --tasks`          | 仅显示运行中的任务       |
| `-l, --logs <service>` | 流式查看服务日志         |
| `--health`             | 显示健康检查状态         |
| `-n, --stack <name>`   | 栈名称（默认：`gatrix`） |
| `-h, --help`           | 显示帮助                 |

**示例：**

```bash
# 显示全部状态
./status.ps1
./status.sh

# 仅显示服务
./status.ps1 -s
./status.sh --services

# 流式查看 backend 日志
./status.ps1 -l backend
./status.sh --logs backend

# 显示健康状态
./status.ps1 --health
./status.sh --health
```

---

## 镜像仓库脚本

### `login-registry.ps1` / `login-registry.sh`

使用 `registry.env` 中的凭证登录腾讯云容器镜像服务。

```bash
./login-registry.ps1
./login-registry.sh
# 输出：Login Succeeded
```

---

### `list-images.ps1` / `list-images.sh`

列出镜像仓库命名空间中的所有镜像标签。

```bash
./list-images.ps1
./list-images.sh
# 输出：Tags found:
#   backend-latest
#   backend-v1.0.0
#   frontend-latest
#   ...
```

如果仓库为空：

```
Repository 'uwocn/uwocn' not found or has no images yet.
```

---

## 故障排除

### "Login Failed" 错误

- 检查 `registry.env` 中是否有有效的凭证。
- 确认 `REGISTRY_HOST` 正确。
- 尝试手动登录：`docker login uwocn.tencentcloudcr.com`

### 列出镜像时显示 "Repository not found"

- 如果还没有推送过镜像，这是正常的。
- 首先使用 `./build-and-push.ps1 -p` 推送镜像。

### "Docker build failed" 构建失败

- 检查 Docker 是否正在运行。
- 检查 `packages/<service>/Dockerfile` 语法。
- 直接运行 `docker build` 查看详细错误。

### Swarm 未初始化

- 运行 `docker swarm init` 或在 `deploy.ps1` 中使用 `--init` 参数。

---

## 文件参考

| 文件                     | 用途                   |
| ------------------------ | ---------------------- |
| `build-and-push.ps1/.sh` | 构建和推送 Docker 镜像 |
| `deploy.ps1/.sh`         | 部署到 Docker Swarm    |
| `update.ps1/.sh`         | 滚动更新               |
| `rollback.ps1/.sh`       | 服务回滚               |
| `scale.ps1/.sh`          | 副本扩展               |
| `status.ps1/.sh`         | 显示栈状态             |
| `login-registry.ps1/.sh` | 镜像仓库登录           |
| `list-images.ps1/.sh`    | 列出镜像仓库镜像       |
| `registry.env`           | 镜像仓库凭证           |
| `.env.example`           | 环境配置模板           |
| `docker-stack.yml`       | Swarm 栈定义           |
