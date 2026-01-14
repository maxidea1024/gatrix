# Gatrix Lite 部署指南

使用 Docker Compose 的轻量级部署包。

---

## 目录

1. [首次设置](#首次设置)
2. [更新到新版本](#更新到新版本)
3. [完全重置](#完全重置)
4. [常用操作](#常用操作)
5. [故障排除](#故障排除)

---

## 首次设置

### 步骤 1：创建环境文件

复制示例环境文件：

```bash
cp .env.example .env
```

或使用设置脚本：

```bash
# Linux/macOS
./setup-env.sh

# Windows
./setup-env.ps1
```

### 步骤 2：配置环境变量

编辑 `.env` 并设置必需值：

```bash
# 使用您喜欢的编辑器打开
vim .env
# 或
nano .env
```

**必需设置：**
- `JWT_SECRET` - JWT 签名密钥（使用随机字符串）
- `JWT_REFRESH_SECRET` - 刷新令牌密钥
- `DB_PASSWORD` - 数据库密码（如使用本地数据库）

### 步骤 3：启动服务

```bash
# Linux/macOS
./update-lite.sh -t v0.0.1

# Windows
./update-lite.ps1 -t v0.0.1
```

### 步骤 4：验证服务

```bash
docker compose -f docker-compose.lite.yml ps
```

所有服务应显示 "running" 状态。

---

## 更新到新版本

当发布新版本时：

```bash
# Linux/macOS
./update-lite.sh -t v0.0.2

# Windows
./update-lite.ps1 -t v0.0.2
```

此操作将：
1. 停止运行中的服务
2. 拉取指定标签的新镜像
3. 使用新版本启动服务

---

## 完全重置

> ⚠️ **危险：数据丢失警告** ⚠️
>
> `-v` 标志将 **永久删除所有数据**，包括：
> - 数据库内容（用户、设置、所有记录）
> - 上传的文件和媒体
> - 缓存和会话数据
> - 任何其他持久化数据
>
> **此操作不可撤销！** 请在继续之前确保有备份。

仅在需要完全重新开始时使用：

```bash
# Linux/macOS
./update-lite.sh -t v0.0.1 -v

# Windows
./update-lite.ps1 -t v0.0.1 -v
```

**何时使用：**
- 初始开发环境设置
- 需要全新数据的重大架构更改后
- 开发团队明确指示时

**何时不使用：**
- 常规版本更新（省略 `-v` 标志）
- 有真实数据的生产环境
- 不确定时

---

## 常用操作

### 检查服务状态

```bash
docker compose -f docker-compose.lite.yml ps
```

### 查看日志

```bash
# 所有服务
docker compose -f docker-compose.lite.yml logs -f

# 特定服务（如 backend）
docker compose -f docker-compose.lite.yml logs -f backend

# 最后 100 行
docker compose -f docker-compose.lite.yml logs --tail 100 backend
```

### 停止服务

```bash
docker compose -f docker-compose.lite.yml down
```

### 重启单个服务

```bash
docker compose -f docker-compose.lite.yml restart backend
```

### 访问服务 Shell

```bash
docker compose -f docker-compose.lite.yml exec backend sh
```

---

## 故障排除

### 问题：运行脚本时 "Permission denied"

**原因：** 脚本没有执行权限。

**解决：**
```bash
chmod +x update-lite.sh setup-env.sh
```

---

### 问题："Cannot connect to Docker daemon"

**原因：** Docker 未运行或需要 sudo。

**解决：**
```bash
# 检查 Docker 状态
sudo systemctl status docker

# 启动 Docker
sudo systemctl start docker

# 或使用 sudo 运行
sudo ./update-lite.sh -t v0.0.1
```

---

### 问题：服务无法启动（端口已被占用）

**原因：** 另一个应用程序正在使用相同的端口。

**解决：**
1. 检查正在使用的端口：
   ```bash
   docker compose -f docker-compose.lite.yml ps
   ```

2. 停止冲突的应用程序或编辑 `.env` 更改端口：
   ```env
   FRONTEND_PORT=3001  # 从默认的 3000 更改
   ```

---

### 问题：数据库连接失败

**原因：** 数据库容器未就绪或凭据错误。

**解决：**
1. 检查数据库是否正在运行：
   ```bash
   docker compose -f docker-compose.lite.yml ps mysql
   ```

2. 检查数据库日志：
   ```bash
   docker compose -f docker-compose.lite.yml logs mysql
   ```

3. 验证 `.env` 中的数据库设置是否正确。

---

### 问题：拉取时 "Image not found"

**原因：** 标签错误或未登录镜像仓库。

**解决：**
1. 验证镜像仓库中是否存在该标签
2. 如需要，登录镜像仓库：
   ```bash
   docker login uwocn.tencentcloudcr.com
   ```

---

### 问题：磁盘空间不足

**原因：** Docker 镜像/卷占用磁盘空间。

**解决：**
```bash
# 删除未使用的 Docker 资源
docker system prune -a

# 检查磁盘使用情况
docker system df
```

---

### 问题：服务启动但应用程序不工作

**原因：** 环境变量缺失或错误。

**解决：**
1. 检查日志中的错误消息：
   ```bash
   docker compose -f docker-compose.lite.yml logs backend
   ```

2. 验证 `.env` 中是否设置了所有必需的环境变量

3. 修复后重启服务：
   ```bash
   docker compose -f docker-compose.lite.yml down
   docker compose -f docker-compose.lite.yml up -d
   ```

---

## 文件结构

```
gatrix/
├── .env                      # 您的环境配置（需要创建）
├── .env.example              # 示例环境配置
├── docker-compose.lite.yml   # Docker Compose 配置
├── update-lite.sh            # 更新脚本 (Linux/macOS)
├── update-lite.ps1           # 更新脚本 (Windows)
├── setup-env.sh              # 设置脚本 (Linux/macOS)
├── setup-env.ps1             # 设置脚本 (Windows)
├── QUICKSTART.md             # 本文件（英文）
├── QUICKSTART.zh.md          # 本文件（中文）
└── deploy/                   # 生产部署脚本
```

---

## 关于 `deploy/` 文件夹

`deploy/` 文件夹包含使用 **Docker Swarm** 进行 **大规模生产部署的高级脚本**。

> 💡 **注意：** 对于简单的单服务器部署，您只需要 `update-lite.sh` 和 `docker-compose.lite.yml`。`deploy/` 文件夹是为管理生产基础设施的 DevOps 团队准备的。

### 何时使用 Docker Swarm 脚本

| 场景 | 使用工具 |
|------|----------|
| 开发 / 测试 | `update-lite.sh`（本指南） |
| 单个生产服务器 | `update-lite.sh`（本指南） |
| 多节点集群 | `deploy/` 脚本 (Docker Swarm) |
| 需要高可用性 | `deploy/` 脚本 (Docker Swarm) |
| 需要自动扩展 | `deploy/` 脚本 (Docker Swarm) |

### Docker Swarm 功能（deploy/ 文件夹）

- **滚动更新** - 零停机部署
- **自动回滚** - 部署失败时自动恢复
- **服务扩展** - 跨多个节点扩展
- **负载均衡** - 内置支持
- **密钥管理** - 敏感数据安全
- **健康检查** - 自动恢复

### deploy/ 脚本

| 脚本 | 用途 |
|------|------|
| `build-and-push.sh/.ps1` | 构建 Docker 镜像并推送到镜像仓库 |
| `deploy.sh/.ps1` | 部署堆栈到 Docker Swarm |
| `update.sh/.ps1` | 滚动更新服务 |
| `rollback.sh/.ps1` | 回滚到上一版本 |
| `scale.sh/.ps1` | 调整服务副本数 |
| `status.sh/.ps1` | 检查堆栈和服务状态 |

有关详细的 Docker Swarm 部署说明，请参阅 `deploy/README.zh.md`。

---

## 获取帮助

如果遇到此处未涵盖的问题：

1. 检查服务日志：`docker compose -f docker-compose.lite.yml logs`
2. 验证 `.env` 配置
3. 尝试使用 `-v` 标志重置（警告：会删除数据）
4. 联系开发团队
