# Gatrix - 简易安装指南

几分钟内启动并运行 Gatrix！

## 前置要求

开始之前，请确保已安装以下软件：

- **Docker** 和 **Docker Compose**
- **Node.js** (v22 LTS 或更高版本)
- **Yarn** (v1.22 或更高版本)

### 安装 Docker

#### Ubuntu/Debian

```bash
# 更新包管理器
sudo apt-get update

# 安装 Docker
sudo apt-get install -y docker.io

# 安装 Docker Compose
sudo apt-get install -y docker-compose

# 将当前用户添加到 docker 组（可选，无需 sudo 运行）
sudo usermod -aG docker $USER

# 应用组更改
newgrp docker

# 验证安装
docker --version
docker-compose --version
```

#### Windows

1. **下载 Windows 版 Docker Desktop：**
   - 访问 https://www.docker.com/products/docker-desktop
   - 点击 "Download for Windows"

2. **安装 Docker Desktop：**
   - 运行安装程序
   - 按照安装向导操作
   - 提示时重启计算机

3. **验证安装：**
   - 打开 PowerShell 并运行：
   ```powershell
   docker --version
   docker-compose --version
   ```

4. **启用 WSL 2（如果尚未启用）：**
   - Docker Desktop 会提示您启用 WSL 2
   - 按照屏幕上的说明操作
   - 启用 WSL 2 后重启 Docker Desktop

## 快速开始

### 选择您的环境

**开发环境**（用于本地开发）：
- 使用 `docker-compose.dev.yml`
- 包含热重载和调试工具
- 适合开发和测试

**生产环境**（用于部署）：
- 使用 `docker-compose.yml`
- 针对性能和安全性进行优化
- 适合生产部署

### 步骤 1：生成配置文件

运行设置脚本以自动生成包含安全加密密钥的 `.env` 文件。

**开发环境 (Linux/Mac)：**
```bash
./setup-env.sh localhost development
```

**开发环境 (Windows PowerShell)：**
```powershell
.\setup-env.ps1 -HostAddress localhost -Environment development
```

**生产环境 (Linux/Mac)：**
```bash
# 英语（默认）
./setup-env.sh example.com production

# 中文（中国部署）
./setup-env.sh example.cn production zh
```

**生产环境 (Windows PowerShell)：**
```powershell
# 英语（默认）
.\setup-env.ps1 -HostAddress example.com -Environment production

# 中文（中国部署）
.\setup-env.ps1 -HostAddress example.cn -Environment production -DefaultLanguage zh
```

**自定义选项：**

**自定义管理员密码 (Linux/Mac)：**
```bash
./setup-env.sh localhost development ko --admin-password "MySecurePassword123"
```

**自定义管理员密码 (Windows PowerShell)：**
```powershell
.\setup-env.ps1 -HostAddress localhost -Environment development -AdminPassword "MySecurePassword123"
```

**自定义协议 (Linux/Mac)：**
```bash
# 在开发环境中使用 HTTPS
./setup-env.sh localhost development ko --protocol https

# 在生产环境中使用 HTTP（用于测试）
./setup-env.sh example.com production en --protocol http

# 中国部署的中文设置
./setup-env.sh example.cn production zh --protocol http
```

**自定义协议 (Windows PowerShell)：**
```powershell
# 在开发环境中使用 HTTPS
.\setup-env.ps1 -HostAddress localhost -Environment development -Protocol https

# 在生产环境中使用 HTTP（用于测试）
.\setup-env.ps1 -HostAddress example.com -Environment production -Protocol http

# 中国部署的中文设置
.\setup-env.ps1 -HostAddress example.cn -Environment production -DefaultLanguage zh -Protocol http
```

**自定义数据根路径 (Linux/Mac)：**
```bash
# 将所有 Docker 卷数据存储在 /data/gatrix
./setup-env.sh example.com production en --data-root /data/gatrix

# 开发环境使用自定义路径
./setup-env.sh localhost development ko --data-root ./my-data
```

