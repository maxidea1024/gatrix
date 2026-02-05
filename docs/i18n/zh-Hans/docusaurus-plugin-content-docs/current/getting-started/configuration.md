---
sidebar_position: 3
---

# 配置指南

Gatrix 配置说明。

## 环境变量

### 数据库设置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DB_HOST` | MySQL 主机 | localhost |
| `DB_PORT` | MySQL 端口 | 43306 |
| `DB_NAME` | 数据库名 | gatrix |
| `DB_USER` | MySQL 用户 | gatrix_user |
| `DB_PASSWORD` | MySQL 密码 | gatrix_password |
| `DB_ROOT_PASSWORD` | MySQL root 密码 | gatrix_rootpassword |

### Redis 设置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `REDIS_HOST` | Redis 主机 | localhost |
| `REDIS_PORT` | Redis 端口 | 46379 |
| `REDIS_PASSWORD` | Redis 密码 | (无) |
| `REDIS_DB` | Redis DB 编号 | 0 |

### 服务端口

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `BACKEND_PORT` | Backend API 端口 | 45000 |
| `FRONTEND_PORT` | Frontend 端口 | 43000 |
| `EDGE_PORT` | Edge 服务器端口 | 3400 |
| `CHAT_PORT` | Chat 服务器端口 | 45100 |
| `EVENT_LENS_PORT` | Event Lens 端口 | 45200 |
| `GRAFANA_PORT` | Grafana 端口 | 44000 |
| `PROMETHEUS_PORT` | Prometheus 端口 | 49090 |

### 安全设置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `JWT_SECRET` | JWT 签名密钥 | dev-jwt-secret |
| `JWT_REFRESH_SECRET` | JWT 刷新令牌密钥 | dev-refresh-secret |
| `SESSION_SECRET` | 会话加密密钥 | dev-session-secret |
| `API_TOKEN` | 内部 API 令牌 | gatrix-unsecured-server-api-token |

### 管理员账户

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ADMIN_EMAIL` | 管理员邮箱 | admin@gatrix.com |
| `ADMIN_PASSWORD` | 管理员密码 | admin123 |
| `ADMIN_NAME` | 管理员名称 | Administrator |

### OAuth 设置 (可选)

| 变量 | 说明 |
|------|------|
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |

### 日志设置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LOG_LEVEL` | 日志级别 | debug |
| `LOG_FORMAT` | 日志格式 | json |
| `GATRIX_LOKI_ENABLED` | Loki 集成 | true |
| `GATRIX_LOKI_URL` | Loki Push URL | http://loki:3100/loki/api/v1/push |

## 环境

Gatrix 支持多个环境。每个环境可以独立管理功能开关。

### 默认环境
- **development** - 开发环境
- **staging** - 预发布环境
- **production** - 生产环境

### 添加环境
可以从仪表板的 **Settings > Environments** 菜单添加新环境。

## 语言设置

仪表板和 API 响应支持多种语言：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DEFAULT_LANGUAGE` | 默认语言 | ko |
| `VITE_DEFAULT_LANGUAGE` | 前端默认语言 | ko |

支持的语言：
- `ko` - 韩语
- `en` - 英语
- `zh` - 简体中文

## 服务发现

游戏服务器集成的服务发现设置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SERVICE_DISCOVERY_MODE` | 发现模式 | etcd |
| `ETCD_HOSTS` | etcd 主机 | http://etcd:2379 |
| `SERVICE_DISCOVERY_HEARTBEAT_TTL` | 心跳 TTL | 30 |
