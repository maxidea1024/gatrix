# Gatrix - Easy Setup Guide

Get Gatrix up and running in just a few minutes!

## Prerequisites

Before you start, make sure you have the following installed:

- **Docker** and **Docker Compose**
- **Node.js** (v22 LTS or higher)
- **Yarn** (v1.22 or higher)

### Installing Docker

#### Ubuntu/Debian

```bash
# Update package manager
sudo apt-get update

# Install Docker
sudo apt-get install -y docker.io

# Install Docker Compose
sudo apt-get install -y docker-compose

# Add current user to docker group (optional, to run without sudo)
sudo usermod -aG docker $USER

# Apply group changes
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

#### Windows

1. **Download Docker Desktop for Windows:**
   - Visit https://www.docker.com/products/docker-desktop
   - Click "Download for Windows"

2. **Install Docker Desktop:**
   - Run the installer
   - Follow the installation wizard
   - Restart your computer when prompted

3. **Verify Installation:**
   - Open PowerShell and run:

   ```powershell
   docker --version
   docker-compose --version
   ```

4. **Enable WSL 2 (if not already enabled):**
   - Docker Desktop will prompt you to enable WSL 2
   - Follow the on-screen instructions
   - Restart Docker Desktop after enabling WSL 2

## Quick Start

### Choose Your Environment

**Development Environment** (for local development):

- Use `docker-compose.dev.yml`
- Includes hot-reload and debugging tools
- Suitable for development and testing

**Production Environment** (for deployment):

- Use `docker-compose.yml`
- Optimized for performance and security
- Suitable for production deployment

### Step 1: Generate Configuration File

Run the setup script to automatically generate the `.env` file with secure encryption keys.

> **Important:** The `HostAddress` must be a **domain name** or **IP address literal** only.
> **Do not include protocols (`http://`, `https://`) or port numbers.**

**For Development (Linux/Mac):**

```bash
./setup-env.sh localhost development
```

**For Development (Windows PowerShell):**

```powershell
.\setup-env.ps1 -HostAddress localhost -Environment development
```

**For Production (Linux/Mac):**

```bash
# English (default)
./setup-env.sh example.com production

# Chinese (for China deployment)
./setup-env.sh example.cn production zh
```

**For Production (Windows PowerShell):**

```powershell
# English (default)
.\setup-env.ps1 -HostAddress example.com -Environment production

# Chinese (for China deployment)
.\setup-env.ps1 -HostAddress example.cn -Environment production -DefaultLanguage zh
```

**With Custom Options:**

**Custom Admin Password (Linux/Mac):**

```bash
./setup-env.sh localhost development ko --admin-password "MySecurePassword123"
```

**Custom Admin Password (Windows PowerShell):**

```powershell
.\setup-env.ps1 -HostAddress localhost -Environment development -AdminPassword "MySecurePassword123"
```

**Custom Protocol (Linux/Mac):**

```bash
# Use HTTPS in development
./setup-env.sh localhost development ko --protocol https

# Use HTTP in production (for testing)
./setup-env.sh example.com production en --protocol http

# Chinese language for China deployment
./setup-env.sh example.cn production zh --protocol http
```

**Custom Protocol (Windows PowerShell):**

```powershell
# Use HTTPS in development
.\setup-env.ps1 -HostAddress localhost -Environment development -Protocol https

# Use HTTP in production (for testing)
.\setup-env.ps1 -HostAddress example.com -Environment production -Protocol http

# Chinese language for China deployment
.\setup-env.ps1 -HostAddress example.cn -Environment production -DefaultLanguage zh -Protocol http
```

**Custom Data Root (Linux/Mac):**

```bash
# Store all Docker volume data in /data/gatrix
./setup-env.sh example.com production en --data-root /data/gatrix

# Use custom path for development
./setup-env.sh localhost development ko --data-root ./my-data
```

**Custom Data Root (Windows PowerShell):**