**自定义数据根路径 (Windows PowerShell)：**
```powershell
# 将所有 Docker 卷数据存储在 /data/gatrix
.\setup-env.ps1 -HostAddress example.com -Environment production -DataRoot /data/gatrix

# 开发环境使用自定义路径
.\setup-env.ps1 -HostAddress localhost -Environment development -DataRoot ./my-data
```

脚本将执行以下操作：
- 自动生成安全加密密钥
- 为 Docker 配置数据库和 Redis
- 设置默认语言（韩语 `ko`、英语 `en` 或中文 `zh`）
- 设置管理员密码（默认：admin123，或自定义）
- 设置协议（默认：开发环境为 http，生产环境为 https）
- 设置数据根路径（默认：开发环境为 ./data，生产环境为 /data/gatrix）
- 如果 `.env` 文件已存在则创建备份
- 根据环境自动选择正确的 docker-compose 文件

**支持的语言：**
- `ko` - 한국어（韩语）- 开发环境默认
- `en` - English（英语）- 生产环境默认
- `zh` - 中文 - 中国部署

### 步骤 2：构建 Docker 环境

**开发环境：**
```bash
docker-compose -f docker-compose.dev.yml build
```

**生产环境：**
```bash
docker-compose -f docker-compose.yml build
```

### 步骤 3：启动服务

**开发环境：**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

**生产环境：**
```bash
docker-compose -f docker-compose.yml up -d
```

等待所有服务准备就绪（通常需要 30-60 秒）。

### 步骤 4：验证安装

**开发环境：**
```bash
docker-compose -f docker-compose.dev.yml ps
```

**生产环境：**
```bash
docker-compose -f docker-compose.yml ps
```

您应该看到所有容器的状态为 "Up"。

### 步骤 5：访问应用程序

打开浏览器并导航至：

**开发环境：**
```
http://localhost:53000
```

**生产环境（HTTPS - 默认）：**
```
https://example.com
```

**生产环境（HTTP - 如果使用 --protocol http 配置）：**
```
http://example.com
```

（将 `example.com` 替换为您的实际域名）

**重要：** 在生产环境中，使用标准端口（HTTP: 80，HTTPS: 443），因此 URL 中不包含端口号。云负载均衡器将 443 转发到 53000。

## 默认凭据

- **管理员邮箱：** admin@gatrix.com
- **管理员密码：** admin123（生产环境中务必更改！）

## 后续步骤

1. **配置云负载均衡器**（生产环境）：

   在生产环境中，您需要配置云负载均衡器来处理 HTTPS 并转发到内部端口。

   **端口转发设置：**
   ```
   外部 HTTPS 443 → 内部 53000（前端 + Bull Board）
   外部 HTTPS 443/grafana → 内部 54000（Grafana）
   ```

   **重要：**
   - 仅 Grafana 需要单独的端口（54000）转发
   - Bull Board 使用与前端相同的端口（53000）- 无需单独转发

   **腾讯云 CLB 示例：**
   - 监听器：HTTPS:443（附加 SSL 证书）
   - 转发规则 1：URL = `/grafana*` → 后端服务器：CVM:54000（仅 Grafana）
   - 转发规则 2：URL = `/*` → 后端服务器：CVM:53000（前端 + Bull Board）
   - X-Forwarded-For：启用
   - 注意：`/bull-board` 路径由规则 2 处理（无需单独规则）

   **AWS Application Load Balancer 示例：**
   - 监听器：HTTPS:443（附加 SSL 证书）
   - 规则 1：路径 = `/grafana*` → 目标组：EC2:54000（仅 Grafana）
   - 规则 2：路径 = `/*` → 目标组：EC2:53000（前端 + Bull Board）
   - 注意：`/bull-board` 路径由规则 2 处理（无需单独规则）

   **Nginx 反向代理示例：**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name example.com;

       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;

       # Grafana（单独端口转发）
       location /grafana/ {
           proxy_pass http://localhost:54000/;
           proxy_set_header X-Forwarded-Proto https;
       }

       # 前端 + Bull Board（相同端口）
       # /bull-board 路径由前端 Nginx 处理
       location / {
           proxy_pass http://localhost:53000;
           proxy_set_header X-Forwarded-Proto https;
       }
   }
   ```

2. **配置 Grafana URL**（开发环境）：
   - 编辑 `.env` 文件
   - 更新 `VITE_GRAFANA_URL` 以匹配您的 Grafana 服务器地址
   - 开发环境默认值：`http://localhost:54000`
   - 生产环境：`https://example.com/grafana`（自动配置）
   - 重启服务：

   **开发环境：**
   ```bash
   docker-compose -f docker-compose.dev.yml restart frontend-dev
   ```

   **生产环境：**
   ```bash
   docker-compose -f docker-compose.yml restart frontend
   ```

