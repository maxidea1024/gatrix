# Gatrix Docker Swarm 部署

使用 Docker Swarm 进行生产环境部署配置。

## 主要功能

- **滚动更新**: 零停机部署，失败时自动回滚
- **服务扩缩容**: 根据流量调整服务规模
- **回滚**: 即时恢复到之前版本
- **健康检查**: 自动容器状态监控
- **密钥管理**: 敏感数据安全存储
- **负载均衡**: 内置服务网格和负载分发

## 前置要求

- Docker 20.10+
- Docker Swarm 已初始化
- Tencent Cloud Registry 访问权限

## 快速开始

### 1. 初始化 Swarm 集群

```bash
# 在管理节点执行
docker swarm init

# 添加工作节点（可选）
docker swarm join-token worker
# 在工作节点执行生成的命令
```

### 2. 配置环境

```bash
cd deploy
cp .env.example .env
# 修改为生产环境值
vim .env
```

### 3. 初始部署

```bash
# 创建密钥并部署
./deploy.sh --init --version 1.0.0
```

## 脚本参考

| 脚本 | 说明 |
|------|------|
| `deploy.sh` | 部署或更新整个栈 |
| `update.sh` | 特定服务滚动更新 |
| `rollback.sh` | 回滚到之前版本 |
| `scale.sh` | 调整服务规模 |
| `status.sh` | 查看栈和服务状态 |

## 部署工作流

### 新部署

```bash
./deploy.sh --init --version 1.0.0
```

### 滚动更新

```bash
# 将所有服务更新到新版本
./update.sh --version 1.1.0 --all

# 仅更新特定服务
./update.sh --version 1.1.0 --service backend
```

### 回滚

```bash
# 回滚特定服务
./rollback.sh --service backend

# 回滚所有服务
./rollback.sh --all
```

### 扩缩容

```bash
# 调整特定服务规模
./scale.sh --service backend --replicas 4

# 使用预设
./scale.sh --preset minimal    # 每个服务1个副本
./scale.sh --preset standard   # 关键服务2个副本
./scale.sh --preset high       # 高流量4个以上副本

# 查看当前规模
./scale.sh --status
```

### 状态监控

```bash
# 查看全部状态
./status.sh

# 查看服务列表
./status.sh --services

# 查看运行中的任务
./status.sh --tasks

# 查看健康状态
./status.sh --health

# 查看日志流
./status.sh --logs backend
```

## 扩缩容预设

| 预设 | backend | frontend | event-lens | chat-server | edge |
|------|---------|----------|------------|-------------|------|
| minimal | 1 | 1 | 1 | 1 | 1 |
| standard | 2 | 2 | 1 | 2 | 2 |
| high | 4 | 4 | 2 | 4 | 4 |

## 更新配置

默认滚动更新设置：
- `parallelism: 1` - 每次更新一个容器
- `delay: 10s` - 更新间隔
- `failure_action: rollback` - 失败时自动回滚
- `monitor: 30s` - 更新后监控期
- `order: start-first` - 先启动新容器再停止旧容器

## 密钥管理

`--init` 部署时创建的密钥：

| 密钥 | 说明 |
|------|------|
| `db_root_password` | MySQL root 密码 |
| `db_password` | 应用数据库密码 |
| `jwt_secret` | JWT 签名密钥 |
| `jwt_refresh_secret` | JWT 刷新令牌密钥 |
| `session_secret` | 会话加密密钥 |
| `api_secret` | 内部 API 认证 |
| `edge_api_token` | Edge 服务器 API 令牌 |
| `grafana_password` | Grafana 管理员密码 |

更新密钥：
```bash
# 删除旧密钥（需先移除使用它的服务）
docker secret rm jwt_secret

# 创建新密钥
echo -n "new-secret-value" | docker secret create jwt_secret -

# 重新部署相关服务
./deploy.sh --version 1.0.0
```

## 网络架构

- `gatrix-internal`: 内部覆盖网络（隔离）
- `gatrix-public`: 外部访问覆盖网络

## 故障排除

### 查看服务日志
```bash
docker service logs gatrix_backend --follow --tail 100
```

### 查看任务状态
```bash
docker service ps gatrix_backend --no-trunc
```

### 强制更新服务
```bash
docker service update --force gatrix_backend
```

### 移除栈
```bash
docker stack rm gatrix
```