```powershell
# Store all Docker volume data in /data/gatrix
.\setup-env.ps1 -HostAddress example.com -Environment production -DataRoot /data/gatrix

# Use custom path for development
.\setup-env.ps1 -HostAddress localhost -Environment development -DataRoot ./my-data
```

The script will:

- Generate secure encryption keys automatically
- Configure database and Redis for Docker
- Set up default language (Korean `ko`, English `en`, or Chinese `zh`)
- Set admin password (default: admin123, or custom if provided)
- Set protocol (default: http for development, https for production)
- Set data root path for Docker volumes (default: ./data for development, /data/gatrix for production)
- Create a backup if `.env` already exists
- Automatically select the correct docker-compose file based on environment

**Supported Languages:**

- `ko` - Korean (한국어) - Default for development
- `en` - English - Default for production
- `zh` - Chinese (中文) - For China deployment

### Step 2: Build Docker Environment

**For Development:**

```bash
docker-compose -f docker-compose.dev.yml build
```

**For Production:**

```bash
docker-compose -f docker-compose.yml build
```

### Step 3: Start Services

**For Development:**

```bash
docker-compose -f docker-compose.dev.yml up -d
```

**For Production:**

```bash
docker-compose -f docker-compose.yml up -d
```

Wait for all services to be ready (usually 30-60 seconds).

### Step 4: Verify Installation

**For Development:**

```bash
docker-compose -f docker-compose.dev.yml ps
```

**For Production:**

```bash
docker-compose -f docker-compose.yml ps
```

You should see all containers with status "Up".

### Step 5: Access the Application

Open your browser and navigate to:

**Development:**

```
http://localhost:43000
```

**Production (HTTPS - default):**

```
https://example.com
```

**Production (HTTP - if configured with --protocol http):**

```
http://example.com
```

(Replace `example.com` with your actual domain)

**Important:** In production, standard ports (HTTP: 80, HTTPS: 443) are used, so port numbers are not included in URLs. Your cloud load balancer forwards 443 → 43000.

## Default Credentials

- **Admin Email:** admin@gatrix.com
- **Admin Password:** admin123 (change this in production!)

## Next Steps

1. **Configure Cloud Load Balancer** (Production):

   In production, you need to configure your cloud load balancer to handle HTTPS and forward to internal ports.

   **Port Forwarding Setup:**

   ```
   External HTTPS 443 → Internal 43000 (Frontend + Bull Board)
   External HTTPS 443/grafana → Internal 44000 (Grafana)
   ```

   **Important:**
   - Only Grafana requires separate port (44000) forwarding
   - Bull Board uses the same port as Frontend (43000) - no separate forwarding needed

   **Tencent Cloud CLB Example:**
   - Listener: HTTPS:443 (with SSL certificate)
   - Forwarding Rule 1: URL = `/grafana*` → Backend Server: CVM:44000 (Grafana only)
   - Forwarding Rule 2: URL = `/*` → Backend Server: CVM:43000 (Frontend + Bull Board)
   - X-Forwarded-For: Enabled
   - Note: `/bull-board` path is handled by Rule 2 (no separate rule needed)

   **AWS Application Load Balancer Example:**
   - Listener: HTTPS:443 (with SSL certificate)
   - Rule 1: Path = `/grafana*` → Target Group: EC2:44000 (Grafana only)
   - Rule 2: Path = `/*` → Target Group: EC2:43000 (Frontend + Bull Board)
   - Note: `/bull-board` path is handled by Rule 2 (no separate rule needed)

   **Nginx Reverse Proxy Example:**

   ```nginx
   server {
       listen 443 ssl http2;
       server_name example.com;

       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;

       # Grafana (separate port forwarding)
       location /grafana/ {
           proxy_pass http://localhost:44000/;
           proxy_set_header X-Forwarded-Proto https;
       }

       # Frontend + Bull Board (same port)
       # /bull-board path is handled by Frontend Nginx
       location / {
           proxy_pass http://localhost:43000;
           proxy_set_header X-Forwarded-Proto https;
       }
   }
   ```