3. **更新 OAuth 凭据**（可选）：
   - 编辑 `.env` 文件
   - 添加您的 Google 和 GitHub OAuth 凭据
   - 重启服务：

   **开发环境：**
   ```bash
   docker-compose -f docker-compose.dev.yml restart
   ```

   **生产环境：**
   ```bash
   docker-compose -f docker-compose.yml restart
   ```

4. **查看日志**：

   **开发环境：**
   ```bash
   docker-compose -f docker-compose.dev.yml logs -f backend
   ```

   **生产环境：**
   ```bash
   docker-compose -f docker-compose.yml logs -f backend
   ```

5. **停止服务**：

   **开发环境：**
   ```bash
   docker-compose -f docker-compose.dev.yml down
   ```

   **生产环境：**
   ```bash
   docker-compose -f docker-compose.yml down
   ```

## 故障排除

### 端口已被占用

如果遇到 "port already in use" 错误：
- 停止使用该端口的服务，或
- 在 docker-compose 文件中修改端口：
  - 开发环境：`docker-compose.dev.yml`
  - 生产环境：`docker-compose.yml`

### 服务无法启动

检查日志：

**开发环境：**
```bash
docker-compose -f docker-compose.dev.yml logs
```

**生产环境：**
```bash
docker-compose -f docker-compose.yml logs
```


### Docker 守护进程未运行

确保 Docker 正在运行：

**Linux：**
```bash
sudo systemctl start docker
```

**Windows：**
- 打开 Docker Desktop 应用程序
- 等待其完全启动

### Grafana 仪表板 iframe 嵌入问题

如果看到错误：`Refused to display 'http://localhost:54000/' in a frame because it set 'X-Frame-Options' to 'deny'`

这是因为 Grafana 的安全设置阻止了 iframe 嵌入。解决方法：

1. **更新 docker-compose.dev.yml** - 在 Grafana 服务中添加以下环境变量：
   ```yaml
   environment:
     GF_SECURITY_ALLOW_EMBEDDING: "true"
     GF_SECURITY_COOKIE_SAMESITE: "Lax"
   ```

