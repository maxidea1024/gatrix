# Gatrix - Easy Setup Guide

Get Gatrix up and running in just a few minutes!

## Prerequisites

Before you start, make sure you have the following installed:

- **Docker** and **Docker Compose**
- **Node.js** (v16 or higher)
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
./setup-env.sh example.com production
```

**For Production (Windows PowerShell):**
```powershell
.\setup-env.ps1 -HostAddress example.com -Environment production
```

The script will:
- Generate secure encryption keys automatically
- Configure database and Redis for Docker
- Set up default language (Korean)
- Create a backup if `.env` already exists
- Automatically select the correct docker-compose file based on environment

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
http://localhost:53000
```

**Production:**
```
https://example.com:53000
```
(Replace `example.com` with your actual domain)

## Default Credentials

- **Admin Email:** admin@gatrix.com
- **Admin Password:** admin123 (change this in production!)

## Next Steps

1. **Update OAuth Credentials** (Optional):
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

2. **View Logs**:

   **Development:**
   ```bash
   docker-compose -f docker-compose.dev.yml logs -f backend
   ```

   **Production:**
   ```bash
   docker-compose -f docker-compose.yml logs -f backend
   ```

3. **Stop Services**:

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

### Need Help?

Refer to the main [README.md](README.md) for more detailed information and advanced configuration options.

## Force Overwrite Configuration

If you need to regenerate the `.env` file:

**For Linux/Mac:**
```bash
./setup-env.sh localhost development --force
```

**For Windows (PowerShell):**
```powershell
.\setup-env.ps1 -HostAddress localhost -Environment development -Force
```

---

**Happy coding! 🚀**