2. **Configure Grafana URL** (Development):
   - Edit `.env` file
   - Update `VITE_GRAFANA_URL` to match your Grafana server address
   - Development default: `http://localhost:44000`
   - Production: `https://example.com/grafana` (auto-configured)
   - Restart services:

   **Development:**

   ```bash
   docker-compose -f docker-compose.dev.yml restart frontend-dev
   ```

   **Production:**

   ```bash
   docker-compose -f docker-compose.yml restart frontend
   ```

3. **Configure Chat Server URL** (Optional):
   - Edit `.env` file
   - Update `VITE_CHAT_SERVER_URL` if your chat server is on a different domain
   - Update `VITE_CHAT_SERVER_PORT` if your chat server uses a non-standard port (default: 55100)
   - Restart services:

   **Development:**

   ```bash
   docker-compose -f docker-compose.dev.yml restart frontend-dev
   ```

   **Production:**

   ```bash
   docker-compose -f docker-compose.yml restart frontend
   ```

4. **Update OAuth Credentials** (Optional):
   - Edit `.env` file
   - Add your Google and GitHub OAuth credentials
   - Restart services:

   **Development:**

   ```bash
   docker-compose -f docker-compose.dev.yml restart
   ```

   **Production:**

   ```bash
   docker-compose -f docker-compose.yml restart
   ```

5. **View Logs**:

   **Development:**

   ```bash
   docker-compose -f docker-compose.dev.yml logs -f backend
   ```

   **Production:**

   ```bash
   docker-compose -f docker-compose.yml logs -f backend
   ```

6. **Stop Services**:

   **Development:**

   ```bash
   docker-compose -f docker-compose.dev.yml down
   ```

   **Production:**

   ```bash
   docker-compose -f docker-compose.yml down
   ```

## Troubleshooting

### Port Already in Use

If you get a "port already in use" error, either:

- Stop the service using that port
- Or modify the port in your docker-compose file:
  - Development: `docker-compose.dev.yml`
  - Production: `docker-compose.yml`

### Services Not Starting

Check the logs:

**Development:**

```bash
docker-compose -f docker-compose.dev.yml logs
```

**Production:**

```bash
docker-compose -f docker-compose.yml logs
```

### Docker Daemon Not Running

Make sure Docker is running:

**Linux:**

```bash
sudo systemctl start docker
```

**Windows:**

- Open Docker Desktop application
- Wait for it to fully start

### Grafana Dashboard iframe Embedding Issue

If you see the error: `Refused to display 'http://localhost:44000/' in a frame because it set 'X-Frame-Options' to 'deny'`

This occurs when Grafana's security settings prevent iframe embedding. To fix this:

1. **Update docker-compose.dev.yml** - Add these environment variables to the Grafana service:

   ```yaml
   environment:
     GF_SECURITY_ALLOW_EMBEDDING: 'true'
     GF_SECURITY_COOKIE_SAMESITE: 'Lax'
   ```