2. **重启 Docker 容器：**
   ```bash
   docker-compose -f docker-compose.dev.yml down
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **刷新浏览器**并导航至**管理面板 > 监控 > Grafana 仪表板**

现在 Grafana 仪表板应该可以在 iframe 中正常加载。

### 需要帮助？

有关更详细的信息和高级配置选项，请参阅主 [README.md](README.md)。

## Jenkins 设置（CI/CD 管道）

对于自动化构建和部署，您可以使用提供的设置脚本配置 Jenkins。

### Jenkins 前置要求

- 已安装并运行 Jenkins 服务器
- Jenkins 中已安装 Git 插件
- Jenkins 代理/服务器上已安装 Node.js 22 LTS
- Jenkins 代理/服务器上已安装 Docker（用于 Docker 构建）

### 使用 Jenkins 设置脚本

项目的 `scripts/` 目录中包含 Jenkins 设置脚本：

**Linux/Mac：**
```bash
./scripts/setup.sh
```

**Windows PowerShell：**
```powershell
.\scripts\setup.ps1
```

这些脚本将：
- 验证已安装 Node.js 22 LTS
- 安装所需的依赖项
- 配置环境变量
- 设置数据库连接
- 初始化应用程序

### Jenkins 管道配置

1. **在 Jenkins 中创建新的 Pipeline 作业**
2. **配置 Git 仓库：**
   - Repository URL：您的 Git 仓库 URL
   - Branch：`main`（或您的默认分支）

3. **管道脚本：**
   ```groovy
   pipeline {
     agent any

     environment {
       // 设置生产主机地址
       HOST_ADDRESS = 'example.com'
       ENVIRONMENT = 'production'
       PROTOCOL = 'http' // 或 'https' 用于安全连接
       DEFAULT_LANGUAGE = 'en' // ko、en 或 zh
       ADMIN_PASSWORD = credentials('gatrix-admin-password') // 存储在 Jenkins 凭据中
     }

     stages {
       stage('Generate Configuration') {
         steps {
           sh '''
             # 使用生产设置生成 .env 文件
             ./setup-env.sh ${HOST_ADDRESS} ${ENVIRONMENT} ${DEFAULT_LANGUAGE} \
               --admin-password "${ADMIN_PASSWORD}" \
               --protocol ${PROTOCOL} \
               --force \
               --nobackup
           '''
         }
       }

       stage('Setup Dependencies') {
         steps {
           sh './scripts/setup.sh'
         }
       }

       stage('Build') {
         steps {
           sh 'yarn build'
         }
       }

       stage('Test') {
         steps {
           sh 'yarn test'
         }
       }

       stage('Deploy') {
         steps {
           sh 'docker-compose -f docker-compose.yml up -d --build'
         }
       }
     }

     post {
       success {
         echo 'Deployment successful!'
       }
       failure {
         echo 'Deployment failed!'
       }
     }
   }
   ```

4. **配置 Jenkins 凭据：**
   - 转到 Jenkins > Credentials > System > Global credentials
   - 添加新的 "Secret text" 凭据：
     - ID：`gatrix-admin-password`
     - Secret：您的管理员密码
     - Description：Gatrix Admin Password

5. **配置 webhook**（可选）：
   - 设置 GitHub/GitLab webhook 以在推送时自动触发构建


### Jenkins 重要说明

- **环境变量：** 在管道脚本中配置以下内容：
  - `HOST_ADDRESS`：您的生产域名（例如：`example.com`）
  - `ENVIRONMENT`：`development` 或 `production`
  - `PROTOCOL`：`http`（默认）或 `https`（用于安全连接）
  - `DEFAULT_LANGUAGE`：`ko`、`en` 或 `zh`
  - `ADMIN_PASSWORD`：存储在 Jenkins 凭据中（参见步骤 4）

- **管理员密码：** 为了安全起见，将管理员密码存储在 Jenkins 凭据中
- **Force 标志：** `--force` 标志会在每次构建时覆盖现有的 `.env` 文件
- **NoBackup 标志：** `--nobackup` 标志可防止在 CI/CD 环境中创建备份文件

### 配置示例

**生产环境 HTTP（默认）：**
```groovy
environment {
  HOST_ADDRESS = 'example.com'
  ENVIRONMENT = 'production'
  PROTOCOL = 'http'
  DEFAULT_LANGUAGE = 'en'
  ADMIN_PASSWORD = credentials('gatrix-admin-password')
}
```

**生产环境 HTTPS（安全）：**
```groovy
environment {
  HOST_ADDRESS = 'example.com'
  ENVIRONMENT = 'production'
  PROTOCOL = 'https'
  DEFAULT_LANGUAGE = 'en'
  ADMIN_PASSWORD = credentials('gatrix-admin-password')
}
```

**中国生产环境（中文）：**
```groovy
environment {
  HOST_ADDRESS = 'example.cn'
  ENVIRONMENT = 'production'
  PROTOCOL = 'http'
  DEFAULT_LANGUAGE = 'zh'
  ADMIN_PASSWORD = credentials('gatrix-admin-password')
}
```

**开发环境（韩语）：**
```groovy
environment {
  HOST_ADDRESS = 'dev.example.com'
  ENVIRONMENT = 'development'
  PROTOCOL = 'http'
  DEFAULT_LANGUAGE = 'ko'
  ADMIN_PASSWORD = credentials('gatrix-admin-password')
}
```

### Jenkins 设置故障排除

- **找不到 Node.js：** 确保 Jenkins 代理上已安装 Node.js 22 LTS
- **权限被拒绝：** 确保脚本具有执行权限：`chmod +x setup-env.sh scripts/setup.sh`
- **Docker 不可用：** 在 Jenkins 代理上安装 Docker 或使用 Docker-in-Docker
- **.env 文件问题：** 在 Jenkins 控制台输出中检查 setup-env.sh 错误

## 强制覆盖配置

如果需要重新生成 `.env` 文件：

**开发环境 (Linux/Mac)：**
```bash
./setup-env.sh localhost development --force
```

**开发环境 (Windows PowerShell)：**
```powershell
.\setup-env.ps1 -HostAddress localhost -Environment development -Force
```

**生产环境 (Linux/Mac)：**
```bash
./setup-env.sh example.com production --force
```

**生产环境 (Windows PowerShell)：**
```powershell
.\setup-env.ps1 -HostAddress example.com -Environment production -Force
```

**自定义选项：**

**自定义管理员密码 (Linux/Mac)：**
```bash
./setup-env.sh localhost development ko --admin-password "NewPassword123" --force
```

**自定义管理员密码 (Windows PowerShell)：**
```powershell
.\setup-env.ps1 -HostAddress localhost -Environment development -AdminPassword "NewPassword123" -Force
```

**自定义协议 (Linux/Mac)：**
```bash
# 韩语 HTTPS
./setup-env.sh localhost development ko --protocol https --force

# 中文 HTTP
./setup-env.sh example.cn production zh --protocol http --force
```

**自定义协议 (Windows PowerShell)：**
```powershell
# 韩语 HTTPS
.\setup-env.ps1 -HostAddress localhost -Environment development -Protocol https -Force

# 中文 HTTP
.\setup-env.ps1 -HostAddress example.cn -Environment production -DefaultLanguage zh -Protocol http -Force
```

这将：
- 备份现有的 `.env` 文件（`.env.backup.TIMESTAMP`）
- 生成新的加密密钥
- 设置新的管理员密码（如果提供）
- 设置协议（如果提供）
- 重新生成配置文件

## 完全重置（从头开始）

如果需要完全重置应用程序并重新开始：

### 步骤 1：停止并删除所有容器

**开发环境：**
```bash
docker-compose -f docker-compose.dev.yml down -v
```

**生产环境：**
```bash
docker-compose -f docker-compose.yml down -v
```

`-v` 标志会删除所有卷（数据库、缓存等）。

### 步骤 2：删除 Docker 镜像（可选）

如果要从头开始重建所有内容：

**开发环境：**
```bash
docker-compose -f docker-compose.dev.yml down -v --rmi all
```

**生产环境：**
```bash
docker-compose -f docker-compose.yml down -v --rmi all
```

### 步骤 3：删除配置文件

```bash
rm .env
```

或先备份：
```bash
mv .env .env.old
```

### 步骤 4：重新开始

从头开始按照**快速开始**部分操作：

1. 生成新配置：
   ```bash
   # 开发环境（韩语）
   ./setup-env.sh localhost development

   # 生产环境（英语）
   ./setup-env.sh example.com production

   # 生产环境（中国部署的中文）
   ./setup-env.sh example.cn production zh
   ```

2. 构建 Docker 环境：
   ```bash
   # 开发环境
   docker-compose -f docker-compose.dev.yml build

   # 生产环境
   docker-compose -f docker-compose.yml build
   ```

3. 启动服务：
   ```bash
   # 开发环境
   docker-compose -f docker-compose.dev.yml up -d

   # 生产环境
   docker-compose -f docker-compose.yml up -d
   ```

4. 验证安装：
   ```bash
   # 开发环境
   docker-compose -f docker-compose.dev.yml ps

   # 生产环境
   docker-compose -f docker-compose.yml ps
   ```

### 将被重置的内容

- ✅ 所有 Docker 容器
- ✅ 所有卷（数据库、Redis 缓存）
- ✅ 所有 Docker 镜像（如果使用 `--rmi all`）
- ✅ 配置文件（`.env`）

### 不会被重置的内容

- ❌ 源代码文件
- ❌ 备份文件（`.env.backup.*`）
- ❌ 本地 git 历史记录

### 警告

**这是一个破坏性操作！** 数据库和缓存中的所有数据将被永久删除。在继续之前，请确保备份任何重要数据。

---

**祝编码愉快！🚀**