2. **Restart Docker containers:**

   ```bash
   docker-compose -f docker-compose.dev.yml down
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **Refresh your browser** and navigate to **Admin Panel > Monitoring > Grafana Dashboard**

The Grafana dashboard should now load successfully within the iframe.

### Need Help?

Refer to the main [README.md](README.md) for more detailed information and advanced configuration options.

## Jenkins Setup (CI/CD Pipeline)

For automated builds and deployments, you can set up Jenkins with the provided setup scripts.

### Prerequisites for Jenkins

- Jenkins server installed and running
- Git plugin installed in Jenkins
- Node.js 22 LTS installed on Jenkins agent/server
- Docker installed on Jenkins agent/server (for Docker builds)

### Using Jenkins Setup Scripts

The project includes Jenkins setup scripts in the `scripts/` directory:

**For Linux/Mac:**

```bash
./scripts/setup.sh
```

**For Windows PowerShell:**

```powershell
.\scripts\setup.ps1
```

These scripts will:

- Verify Node.js 22 LTS is installed
- Install required dependencies
- Configure environment variables
- Set up database connections
- Initialize the application

### Jenkins Pipeline Configuration

1. **Create a new Pipeline job in Jenkins**
2. **Configure Git repository:**
   - Repository URL: Your Git repository URL
   - Branch: `main` (or your default branch)

3. **Pipeline script:**

   ```groovy
   pipeline {
     agent any

     environment {
       // Set your production host address
       HOST_ADDRESS = 'example.com'
       ENVIRONMENT = 'production'
       PROTOCOL = 'http' // or 'https' for secure connection
       DEFAULT_LANGUAGE = 'en' // ko, en, or zh
       ADMIN_PASSWORD = credentials('gatrix-admin-password') // Store in Jenkins credentials
     }

     stages {
       stage('Generate Configuration') {
         steps {
           sh '''
             # Generate .env file with production settings
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

4. **Configure Jenkins Credentials:**
   - Go to Jenkins > Credentials > System > Global credentials
   - Add a new "Secret text" credential:
     - ID: `gatrix-admin-password`
     - Secret: Your admin password
     - Description: Gatrix Admin Password

5. **Configure webhooks** (optional):
   - Set up GitHub/GitLab webhooks to trigger builds automatically on push

### Important Notes for Jenkins

- **Environment Variables:** Configure these in the pipeline script:
  - `HOST_ADDRESS`: Your production domain (e.g., `example.com`)
  - `ENVIRONMENT`: `development` or `production`
  - `PROTOCOL`: `http` (default) or `https` (for secure connection)
  - `DEFAULT_LANGUAGE`: `ko`, `en`, or `zh`
  - `ADMIN_PASSWORD`: Stored in Jenkins credentials (see step 4)

- **Admin Password:** Store the admin password in Jenkins credentials for security
- **Force Flag:** The `--force` flag overwrites existing `.env` file on each build
- **NoBackup Flag:** The `--nobackup` flag prevents creating backup files in CI/CD environment

### Example Configurations

**Production with HTTP (default):**

```groovy
environment {
  HOST_ADDRESS = 'example.com'
  ENVIRONMENT = 'production'
  PROTOCOL = 'http'
  DEFAULT_LANGUAGE = 'en'
  ADMIN_PASSWORD = credentials('gatrix-admin-password')
}
```

**Production with HTTPS (secure):**

```groovy
environment {
  HOST_ADDRESS = 'example.com'
  ENVIRONMENT = 'production'
  PROTOCOL = 'https'
  DEFAULT_LANGUAGE = 'en'
  ADMIN_PASSWORD = credentials('gatrix-admin-password')
}
```

**Production for China (Chinese language):**

```groovy
environment {
  HOST_ADDRESS = 'example.cn'
  ENVIRONMENT = 'production'
  PROTOCOL = 'http'
  DEFAULT_LANGUAGE = 'zh'
  ADMIN_PASSWORD = credentials('gatrix-admin-password')
}
```

**Development (Korean):**

```groovy
environment {
  HOST_ADDRESS = 'dev.example.com'
  ENVIRONMENT = 'development'
  PROTOCOL = 'http'
  DEFAULT_LANGUAGE = 'ko'
  ADMIN_PASSWORD = credentials('gatrix-admin-password')
}
```

### Troubleshooting Jenkins Setup

- **Node.js not found:** Ensure Node.js 22 LTS is installed on the Jenkins agent
- **Permission denied:** Make sure scripts have execute permissions: `chmod +x setup-env.sh scripts/setup.sh`
- **Docker not available:** Install Docker on the Jenkins agent or use Docker-in-Docker
- **.env file issues:** Check Jenkins console output for setup-env.sh errors

## Force Overwrite Configuration

If you need to regenerate the `.env` file:

**For Development (Linux/Mac):**

```bash
./setup-env.sh localhost development --force
```

**For Development (Windows PowerShell):**

```powershell
.\setup-env.ps1 -HostAddress localhost -Environment development -Force
```

**For Production (Linux/Mac):**

```bash
./setup-env.sh example.com production --force
```

**For Production (Windows PowerShell):**

```powershell
.\setup-env.ps1 -HostAddress example.com -Environment production -Force
```

**With Custom Options:**

**Custom Admin Password (Linux/Mac):**

```bash
./setup-env.sh localhost development ko --admin-password "NewPassword123" --force
```

**Custom Admin Password (Windows PowerShell):**

```powershell
.\setup-env.ps1 -HostAddress localhost -Environment development -AdminPassword "NewPassword123" -Force
```

**Custom Protocol (Linux/Mac):**

```bash
# HTTPS with Korean
./setup-env.sh localhost development ko --protocol https --force

# HTTP with Chinese
./setup-env.sh example.cn production zh --protocol http --force
```

**Custom Protocol (Windows PowerShell):**

```powershell
# HTTPS with Korean
.\setup-env.ps1 -HostAddress localhost -Environment development -Protocol https -Force

# HTTP with Chinese
.\setup-env.ps1 -HostAddress example.cn -Environment production -DefaultLanguage zh -Protocol http -Force
```

This will:

- Backup the existing `.env` file (`.env.backup.TIMESTAMP`)
- Generate new encryption keys
- Set new admin password (if provided)
- Set protocol (if provided)
- Regenerate the configuration file

## Complete Reset (Start from Scratch)

If you need to completely reset the application and start fresh:

### Step 1: Stop and Remove All Containers

**For Development:**

```bash
docker-compose -f docker-compose.dev.yml down -v
```

**For Production:**

```bash
docker-compose -f docker-compose.yml down -v
```

The `-v` flag removes all volumes (databases, caches, etc.).

### Step 2: Remove Docker Images (Optional)

If you want to rebuild everything from scratch:

**For Development:**

```bash
docker-compose -f docker-compose.dev.yml down -v --rmi all
```

**For Production:**

```bash
docker-compose -f docker-compose.yml down -v --rmi all
```

### Step 3: Delete Configuration File

```bash
rm .env
```

Or backup it first:

```bash
mv .env .env.old
```

### Step 4: Start Fresh

Follow the **Quick Start** section from the beginning:

1. Generate new configuration:

   ```bash
   # Development (Korean)
   ./setup-env.sh localhost development

   # Production (English)
   ./setup-env.sh example.com production

   # Production (Chinese for China)
   ./setup-env.sh example.cn production zh
   ```

2. Build Docker environment:

   ```bash
   # Development
   docker-compose -f docker-compose.dev.yml build

   # Production
   docker-compose -f docker-compose.yml build
   ```

3. Start services:

   ```bash
   # Development
   docker-compose -f docker-compose.dev.yml up -d

   # Production
   docker-compose -f docker-compose.yml up -d
   ```

4. Verify installation:

   ```bash
   # Development
   docker-compose -f docker-compose.dev.yml ps

   # Production
   docker-compose -f docker-compose.yml ps
   ```

### What Gets Reset

- ✅ All Docker containers
- ✅ All volumes (databases, Redis cache)
- ✅ All Docker images (if using `--rmi all`)
- ✅ Configuration file (`.env`)

### What Doesn't Get Reset

- ❌ Source code files
- ❌ Backup files (`.env.backup.*`)
- ❌ Local git history

### Warning

**This is a destructive operation!** All data in the databases and caches will be permanently deleted. Make sure to backup any important data before proceeding.

---

**Happy coding! 🚀**
